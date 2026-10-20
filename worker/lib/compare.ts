import { sha256Hex, timingSafeEqual } from './crypto';

/** Constant-time string comparison (compares SHA-256 digests of equal length). */
export async function compareStringsSafely(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
  const encoder = new TextEncoder();
  return timingSafeEqual(encoder.encode(ha), encoder.encode(hb));
}
