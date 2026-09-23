import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaymentChallenge } from '@lumora/types';
import { TimeoutError } from './http.js';

const ROUTER_WALLET = 'GROUTERWALLETPUBLICKEY0000000000000000000000000000000';
const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const OTHER_ADDRESS = 'GNOTALLOWEDADDRESS00000000000000000000000000000000000';
const AGENT_PUBLIC_KEY = 'GAGENTPUBLICKEY00000000000000000000000000000000000000';

function setBaseEnv(overrides: Record<string, string> = {}) {
  process.env['ROUTER_URL'] = 'http://localhost:3001';
  process.env['AGENT_WALLET_SECRET'] = 'SAGENTSECRETPLACEHOLDER';
  process.env['STELLAR_NETWORK'] = 'testnet';
  process.env['STELLAR_HORIZON_URL'] = 'https://horizon-testnet.stellar.org';
  process.env['USDC_ISSUER'] = USDC_ISSUER;
  process.env['ROUTER_WALLET_PUBLIC'] = ROUTER_WALLET;
  process.env['MAX_PAYMENT_USDC'] = '10';
  delete process.env['ALLOWED_PAY_TO'];
  delete process.env['SPENDING_POLICY_CONTRACT_ID'];
  for (const [key, value] of Object.entries(overrides)) {
    process.env[key] = value;
  }
}

function buildChallenge(overrides: Partial<PaymentChallenge['accepts'][0]> = {}): PaymentChallenge {
  return {
    x402Version: 1,
    requestId: 'req_test123456789',
    error: 'Payment required',
    accepts: [
      {
        scheme: 'exact',
        network: 'stellar',
        maxAmountRequired: '50000000', // 5 USDC
        resource: 'http://localhost:3001/services/demo',
        description: 'demo service',
        payTo: ROUTER_WALLET,
        maxTimeoutSeconds: 60,
        asset: 'USDC',
        extra: { issuer: USDC_ISSUER, name: 'USD Coin' },
        ...overrides,
      },
    ],
  };
}

function challengeResponse(challenge: PaymentChallenge) {
  return {
    status: 402,
    ok: false,
    json: async () => challenge,
    text: async () => JSON.stringify(challenge),
  } as unknown as Response;
}

function okResponse(body: unknown) {
  return {
    status: 200,
    ok: true,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const submitPayment = vi.fn();
const getPublicKey = vi.fn(() => AGENT_PUBLIC_KEY);

vi.mock('../stellar/wallet.js', () => ({
  submitPayment: (...args: unknown[]) => submitPayment(...args),
  getPublicKey: () => getPublicKey(),
}));

async function loadClient() {
  const mod = await import('./x402-client.js');
  return mod;
}

describe('callServiceWithPayment', () => {
  // Env is set once, identically, before the module (and its `config.ts` import) is
  // first loaded below — config is read at import time, so it must not change per test,
  // and modules are intentionally NOT reset so `instanceof` checks against classes
  // imported here stay valid across tests.
  beforeEach(() => {
    submitPayment.mockReset();
    getPublicKey.mockReset().mockReturnValue(AGENT_PUBLIC_KEY);
    submitPayment.mockResolvedValue('deadbeefcafefeed');
    setBaseEnv();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('attempts and submits a payment when the amount is within the configured cap', async () => {
    const challenge = buildChallenge({ maxAmountRequired: '50000000' }); // 5 USDC, cap is 10
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(challengeResponse(challenge))
      .mockResolvedValueOnce(okResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const { callServiceWithPayment } = await loadClient();
    const result = await callServiceWithPayment({ serviceId: 'demo', payload: { a: 1 } });

    expect(submitPayment).toHaveBeenCalledTimes(1);
    expect(submitPayment).toHaveBeenCalledWith(
      expect.objectContaining({ destination: ROUTER_WALLET, amountStroops: '50000000', usdcIssuer: USDC_ISSUER }),
    );
    expect(result.txHash).toBe('deadbeefcafefeed');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refuses payment that exceeds MAX_PAYMENT_USDC', async () => {
    const challenge = buildChallenge({ maxAmountRequired: '200000000' }); // 20 USDC, cap is 10
    const fetchMock = vi.fn().mockResolvedValueOnce(challengeResponse(challenge));
    vi.stubGlobal('fetch', fetchMock);

    const { callServiceWithPayment, PaymentRefusedError } = await loadClient();

    const err = await callServiceWithPayment({ serviceId: 'demo', payload: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(PaymentRefusedError);
    expect(err.reason).toBe('AMOUNT_EXCEEDS_CAP');
    expect(submitPayment).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refuses payment when the challenge network does not match', async () => {
    const challenge = buildChallenge({ network: 'ethereum' as unknown as 'stellar' });
    const fetchMock = vi.fn().mockResolvedValueOnce(challengeResponse(challenge));
    vi.stubGlobal('fetch', fetchMock);

    const { callServiceWithPayment, PaymentRefusedError } = await loadClient();

    const err = await callServiceWithPayment({ serviceId: 'demo', payload: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(PaymentRefusedError);
    expect(err.reason).toBe('NETWORK_MISMATCH');
    expect(submitPayment).not.toHaveBeenCalled();
  });

  it('refuses payment when the asset or issuer does not match', async () => {
    const challenge = buildChallenge({ extra: { issuer: 'GWRONGISSUER00000000000000000000000000000000000000000', name: 'USD Coin' } });
    const fetchMock = vi.fn().mockResolvedValueOnce(challengeResponse(challenge));
    vi.stubGlobal('fetch', fetchMock);

    const { callServiceWithPayment, PaymentRefusedError } = await loadClient();

    const err = await callServiceWithPayment({ serviceId: 'demo', payload: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(PaymentRefusedError);
    expect(err.reason).toBe('ASSET_MISMATCH');
    expect(submitPayment).not.toHaveBeenCalled();
  });

  it('refuses payment when payTo is not in the allowlist', async () => {
    const challenge = buildChallenge({ payTo: OTHER_ADDRESS });
    const fetchMock = vi.fn().mockResolvedValueOnce(challengeResponse(challenge));
    vi.stubGlobal('fetch', fetchMock);

    const { callServiceWithPayment, PaymentRefusedError } = await loadClient();

    const err = await callServiceWithPayment({ serviceId: 'demo', payload: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(PaymentRefusedError);
    expect(err.reason).toBe('PAY_TO_NOT_ALLOWED');
    expect(submitPayment).not.toHaveBeenCalled();
  });

  it('aborts and times out a hanging request', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
      return new Promise((_resolve, reject) => {
        opts.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { callServiceWithPayment } = await loadClient();
    const promise = callServiceWithPayment({ serviceId: 'demo', payload: {} });
    const assertion = expect(promise).rejects.toBeInstanceOf(TimeoutError);

    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(submitPayment).not.toHaveBeenCalled();
  });
});
