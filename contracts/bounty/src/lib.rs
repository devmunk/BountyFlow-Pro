//! BountyFlow Pro — Bounty/Escrow Contract
//!
//! One instance of this contract represents exactly one bounty. Instances are
//! deployed by the `factory` contract (see `contracts/factory`), which is the
//! genuine inter-contract relationship in this project:
//!
//!   Factory.create_bounty()
//!       -> env.deployer().deploy(wasm_hash)          (deploys a new Bounty instance)
//!       -> CrossContract call: BountyClient::init(..) (initializes the new instance)
//!
//! This contract itself performs a second, independent inter-contract call:
//! every fund/release/refund moves real XLM by invoking the Stellar Asset
//! Contract (SAC) token interface (`soroban_sdk::token::Client`) for the
//! native asset. The bounty contract's own address is the escrow — the SAC
//! token balance of `env.current_contract_address()` IS the held reward.
//!
//! State machine (enforced on-chain, not in the frontend):
//!
//!   Created -> Funded(Open) -> Claimed -> Submitted -> Approved/Released
//!                  |              |
//!                  +--> Cancelled +--> Refunded (creator-only, rule-gated)
//!
//! All authorization is enforced with `require_auth`, all transitions are
//! guarded by explicit status checks, and the reward can never be released
//! or refunded more than once (status is flipped before token transfer using
//! checks-effects-interactions ordering).

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, token,
    Address, Env, String,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Status {
    /// Instance initialized by the factory, awaiting the creator's deposit.
    Created = 0,
    /// Reward is escrowed in this contract's own token balance. Claimable.
    Open = 1,
    /// A developer has claimed the bounty; work is in progress.
    Claimed = 2,
    /// The claimant submitted work for review.
    Submitted = 3,
    /// The creator approved the work. Reward has been released atomically.
    Released = 4,
    /// Creator cancelled before/after claim per the rules below. Escrow refunded.
    Refunded = 5,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Submission {
    pub description: String,
    pub link: String,
    pub submitted_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct BountyData {
    pub factory: Address,
    pub creator: Address,
    pub token: Address,
    pub title: String,
    pub description: String,
    pub reward: i128,
    /// Ledger seconds after `claimed_at` after which the creator may cancel
    /// an unsubmitted, claimed bounty and reclaim escrow. 0 = disabled.
    pub claim_timeout_secs: u64,
    pub status: Status,
    pub claimant: Option<Address>,
    pub submission_description: Option<String>,
    pub submission_link: Option<String>,
    pub submitted_at: u64,
    pub created_at: u64,
    pub funded_at: u64,
    pub claimed_at: u64,
}

#[contracttype]
pub enum DataKey {
    Bounty,
    Funded, // bool guard against double funding
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotCreator = 3,
    NotClaimant = 4,
    InvalidReward = 5,
    AlreadyFunded = 6,
    WrongStatus = 7,
    NotOpen = 8,
    NotClaimed = 9,
    NotSubmitted = 10,
    CannotCancelYet = 11,
    EmptyTitle = 12,
    EmptyDescription = 13,
    EmptySubmission = 14,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[contractevent]
pub struct BountyCreated {
    #[topic]
    pub bounty: Address,
    pub creator: Address,
    pub reward: i128,
}

#[contractevent]
pub struct BountyFunded {
    #[topic]
    pub bounty: Address,
    pub reward: i128,
}

#[contractevent]
pub struct BountyClaimed {
    #[topic]
    pub bounty: Address,
    pub claimant: Address,
}

#[contractevent]
pub struct WorkSubmitted {
    #[topic]
    pub bounty: Address,
    pub claimant: Address,
}

#[contractevent]
pub struct BountyApproved {
    #[topic]
    pub bounty: Address,
    pub approver: Address,
}

#[contractevent]
pub struct RewardReleased {
    #[topic]
    pub bounty: Address,
    pub to: Address,
    pub amount: i128,
}

#[contractevent]
pub struct BountyRefunded {
    #[topic]
    pub bounty: Address,
    pub to: Address,
    pub amount: i128,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct BountyContract;

#[contractimpl]
impl BountyContract {
    /// Called once by the factory immediately after deployment.
    /// Sets up bounty metadata in `Created` status. No funds move here.
    pub fn init(
        env: Env,
        factory: Address,
        creator: Address,
        token: Address,
        title: String,
        description: String,
        reward: i128,
        claim_timeout_secs: u64,
    ) {
        if env.storage().instance().has(&DataKey::Bounty) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        creator.require_auth();

        if reward <= 0 {
            panic_with_error!(&env, Error::InvalidReward);
        }
        if title.len() == 0 {
            panic_with_error!(&env, Error::EmptyTitle);
        }
        if description.len() == 0 {
            panic_with_error!(&env, Error::EmptyDescription);
        }

        let now = env.ledger().timestamp();
        let data = BountyData {
            factory,
            creator: creator.clone(),
            token,
            title,
            description,
            reward,
            claim_timeout_secs,
            status: Status::Created,
            claimant: None,
            submission_description: None,
            submission_link: None,
            submitted_at: 0,
            created_at: now,
            funded_at: 0,
            claimed_at: 0,
        };
        env.storage().instance().set(&DataKey::Bounty, &data);
        env.storage().instance().extend_ttl(500_000, 1_000_000);

        BountyCreated {
            bounty: env.current_contract_address(),
            creator,
            reward,
        }
        .publish(&env);
    }

    /// Creator deposits the reward into this contract's own token balance.
    /// This is a genuine inter-contract call into the SAC token contract.
    /// Transitions Created -> Open. Can only ever run once.
    pub fn fund(env: Env) {
        let mut data = Self::load(&env);
        data.creator.require_auth();

        if data.status != Status::Created {
            panic_with_error!(&env, Error::AlreadyFunded);
        }

        let token_client = token::Client::new(&env, &data.token);
        let contract_addr = env.current_contract_address();

        // Real XLM movement: creator -> escrow (this contract).
        token_client.transfer(&data.creator, &contract_addr, &data.reward);

        data.status = Status::Open;
        data.funded_at = env.ledger().timestamp();
        env.storage().instance().set(&DataKey::Bounty, &data);

        BountyFunded {
            bounty: contract_addr,
            reward: data.reward,
        }
        .publish(&env);
    }

    /// A developer claims an open bounty.
    pub fn claim(env: Env, claimant: Address) {
        let mut data = Self::load(&env);
        claimant.require_auth();

        if data.status != Status::Open {
            panic_with_error!(&env, Error::NotOpen);
        }

        data.claimant = Some(claimant.clone());
        data.status = Status::Claimed;
        data.claimed_at = env.ledger().timestamp();
        env.storage().instance().set(&DataKey::Bounty, &data);

        BountyClaimed {
            bounty: env.current_contract_address(),
            claimant,
        }
        .publish(&env);
    }

    /// The claimant submits completed work. Only the claimant may call this.
    pub fn submit(env: Env, claimant: Address, description: String, link: String) {
        let mut data = Self::load(&env);
        claimant.require_auth();

        if data.status != Status::Claimed {
            panic_with_error!(&env, Error::NotClaimed);
        }
        match &data.claimant {
            Some(c) if c == &claimant => {}
            _ => panic_with_error!(&env, Error::NotClaimant),
        }
        if description.len() == 0 {
            panic_with_error!(&env, Error::EmptySubmission);
        }

        data.submission_description = Some(description);
        data.submission_link = Some(link);
        data.submitted_at = env.ledger().timestamp();
        data.status = Status::Submitted;
        env.storage().instance().set(&DataKey::Bounty, &data);

        WorkSubmitted {
            bounty: env.current_contract_address(),
            claimant,
        }
        .publish(&env);
    }

    /// Creator approves submitted work. Reward is released atomically in the
    /// same call — there is no separate "release" step a creator could skip,
    /// which removes an entire class of stuck-escrow bugs.
    pub fn approve(env: Env) {
        let mut data = Self::load(&env);
        data.creator.require_auth();

        if data.status != Status::Submitted {
            panic_with_error!(&env, Error::NotSubmitted);
        }
        let claimant = match &data.claimant {
            Some(c) => c.clone(),
            None => panic_with_error!(&env, Error::NotClaimed),
        };

        // checks-effects-interactions: flip status BEFORE the token transfer
        // so the reward can never be released twice, even under re-entrancy.
        data.status = Status::Released;
        env.storage().instance().set(&DataKey::Bounty, &data);

        let token_client = token::Client::new(&env, &data.token);
        let contract_addr = env.current_contract_address();
        token_client.transfer(&contract_addr, &claimant, &data.reward);

        let approver = data.creator.clone();
        BountyApproved {
            bounty: contract_addr.clone(),
            approver,
        }
        .publish(&env);

        RewardReleased {
            bounty: contract_addr,
            to: claimant,
            amount: data.reward,
        }
        .publish(&env);
    }

    /// Creator cancels and reclaims escrowed funds. Allowed when:
    ///   - status is `Open` (unclaimed) at any time, or
    ///   - status is `Claimed` and `claim_timeout_secs` has elapsed since
    ///     the claim without a submission (protects creators from a
    ///     claimant who never delivers).
    /// Never allowed once work has been `Submitted` (that requires the
    /// creator to review and either approve or wait — funds are not at
    /// risk of double payment either way since only `approve` pays out).
    pub fn cancel(env: Env) {
        let mut data = Self::load(&env);
        data.creator.require_auth();

        let now = env.ledger().timestamp();
        let refundable = match data.status {
            Status::Created => true, // never funded, nothing to move on-chain but state closes cleanly
            Status::Open => true,
            Status::Claimed => {
                data.claim_timeout_secs > 0
                    && now >= data.claimed_at.saturating_add(data.claim_timeout_secs)
            }
            _ => false,
        };
        if !refundable {
            panic_with_error!(&env, Error::CannotCancelYet);
        }

        let was_funded = data.status != Status::Created;
        data.status = Status::Refunded;
        env.storage().instance().set(&DataKey::Bounty, &data);

        let contract_addr = env.current_contract_address();
        if was_funded {
            let token_client = token::Client::new(&env, &data.token);
            token_client.transfer(&contract_addr, &data.creator, &data.reward);
        }

        BountyRefunded {
            bounty: contract_addr,
            to: data.creator.clone(),
            amount: if was_funded { data.reward } else { 0 },
        }
        .publish(&env);
    }

    // -- Read-only views -----------------------------------------------

    pub fn get_bounty(env: Env) -> BountyData {
        Self::load(&env)
    }

    pub fn status(env: Env) -> Status {
        Self::load(&env).status
    }

    fn load(env: &Env) -> BountyData {
        env.storage()
            .instance()
            .get(&DataKey::Bounty)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }
}

#[cfg(test)]
mod test;
