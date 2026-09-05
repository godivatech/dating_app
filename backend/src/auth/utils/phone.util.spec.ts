import { PhoneUtil } from './phone.util';

describe('PhoneUtil', () => {
  describe('normalize', () => {
    it('should normalize standard 10-digit Indian mobile number to E.164 (+91)', () => {
      const result = PhoneUtil.normalize('9876543210');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+919876543210');
    });

    it('should normalize Indian mobile number with +91 prefix', () => {
      const result = PhoneUtil.normalize('+91 98765 43210');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+919876543210');
    });

    it('should normalize Indian mobile number with 0 prefix', () => {
      const result = PhoneUtil.normalize('09876543210');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+919876543210');
    });

    it('should normalize international numbers when given with country code', () => {
      const result = PhoneUtil.normalize('+14155552671');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('+14155552671');
    });

    it('should reject invalid or malformed numbers', () => {
      expect(PhoneUtil.normalize('12345').isValid).toBe(false);
      expect(PhoneUtil.normalize('abcdefghij').isValid).toBe(false);
      expect(PhoneUtil.normalize('').isValid).toBe(false);
      expect(PhoneUtil.normalize('   ').isValid).toBe(false);
      expect(PhoneUtil.normalize('9876543210123456').isValid).toBe(false);
    });
  });

  describe('mask', () => {
    it('should mask middle digits of normalized phone number', () => {
      const masked = PhoneUtil.mask('+919876543210');
      expect(masked).toBe('+9198****3210');
    });

    it('should handle short strings safely', () => {
      expect(PhoneUtil.mask('123')).toBe('123');
    });
  });
});
