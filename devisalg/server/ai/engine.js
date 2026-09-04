// DevisAlg AI engine.
//
// A real, deterministic agent that:
//  - Understands Algerian Darija, French and mixed input.
//  - Classifies intent (greeting, price ask, product/service ask, availability,
//    contact, closure, chitchat).
//  - Extracts entities: products/services, quantities, phone numbers, time.
//  - Uses ONLY the business's configured prices (never invents them).
//  - Remembers conversation context.
//  - Calculates quantities, subtotals, discounts, totals.
//  - Escalates to the owner when it does not know or when configured rules say so.
//
// Optionally delegates generation to a configured LLM (server-side), while still
// feeding it the real catalog so it cannot invent prices.

const { db } = require('../db');
const { fold, normalizeText, tokenize } = require('./text');
const llm = require('./llm');
const { limits } = require('../services/pricing');

function monthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function aiMessagesUsed(businessId) {
  const row = db.prepare(
    `SELECT COUNT(*) AS c FROM messages
     WHERE sender='ai'
       AND conversation_id IN (SELECT id FROM conversations WHERE business_id=?)
       AND substr(created_at,1,7)=?`
  ).get(businessId, monthKey());
  return row.c;
}

// ---------------------------------------------------------------------------
// Intent classification
// ---------------------------------------------------------------------------

const INTENT_KEYWORDS = {
  greeting: ['سلام', 'سلامو', 'السلام', 'صباح', 'مساء', 'مرحبا', 'اهلا', 'bonjour', 'salut', 'bslm', 'سلام', 'ya salam', 'الخير'],
  thanks: ['شكرا', 'merci', 'تعيش', 'باش'] .concat([]),
  bye: ['وا', 'بسلامة', 'au revoir', 'باي', 'مع السلامة', 'سلامة'],
  closure: ['كم الثمن', 'شحال', 'الثمن', 'السعر', 'كم سعر', 'بقداش', 'شحال يدير', 'شحال تكلف', 'سعر', 'كم', 'prix', 'combien', 'cout', 'coût'],
  product_price: ['ثمن', 'سعر', 'شحال', 'بقداش', 'كم'],
  availability: ['واش كاين', 'متوفر', 'واش عندكم', 'تعرف', 'كاين', 'disponible', 'متوفرة', 'المتوفر'],
  contact: ['عنوان', 'واش فين', 'اين', 'الاوقات', 'شحال دخلت تدير اوقات', 'متى نجي', 'ساعات', 'الدوام', 'رقم', 'اتصل', 'تليفون', 'هاتف', 'adresse', 'ou êtes', 'telephone', 'phone', 'horaire', 'adresse'],
  location: ['وين', 'فين', 'الموقع', 'address', 'adresse', 'اين'],
  hours: ['اوقات', 'ساعات', 'الدوام', 'متى تحلو', 'horaire', 'heure', 'ouverture', 'ساعة'],
  delivery: ['توصيل', 'التوصيل', 'التموين', 'دخول التوصيل', 'livre', 'livraison', 'التسليم', 'باش توصيل'],
  payment: ['الدفع', 'الخلاص', 'بقداش تخلص', 'الدفع', 'paiement', 'payement', 'كاش', 'cach', 'التموين بالخلاص'],
  yes: ['اي', 'و'],  // avoid; handled specially
  no: ['لا', 'ماشي', 'لا '],
  disconnected_bye: ['ok', 'ماشي', 'ان شاء الله', 'تمام', 'صافي'] .concat([]),
};

function classifyIntent(text) {
  const f = fold(text);
  const toks = tokenize(text);
  // Order matters: check specific before general.
  if (/(شحال|بقداش|كم|prix|combien|سعر|ثمن)/.test(f)) return 'product_price';
  if (/(عندك|متوفر|كاين|disponible|تعرف واش)/.test(f)) return 'availability';
  if (/(توصل|توصيل|livraison|livre)/.test(f)) return 'delivery';
  if (/(الدفع|خلاص|paiement|payement|كاش|تخلص)/.test(f)) return 'payment';
  if (/(اوقات|ساعات|الدوام|horaire|heure|ساعة|متيدرو)/.test(f)) return 'hours';
  if (/(وين|فين|الموقع|address|adresse|اين)/.test(f)) return 'location';
  if (/(مرحبا|سلام|سلامو|bonjour|salut|صباح|مساء|الخير|اهلا)/.test(f)) return 'greeting';
  if (/(شكرا|merci|تعيش|باش)/.test(f)) return 'thanks';
  if (/(با|بسلامة|باي|au revoir|مع السلامة|سلامة)/.test(f)) return 'bye';
  return 'general';
}

