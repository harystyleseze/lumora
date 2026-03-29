import { StrKey } from '@stellar/stellar-sdk';

export function usdcToStroops(usdc: string): bigint {
  const [whole, decimals = ''] = usdc.split('.');
  const paddedDecimals = decimals.padEnd(7, '0').slice(0, 7);
  return BigInt(whole!) * 10_000_000n + BigInt(paddedDecimals);
}

export function stroopsToUsdc(stroops: bigint | number | string): string {
  const n = BigInt(stroops);
  const whole = n / 10_000_000n;
  const remainder = n % 10_000_000n;
  return `${whole}.${remainder.toString().padStart(7, '0')}`;
}

export function isValidStellarAddress(address: string): boolean {
  try {
    return StrKey.isValidEd25519PublicKey(address);
  } catch {
    return false;
  }
}
