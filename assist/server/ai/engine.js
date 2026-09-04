const { db } = require('../db');
const { callLLM } = require('./llm');
const { detectLanguage, normalizeText } = require('./text');

function getBusinessConfig(businessId) {
  const biz = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  const aiSettings = db.prepare('SELECT * FROM ai_settings WHERE business_id = ?').get(businessId);
  const products = db.prepare('SELECT * FROM products WHERE business_id = ? AND active = 1').all(businessId);
  return { biz, aiSettings, products };
}

function getOrderContext(conversationId) {
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
  if (!conv) return null;
  const context = JSON.parse(conv.context || '{}');
  return { conversation: conv, context };
}

function saveOrderContext(conversationId, context) {
  db.prepare('UPDATE conversations SET context = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(JSON.stringify(context), conversationId);
}

function getConversationHistory(conversationId, limit = 20) {
  return db.prepare(
    'SELECT sender, body, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(conversationId, limit).reverse();
}

function formatHistory(history) {
  return history.map(m => {
    const role = m.sender === 'customer' ? 'user' : m.sender === 'ai' ? 'assistant' : 'system';
    return { role, content: m.body };
  });
}

const INTENT_PATTERNS = {
  greeting: {
    fr: ['bonjour', 'bonsoir', 'salut', 'hello', 'hey', 'coucou', 'bonne journée'],
    ar: ['مرحبا', 'أهلا', 'السلام عليكم', 'هاي'],
    en: ['hello', 'hi', 'hey', 'good morning', 'good evening', 'good afternoon'],
    darija: ['salam', 'slm', 'ahlan', 'cava', 'labas'],
  },
  order_intent: {
    fr: ['je veux commander', 'je voudrais commander', 'commander', 'acheter', 'prendre', 'je veux acheter', 'donnez-moi', 'je prends'],
    ar: ['أريد أن أطلب', 'أريد طلب', 'طلب', 'اشتري', 'عايز'],
    en: ['i want to order', 'order', 'buy', 'purchase', 'get', 'i need'],
    darija: ['bghit nchri', 'nchri', 'bghit', '3andek', '3andkum'],
  },
  cancellation: {
    fr: ['annuler', 'annulation', 'je veux annuler', 'pas envie', 'plus besoin', 'finalement non'],
    ar: ['إلغاء', 'ألغي', 'لا أريد'],
    en: ['cancel', 'never mind', "don't want anymore", 'scratch that'],
    darija: ['batal', 'la bghit', 'nlaa', 'ghir mchkil'],
  },
  confirm: {
    fr: ['confirme', 'confirmer', 'oui', 'c\'est bon', 'valide', 'ok', "d'accord", 'oui c\'est bon'],
    ar: ['تأكيد', 'موافق', 'نعم', 'تمام', 'حسناً'],
    en: ['confirm', 'yes', 'yes please', 'looks good', 'go ahead', 'perfect', 'deal'],
    darija: ['oui', 'merci', 'c bon', 'cbon', 'yes', 'ok', 'ns7ab'],
  },
  product_question: {
    fr: ['prix', 'combien', 'coût', 'tarif', 'disponible', 'stock', 'décrivez', 'description', 'qu\'est-ce que c\'est'],
    ar: ['السعر', 'كم', 'توفر', ' STOCK', 'وصف'],
    en: ['price', 'how much', 'cost', 'available', 'in stock', 'describe', 'what is', 'tell me about'],
    darija: ['sh7al', 'kam', 'price', 'ch7al', '3andek fiha'],
  },
  info_name: {
    fr: ['je m\'appelle', 'mon nom', 'c\'est', 'moi c\'est'],
    ar: ['اسمي', 'أنا'],
    en: ['my name is', 'i am', "i'm", 'this is'],
    darija: ['smiya', 'ana smiyti', 'isma'],
  },
  info_phone: {
    fr: ['mon numéro', 'mon téléphone', 'mon tel', 'numéro'],
    ar: ['رقم', 'هاتف', 'جوالي'],
    en: ['my number', 'my phone', 'phone number'],
    darija: ['numéro', 'num', 'tel', 'telephone'],
  },
  info_address: {
    fr: ['adresse', 'mon adresse', 'livrer à', 'où habite', 'livraison'],
    ar: ['عنوان', 'عنواني', 'العنوان', 'توصيل'],
    en: ['address', 'my address', 'deliver to', 'where i live'],
    darija: ['adresse', 'wain', 'dar', 'ladresse'],
  },
};

function detectIntent(text) {
  const norm = normalizeText(text);
  const lang = detectLanguage(text);
  // Action intents first (order, cancel, confirm, product question) — these
  // take priority even if the message also contains a greeting.
  for (const intent of ['cancellation', 'order_intent', 'confirm', 'product_question']) {
    const patterns = INTENT_PATTERNS[intent];
    for (const words of Object.values(patterns)) {
      if (words.some(w => norm.includes(w))) return intent;
    }
  }
  for (const [_lang, words] of Object.entries(INTENT_PATTERNS.greeting)) {
    if (words.some(w => norm.includes(w))) return 'greeting';
  }
  for (const [_lang, words] of Object.entries(INTENT_PATTERNS.info_name)) {
    if (words.some(w => norm.includes(w))) return 'info_name';
  }
  for (const [_lang, words] of Object.entries(INTENT_PATTERNS.info_phone)) {
    if (words.some(w => norm.includes(w))) return 'info_phone';
  }
  for (const [_lang, words] of Object.entries(INTENT_PATTERNS.info_address)) {
    if (words.some(w => norm.includes(w))) return 'info_address';
  }
  return 'unknown';
}

function extractProductName(text, products) {
  const norm = normalizeText(text);
  for (const p of products) {
    const pname = normalizeText(p.name);
    if (norm.includes(pname) || pname.includes(norm)) return p;
    const words = pname.split(/\s+/);
    if (words.length > 1 && words.some(w => w.length > 2 && norm.includes(w))) return p;
  }
  return null;
}

function extractQuantity(text) {
  const arabicNums = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  let t = text;
  arabicNums.forEach((an, i) => { t = t.split(an).join(String(i)); });
  const digits = t.replace(/[^\d]/g, '').split('').map(d => parseInt(d)).filter(n => !isNaN(n));
  if (digits.length > 0) return digits[0];
  const words = t.toLowerCase();
  const wordToNum = {
    'one': 1, 'deux': 2, 'trois': 3, 'quatre': 4, 'cinq': 5, 'six': 6, 'sept': 7, 'huit': 8, 'neuf': 9, 'dix': 10,
    ' واحد': 1, 'اثنين': 2, 'ثلاثة': 3, 'اربعة': 4, 'خمسة': 5,
    'wahed': 1, 'jouj': 2, 'tlata': 3, 'rb3a': 4, 'khmsa': 5,
  };
  for (const [w, n] of Object.entries(wordToNum)) {
    if (words.includes(w)) return n;
  }
  return 1;
}

function extractWilaya(text) {
  const wilayas = [
    'alger','oran','constantine','annaba','blida','batna','djelfa','sidi bel abbes','biskra','tlemcen',
    'bejaia','tiaret','tizi ouzou','algiers','setif','saida','skikda','jijel','relizane','medea',
    'mostaganem','msila','ouargla','bechar','tizi ouzou','tenes','chlef','taza','azaazoun','tamanrasset',
  ];
  const norm = normalizeText(text);
  for (const w of wilayas) {
    if (norm.includes(w)) return w.charAt(0).toUpperCase() + w.slice(1);
  }
  return null;
}

function buildOrderSummary(context, biz) {
  const items = context.items || [];
  const currency = biz.currency || 'DA';
  let subtotal = 0;
  const productLines = items.map(item => {
    const total = item.price * item.qty;
    subtotal += total;
    return `• ${item.name} × ${item.qty} = ${total.toLocaleString()} ${currency}`;
  }).join('\n');
  const delivery = biz.delivery_info ? 500 : 0;
  const total = subtotal + delivery;
  return { productLines, subtotal, delivery, total, currency };
}

function buildOrderConfirmationMessage(context, biz) {
  const { productLines, subtotal, delivery, total, currency } = buildOrderSummary(context, biz);
  const lang = context.lang || 'fr';
  if (lang === 'darija' || lang === 'fr') {
    return [
      `📦 **Confirmation de commande**`,
      ``,
      productLines,
      ``,
      `Livraison: ${delivery.toLocaleString()} ${currency}`,
      `**Total: ${total.toLocaleString()} ${currency}**`,
      ``,
      `👤 Nom: ${context.customer_name || '—'}`,
      `📞 Tél: ${context.customer_phone || '—'}`,
      `📍 Wilaya: ${context.customer_wilaya || '—'}`,
      `🏠 Adresse: ${context.customer_address || '—'}`,
      ``,
      `**Confirmez-vous votre commande ?**`,
      `✅ Confirmer  |  ❌ Annuler`,
    ].join('\n');
  } else if (lang === 'ar' || lang === 'darija') {
    return [
      `📦 تأكيد الطلب`,
      ``,
      productLines,
      ``,
      `التوصيل: ${delivery.toLocaleString()} ${currency}`,
      `**المجموع: ${total.toLocaleString()} ${currency}**`,
      ``,
      `👤 الاسم: ${context.customer_name || '—'}`,
      `📞 الهاتف: ${context.customer_phone || '—'}`,
      `📍 الولاية: ${context.customer_wilaya || '—'}`,
      `🏠 العنوان: ${context.customer_address || '—'}`,
      ``,
      `**هل تؤكد طلبك؟**`,
    ].join('\n');
  } else {
    return [
      `📦 **Order Confirmation**`,
      ``,
      productLines,
      ``,
      `Delivery: ${delivery.toLocaleString()} ${currency}`,
      `**Total: ${total.toLocaleString()} ${currency}**`,
      ``,
      `👤 Name: ${context.customer_name || '—'}`,
      `📞 Phone: ${context.customer_phone || '—'}`,
      `📍 Wilaya: ${context.customer_wilaya || '—'}`,
      `🏠 Address: ${context.customer_address || '—'}`,
      ``,
      `**Confirm your order?**`,
      `✅ Confirm  |  ❌ Cancel`,
    ].join('\n');
  }
}

const GREETINGS = {
  fr: "Bonjour ! 👋 Je suis l'assistant virtuel. Comment puis-je vous aider ?",
  ar: "مرحباً! 👋 أنا المساعد الافتراضي. كيف يمكنني مساعدتك؟",
  en: "Hello! 👋 I'm the virtual assistant. How can I help you?",
  darija: "Salam! 👋 Ana lassistant. Kifach n9der n3awnak?",
};

const FALLBACK = {
  fr: "Je vais transmettre votre demande à notre équipe. Un conseiller va vous répondre rapidement.",
  ar: "سأحوّل طلبك لفريقنا. سيجيبك مستشارنا قريباً.",
  en: "I'll forward your request to our team. A representative will respond shortly.",
  darija: "Ghadi n3tik l7okm dyalna. Chi wahed ghadi y3awnek dBreva.",
};

const COLLECT_STEPS = ['customer_name', 'customer_phone', 'customer_wilaya', 'customer_address'];

function cleanField(step, value) {
  let v = (value || '').trim();
  if (step === 'customer_name') {
    v = v
      .replace(/^(c'est|moi c'est|c c'est|je m'appelle|je suis|my name is|i am|i'm|this is|اسمي|أنا|انا)\s+/i, '')
      .replace(/^(mon nom est|mon nom c'est)\s+/i, '');
    v = v.split(',').shift().trim();
  }
  if (step === 'customer_phone') {
    v = (value.match(/[+0-9\s]{8,}/) || [''])[0].trim();
  }
  return v;
}

const COLLECT_PROMPTS = {
  customer_name: {
    fr: "Pour traiter votre commande, quel est votre nom complet ?",
    ar: "لمعالجة طلبك، ما هو اسمك الكامل؟",
    en: "To process your order, what is your full name?",
    darija: "Bach n3mlou commande, chno smiytek?",
  },
  customer_phone: {
    fr: "Quel est votre numéro de téléphone ?",
    ar: "ما هو رقم هاتفك؟",
    en: "What is your phone number?",
    darija: "Chno numérotek?",
  },
  customer_wilaya: {
    fr: "Dans quelle wilaya êtes-vous ?",
    ar: "في أي ولاية أنت؟",
    en: "Which wilaya are you in?",
    darija: "Fin 3andek?",
  },
  customer_address: {
    fr: "Quelle est votre adresse complète ?",
    ar: "ما هو عنوانك الكامل؟",
    en: "What is your full address?",
    darija: "Chno ladresse dyalek?",
  },
};

async function processMessage(conversationId, customerMessage) {
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
  if (!conv) return { reply: 'Conversation not found.', action: 'error' };

  const { biz, aiSettings, products } = getBusinessConfig(conv.business_id);
  if (!biz) return { reply: 'Business not found.', action: 'error' };
  if (!aiSettings || !aiSettings.enabled) return { reply: null, action: 'skip' };
  if (!conv.ai_mode) return { reply: null, action: 'skip' };

  const lang = detectLanguage(customerMessage);
  let ctx = JSON.parse(conv.context || '{}');
  if (!ctx.flow) ctx.flow = 'idle';
  if (!ctx.items) ctx.items = [];
  if (!ctx.lang) ctx.lang = lang;

  const intent = detectIntent(customerMessage);

  // ── Escalation check ──
  const escKeywords = JSON.parse(aiSettings.escalation_keywords || '[]');
  const norm = normalizeText(customerMessage);
  if (escKeywords.some(kw => norm.includes(normalizeText(kw)))) {
    db.prepare(`UPDATE conversations SET ai_mode = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(conversationId);
    saveOrderContext(conversationId, ctx);
    return {
      reply: FALLBACK[lang] || FALLBACK.fr,
      action: 'escalate',
    };
  }

  // ── Cancellation ──
  if (intent === 'cancellation') {

  // ── Order context handling ──
  if (ctx.flow === 'collecting') {
    const step = COLLECT_STEPS[ctx.collectStep || 0];
    if (!step) {
      ctx.flow = 'confirming';
      saveOrderContext(conversationId, ctx);
      return {
        reply: buildOrderConfirmationMessage(ctx, biz),
        action: 'show_confirmation',
      };
    }
    ctx[step] = cleanField(step, customerMessage);
    ctx.collectStep = (ctx.collectStep || 0) + 1;

    const nextStep = COLLECT_STEPS[ctx.collectStep || 0];
    if (nextStep) {
      saveOrderContext(conversationId, ctx);
      return {
        reply: COLLECT_PROMPTS[nextStep][lang] || COLLECT_PROMPTS[nextStep].fr,
        action: 'collecting',
      };
    } else {
      ctx.flow = 'confirming';
      saveOrderContext(conversationId, ctx);
      return {
        reply: buildOrderConfirmationMessage(ctx, biz),
        action: 'show_confirmation',
      };
    }
  }

  // ── Confirm / decline order ──
  if (ctx.flow === 'confirming') {
    if (intent === 'confirm') {
      const orderNumber = require('../db').nextNumber('ORD', 'orders', conv.business_id);
      const { subtotal, delivery, total } = buildOrderSummary(ctx, biz);
      const orderId = db.prepare(
        `INSERT INTO orders (business_id, customer_id, conversation_id, number, status, customer_name, customer_phone, customer_address, customer_wilaya, products_json, subtotal, delivery_cost, total, payment_method, notes)
         VALUES (?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        conv.business_id, conv.customer_id, conversationId, orderNumber,
        ctx.customer_name || '', ctx.customer_phone || '', ctx.customer_address || '',
        ctx.customer_wilaya || '', JSON.stringify(ctx.items),
        subtotal, delivery, total, ctx.payment_method || '', ''
      );
      db.prepare('UPDATE conversations SET order_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(orderId.lastInsertRowid, conversationId);
      ctx = { flow: 'idle', items: [], lang };
      saveOrderContext(conversationId, ctx);
      const confirmMsg = lang === 'fr' ? `✅ Commande ${orderNumber} confirmée ! Nous la préparons.`
        : lang === 'ar' ? `✅ تم تأكيد الطلب ${orderNumber}! جاري التجهيز.`
        : lang === 'darija' ? `✅ Commande ${orderNumber} confirmée! Ghadi n7itoh.`
        : `✅ Order ${orderNumber} confirmed! We're preparing it.`;
      return {
        reply: confirmMsg,
        action: 'order_confirmed',
        orderId: orderId.lastInsertRowid,
        orderNumber,
      };
    }
    if (intent === 'cancellation' || norm.includes('non') || norm.includes('لا')) {
      ctx = { flow: 'idle', items: [], lang };
      saveOrderContext(conversationId, ctx);
      return {
        reply: lang === 'fr' ? "Commande annulée. Dites-moi si vous avez autre chose."
          : "Order cancelled. Let me know if you need anything else.",
        action: 'cancel',
      };
    }
  }

  // ── Add to order (items already started) ──
  if (intent === 'order_intent' && ctx.items.length > 0) {
    const product = extractProductName(customerMessage, products);
    const qty = extractQuantity(customerMessage);
    if (product) {
      const exists = ctx.items.find(i => i.product_id === product.id);
      if (exists) exists.qty += qty;
      else ctx.items.push({ product_id: product.id, name: product.name, price: product.unit_price, qty });
      const addedMsg = lang === 'fr' ? `Ajouté : ${product.name} × ${qty}. Autre chose ?`
        : lang === 'ar' ? `تمت الإضافة: ${product.name} × ${qty}. شيء آخر؟`
        : lang === 'darija' ? `Zedna: ${product.name} × ${qty}. Ghir haja?`
        : `Added: ${product.name} × ${qty}. Anything else?`;
      saveOrderContext(conversationId, ctx);
      return { reply: addedMsg, action: 'add_item', item: product.name };
    }
  }

  // ── Pending quantity: user has selected a product, awaiting quantity ──
  if (ctx.flow === 'pending_quantity') {
    const product = ctx.pendingProduct;
    const qty = extractQuantity(customerMessage);
    if (product) {
      ctx.items.push({ product_id: product.id, name: product.name, price: product.unit_price, qty: qty || 1 });
      ctx.flow = 'collecting';
      ctx.collectStep = 0;
      ctx.pendingProduct = null;
      saveOrderContext(conversationId, ctx);
      return {
        reply: COLLECT_PROMPTS.customer_name[lang] || COLLECT_PROMPTS.customer_name.fr,
        action: 'start_order',
        item: product.name,
      };
    }
  }

  // ── Start order flow ──
  if (intent === 'order_intent') {
    const product = extractProductName(customerMessage, products);
    const qty = extractQuantity(customerMessage);
    const hasExplicitQty = /\d/.test(customerMessage) || ['un','deux','trois','quatre','cinq','one','two','three','four','five','واحد','اثنين','ثلاثة','wahed','jouj','tlata'].some(w => normalizeText(customerMessage).includes(w));
    if (product) {
      if (!hasExplicitQty) {
        ctx.flow = 'pending_quantity';
        ctx.pendingProduct = product;
        saveOrderContext(conversationId, ctx);
        const qMsg = lang === 'fr' ? `Combien de ${product.name} souhaitez-vous ?`
          : lang === 'ar' ? `كم تريد من ${product.name}؟`
          : lang === 'darija' ? `Ch7al mn ${product.name} bghiti?`
          : `How many ${product.name} would you like?`;
        return { reply: qMsg, action: 'ask_quantity', item: product.name };
      }
      ctx.items = [{ product_id: product.id, name: product.name, price: product.unit_price, qty: qty || 1 }];
      ctx.flow = 'collecting';
      ctx.collectStep = 0;
      saveOrderContext(conversationId, ctx);
      return {
        reply: COLLECT_PROMPTS.customer_name[lang] || COLLECT_PROMPTS.customer_name.fr,
        action: 'start_order',
        item: product.name,
      };
    } else if (products.length > 0) {
      const list = products.slice(0, 8).map(p => `• ${p.name} — ${p.unit_price.toLocaleString()} ${biz.currency}`).join('\n');
      const msg = lang === 'fr' ? `Voici nos produits :\n${list}\n\nQue souhaitez-vous commander ?`
        : lang === 'ar' ? `منتجاتنا:\n${list}\n\nماذا تريد أن تطلب؟`
        : lang === 'darija' ? `3andna hado:\n${list}\n\nChno bghit nchri?`
        : `Our products:\n${list}\n\nWhat would you like to order?`;
      ctx.flow = 'browsing';
      saveOrderContext(conversationId, ctx);
      return { reply: msg, action: 'browse_products' };
    }
  }

  // ── Browsing flow: pick from list ──
  if (ctx.flow === 'browsing') {
    const product = extractProductName(customerMessage, products);
    const qty = extractQuantity(customerMessage);
    const hasExplicitQty = /\d/.test(customerMessage) || ['un','deux','trois','quatre','cinq','one','two','three','four','five','واحد','اثنين','ثلاثة','wahed','jouj','tlata'].some(w => normalizeText(customerMessage).includes(w));
    if (product) {
      if (!hasExplicitQty) {
        ctx.flow = 'pending_quantity';
        ctx.pendingProduct = product;
        saveOrderContext(conversationId, ctx);
        const qMsg = lang === 'fr' ? `Combien de ${product.name} souhaitez-vous ?`
          : lang === 'ar' ? `كم تريد من ${product.name}؟`
          : lang === 'darija' ? `Ch7al mn ${product.name} bghiti?`
          : `How many ${product.name} would you like?`;
        return { reply: qMsg, action: 'ask_quantity', item: product.name };
      }
      ctx.items = [{ product_id: product.id, name: product.name, price: product.unit_price, qty: qty || 1 }];
      ctx.flow = 'collecting';
      ctx.collectStep = 0;
      saveOrderContext(conversationId, ctx);
      return {
        reply: COLLECT_PROMPTS.customer_name[lang] || COLLECT_PROMPTS.customer_name.fr,
        action: 'start_order',
        item: product.name,
      };
    }
  }

  // ── Product questions ──
  if (intent === 'product_question') {
    const product = extractProductName(customerMessage, products);
    if (product) {
      const msg = lang === 'fr' ? `📦 **${product.name}**\n${product.description || ''}\n💰 Prix : ${product.unit_price.toLocaleString()} ${biz.currency}\n${product.stock >= 0 ? `📊 Stock : ${product.stock}` : ''}`
        : lang === 'ar' ? `📦 **${product.name}**\n${product.description || ''}\n💰 السعر : ${product.unit_price.toLocaleString()} ${biz.currency}`
        : lang === 'darija' ? `📦 **${product.name}**\n${product.description || ''}\n💰 Prix: ${product.unit_price.toLocaleString()} ${biz.currency}`
        : `📦 **${product.name}**\n${product.description || ''}\n💰 Price: ${product.unit_price.toLocaleString()} ${biz.currency}`;
      return { reply: msg, action: 'info' };
    }
    if (products.length > 0) {
      const list = products.slice(0, 8).map(p => `• ${p.name} — ${p.unit_price.toLocaleString()} ${biz.currency}`).join('\n');
      return {
        reply: lang === 'fr' ? `Voici nos produits :\n${list}`
          : lang === 'ar' ? `منتجاتنا:\n${list}`
          : `Our products:\n${list}`,
        action: 'list_products',
      };
    }
  }

  // ── Try LLM if configured ──
  const llmProvider = process.env.LLM_PROVIDER || 'auto';
  if (llmProvider && llmProvider !== 'none') {
    try {
      const history = getConversationHistory(conversationId, 10);
      const systemPrompt = buildSystemPrompt(biz, aiSettings, products);
      const llmReply = await callLLM(systemPrompt, history, customerMessage, lang);
      if (llmReply) return { reply: llmReply, action: 'llm_response' };
    } catch (e) {
      console.error('[ai:llm]', e.message);
    }
  }

  // ── Smart local fallback (no LLM key needed) ──
  const localReply = buildLocalReply(customerMessage, ctx, biz, aiSettings, products, lang);
  return { reply: localReply.reply, action: localReply.action };
}

function buildSystemPrompt(biz, aiSettings, products) {
  const productList = products.map(p =>
    `${p.name} — ${p.unit_price} ${biz.currency}${p.description ? ' — ' + p.description : ''}${p.stock >= 0 ? ' — stock: ' + p.stock : ''}`
  ).join('\n');
  const faqs = JSON.parse(aiSettings.faqs || '[]');
  const faqText = faqs.map(f => `Q: ${f.q}\nA: ${f.a}`).join('\n');

  return [
    `You are the AI assistant for "${biz.name}".`,
    `Language: respond in the same language the customer uses (French, Arabic, English, or Darija).`,
    `Business: ${biz.description || biz.name}`,
    `Currency: ${biz.currency}`,
    `Delivery info: ${biz.delivery_info || 'Contact for delivery details'}`,
    `Payment methods: ${biz.payment_methods || 'Contact for payment details'}`,
    ``,
    `PRODUCTS:\n${productList || 'No products configured yet.'}`,
    ``,
    faqText ? `FAQ:\n${faqText}` : '',
    ``,
    aiSettings.custom_instructions ? `Custom instructions:\n${aiSettings.custom_instructions}` : '',
    ``,
    `RULES: Never invent prices. Always use the product list above. If a product is not listed, say so. If you need to collect order info (name, phone, wilaya, address), guide the customer. Be concise, friendly, professional.`,
  ].filter(Boolean).join('\n');
}

function buildLocalReply(msg, ctx, biz, aiSettings, products, lang) {
  const norm = normalizeText(msg);

  // FAQ match
  const faqs = JSON.parse(aiSettings.faqs || '[]');
  for (const f of faqs) {
    if (f.q && norm.includes(normalizeText(String(f.q)).slice(0, 20))) {
      return { reply: f.a, action: 'faq' };
    }
  }

  // Thanks / farewell
  if (/(merci|chokran|شكرا|thank|thanks|thanks you|barakallahu)/.test(norm)) {
    const msg = lang === 'ar' ? 'العفو! لا تتردد في التواصل معنا في أي وقت.'
      : 'Avec plaisir ! N\'hésitez pas si vous avez d\'autres questions. 😊';
    return { reply: msg, action: 'ack' };
  }

  // Human / agent / service hotline
  if (/(agent|humain|conseiller|représentant|operation|operator|human|representative)/.test(norm)) {
    const msg = lang === 'ar' ? 'وصلتك بمستشارنا لتقديم المساعدة.'
      : 'Je vous connecte à un conseiller humain pour vous aider.';
    return { reply: msg, action: 'ack' };
  }

  // Unknown / confused — offer clear options, mention products & ordering
  if (products.length > 0) {
    const names = products.slice(0, 3).map(p => p.name).join(', ');
    const msg = lang === 'ar'
      ? `آسف لم أفهمك. يمكنك أن تطلب منا أي شيء: اطلب "أريد أن أطلب ${names}" أو اسأل عن سعر منتج. تواصل معنا إذا كنت بحاجة إلى مساعدة.`
      : lang === 'darija'
        ? `Ma fhemtech mlih. 9der t9oli "bghit nchri ${names}" wla tsawel 3la lprix. Kifach n9der n3wnk?`
        : `Je n'ai pas bien compris. Vous pouvez me dire « je veux commander ${names} », demander le prix d'un produit, ou parler à un conseiller. Comment puis-je vous aider ?`;
    return { reply: msg, action: 'help' };
  }
  return { reply: GREETINGS[lang] || GREETINGS.en, action: 'greeting' };
}

module.exports = { processMessage, getBusinessConfig, detectLanguage, detectIntent, extractProductName, extractQuantity };