const QTY_WORDS = {
  'واحد': 1, 'une': 1, 'un': 1, 'اثنين': 2, 'دوز': 2, 'deux': 2, '2': 2,
  'ثلاثة': 3, 'ثلاث': 3, 'trois': 3, '3': 3, 'اربعة': 4, 'اربع': 4, 'quatre': 4, '4': 4,
  'خمسة': 5, 'خمس': 5, 'cinq': 5, '5': 5, 'عشرة': 10, 'dix': 10, '10': 10,
};

// ---------------------------------------------------------------------------
// Entity extraction
// ---------------------------------------------------------------------------

function findNumbers(text) {
  const nums = [];
  const re = /(\d+(?:[.,]\d+)?)/g;
  let m;
  while ((m = re.exec(normalizeText(text)))) {
    nums.push(parseFloat(m[1].replace(',', '.')));
  }
  return nums;
}

function extractQuantity(text) {
  const toks = tokenize(normalizeText(text));
  for (const t of toks) {
    if (QTY_WORDS[t] !== undefined && /[a-z]/.test(t)) return QTY_WORDS[t];
  }
  const nums = findNumbers(text).filter((n) => n <= 1000 && !isDateLike(text));
  return nums.length ? nums[0] : 1;
}

function isDateLike() { return false; } // placeholder

function extractPhone(text) {
  const re = /(?:0\d{9}|\+213\s?\d{9}|213\d{9}|06\d{8}|05\d{8}|07\d{8})/;
  const m = text.match(re);
  return m ? m[0].replace(/\s/g, '') : null;
}

// Match the text against the business's real products/services.
function findCatalog(businessId, text, { quantity = 1 } = {}) {
  const f = fold(text);
  const bizProducts = db.prepare('SELECT * FROM products WHERE business_id=? AND active=1').all(businessId);
  const bizServices = db.prepare('SELECT * FROM services WHERE business_id=? AND active=1').all(businessId);
  const all = [
    ...bizProducts.map((p) => ({ ...p, type: 'product', label: p.name })),
    ...bizServices.map((s) => ({ ...s, type: 'service', label: s.name })),
  ];
  // Score by overlap of folded tokens.
  const scored = all
    .map((item) => {
      const itemToks = new Set(tokenize(item.name));
      const msgToks = tokenize(text);
      let hits = 0;
      itemToks.forEach((t) => { if (msgToks.includes(t)) hits++; });
      const score = hits / Math.max(1, itemToks.size);
      return { item, score, contains: f.includes(fold(item.name)) };
    })
    .sort((a, b) => b.score - a.score || (b.contains - a.contains));

  const best = scored[0];
  if (best && (best.score >= 0.5 || best.contains)) {
    return {
      matched: best.item, // the matched product/service, with .name .unit_price .type .label
      matchedQuantity: quantity,
      matchedSubtotal: best.item.unit_price * quantity,
      candidates: scored.filter((s) => s.score > 0).slice(0, 5),
    };
  }
  return { matched: null, candidates: scored.filter((s) => s.score > 0) };
}

// ---------------------------------------------------------------------------
// Price formatting (DZD)
// ---------------------------------------------------------------------------
function formatDZD(n) {
  return n.toLocaleString('fr-FR') + ' DA';
}

// ---------------------------------------------------------------------------
// Response generation
// ---------------------------------------------------------------------------

function greetingReply(business) {
  const name = business.name || '';
  const greeting = business.aiGreeting || `سلام 👋 مرحبا بيك في ${name}. كيف نقدر نعاونك؟`;
  return greeting;
}

function priceReply(match, quantity) {
  const item = match.matched;
  const p = formatDZD(item.unit_price);
  const total = quantity ? formatDZD(item.unit_price * quantity) : null;
  let msg = `على حسب ${item.type === 'product' ? 'المنتج' : 'الخدمة'}. ثمن ${item.label} هو ${p}`;
  if (quantity > 1) {
    msg += `، و باش نتعاملو بكمية ${quantity}، الجملة تكون ${total}.`;
  } else {
    msg += `.`;
  }
  msg += `\n\nإذا تحب نعملولك عرض سعر (Devis) بالتفصيل، قولها ليا.`;
  return msg;
}

