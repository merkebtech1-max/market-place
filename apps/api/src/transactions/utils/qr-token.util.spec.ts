import { generateQrToken, hashQrToken } from './qr-token.util.js';

describe('qr-token.util', () => {
  describe('generateQrToken', () => {
    const secret = 'test-secret';

    it('returns a non-empty string', () => {
      const token = generateQrToken('reservation-1', secret);
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('is deterministic for the same reservationId and secret', () => {
      expect(generateQrToken('reservation-1', secret)).toBe(generateQrToken('reservation-1', secret));
    });

    it('produces different tokens for different reservationIds', () => {
      expect(generateQrToken('reservation-1', secret)).not.toBe(generateQrToken('reservation-2', secret));
    });

    it('produces different tokens for different secrets', () => {
      expect(generateQrToken('reservation-1', secret)).not.toBe(generateQrToken('reservation-1', 'other-secret'));
    });
  });

  describe('hashQrToken', () => {
    it('produces the same hash for the same token', () => {
      const token = generateQrToken('reservation-1', 'test-secret');
      expect(hashQrToken(token)).toBe(hashQrToken(token));
    });

    it('produces different hashes for different tokens', () => {
      expect(hashQrToken(generateQrToken('reservation-1', 's'))).not.toBe(hashQrToken(generateQrToken('reservation-2', 's')));
    });

    it('returns a non-empty string', () => {
      const hash = hashQrToken(generateQrToken('reservation-1', 'test-secret'));
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('does not modify the original token', () => {
      const token = generateQrToken('reservation-1', 'test-secret');
      const copy = token;
      hashQrToken(token);
      expect(token).toBe(copy);
    });
  });

  describe('integration-style check', () => {
    it('reproduces the stored hash from the same raw token', () => {
      const rawToken = generateQrToken('reservation-1', 'test-secret');
      const storedHash = hashQrToken(rawToken);

      // Later: seller scans QR, backend receives raw token again.
      expect(hashQrToken(rawToken)).toBe(storedHash);
    });
  });
});
