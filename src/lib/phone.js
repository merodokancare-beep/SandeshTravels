export const COUNTRY_CODES = [
  { code: '+91', flag: '🇮🇳', name: 'India (+91)' },
  { code: '+977', flag: '🇳🇵', name: 'Nepal (+977)' },
  { code: '+1', flag: '🇺🇸', name: 'USA/Canada (+1)' },
  { code: '+44', flag: '🇬🇧', name: 'UK (+44)' },
  { code: '+971', flag: '🇦🇪', name: 'UAE (+971)' },
  { code: '+61', flag: '🇦🇺', name: 'Australia (+61)' },
  { code: '+880', flag: '🇧🇩', name: 'Bangladesh (+880)' },
  { code: '+94', flag: '🇱🇰', name: 'Sri Lanka (+94)' },
  { code: '+65', flag: '🇸🇬', name: 'Singapore (+65)' },
  { code: '+49', flag: '🇩🇪', name: 'Germany (+49)' },
  { code: '+33', flag: '🇫🇷', name: 'France (+33)' },
  { code: '+81', flag: '🇯🇵', name: 'Japan (+81)' },
  { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia (+966)' },
  { code: '+60', flag: '🇲🇾', name: 'Malaysia (+60)' },
  { code: '+82', flag: '🇰🇷', name: 'South Korea (+82)' }
];

export function parsePhoneNumber(phoneStr) {
  if (!phoneStr) return { countryCode: '+91', localNumber: '' };
  
  let cleaned = String(phoneStr).trim();
  
  if (!cleaned.startsWith('+')) {
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
      cleaned = '+' + cleaned;
    } else if (cleaned.length === 13 && cleaned.startsWith('977')) {
      cleaned = '+' + cleaned;
    } else {
      return { countryCode: '+91', localNumber: cleaned.replace(/\D/g, '') };
    }
  }

  // Sort country codes by length descending so longer codes match first (+977 before +91)
  const sortedCodes = [...COUNTRY_CODES.map(c => c.code)].sort((a, b) => b.length - a.length);

  for (const code of sortedCodes) {
    if (cleaned.startsWith(code)) {
      const local = cleaned.substring(code.length).replace(/\D/g, '');
      return { countryCode: code, localNumber: local };
    }
  }
  
  return { countryCode: '+91', localNumber: cleaned.replace(/\D/g, '') };
}

export function formatFullPhoneNumber(countryCode, localNumber) {
  const digitsOnly = String(localNumber || '').replace(/\D/g, '');
  if (!digitsOnly) return '';
  const code = countryCode || '+91';
  return `${code} ${digitsOnly}`;
}
