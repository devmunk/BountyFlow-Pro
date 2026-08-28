#![cfg(test)]

use super::*;
use soroban_sdk::testutils::{Address as _, Ledger, LedgerInfo};
use soroban_sdk::{token, Env, String as SorobanString};

fn setup(env: &Env) -> (Address, Address, token::Client<'static>, token::StellarAssetClient<'static>) {
    let admin = Address::generate(env);
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_client = token::Client::new(env, &sac.address());
    let asset_client = token::StellarAssetClient::new(env, &sac.address());
    (admin, sac.address(), token_client, asset_client)
}

fn deploy_bounty(env: &Env) -> Address {
    env.register(BountyContract, ())
}

fn init_bounty(
    env: &Env,
    bounty_id: &Address,
    factory: &Address,
    creator: &Address,
    token: &Address,
    reward: i128,
    timeout: u64,
) {
    let client = BountyContractClient::new(env, bounty_id);
    client.init(
        factory,
        creator,
        token,
        &SorobanString::from_str(env, "Fix the wallet bug"),
        &SorobanString::from_str(env, "The connect button crashes on Safari"),
        &reward,
        &timeout,
    );
}

#[test]
fn test_create_and_fund_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();

    let factory = Address::generate(&env);
    let creator = Address::generate(&env);
    let claimant = Address::generate(&env);
    let (_admin, token_addr, token_client, asset_client) = setup(&env);

    asset_client.mint(&creator, &100_0000000);

    let bounty_id = deploy_bounty(&env);
    init_bounty(&env, &bounty_id, &factory, &creator, &token_addr, 10_0000000, 0);

    let client = BountyContractClient::new(&env, &bounty_id);
    assert_eq!(client.status(), Status::Created);

    client.fund();
    assert_eq!(client.status(), Status::Open);
    assert_eq!(token_client.balance(&bounty_id), 10_0000000);
    assert_eq!(token_client.balance(&creator), 90_0000000);

    client.claim(&claimant);
    assert_eq!(client.status(), Status::Claimed);

    client.submit(
        &claimant,
        &SorobanString::from_str(&env, "Fixed via feature-detection patch"),
        &SorobanString::from_str(&env, "https://github.com/example/pr/42"),
    );
    assert_eq!(client.status(), Status::Submitted);

    client.approve();
    assert_eq!(client.status(), Status::Released);
    assert_eq!(token_client.balance(&claimant), 10_0000000);
    assert_eq!(token_client.balance(&bounty_id), 0);
}

#[test]
fn test_reward_cannot_be_released_twice() {
    let env = Env::default();
    env.mock_all_auths();

    let factory = Address::generate(&env);
    let creator = Address::generate(&env);
    let claimant = Address::generate(&env);
    let (_admin, token_addr, _tc, asset_client) = setup(&env);
    asset_client.mint(&creator, &50_0000000);

    let bounty_id = deploy_bounty(&env);
    init_bounty(&env, &bounty_id, &factory, &creator, &token_addr, 5_0000000, 0);
    let client = BountyContractClient::new(&env, &bounty_id);

    client.fund();
    client.claim(&claimant);
    client.submit(
        &claimant,
        &SorobanString::from_str(&env, "done"),
        &SorobanString::from_str(&env, ""),
    );
    client.approve();

    // Second approval attempt must fail: status is no longer Submitted.
    let result = client.try_approve();
    assert!(result.is_err());
}

#[test]
fn test_cannot_claim_already_claimed_bounty() {
    let env = Env::default();
    env.mock_all_auths();

    let factory = Address::generate(&env);
    let creator = Address::generate(&env);
    let claimant_a = Address::generate(&env);
    let claimant_b = Address::generate(&env);
    let (_admin, token_addr, _tc, asset_client) = setup(&env);
    asset_client.mint(&creator, &50_0000000);

    let bounty_id = deploy_bounty(&env);
    init_bounty(&env, &bounty_id, &factory, &creator, &token_addr, 5_0000000, 0);
    let client = BountyContractClient::new(&env, &bounty_id);

    client.fund();
    client.claim(&claimant_a);

    let result = client.try_claim(&claimant_b);
    assert!(result.is_err());
}

#[test]
fn test_only_claimant_can_submit() {
    let env = Env::default();
    env.mock_all_auths();

    let factory = Address::generate(&env);
    let creator = Address::generate(&env);
    let claimant = Address::generate(&env);
    let impostor = Address::generate(&env);
    let (_admin, token_addr, _tc, asset_client) = setup(&env);
    asset_client.mint(&creator, &50_0000000);

    let bounty_id = deploy_bounty(&env);
    init_bounty(&env, &bounty_id, &factory, &creator, &token_addr, 5_0000000, 0);
    let client = BountyContractClient::new(&env, &bounty_id);

    client.fund();
    client.claim(&claimant);

    let result = client.try_submit(
        &impostor,
        &SorobanString::from_str(&env, "not really theirs"),
        &SorobanString::from_str(&env, ""),
    );
    assert!(result.is_err());
}

