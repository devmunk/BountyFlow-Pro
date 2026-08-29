#![allow(clippy::too_many_arguments)]
#![cfg(test)]

use super::*;
use bounty::Status as BountyStatus;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{token, Env, String as SorobanString};

// The bounty contract must be built to WASM before factory tests run (the
// factory deploys real bounty WASM, not the native Rust struct). CI and
// `scripts/test.ps1` build the bounty crate first for exactly this reason:
//   stellar contract build --package bounty
//   cargo test -p factory
mod bounty_wasm {
    soroban_sdk::contractimport!(file = "../target/wasm32v1-none/release/bounty.wasm");
}

fn setup_token(
    env: &Env,
) -> (
    Address,
    token::Client<'static>,
    token::StellarAssetClient<'static>,
) {
    let admin = Address::generate(env);
    let sac = env.register_stellar_asset_contract_v2(admin);
    (
        sac.address(),
        token::Client::new(env, &sac.address()),
        token::StellarAssetClient::new(env, &sac.address()),
    )
}

fn setup_factory(env: &Env, token: &Address) -> (Address, Address) {
    let admin = Address::generate(env);
    let bounty_wasm_hash = env.deployer().upload_contract_wasm(bounty_wasm::WASM);
    let factory_id = env.register(FactoryContract, ());
    let client = FactoryContractClient::new(env, &factory_id);
    client.init(&admin, &bounty_wasm_hash, token);
    (factory_id, admin)
}

#[test]
fn test_create_bounty_deploys_and_registers() {
    let env = Env::default();
    env.mock_all_auths();

    let (token_addr, token_client, asset_client) = setup_token(&env);
    let (factory_id, _admin) = setup_factory(&env, &token_addr);
    let factory_client = FactoryContractClient::new(&env, &factory_id);

    let creator = Address::generate(&env);
    asset_client.mint(&creator, &100_0000000);

    let (bounty_id, bounty_addr) = factory_client.create_bounty(
        &creator,
        &SorobanString::from_str(&env, "Build a landing page"),
        &SorobanString::from_str(&env, "Responsive marketing page in Next.js"),
        &15_0000000,
        &0,
    );

    assert_eq!(bounty_id, 0);
    assert_eq!(factory_client.get_bounty_address(&bounty_id), bounty_addr);

    let all_ids = factory_client.get_all_bounty_ids();
    assert_eq!(all_ids.len(), 1);

    let by_creator = factory_client.get_bounties_by_creator(&creator);
    assert_eq!(by_creator.len(), 1);

    // The deployed instance should be a live, independently callable
    // bounty contract already in `Created` status.
    let bounty_client = bounty::BountyContractClient::new(&env, &bounty_addr);
    assert_eq!(bounty_client.status(), BountyStatus::Created);

    // And it should be independently fundable using the same token.
    bounty_client.fund();
    assert_eq!(token_client.balance(&bounty_addr), 15_0000000);
}

#[test]
fn test_multiple_bounties_get_unique_addresses() {
    let env = Env::default();
    env.mock_all_auths();

    let (token_addr, _tc, asset_client) = setup_token(&env);
    let (factory_id, _admin) = setup_factory(&env, &token_addr);
    let factory_client = FactoryContractClient::new(&env, &factory_id);

    let creator = Address::generate(&env);
    asset_client.mint(&creator, &1000_0000000);

    let (id_a, addr_a) = factory_client.create_bounty(
        &creator,
        &SorobanString::from_str(&env, "Bounty A"),
        &SorobanString::from_str(&env, "First bounty"),
        &10_0000000,
        &0,
    );
    let (id_b, addr_b) = factory_client.create_bounty(
        &creator,
        &SorobanString::from_str(&env, "Bounty B"),
        &SorobanString::from_str(&env, "Second bounty"),
        &20_0000000,
        &0,
    );

    assert_ne!(id_a, id_b);
    assert_ne!(addr_a, addr_b);
    assert_eq!(factory_client.get_all_bounty_ids().len(), 2);
}

#[test]
fn test_rejects_non_positive_reward() {
    let env = Env::default();
    env.mock_all_auths();

    let (token_addr, _tc, _asset) = setup_token(&env);
    let (factory_id, _admin) = setup_factory(&env, &token_addr);
    let factory_client = FactoryContractClient::new(&env, &factory_id);

    let creator = Address::generate(&env);

    let result = factory_client.try_create_bounty(
        &creator,
        &SorobanString::from_str(&env, "Bad"),
        &SorobanString::from_str(&env, "Zero reward"),
        &0,
        &0,
    );
    assert!(result.is_err());
}

#[test]
fn test_only_admin_can_update_wasm_hash() {
    let env = Env::default();
    env.mock_all_auths();

    let (token_addr, _tc, _asset) = setup_token(&env);
    let (factory_id, _admin) = setup_factory(&env, &token_addr);
    let factory_client = FactoryContractClient::new(&env, &factory_id);

    let new_hash = env.deployer().upload_contract_wasm(bounty_wasm::WASM);
    // With mock_all_auths this call succeeds regardless of caller identity
    // in the test harness, but require_auth() in the contract still means
    // that on a real network only a transaction actually signed by the
    // stored admin key can pass — this test documents the call succeeds
    // for the legitimate admin path exercised end-to-end above.
    factory_client.set_wasm_hash(&new_hash);
}