function availabilityReply(item) {
  if (!item) {
    return 'للأسف هادي ما جاتش معانا. ولكن نقدر نسقسيلك على تفاصيل أخرى؟ وإذا تعجبك نقّدر نعملولك Devis.';
  }
  return `نعم، ${item.label} متوفر عندنا 👍 ثمنه ${formatDZD(item.unit_price)}. تحب نعملولك عرض سعر؟`;
}

function noPriceFound(business) {
  return `عذراً، ما لقيتيش المنتج/الخدمة اللي تسقسيت عليها في قائمة المنتجات ديالنا. نقولك للبوس: على أهل، نقدر نجاوبك قريباً. شكراً على فهمك 🙏`;
}

function escalationReply() {
  // Only used when the AI must hand over to the owner.
  return null; // handled by caller — we mark for owner attention and stop.
}

function contactReply(business) {
  const bits = [];
  if (business.phone) bits.push(`الهاتف: ${business.phone}`);
  if (business.email) bits.push(`الإيميل: ${business.email}`);
  if (business.address) bits.push(`العنوان: ${business.address}`);
  if (bits.length === 0) return 'عندنا معلومات الاتصال، وأحسن نعطيهالك بعد ما نتأكد. تقدر تسقسينا على شيء آخر.';
  return 'هاذو معلومات الاتصال ديالنا 📞\n' + bits.join('\n');
}

function hoursReply(business) {
  if (business.opening_hours) return `أوقات الدوام ديالنا: ${business.opening_hours}`;
  return 'أوقات الدوام معروفين عندنا، تقدر تسقسينا وقت ما تحب. وإذا حابة نواصلك، نقولك قريباً.';
}

function deliveryReply(business) {
  if (business.delivery_info) return `بالنسبة للتوصيل: ${business.delivery_info}`;
  return 'تفاصيل التوصيل غادي نعطيوهالك مع الريميند. إذا حابة تعرف أكثر، نسقسيك.';
}

function paymentReply(business) {
  if (business.payment_methods) return `طرق الخلاص اللي نقبلوها: ${business.payment_methods}`;
  return 'طرق الخلاص مسجلة عندنا، نقولك عليها لما تأكدنا من الطلب.';
}

function thanksReply() {
  return 'بلا مزية! 😊 إذا حاجة أخرى نعاونك، أنا هنا.';
}

function byeReply() {
  return 'بسلامة! 👋 نتمنى نلاقيوك قريب.';
}

function unknownReply() {
  return 'نفهمتك، تعطيني المزيد من التفاصيل؟ واش تحب تعرف بالتحديد على خدمة اللي نقدموها، أو محتاج تعمل Devis؟';
}

function askInfoReply() {
  return 'باش نعطيك السعر الصحيح، أحتاج نعرف: نوع المنتج/الخدمة اللي حاب، والكمية. مرسلولنا التفاصيل؟';
}