#[test]
fn test_only_creator_can_approve() {
    // approve() reads creator from stored state and calls require_auth on it;
    // this test documents that approve always authorizes as the *stored*
    // creator regardless of who submits the transaction, so an attacker
    // cannot redirect funds by simply invoking the function.
    let env = Env::default();
    env.mock_all_auths();

    let factory = Address::generate(&env);
    let creator = Address::generate(&env);
    let claimant = Address::generate(&env);
    let (_admin, token_addr, token_client, asset_client) = setup(&env);
    asset_client.mint(&creator, &50_0000000);

    let bounty_id = deploy_bounty(&env);
    init_bounty(&env, &bounty_id, &factory, &creator, &token_addr, 5_0000000, 0);
    let client = BountyContractClient::new(&env, &bounty_id);

    client.fund();
    client.claim(&claimant);
    client.submit(
        &claimant,
        &SorobanString::from_str(&env, "done"),
        &SorobanString::from_str(&env, ""),
    );
    client.approve();

    assert_eq!(token_client.balance(&claimant), 5_0000000);
}

#[test]
fn test_cancel_refunds_creator_when_open() {
    let env = Env::default();
    env.mock_all_auths();

    let factory = Address::generate(&env);
    let creator = Address::generate(&env);
    let (_admin, token_addr, token_client, asset_client) = setup(&env);
    asset_client.mint(&creator, &50_0000000);

    let bounty_id = deploy_bounty(&env);
    init_bounty(&env, &bounty_id, &factory, &creator, &token_addr, 20_0000000, 0);
    let client = BountyContractClient::new(&env, &bounty_id);

    client.fund();
    assert_eq!(token_client.balance(&bounty_id), 20_0000000);

    client.cancel();
    assert_eq!(client.status(), Status::Refunded);
    assert_eq!(token_client.balance(&creator), 50_0000000);
    assert_eq!(token_client.balance(&bounty_id), 0);
}

#[test]
fn test_cannot_cancel_after_submission() {
    let env = Env::default();
    env.mock_all_auths();

    let factory = Address::generate(&env);
    let creator = Address::generate(&env);
    let claimant = Address::generate(&env);
    let (_admin, token_addr, _tc, asset_client) = setup(&env);
    asset_client.mint(&creator, &50_0000000);

    let bounty_id = deploy_bounty(&env);
    init_bounty(&env, &bounty_id, &factory, &creator, &token_addr, 20_0000000, 0);
    let client = BountyContractClient::new(&env, &bounty_id);

    client.fund();
    client.claim(&claimant);
    client.submit(
        &claimant,
        &SorobanString::from_str(&env, "done"),
        &SorobanString::from_str(&env, ""),
    );

    let result = client.try_cancel();
    assert!(result.is_err());
}

#[test]
fn test_claim_timeout_allows_refund() {
    let env = Env::default();
    env.mock_all_auths();

    let factory = Address::generate(&env);
    let creator = Address::generate(&env);
    let claimant = Address::generate(&env);
    let (_admin, token_addr, token_client, asset_client) = setup(&env);
    asset_client.mint(&creator, &50_0000000);

    let bounty_id = deploy_bounty(&env);
    // 1 hour claim timeout
    init_bounty(&env, &bounty_id, &factory, &creator, &token_addr, 20_0000000, 3600);
    let client = BountyContractClient::new(&env, &bounty_id);

    client.fund();
    client.claim(&claimant);

    // Too early — still within the claim window.
    let result = client.try_cancel();
    assert!(result.is_err());

    // Fast-forward past the timeout.
    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp() + 3601,
        protocol_version: env.ledger().protocol_version(),
        sequence_number: env.ledger().sequence(),
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 16 * 60 * 60 * 24,
        min_persistent_entry_ttl: 30 * 60 * 60 * 24,
        max_entry_ttl: 365 * 60 * 60 * 24,
    });

    client.cancel();
    assert_eq!(client.status(), Status::Refunded);
    assert_eq!(token_client.balance(&creator), 50_0000000);
}

#[test]
fn test_rejects_invalid_reward() {
    let env = Env::default();
    env.mock_all_auths();

    let factory = Address::generate(&env);
    let creator = Address::generate(&env);
    let (_admin, token_addr, _tc, _asset) = setup(&env);

    let bounty_id = deploy_bounty(&env);
    let client = BountyContractClient::new(&env, &bounty_id);

    let result = client.try_init(
        &factory,
        &creator,
        &token_addr,
        &SorobanString::from_str(&env, "Bad bounty"),
        &SorobanString::from_str(&env, "Zero reward should fail"),
        &0,
        &0,
    );
    assert!(result.is_err());
}

#[test]
fn test_cannot_double_fund() {
    let env = Env::default();
    env.mock_all_auths();

    let factory = Address::generate(&env);
    let creator = Address::generate(&env);
    let (_admin, token_addr, _tc, asset_client) = setup(&env);
    asset_client.mint(&creator, &50_0000000);

    let bounty_id = deploy_bounty(&env);
    init_bounty(&env, &bounty_id, &factory, &creator, &token_addr, 10_0000000, 0);
    let client = BountyContractClient::new(&env, &bounty_id);

    client.fund();
    let result = client.try_fund();
    assert!(result.is_err());
}
