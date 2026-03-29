#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

#[test]
fn test_set_and_get_limit() {
    let env = Env::default();
    env.mock_all_auths();

    let agent = Address::generate(&env);
    let client = SpendingPolicyClient::new(&env, &env.register(SpendingPolicy, ()));

    // No limit set — returns 0
    assert_eq!(client.get_limit(&agent), 0);

    // Set 10 USDC daily limit (10_0000000 stroops)
    client.set_limit(&agent, &10_0000000_i128);
    assert_eq!(client.get_limit(&agent), 10_0000000_i128);
}

#[test]
fn test_is_within_limit_no_limit() {
    let env = Env::default();
    env.mock_all_auths();

    let agent = Address::generate(&env);
    let client = SpendingPolicyClient::new(&env, &env.register(SpendingPolicy, ()));

    // No limit set — always within limit
    assert!(client.is_within_limit(&agent, &999_9999999_i128));
}

#[test]
fn test_record_spend_and_remaining() {
    let env = Env::default();
    env.mock_all_auths();

    let agent = Address::generate(&env);
    let client = SpendingPolicyClient::new(&env, &env.register(SpendingPolicy, ()));

    // Set 1 USDC limit
    client.set_limit(&agent, &1_0000000_i128);

    // Spend 0.05 USDC (pdf-extract-text price)
    client.record_spend(&agent, &500000_i128, &String::from_str(&env, "pdf-extract-text"));

    assert_eq!(client.get_daily_spent(&agent), 500000_i128);

    let remaining = client.get_remaining(&agent);
    assert_eq!(remaining, 9500000_i128); // 1 USDC - 0.05 USDC

    // Can still spend
    assert!(client.is_within_limit(&agent, &500000_i128));

    // Cannot overspend
    assert!(!client.is_within_limit(&agent, &9_5000001_i128));
}

#[test]
#[should_panic(expected = "daily spending limit exceeded")]
fn test_overspend_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let agent = Address::generate(&env);
    let client = SpendingPolicyClient::new(&env, &env.register(SpendingPolicy, ()));

    // Set 0.05 USDC limit
    client.set_limit(&agent, &500000_i128);

    // Spend 0.05 USDC — OK
    client.record_spend(&agent, &500000_i128, &String::from_str(&env, "pdf-extract-text"));

    // Spend another 0.05 USDC — should panic
    client.record_spend(&agent, &500000_i128, &String::from_str(&env, "pdf-extract-text"));
}
