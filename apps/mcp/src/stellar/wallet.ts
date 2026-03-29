import {
  Keypair,
  Networks,
  TransactionBuilder,
  Operation,
  Asset,
  Horizon,
  Memo,
} from '@stellar/stellar-sdk';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

let _keypair: Keypair | null = null;
let _server: Horizon.Server | null = null;

export function getKeypair(): Keypair {
  if (!_keypair) {
    _keypair = Keypair.fromSecret(config.AGENT_WALLET_SECRET);
  }
  return _keypair;
}

export function getHorizon(): Horizon.Server {
  if (!_server) {
    _server = new Horizon.Server(config.STELLAR_HORIZON_URL);
  }
  return _server;
}

export function getPublicKey(): string {
  return getKeypair().publicKey();
}

function getNetwork(): string {
  return config.STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
}

export interface PaymentParams {
  destination: string;
  amountStroops: string;
  asset: 'USDC' | 'XLM';
  usdcIssuer?: string;
  memo: string;
}

export async function submitPayment(params: PaymentParams): Promise<string> {
  const keypair = getKeypair();
  const server = getHorizon();
  const publicKey = keypair.publicKey();

  const account = await server.loadAccount(publicKey);

  const stellarAsset =
    params.asset === 'XLM'
      ? Asset.native()
      : new Asset('USDC', params.usdcIssuer ?? 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5');

  // Convert stroops to decimal amount
  const amount = (parseInt(params.amountStroops, 10) / 10_000_000).toFixed(7);

  const tx = new TransactionBuilder(account, {
    fee: '100000', // 0.01 XLM max fee
    networkPassphrase: getNetwork(),
  })
    .addOperation(
      Operation.payment({
        destination: params.destination,
        asset: stellarAsset,
        amount,
      }),
    )
    .addMemo(Memo.text(params.memo))
    .setTimeout(30)
    .build();

  tx.sign(keypair);

  const result = await server.submitTransaction(tx);
  logger.info({ hash: result.hash, memo: params.memo }, 'Payment submitted');
  return result.hash;
}

export async function getBalances(): Promise<{ usdc: string; xlm: string; address: string }> {
  const server = getHorizon();
  const publicKey = getPublicKey();

  try {
    const account = await server.loadAccount(publicKey);
    let xlm = '0';
    let usdc = '0';

    for (const balance of account.balances) {
      if (balance.asset_type === 'native') {
        xlm = balance.balance;
      } else if (
        balance.asset_type === 'credit_alphanum4' &&
        balance.asset_code === 'USDC'
      ) {
        usdc = balance.balance;
      }
    }

    return { usdc, xlm, address: publicKey };
  } catch {
    return { usdc: '0', xlm: '0', address: publicKey };
  }
}