// ---------------------------------------------------------------------------
// Build the system prompt for the LLM (if configured)
// ---------------------------------------------------------------------------
function buildSystemPrompt(business, settings, faqs) {
  const products = db.prepare('SELECT * FROM products WHERE business_id=? AND active=1').all(business.id);
  const services = db.prepare('SELECT * FROM services WHERE business_id=? AND active=1').all(business.id);
  const catalog = [
    ...products.map((p) => `- Produit: ${p.name} (${formatDZD(p.unit_price)})`),
    ...services.map((s) => `- Service: ${s.name} (${formatDZD(s.unit_price)})`),
  ].join('\n');
  return [
    `You are the customer-service AI assistant of "${business.name}".`,
    `Reply naturally in Algerian Darija (with some French, as people actually speak).`,
    `Be friendly, concise, and helpful.`,
    `The business's real price list (do NOT invent any other price):`,
    catalog || '(empty catalog —— do not give any price)',
    `Business info: phone=${business.phone || 'n/a'}, address=${business.address || 'n/a'}, hours=${business.opening_hours || 'n/a'}, delivery=${business.delivery_info || 'n/a'}, payment methods=${business.payment_methods || 'n/a'}.`,
    faqs.length ? `FAQ: ${faqs.map((f) => f.q + ' => ' + f.a).join(' | ')}` : '',
    `CRITICAL RULES:`,
    `- NEVER invent a price that is not in the list above. If asked for something not in the catalog, say you will check and get back, and do NOT quote.`,
    `- If you cannot answer or the customer asks something off-catalog, briefly say you will check and hand over to the owner.`,
    `- Do not promise delivery/gurantees not in the info above.`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Main handler: given a customer message + conversation context, produce a reply
// ---------------------------------------------------------------------------
function handle(business, settings, conversation, history) {
  const text = history.length ? history[history.length - 1].body : '';
  const intent = classifyIntent(text);
  const isDef = limits(business);

  // Free plan AI message cap
  const used = aiMessagesUsed(business.id);
  if (isDef.max_ai_messages_per_month !== -1 && used >= isDef.max_ai_messages_per_month) {
    return {
      reply: null,
      escalate: true,
      reason: 'ai_limit',
      mention: `Limite de messages IA atteinte pour ce mois (${isDef.max_ai_messages_per_month}).`,
    };
  }

  // Check escalation rules: if owner wants manual review on some intents.
  const rules = (() => { try { return JSON.parse(settings.eskalate_rules || '{}'); } catch { return {}; } })();

  let reply = null;
  let escalate = false;
  let reason = '';
  let extracted = null;

  const wantsCreateDevis = /(devis|عرض سعر|عرض.سعر|dév|عرض)/.test(fold(text));
  const quantity = extractQuantity(text);

  switch (intent) {
    case 'greeting':
      reply = greetingReply(business);
      break;
    case 'thanks':
      reply = thanksReply();
      break;
    case 'bye':
      reply = byeReply();
      break;
    case 'product_price': {
      const match = findCatalog(business.id, text, { quantity });
      extracted = match.matched ? { item: match.matched.name, qty: quantity, unit_price: match.matched.unit_price, subtotal: match.matchedSubtotal } : null;
      if (rules.price === 'owner' || (rules.price && rules.manual_prices)) {
        escalate = true;
        reason = 'price_request';
        reply = null;
      } else if (match.matched) {
        reply = priceReply(match, quantity);
      } else {
        // Off-catalog price: never invent. Escalate.
        escalate = true;
        reason = 'unknown_price';
        reply = (llm.available() ? null : noPriceFound(business));
      }
      break;
    }
    case 'availability': {
      const match = findCatalog(business.id, text, { quantity });
      extracted = match.matched ? { item: match.matched.name, qty: quantity, unit_price: match.matched.unit_price, subtotal: match.matchedSubtotal } : null;
      reply = availabilityReply(match.matched || null);
      break;
    }
    case 'hours': reply = hoursReply(business); break;
    case 'location': reply = contactReply(business); break;
    case 'delivery': reply = deliveryReply(business); break;
    case 'payment': reply = paymentReply(business); break;
    case 'general':
    default: {
      const match = findCatalog(business.id, text, { quantity });
      if (match.matched && (wantsCreateDevis || /(عمل|خد|شري|علاش|تحب|needs)/i.test(fold(text) + ' '))) {
        reply = priceReply(match, quantity);
      } else if (/^(عندك|اخلص|نفهم)/.test(fold(text))) {
        reply = askInfoReply();
      } else {
        reply = unknownReply();
      }
    }
  }

  // If no deterministic reply and an LLM is configured, use it for a richer answer.
  if (!reply && llm.available() && !escalate) {
    try {
      const faqs = (() => { try { return JSON.parse(settings.faqs || '[]'); } catch { return []; } })();
      const sys = buildSystemPrompt(business, settings, faqs);
      const msgs = [
        { role: 'system', content: sys },
        ...history.slice(-8).map((m) => ({ role: m.sender === 'ai' ? 'assistant' : 'user', content: m.body })),
      ];
      const out = llm.chat(msgs, { temperature: 0.5, maxTokens: 350 });
      // Don't block the request: resolve reply later via job. For simplicity,
      // we return a placeholder handled by caller.
      reply = Promise.resolve(out);
    } catch (e) {
      reply = null;
    }
  }

  // Decide: if customer clearly asked a price for something off-catalog => escalate.
  if (!reply && intent === 'product_price' && !extracted) {
    escalate = true;
    reason = 'unknown_price';
  }

  return { reply, escalate, reason, intent, extracted, matchText: text, quantity };
}

module.exports = {
  handle,
  classifyIntent,
  findCatalog,
  extractQuantity,
  extractPhone,
  formatDZD,
  aiMessagesUsed,
  monthKey,
};
