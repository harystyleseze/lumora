# Proposal: a feeless settlement rail (Nano / XNO) via an exact-scheme verifier

Lumora is an open-source x402 payment gateway on Stellar where a per-request USDC paywall
wraps any REST API. The verifier lives at `apps/router/src/x402/verify.ts` (USDC settlement
checked via Horizon/Soroban, then a SQLite dedup). It's the one slot a new settlement rail
drops into: a verifier that accepts a Nano (XNO) send block and reports `settled`.

Nano is a DAG with no gas and no fees — a send moves the exact amount and is final in ~0.5s.
So alongside USDC-on-Stellar, a buyer who wants a feeless rail gets one: the settlement is a
single integer moved fee-free, no gas to sponsor, no facilitator, no reconciliation (the
payee's balance rise equals the payer's balance drop by construction).

On-chain proof the mechanism is live:
  https://nanexplorer.com/nano/block/E67FB89426F46E6AE4E0E5750B5F814A699965B8639DA89F38689EA1AFE57FC3
  (a confirmed Nano send, settled with no fee)

Shape the existing `verify.ts` already picks: given a send block, read `link_as_account`
(= the seller's payTo) from the block, check `subtype == send`, check the amount equals the
challenged exact amount (no fee to reconcile), and report `settled` once — a Nano block is
cemented at publication, so it is final-by-publication and needs no separate settle step.
The exact-scheme Nano verifier is a library (`x402nano/exact`, `pursekeeper/x402-nano-exact`,
`feeless402`); a working 9/9-tested `verify` snippet is at
  https://gist.github.com/PANDeveloper001/62036122e9a1945593d09afcb9940ee3

This is a proposal for an additive rail, not a change to USDC-on-Stellar. Buyers on Stellar
keep working unchanged; buyers who want a feeless sub-cent rail have one. Happy to adjust the
framing.
