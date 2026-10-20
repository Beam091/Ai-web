import { describe, expect, it } from 'vitest';
import { hashPassword, sha256Hex, verifyPassword } from '../../worker/lib/crypto';

describe('password hashing', () => {
  it('round-trips a password and rejects the wrong one', async () => {
    const stored = await hashPassword('correct-horse-battery');
    expect(stored.startsWith('pbkdf2$100000$')).toBe(true);
    await expect(verifyPassword('correct-horse-battery', stored)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', stored)).resolves.toBe(false);
  });

  it('produces unique salts for the same password', async () => {
    const [a, b] = await Promise.all([hashPassword('same-password'), hashPassword('same-password')]);
    expect(a).not.toBe(b);
  });

  it('rejects malformed stored hashes instead of throwing', async () => {
    await expect(verifyPassword('x', 'not-a-hash')).resolves.toBe(false);
    await expect(verifyPassword('x', 'pbkdf2$1$bad$bad')).resolves.toBe(false);
  });
});

describe('sha256Hex', () => {
  it('matches a known digest', async () => {
    await expect(sha256Hex('abc')).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
