const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

function detectLanguage(text) {
  if (!text) return 'en';
  if (ARABIC_RANGE.test(text)) return 'ar';
  const lower = text.toLowerCase();
  const darijaWords = ['salam', 'slm', 'ahlan', 'labas', 'bghit', 'nchri', 'sh7al', 'kam', 'smiya', 'isma', 'wain', 'dar', '9albi', '3andek', '3andkum', 'glt', 'ghir', 'ch7al', 'ns7ab', 'batal', 'sir', 'cbon'];
  if (darijaWords.some(w => lower.includes(w))) return 'darija';
  const frWords = ['bonjour', 'bonsoir', 'salut', 'merci', 'oui', 'non', 'je', 'tu', 'nous', 'vous', 'le', 'la', 'les', 'de', 'du', 'des', 'et', 'est', 'sont', 'prix', 'commander', 'livraison', 'adresse', 'nom', 'téléphone', 'combien', 'disponible'];
  const enWords = ['hello', 'hi', 'hey', 'thank', 'yes', 'no', 'please', 'order', 'price', 'address', 'name', 'phone', 'how much', 'available', 'product', 'want'];
  const frScore = frWords.filter(w => lower.includes(w)).length;
  const enScore = enWords.filter(w => lower.includes(w)).length;
  if (frScore > enScore) return 'fr';
  if (enScore > frScore) return 'en';
  return 'fr';
}

function normalizeText(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { detectLanguage, normalizeText };
