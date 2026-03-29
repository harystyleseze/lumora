.PHONY: build test deploy clean

build:
	stellar contract build

test:
	cargo test

clean:
	cargo clean

deploy:
	@echo "Set STELLAR_SECRET env var before deploying"
	stellar contract deploy \
		--wasm target/wasm32-unknown-unknown/release/spending_policy.wasm \
		--source admin \
		--network testnet
