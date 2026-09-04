// Text normalization + Darija/French tokenization helpers for the AI engine.

// Algerian Arabic digits are commonly written using Western (latin) digits,
// but some users type Eastern Arabic numerals. Normalize both.
const EASTERN_DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };

function normalizeDigit(c) {
  return EASTERN_DIGITS[c] || c;
}

function normalizeText(str) {
  if (!str) return '';
  return String(str)
    .split('')
    .map(normalizeDigit)
    .join('');
}

// Remove diacritics / normalize Arabic letters and French accents for matching.
function fold(str) {
  if (!str) return '';
  let s = String(str).toLowerCase();
  s = s.replace(/[\u064B-\u065F\u0670]/g, ''); // Arabic diacritics
  s = s.replace(/[أإآ]/g, 'ا');
  s = s.replace(/ة/g, 'ه');
  s = s.replace(/ى/g, 'ي');
  s = s.replace(/ؤ/g, 'و');
  s = s.replace(/ئ/g, 'ي');
  s = s.replace(/[àâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/îï/g, 'i')
    .replace(/ôö/g, 'o').replace(/ûü/g, 'u').replace(/ç/g, 'c');
  return s.trim();
}

function tokenize(str) {
  return fold(str).split(/[^a-z0-9ا-ي]+/).filter(Boolean);
}

module.exports = { normalizeText, fold, tokenize, EASTERN_DIGITS };
