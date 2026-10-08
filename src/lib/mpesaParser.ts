/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * M-Pesa parsing and Kenyan phone validation utilities.
 */

export interface ParsedMpesaSMS {
  code: string | null;
  amount: number | null;
  phoneNumber: string | null;
  recipient: string | null;
  dateTime: string | null;
  isExtractedFromSMS: boolean;
  rawText: string;
}

/**
 * Kenyan Safaricom M-Pesa Code Regex (standard 10-char alphanumeric like SGH7A1B2C3, QA91KJ2819)
 */
export const MPESA_CODE_REGEX = /\b([A-Z0-9]{8,12})\b/i;

/**
 * Strict standalone M-Pesa Code Validator
 */
export function isValidMpesaCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  const clean = code.trim().toUpperCase();
  // Valid M-Pesa code is 8 to 12 alphanumeric chars, usually starting with 1-2 letters
  return /^[A-Z0-9]{8,12}$/.test(clean) && /[A-Z]/.test(clean) && /[0-9]/.test(clean);
}

/**
 * Normalizes Kenyan phone numbers to the standard 254XXXXXXXXX format for Daraja STK Push
 */
export function normalizeKenyanPhone(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.startsWith('07') || cleaned.startsWith('01')) {
    cleaned = '254' + cleaned.substring(1);
  } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
    if (cleaned.length === 9) {
      cleaned = '254' + cleaned;
    }
  }
  return cleaned;
}

/**
 * Validates whether a phone number is a valid Kenyan mobile number (Safaricom, Airtel, Telkom)
 * Supports:
 * - 07XXXXXXXX or 01XXXXXXXX (10 digits starting with 07 or 01)
 * - +2547XXXXXXXX or +2541XXXXXXXX (+254 followed by 9 digits)
 * - 2547XXXXXXXX or 2541XXXXXXXX (12 digits starting with 254)
 * - 7XXXXXXXX or 1XXXXXXXX (9 digits starting with 7 or 1)
 */
export function isValidKenyanPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  return /^(?:(?:\+?254)|0)?([17]\d{8})$/.test(cleaned);
}

/**
 * Smartly parse an M-Pesa SMS confirmation message or user input string
 * Extracts transaction code, amount, recipient, phone, and date.
 */
export function parseMpesaInput(input: string): ParsedMpesaSMS {
  const result: ParsedMpesaSMS = {
    code: null,
    amount: null,
    phoneNumber: null,
    recipient: null,
    dateTime: null,
    isExtractedFromSMS: false,
    rawText: input,
  };

  if (!input || typeof input !== 'string') return result;

  const text = input.trim();
  if (!text) return result;

  // Case 1: Pure single code entered directly
  const singleCodeMatch = text.match(/^[A-Z0-9]{8,12}$/i);
  if (singleCodeMatch && !text.includes(' ') && !text.includes('\n')) {
    result.code = singleCodeMatch[0].toUpperCase();
    return result;
  }

  // Case 2: Full or partial SMS paste
  // E.g. "SGH7XYZ123 Confirmed. Ksh1,500.00 sent to ROPENIX INVESTMENTS LTD 303030 on 05/10/26 at 8:30 PM..."
  // 1. Extract M-Pesa Code (typically first token or immediately before 'Confirmed')
  const confirmedMatch = text.match(/\b([A-Z0-9]{8,12})\s+Confirmed/i);
  if (confirmedMatch && confirmedMatch[1]) {
    result.code = confirmedMatch[1].toUpperCase();
    result.isExtractedFromSMS = true;
  } else {
    // Look for standalone 10-char token containing both letters and numbers
    const tokens = text.match(/\b([A-Z0-9]{8,12})\b/gi) || [];
    for (const token of tokens) {
      const upper = token.toUpperCase();
      // Exclude common words like "CONFIRMED", "PAYBILL", "BALANCE", "ACCOUNT", "ROPENIX"
      if (!['CONFIRMED', 'PAYBILL', 'BALANCE', 'ACCOUNT', 'ROPENIX', 'INVESTMENTS', 'TRANSACTION', 'SAFARICOM'].includes(upper)) {
        if (/[A-Z]/.test(upper) && /[0-9]/.test(upper)) {
          result.code = upper;
          result.isExtractedFromSMS = true;
          break;
        }
      }
    }
  }

  // 2. Extract Amount (e.g. "Ksh1,500.00" or "Ksh 1,500" or "KES 2,000")
  const amountMatch = text.match(/(?:Ksh|Kshs|KES|\$)\s*([\d,]+(?:\.\d{2})?)/i) ||
                      text.match(/amount\s+(?:of\s+)?(?:Ksh|KES)?\s*([\d,]+(?:\.\d{2})?)/i);
  if (amountMatch && amountMatch[1]) {
    const numericStr = amountMatch[1].replace(/,/g, '');
    const parsedAmount = parseFloat(numericStr);
    if (!isNaN(parsedAmount) && parsedAmount > 0) {
      result.amount = parsedAmount;
    }
  }

  // 3. Extract Phone number if present
  const phoneMatch = text.match(/(?:from|to|number|phone)\s*(?:\+?254|0)?([17]\d{8})\b/i);
  if (phoneMatch && phoneMatch[1]) {
    result.phoneNumber = '0' + phoneMatch[1];
  }

  // 4. Extract Date / Time if present
  const dateMatch = text.match(/on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
  if (dateMatch) {
    result.dateTime = `${dateMatch[1]} ${dateMatch[2]}`;
  }

  return result;
}
