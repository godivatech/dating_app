import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

export interface PhoneValidationResult {
  isValid: boolean;
  normalized: string;
  error?: string;
}

export class PhoneUtil {
  /**
   * Normalizes an input phone number into canonical international E.164 format.
   * Default country code is 'IN' (India) if international prefix is omitted.
   */
  static normalize(
    input: string,
    defaultCountry: CountryCode = 'IN',
  ): PhoneValidationResult {
    if (!input || typeof input !== 'string') {
      return {
        isValid: false,
        normalized: '',
        error: 'Phone number is required and must be a string',
      };
    }

    const trimmed = input.trim();
    if (!trimmed) {
      return {
        isValid: false,
        normalized: '',
        error: 'Phone number cannot be empty',
      };
    }

    try {
      const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);

      if (!parsed || !parsed.isValid()) {
        return {
          isValid: false,
          normalized: '',
          error: 'Please provide a valid phone number',
        };
      }

      return {
        isValid: true,
        normalized: parsed.number, // Canonical E.164 format: e.g. +919876543210
      };
    } catch {
      return {
        isValid: false,
        normalized: '',
        error: 'Error parsing phone number',
      };
    }
  }

  /**
   * Masks a normalized phone number for safe logging and UI display.
   * Example: +919876543210 -> +91 98****3210
   */
  static mask(phone: string): string {
    if (!phone || phone.length < 8) return phone;
    const prefix = phone.slice(0, 5);
    const suffix = phone.slice(-4);
    return `${prefix}****${suffix}`;
  }
}
