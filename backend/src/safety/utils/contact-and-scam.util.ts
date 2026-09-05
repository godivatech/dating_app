/**
 * Detection rules for Contact Information Sharing, Off-Platform Solicitation,
 * and Romance / UPI Payment Scams.
 */

export interface ContactOrScamViolation {
  category: 'CONTACT_INFO' | 'SCAM';
  patternName: string;
  matched: string;
  reason: string;
}

// Indian mobile phone numbers: E.164 (+91), national with 0, or standard 10 digits starting 6,7,8,9
const INDIAN_PHONE_REGEX =
  /(?:(?:\+91|0091|0)[\s.-]?)?[6-9]\d{4}[\s.-]?\d{5}\b/g;

// Spaced out 10-digit phone numbers: e.g. "9 8 7 6 5 4 3 2 1 0"
const SPACED_PHONE_REGEX =
  /(?:^|\D)(?:(?:\+?9\s*1|0)\s*)?[6-9](?:\s*\d){9}(?:\D|$)/g;

// Common Indian UPI VPA Handle extensions
const UPI_HANDLE_REGEX =
  /[\w.-]+@(okhdfcbank|okaxis|oksbi|okicici|paytm|ybl|apl|upi|axl|ibl|barodampay|airtel|postbank|jupiteraxis|kotak|allbank)\b/gi;

// Social Media Off-Platform Handles
const INSTAGRAM_HANDLE_REGEX =
  /(?:\b(?:ig|insta|instagram)\s*[:=-]?\s*@?([a-zA-Z0-9._]{3,30})|(?<!\w)@([a-zA-Z0-9._]{4,30}))\b/gi;

const SNAPCHAT_HANDLE_REGEX =
  /\b(?:snap|snapchat|sc)\s*[:=-]?\s*([a-zA-Z0-9._]{3,30})\b/gi;

const TELEGRAM_HANDLE_REGEX =
  /(?:t\.me\/[a-zA-Z0-9_]{5,32}|\b(?:telegram|tg)\s*[:=-]?\s*@?([a-zA-Z0-9_]{5,32}))\b/gi;

const WHATSAPP_LINK_REGEX =
  /(?:wa\.me\/\d+|api\.whatsapp\.com\/send\?phone=\d+)/gi;

