import { parsePhoneNumberFromString, CountryCode, PhoneNumber } from 'libphonenumber-js';

export interface PhoneValidation {
  isValid: boolean;
  e164: string;           // Canonical international format e.g. "+919876543210"
  nationalNumber: string; // Raw digits e.g. "9876543210"
  formatted: string;      // Formatted national number e.g. "98765 43210"
  countryCode: string;    // e.g. "+91"
  error?: string;
}

/**
 * Validates, normalizes, and formats phone numbers.
 * Defaults to Indian numbering plan ('IN', +91).
 */
export function validateAndFormatPhone(
  rawInput: string,
  defaultCountry: CountryCode = 'IN'
): PhoneValidation {
  if (!rawInput || !rawInput.trim()) {
    return {
      isValid: false,
      e164: '',
      nationalNumber: '',
      formatted: '',
      countryCode: '+91',
      error: 'Please enter your phone number',
    };
  }

  // Strip non-digit characters (keep leading + if typed)
  const cleaned = rawInput.replace(/[^\d+]/g, '');

  // Handle Indian trunk prefix: '09876543210' -> '9876543210'
  let normalized = cleaned;
  if (defaultCountry === 'IN' && normalized.startsWith('0') && normalized.length === 11) {
    normalized = normalized.substring(1);
  }

  // Prepend +91 if user didn't enter an international + prefix
  const fullNumber = normalized.startsWith('+') ? normalized : `+91${normalized}`;

  try {
    const parsed: PhoneNumber | undefined = parsePhoneNumberFromString(fullNumber, defaultCountry);

    if (!parsed || !parsed.isValid()) {
      // Provide actionable, specific feedback for Indian numbers
      if (defaultCountry === 'IN' && !normalized.startsWith('+')) {
        const digits = normalized.replace(/\D/g, '');
        if (digits.length === 0) {
          return {
            isValid: false,
            e164: '',
            nationalNumber: '',
            formatted: '',
            countryCode: '+91',
            error: 'Please enter your phone number',
          };
        }
        if (digits.length < 10) {
          return {
            isValid: false,
            e164: '',
            nationalNumber: digits,
            formatted: digits,
            countryCode: '+91',
            error: `Phone number must be 10 digits (currently ${digits.length})`,
          };
        }
        if (digits.length > 10) {
          return {
            isValid: false,
            e164: '',
            nationalNumber: digits,
            formatted: digits,
            countryCode: '+91',
            error: `Phone number is too long (${digits.length} digits, max 10)`,
          };
        }
        if (!/^[6-9]/.test(digits)) {
          return {
            isValid: false,
            e164: '',
            nationalNumber: digits,
            formatted: digits,
            countryCode: '+91',
            error: 'Indian mobile numbers must start with 6, 7, 8, or 9',
          };
        }
      }

      return {
        isValid: false,
        e164: '',
        nationalNumber: normalized,
        formatted: normalized,
        countryCode: '+91',
        error: 'Please enter a valid mobile number',
      };
    }

    // Format Indian national number as "98765 43210" for readability
    const nat = parsed.nationalNumber;
    const formattedNational =
      nat.length === 10 ? `${nat.slice(0, 5)} ${nat.slice(5)}` : parsed.formatNational();

    return {
      isValid: true,
      e164: parsed.number, // e.g. "+919876543210"
      nationalNumber: parsed.nationalNumber,
      formatted: formattedNational,
      countryCode: `+${parsed.countryCallingCode}`,
    };
  } catch {
    return {
      isValid: false,
      e164: '',
      nationalNumber: rawInput,
      formatted: rawInput,
      countryCode: '+91',
      error: 'Invalid phone number format',
    };
  }
}

/**
 * Masks a phone number for secure UI display and logs.
 * Example: "+919876543210" -> "+91 98****3210"
 */
export function maskPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '+91 98****3210';
  const clean = phone.replace(/\s+/g, '');
  if (clean.length >= 10) {
    const prefix = clean.slice(0, clean.startsWith('+') ? 5 : 4);
    const suffix = clean.slice(-4);
    return `${prefix} **** ${suffix}`;
  }
  return phone;
}
