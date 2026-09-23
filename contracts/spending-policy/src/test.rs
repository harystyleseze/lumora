#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, String,
};

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

    // Cannot overspend — remaining is 9_500_000, so 9_500_001 exceeds it
    assert!(!client.is_within_limit(&agent, &9_500_001_i128));
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

#[test]
fn test_daily_limit_resets_on_rollover() {
    let env = Env::default();
    env.mock_all_auths();

    let agent = Address::generate(&env);
    let client = SpendingPolicyClient::new(&env, &env.register(SpendingPolicy, ()));

    // Start at a fixed timestamp within "day 0".
    let mut li = env.ledger().get();
    li.timestamp = 1_000;
    env.ledger().set(li);

    client.set_limit(&agent, &1_0000000_i128); // 1 USDC
    client.record_spend(&agent, &1_0000000_i128, &String::from_str(&env, "svc"));
    assert_eq!(client.get_daily_spent(&agent), 1_0000000_i128);
    assert!(!client.is_within_limit(&agent, &1_i128));

    // Advance the ledger timestamp past the next day boundary (86,400s/day).
    let mut li = env.ledger().get();
    li.timestamp = 1_000 + 86_400;
    env.ledger().set(li);

    // The spend counter resets for the new day.
    assert_eq!(client.get_daily_spent(&agent), 0);
    assert!(client.is_within_limit(&agent, &1_0000000_i128));

    // The full limit is spendable again on the new day.
    client.record_spend(&agent, &1_0000000_i128, &String::from_str(&env, "svc"));
    assert_eq!(client.get_daily_spent(&agent), 1_0000000_i128);
}

#[test]
fn test_exact_limit_boundary() {
    let env = Env::default();
    env.mock_all_auths();

    let agent = Address::generate(&env);
    let client = SpendingPolicyClient::new(&env, &env.register(SpendingPolicy, ()));

    client.set_limit(&agent, &500000_i128);

    // Spending exactly up to the limit is allowed.
    assert!(client.is_within_limit(&agent, &500000_i128));
    client.record_spend(&agent, &500000_i128, &String::from_str(&env, "svc"));
    assert_eq!(client.get_daily_spent(&agent), 500000_i128);
    assert_eq!(client.get_remaining(&agent), 0);

    // Any further spend, even by 1 stroop, would exceed the limit.
    assert!(!client.is_within_limit(&agent, &1_i128));
}

#[test]
#[should_panic(expected = "daily spending limit exceeded")]
fn test_exact_limit_boundary_overspend_by_one_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let agent = Address::generate(&env);
    let client = SpendingPolicyClient::new(&env, &env.register(SpendingPolicy, ()));

    client.set_limit(&agent, &500000_i128);
    client.record_spend(&agent, &500000_i128, &String::from_str(&env, "svc"));
    // One stroop over the limit must panic.
    client.record_spend(&agent, &1_i128, &String::from_str(&env, "svc"));
}

#[test]
fn test_limit_zero_is_unlimited() {
    let env = Env::default();
    env.mock_all_auths();

    let agent = Address::generate(&env);
    let client = SpendingPolicyClient::new(&env, &env.register(SpendingPolicy, ()));

    // No limit has ever been set for this agent — get_limit returns 0,
    // which per DataKey::Limit's contract means "unlimited".
    assert_eq!(client.get_limit(&agent), 0);
    assert_eq!(client.get_remaining(&agent), i128::MAX);
    assert!(client.is_within_limit(&agent, &999_999_9999999_i128));

    // Spends of arbitrary size succeed and never trip a limit check.
    client.record_spend(&agent, &999_999_9999999_i128, &String::from_str(&env, "svc"));
    assert_eq!(client.get_daily_spent(&agent), 999_999_9999999_i128);
    assert_eq!(client.get_remaining(&agent), i128::MAX);
}

#[test]
#[should_panic]
fn test_record_spend_requires_auth() {
    let env = Env::default();
    // Intentionally not calling env.mock_all_auths() — the agent never
    // authorizes this call.

    let agent = Address::generate(&env);
    let client = SpendingPolicyClient::new(&env, &env.register(SpendingPolicy, ()));

    // Without the agent's signature, record_spend must fail auth.
    client.record_spend(&agent, &1_i128, &String::from_str(&env, "svc"));
}

#[test]
fn test_get_remaining_after_several_spends() {
    let env = Env::default();
    env.mock_all_auths();

    let agent = Address::generate(&env);
    let client = SpendingPolicyClient::new(&env, &env.register(SpendingPolicy, ()));

    client.set_limit(&agent, &1_0000000_i128); // 1 USDC

    client.record_spend(&agent, &200000_i128, &String::from_str(&env, "svc-a"));
    assert_eq!(client.get_remaining(&agent), 9800000_i128);

    client.record_spend(&agent, &300000_i128, &String::from_str(&env, "svc-b"));
    assert_eq!(client.get_remaining(&agent), 9500000_i128);

    client.record_spend(&agent, &400000_i128, &String::from_str(&env, "svc-c"));
    assert_eq!(client.get_remaining(&agent), 9100000_i128);

    assert_eq!(client.get_daily_spent(&agent), 900000_i128);
}