// External URLs & Suspicious URL Shorteners
const URL_REGEX =
  /(?:https?:\/\/|www\.)[^\s/$.?#].[^\s]*/gi;

const SHORTENER_REGEX =
  /\b(?:bit\.ly|tinyurl\.com|t\.co|cutt\.ly|wa\.link|is\.gd|rb\.gy)\/[a-zA-Z0-9]+\b/gi;

// Financial / Advance Payment Scam Solicitation Phrases
const SCAM_SOLICITATION_PHRASES = [
  'send money',
  'transfer money',
  'send advance',
  'advance payment',
  'pay advance',
  'need financial help',
  'urgent money',
  'emergency hospital money',
  'google pay me',
  'phonepe me',
  'paytm me',
  'gpay me',
  'crypto investment',
  'binary options',
  'forex profit',
  'guaranteed return',
  'earn daily ₹',
  'earn 5000 daily',
];

/**
 * Scans text for contact information sharing (phone, social handles, links)
 * and financial / payment scam solicitations.
 */
export function detectContactAndScams(text: string): ContactOrScamViolation[] {
  const violations: ContactOrScamViolation[] = [];
  if (!text) return violations;

  const lowerText = text.toLowerCase();

  // 1. Indian Phone Numbers
  const phoneMatches = text.match(INDIAN_PHONE_REGEX);
  if (phoneMatches && phoneMatches.length > 0) {
    violations.push({
      category: 'CONTACT_INFO',
      patternName: 'PHONE_NUMBER',
      matched: phoneMatches[0].trim(),
      reason: 'Sharing personal phone numbers is prohibited for your privacy and safety.',
    });
  } else {
    // Check spaced phone numbers
    const spacedMatches = text.match(SPACED_PHONE_REGEX);
    if (spacedMatches && spacedMatches.length > 0) {
      violations.push({
        category: 'CONTACT_INFO',
        patternName: 'SPACED_PHONE_NUMBER',
        matched: spacedMatches[0].trim(),
        reason: 'Sharing personal phone numbers is prohibited for your privacy and safety.',
      });
    }
  }

  // 2. UPI Payment Handles
  const upiMatches = text.match(UPI_HANDLE_REGEX);
  if (upiMatches && upiMatches.length > 0) {
    violations.push({
      category: 'SCAM',
      patternName: 'UPI_HANDLE',
      matched: upiMatches[0].trim(),
      reason: 'Sharing UPI payment handles is strictly prohibited to prevent financial fraud.',
    });
  }

  // 3. WhatsApp Direct Links
  const waMatches = text.match(WHATSAPP_LINK_REGEX);
  if (waMatches && waMatches.length > 0) {
    violations.push({
      category: 'CONTACT_INFO',
      patternName: 'WHATSAPP_LINK',
      matched: waMatches[0].trim(),
      reason: 'External WhatsApp links are not permitted.',
    });
  }

  // 4. Snapchat Handles
  const snapMatches = text.match(SNAPCHAT_HANDLE_REGEX);
  if (snapMatches && snapMatches.length > 0) {
    violations.push({
      category: 'CONTACT_INFO',
      patternName: 'SNAPCHAT_HANDLE',
      matched: snapMatches[0].trim(),
      reason: 'Off-platform Snapchat handle sharing is restricted.',
    });
  }

  // 5. Telegram Handles / Links
  const tgMatches = text.match(TELEGRAM_HANDLE_REGEX);
  if (tgMatches && tgMatches.length > 0) {
    violations.push({
      category: 'CONTACT_INFO',
      patternName: 'TELEGRAM_HANDLE',
      matched: tgMatches[0].trim(),
      reason: 'Off-platform Telegram links are restricted.',
    });
  }

  // 6. Instagram Handles (e.g. "ig: username" or "insta: username")
  if (/\b(?:ig|insta|instagram)\s*[:=-]?\s*@?[a-zA-Z0-9._]{3,30}\b/i.test(text)) {
    const igMatch = text.match(/\b(?:ig|insta|instagram)\s*[:=-]?\s*@?[a-zA-Z0-9._]{3,30}\b/i);
    if (igMatch) {
      violations.push({
        category: 'CONTACT_INFO',
        patternName: 'INSTAGRAM_HANDLE',
        matched: igMatch[0].trim(),
        reason: 'Off-platform Instagram handle sharing is restricted in chat.',
      });
    }
  }

  // 7. URLs & Shorteners
  const shortenerMatches = text.match(SHORTENER_REGEX);
  if (shortenerMatches && shortenerMatches.length > 0) {
    violations.push({
      category: 'SCAM',
      patternName: 'URL_SHORTENER',
      matched: shortenerMatches[0].trim(),
      reason: 'External URL shorteners are prohibited to protect against phishing.',
    });
  } else {
    const urlMatches = text.match(URL_REGEX);
    if (urlMatches && urlMatches.length > 0) {
      violations.push({
        category: 'SCAM',
        patternName: 'EXTERNAL_URL',
        matched: urlMatches[0].trim(),
        reason: 'External links are not permitted in conversations.',
      });
    }
  }

  // 8. Financial Scam Solicitation Phrases
  for (const phrase of SCAM_SOLICITATION_PHRASES) {
    if (lowerText.includes(phrase)) {
      violations.push({
        category: 'SCAM',
        patternName: 'PAYMENT_SOLICITATION',
        matched: phrase,
        reason: 'Soliciting money or financial transfers violates our safety standards.',
      });
      break;
    }
  }

  return violations;
}
