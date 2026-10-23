import * as crypto from 'crypto';

export class PinUtil {
  /**
   * Hashes a PIN using crypto.scryptSync with a cryptographically secure random salt.
   * Returns formatted string: `${salt}:${hash}`
   */
  static hashPin(pin: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(pin.trim(), salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Verifies a candidate PIN against a stored salt:hash string using constant-time comparison.
   */
  static verifyPin(pin: string, storedHash: string): boolean {
    if (!pin || !storedHash) return false;
    try {
      const parts = storedHash.split(':');
      if (parts.length !== 2) return false;
      const [salt, hash] = parts;
      const attemptHash = crypto.scryptSync(pin.trim(), salt, 64).toString('hex');
      return crypto.timingSafeEqual(
        Buffer.from(hash, 'hex'),
        Buffer.from(attemptHash, 'hex'),
      );
    } catch {
      return false;
    }
  }

  /**
   * Validates that the PIN format is numeric and exactly 4 to 6 digits long.
   */
  static isValidPinFormat(pin: string): boolean {
    if (!pin || typeof pin !== 'string') return false;
    const trimmed = pin.trim();
    return /^\d{4,6}$/.test(trimmed);
  }
}
