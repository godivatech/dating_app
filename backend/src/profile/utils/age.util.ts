export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Normalizes any input date string (e.g. "2000-01-15" or ISO string) to a UTC calendar Date at 00:00:00.000Z.
 * This guarantees consistent timezone-independent calendar-date comparisons.
 */
export function normalizeCalendarDate(input: string | Date): Date {
  if (input instanceof Date) {
    return new Date(
      Date.UTC(
        input.getUTCFullYear(),
        input.getUTCMonth(),
        input.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
  }

  const trimmed = input.trim();
  // Check for YYYY-MM-DD format
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (dateMatch) {
    const year = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10) - 1; // 0-indexed
    const day = parseInt(dateMatch[3], 10);
    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  }

  const parsed = new Date(trimmed);
  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
}

/**
 * Calculates current age based on calendar-date semantics.
 * February 29 birthday convention: In non-leap reference years, the birthday occurs on March 1.
 */
export function calculateAge(
  dob: Date,
  referenceDate: Date = new Date(),
): number {
  const normDob = normalizeCalendarDate(dob);
  const normRef = normalizeCalendarDate(referenceDate);

  const birthYear = normDob.getUTCFullYear();
  const birthMonth = normDob.getUTCMonth(); // 0-indexed (1 = Feb)
  const birthDay = normDob.getUTCDate();

  const refYear = normRef.getUTCFullYear();
  const refMonth = normRef.getUTCMonth();
  const refDay = normRef.getUTCDate();

  let effectiveBirthMonth = birthMonth;
  let effectiveBirthDay = birthDay;

  // Leap-day convention: In non-leap reference years, Feb 29 birthday occurs on March 1
  if (birthMonth === 1 && birthDay === 29 && !isLeapYear(refYear)) {
    effectiveBirthMonth = 2; // March
    effectiveBirthDay = 1;
  }

  let age = refYear - birthYear;
  if (
    refMonth < effectiveBirthMonth ||
    (refMonth === effectiveBirthMonth && refDay < effectiveBirthDay)
  ) {
    age--;
  }

  return age;
}

export interface DobValidationResult {
  isValid: boolean;
  age: number;
  dateOfBirth?: Date;
  error?: string;
}

/**
 * Validates DOB eligibility:
 * 1. Must be a valid date.
 * 2. Cannot be in the future.
 * 3. User must be strictly >= 18 years old.
 * 4. Maximum reasonable age (<= 120).
 */
export function validateDobEligibility(
  dobInput: string | Date,
  referenceDate: Date = new Date(),
): DobValidationResult {
  try {
    const dob = normalizeCalendarDate(dobInput);
    if (isNaN(dob.getTime())) {
      return { isValid: false, age: 0, error: 'Invalid date of birth format.' };
    }

    const normRef = normalizeCalendarDate(referenceDate);

    if (dob.getTime() > normRef.getTime()) {
      return {
        isValid: false,
        age: 0,
        error: 'Date of birth cannot be in the future.',
      };
    }

    const age = calculateAge(dob, normRef);

    if (age < 18) {
      return {
        isValid: false,
        age,
        dateOfBirth: dob,
        error: 'You must be at least 18 years old to create a dating profile.',
      };
    }

    if (age > 120) {
      return {
        isValid: false,
        age,
        dateOfBirth: dob,
        error: 'Please enter a valid date of birth.',
      };
    }

    return {
      isValid: true,
      age,
      dateOfBirth: dob,
    };
  } catch {
    return { isValid: false, age: 0, error: 'Invalid date of birth.' };
  }
}
