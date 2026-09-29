/**
 * Indian WhatsApp Phone Number Utilities
 *
 * Rules:
 * 1. All WhatsApp numbers are Indian (+91 by default).
 * 2. Standard format: +91 XXXXX XXXXX (10-digit mobile).
 * 3. WhatsApp dispatch format: 91XXXXXXXXXX (12 digits, no leading plus or spaces).
 */

export const INDIA_COUNTRY_CODE = '+91';

/**
 * Extracts raw 10-digit Indian mobile number from various inputs
 * e.g., '+91 98220 12345' -> '9822012345'
 * e.g., '09822012345' -> '9822012345'
 * e.g., '919822012345' -> '9822012345'
 * e.g., '9822012345' -> '9822012345'
 */
export function extractIndianMobileDigits(input: string | undefined | null): string {
  if (!input) return '';
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) {
    return digits;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length > 10) {
    // Return last 10 digits as Indian mobile numbers are 10 digits
    return digits.slice(-10);
  }
  return digits;
}

/**
 * Formats a phone number cleanly as '+91 98220 12345'
 */
export function formatIndianPhoneNumber(input: string | undefined | null): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (!trimmed) return '';

  const mobile10 = extractIndianMobileDigits(trimmed);
  if (mobile10.length === 10) {
    return `+91 ${mobile10.slice(0, 5)} ${mobile10.slice(5)}`;
  }
  if (trimmed.startsWith('+91')) {
    return trimmed;
  }
  if (mobile10.length > 0) {
    return `+91 ${mobile10}`;
  }
  return trimmed;
}

/**
 * Normalizes for WhatsApp API / wa.me link: 91XXXXXXXXXX
 */
export function toWhatsAppDigits(input: string | undefined | null): string {
  if (!input) return '';
  const mobile10 = extractIndianMobileDigits(input);
  if (mobile10.length === 10) {
    return `91${mobile10}`;
  }
  const raw = input.replace(/\D/g, '');
  if (raw.length === 10) return `91${raw}`;
  if (raw.length === 12 && raw.startsWith('91')) return raw;
  return raw;
}

/**
 * Validates if the phone number is a valid 10-digit Indian mobile
 */
export function isValidIndianMobile(input: string | undefined | null): boolean {
  if (!input) return false;
  const mobile10 = extractIndianMobileDigits(input);
  // Indian mobile numbers start with 6, 7, 8, or 9 and are 10 digits long
  return mobile10.length === 10 && /^[6-9]\d{9}$/.test(mobile10);
}
