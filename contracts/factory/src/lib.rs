//! BountyFlow Pro — Factory Contract
//!
//! Responsible for:
//!   1. Storing the installed WASM hash of the `bounty` contract.
//!   2. Deploying a brand-new `bounty` contract instance per bounty, using
//!      Soroban's native contract deployer (`env.deployer()`).
//!   3. Immediately performing a cross-contract call into that freshly
//!      deployed instance's `init` function to configure it.
//!   4. Maintaining an on-chain registry (id -> address, creator -> ids)
//!      so the frontend can discover bounties without an off-chain indexer.
//!
//! This deploy-then-call sequence is the project's primary demonstration of
//! genuine Soroban inter-contract communication: the factory does not just
//! store data about bounties, it provisions and configures independent
//! contract instances that subsequently manage their own escrowed XLM.

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error,
    Address, BytesN, Env, IntoVal, String, Symbol, Val, Vec,
};

#[contracttype]
pub enum DataKey {
    Admin,
    WasmHash,
    Token,
    NextId,
    BountyAddr(u64),
    AllIds,
    CreatorIds(Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAdmin = 3,
    InvalidReward = 4,
    UnknownBounty = 5,
}

#[contractevent]
pub struct FactoryInitialized {
    #[topic]
    pub admin: Address,
    pub token: Address,
}

#[contractevent]
pub struct BountyRegistered {
    #[topic]
    pub bounty_id: u64,
    pub bounty_address: Address,
    pub creator: Address,
}

#[contract]
pub struct FactoryContract;

#[contractimpl]
impl FactoryContract {
    /// One-time setup. `wasm_hash` must be the hash of the already-installed
    /// `bounty` contract WASM.
    pub fn init(env: Env, admin: Address, wasm_hash: BytesN<32>, token: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::WasmHash, &wasm_hash);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::NextId, &0u64);
        env.storage()
            .instance()
            .set(&DataKey::AllIds, &Vec::<u64>::new(&env));
        env.storage().instance().extend_ttl(500_000, 1_000_000);

        FactoryInitialized { admin, token }.publish(&env);
    }

    /// Allows the admin to point at a new bounty WASM hash after an upgrade.
    pub fn set_wasm_hash(env: Env, new_hash: BytesN<32>) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized));
        admin.require_auth();
        env.storage().instance().set(&DataKey::WasmHash, &new_hash);
    }

    /// Deploys a new `bounty` contract instance and initializes it via a
    /// cross-contract call.
    pub fn create_bounty(
        env: Env,
        creator: Address,
        title: String,
        description: String,
        reward: i128,
        claim_timeout_secs: u64,
    ) -> (u64, Address) {
        creator.require_auth();

        if reward <= 0 {
            panic_with_error!(&env, Error::InvalidReward);
        }

        let wasm_hash: BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::WasmHash)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized));
        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();

        let next_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextId)
            .unwrap_or(0);

        // A unique, deterministic salt per bounty id
        let salt = BytesN::from_array(&env, &Self::salt_from_id(next_id));

        // --- Inter-contract call #1: deploy a new contract instance -------
        let deployed_address = env
            .deployer()
            .with_current_contract(salt)
            .deploy_v2(wasm_hash, ());

        // --- Inter-contract call #2: configure the new instance ----------
        let factory_address = env.current_contract_address();
        let init_args: Vec<Val> = (
            factory_address,
            creator.clone(),
            token,
            title,
            description,
            reward,
            claim_timeout_secs,
        )
            .into_val(&env);

        let _: Val = env.invoke_contract(&deployed_address, &Symbol::new(&env, "init"), init_args);

        env.storage()
            .instance()
            .set(&DataKey::BountyAddr(next_id), &deployed_address);
        env.storage()
            .instance()
            .set(&DataKey::NextId, &(next_id + 1));

        let mut all_ids: Vec<u64> = env
            .storage()
            .instance()
            .get(&DataKey::AllIds)
            .unwrap_or_else(|| Vec::new(&env));
        all_ids.push_back(next_id);
        env.storage().instance().set(&DataKey::AllIds, &all_ids);

        let mut creator_ids: Vec<u64> = env
            .storage()
            .instance()
            .get(&DataKey::CreatorIds(creator.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        creator_ids.push_back(next_id);
        env.storage()
            .instance()
            .set(&DataKey::CreatorIds(creator.clone()), &creator_ids);

        env.storage().instance().extend_ttl(500_000, 1_000_000);

        BountyRegistered {
            bounty_id: next_id,
            bounty_address: deployed_address.clone(),
            creator,
        }
        .publish(&env);

        (next_id, deployed_address)
    }

    pub fn get_bounty_address(env: Env, bounty_id: u64) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::BountyAddr(bounty_id))
            .unwrap_or_else(|| panic_with_error!(&env, Error::UnknownBounty))
    }

    pub fn get_all_bounty_ids(env: Env) -> Vec<u64> {
        env.storage()
            .instance()
            .get(&DataKey::AllIds)
            .unwrap_or_else(|| Vec::new(&env))
    }

    pub fn get_bounties_by_creator(env: Env, creator: Address) -> Vec<u64> {
        env.storage()
            .instance()
            .get(&DataKey::CreatorIds(creator))
            .unwrap_or_else(|| Vec::new(&env))
    }

    pub fn get_token(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Token).unwrap()
    }

    fn salt_from_id(id: u64) -> [u8; 32] {
        let mut salt = [0u8; 32];
        salt[24..32].copy_from_slice(&id.to_be_bytes());
        salt
    }
}

#[cfg(test)]
mod test;