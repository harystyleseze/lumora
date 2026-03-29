import { StrKey } from '@stellar/stellar-sdk';

/**
 * Convert a USDC decimal string (e.g. "0.0500000") to stroops (bigint).
 * Uses string arithmetic to avoid floating-point precision loss.
 */
export function usdcToStroops(usdc: string): bigint {
  if (!usdc || usdc.trim() === '') throw new Error('Empty amount string');
  const trimmed = usdc.trim();
  const negative = trimmed.startsWith('-');
  const abs = negative ? trimmed.slice(1) : trimmed;
  const [whole = '0', decimals = ''] = abs.split('.');
  const paddedDecimals = decimals.padEnd(7, '0').slice(0, 7);
  const result = BigInt(whole) * 10_000_000n + BigInt(paddedDecimals);
  return negative ? -result : result;
}

/**
 * Convert stroops (bigint) to USDC decimal string with 7 decimal places.
 */
export function stroopsToUsdc(stroops: bigint | number | string): string {
  const n = BigInt(stroops);
  const negative = n < 0n;
  const abs = negative ? -n : n;
  const whole = abs / 10_000_000n;
  const remainder = abs % 10_000_000n;
  const result = `${whole}.${remainder.toString().padStart(7, '0')}`;
  return negative ? `-${result}` : result;
}

/**
 * Convert stroops bigint to a Stellar-formatted decimal string (7 places).
 * Used when submitting transactions via the Stellar SDK.
 */
export function stroopsToStellarAmount(stroops: string | bigint): string {
  return stroopsToUsdc(stroops);
}

export function isValidStellarAddress(address: string): boolean {
  try {
    return StrKey.isValidEd25519PublicKey(address);
  } catch {
    return false;
  }
}
