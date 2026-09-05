import {
  calculateAge,
  validateDobEligibility,
  normalizeCalendarDate,
  isLeapYear,
} from './age.util';

describe('Age & DOB Utilities', () => {
  describe('isLeapYear', () => {
    it('should correctly identify leap years', () => {
      expect(isLeapYear(2000)).toBe(true);
      expect(isLeapYear(2004)).toBe(true);
      expect(isLeapYear(2024)).toBe(true);
      expect(isLeapYear(2028)).toBe(true);

      expect(isLeapYear(1900)).toBe(false);
      expect(isLeapYear(2023)).toBe(false);
      expect(isLeapYear(2025)).toBe(false);
      expect(isLeapYear(2026)).toBe(false);
    });
  });

  describe('normalizeCalendarDate', () => {
    it('should normalize date string to UTC midnight', () => {
      const date = normalizeCalendarDate('2000-05-15');
      expect(date.getUTCFullYear()).toBe(2000);
      expect(date.getUTCMonth()).toBe(4); // 0-indexed May
      expect(date.getUTCDate()).toBe(15);
      expect(date.getUTCHours()).toBe(0);
      expect(date.getUTCMinutes()).toBe(0);
      expect(date.getUTCSeconds()).toBe(0);
    });
  });

  describe('calculateAge', () => {
    it('should return exact 18 when birthday is today', () => {
      const dob = new Date('2008-08-31T00:00:00.000Z');
      const refDate = new Date('2026-08-31T12:00:00.000Z');
      expect(calculateAge(dob, refDate)).toBe(18);
    });

    it('should return 17 when birthday is tomorrow', () => {
      const dob = new Date('2008-09-01T00:00:00.000Z');
      const refDate = new Date('2026-08-31T12:00:00.000Z');
      expect(calculateAge(dob, refDate)).toBe(17);
    });

    it('should return 18 when birthday was yesterday', () => {
      const dob = new Date('2008-08-30T00:00:00.000Z');
      const refDate = new Date('2026-08-31T12:00:00.000Z');
      expect(calculateAge(dob, refDate)).toBe(18);
    });

    describe('February 29 Leap-Day Birthday Convention', () => {
      const leapDob = new Date('2004-02-29T00:00:00.000Z');

      it('should NOT increment age on Feb 28 in a non-leap year', () => {
        // 2025 is not a leap year. On Feb 28, the person has not reached March 1.
        const refFeb28 = new Date('2025-02-28T00:00:00.000Z');
        expect(calculateAge(leapDob, refFeb28)).toBe(20);
      });

      it('should increment age on March 1 in a non-leap year', () => {
        // 2025 is not a leap year. On March 1, the person turns 21.
        const refMar01 = new Date('2025-03-01T00:00:00.000Z');
        expect(calculateAge(leapDob, refMar01)).toBe(21);
      });

      it('should increment age on February 29 in a leap year', () => {
        // 2024 is a leap year. On Feb 29, the person turns 20.
        const refLeapFeb29 = new Date('2024-02-29T00:00:00.000Z');
        expect(calculateAge(leapDob, refLeapFeb29)).toBe(20);
      });
    });
  });

  describe('validateDobEligibility', () => {
    const today = new Date('2026-08-31T00:00:00.000Z');

    it('should accept someone who turned 18 today', () => {
      const result = validateDobEligibility('2008-08-31', today);
      expect(result.isValid).toBe(true);
      expect(result.age).toBe(18);
    });

    it('should reject someone who turns 18 tomorrow', () => {
      const result = validateDobEligibility('2008-09-01', today);
      expect(result.isValid).toBe(false);
      expect(result.age).toBe(17);
      expect(result.error).toContain('at least 18 years old');
    });

    it('should reject future dates', () => {
      const result = validateDobEligibility('2028-01-01', today);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('future');
    });

    it('should reject unreasonable ages (> 120)', () => {
      const result = validateDobEligibility('1850-01-01', today);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('valid date of birth');
    });

    it('should reject invalid date strings', () => {
      const result = validateDobEligibility('invalid-date', today);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
