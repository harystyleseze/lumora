#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Persistent: agent address → daily limit in USDC stroops
    Limit(Address),
    /// Temporary: (agent address, day_number) → total spent today in stroops
    Spent(Address, u64),
}

/// Day number derived from ledger sequence.
/// Stellar mainnet produces ~17,280 ledgers/day (5s per ledger).
fn day_number(env: &Env) -> u64 {
    env.ledger().sequence() as u64 / 17_280
}

#[contract]
pub struct SpendingPolicy;

#[contractimpl]
impl SpendingPolicy {
    /// Set or update the daily spending limit for the calling agent.
    /// The agent must sign this transaction.
    pub fn set_limit(env: Env, agent: Address, daily_limit_stroops: i128) {
        agent.require_auth();
        assert!(daily_limit_stroops > 0, "limit must be positive");
        env.storage()
            .persistent()
            .set(&DataKey::Limit(agent), &daily_limit_stroops);
    }

    /// Get the daily spending limit for an agent (0 if not set = unlimited).
    pub fn get_limit(env: Env, agent: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Limit(agent))
            .unwrap_or(0)
    }

    /// Read-only check: returns true if the agent can spend `amount` more today.
    /// Always returns true if no limit is set.
    pub fn is_within_limit(env: Env, agent: Address, amount: i128) -> bool {
        let limit: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Limit(agent.clone()))
            .unwrap_or(0);

        if limit == 0 {
            return true; // no limit set
        }

        let day = day_number(&env);
        let spent: i128 = env
            .storage()
            .temporary()
            .get(&DataKey::Spent(agent, day))
            .unwrap_or(0);

        spent + amount <= limit
    }

    /// Record a spend. The agent must sign this transaction.
    /// Called after a successful service response.
    pub fn record_spend(env: Env, agent: Address, amount: i128, _service_id: String) {
        agent.require_auth();
        assert!(amount > 0, "amount must be positive");

        let day = day_number(&env);
        let key = DataKey::Spent(agent.clone(), day);

        let current: i128 = env.storage().temporary().get(&key).unwrap_or(0);
        let new_total = current + amount;

        // Check against limit if set
        let limit: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Limit(agent))
            .unwrap_or(0);

        if limit > 0 {
            assert!(new_total <= limit, "daily spending limit exceeded");
        }

        // Temporary storage: expires after ~1 day (17,280 ledgers)
        env.storage()
            .temporary()
            .set(&key, &new_total);
        env.storage()
            .temporary()
            .extend_ttl(&key, 17_280, 17_280);
    }

    /// Get total amount spent today by the agent (in USDC stroops).
    pub fn get_daily_spent(env: Env, agent: Address) -> i128 {
        let day = day_number(&env);
        env.storage()
            .temporary()
            .get(&DataKey::Spent(agent, day))
            .unwrap_or(0)
    }

    /// Get remaining budget for today. Returns i128::MAX if no limit is set.
    pub fn get_remaining(env: Env, agent: Address) -> i128 {
        let limit: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Limit(agent.clone()))
            .unwrap_or(0);

        if limit == 0 {
            return i128::MAX;
        }

        let day = day_number(&env);
        let spent: i128 = env
            .storage()
            .temporary()
            .get(&DataKey::Spent(agent, day))
            .unwrap_or(0);

        (limit - spent).max(0)
    }
}

mod test;
