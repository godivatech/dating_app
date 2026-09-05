export const SMS_SERVICE = 'SMS_SERVICE';

export interface ISmsService {
  /**
   * Dispatches an OTP verification code to the target phone number.
   * @param phoneNumber Normalized canonical E.164 phone number
   * @param otp 6-digit verification code
   */
  sendOtp(phoneNumber: string, otp: string): Promise<void>;
}
