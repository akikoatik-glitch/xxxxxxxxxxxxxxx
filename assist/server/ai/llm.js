let fetchFn = globalThis.fetch;
if (!fetchFn) {
  try { fetchFn = require('node-fetch'); } catch { /* noop */ }
}

const SUPPORTED_FREE_PROVIDERS = ['gemini', 'groq', 'openrouter'];

async function callGemini(systemPrompt, history, userMessage) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('No Gemini API key configured');
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const contents = [
    ...history.map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];
  const res = await fetchFn(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system_instruction: { parts: [{ text: systemPrompt }] }, contents }),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText;
    throw new Error(`Gemini ${res.status}: ${msg}`);
  }
  if (data.candidates?.[0]?.content?.parts?.[0]?.text) return data.candidates[0].content.parts[0].text.trim();
  throw new Error('Gemini returned no content');
}

async function callOpenAICompatible(baseUrl, apiKey, model, systemPrompt, history, userMessage) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: userMessage },
  ];
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  const res = await fetchFn(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages, max_tokens: 512, temperature: 0.7 }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText;
    throw new Error(`${model} ${res.status}: ${msg}`);
  }
  if (data.choices?.[0]?.message?.content) return data.choices[0].message.content.trim();
  throw new Error(`${model} returned no content`);
}

async function callLLM(systemPrompt, history, userMessage, lang) {
  const provider = (process.env.LLM_PROVIDER || 'auto').toLowerCase();

  if (provider === 'openai') {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('No OpenAI API key configured');
    return callOpenAICompatible('https://api.openai.com/v1', key, process.env.OPENAI_MODEL || 'gpt-4o-mini', systemPrompt, history, userMessage);
  }

  if (provider === 'anthropic') {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('No Anthropic API key configured');
    const msgs = history.map(h => ({ role: h.role, content: h.content }));
    const res = await fetchFn('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest',
        max_tokens: 512,
        system: systemPrompt,
        messages: [...msgs, { role: 'user', content: userMessage }],
      }),
    });
    const data = await res.json();
    if (data.content?.[0]?.text) return data.content[0].text.trim();
    throw new Error('Anthropic returned no content');
  }

  if (provider === 'gemini') {
    return callGemini(systemPrompt, history, userMessage);
  }

  if (provider === 'groq') {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('No Groq API key configured');
    return callOpenAICompatible('https://api.groq.com/openai/v1', key, process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', systemPrompt, history, userMessage);
  }

  if (provider === 'openrouter') {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('No OpenRouter API key configured');
    return callOpenAICompatible('https://openrouter.ai/api/v1', key, process.env.OPENROUTER_MODEL || 'openrouter/auto', systemPrompt, history, userMessage);
  }

  if (provider === 'local') {
    const baseUrl = process.env.LOCAL_LLM_BASE_URL || 'http://localhost:11434/v1';
    return callOpenAICompatible(baseUrl, process.env.LOCAL_LLM_API_KEY || '', process.env.LOCAL_LLM_MODEL || 'llama3.1', systemPrompt, history, userMessage);
  }

  // `auto` — try each configured free provider in order, fall back gracefully
  const attempts = [];
  if (process.env.GEMINI_API_KEY) attempts.push(() => callGemini(systemPrompt, history, userMessage));
  if (process.env.GROQ_API_KEY) attempts.push(() => callOpenAICompatible('https://api.groq.com/openai/v1', process.env.GROQ_API_KEY, process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', systemPrompt, history, userMessage));
  if (process.env.OPENROUTER_API_KEY) attempts.push(() => callOpenAICompatible('https://openrouter.ai/api/v1', process.env.OPENROUTER_API_KEY, process.env.OPENROUTER_MODEL || 'openrouter/auto', systemPrompt, history, userMessage));
  if (process.env.OPENAI_API_KEY) attempts.push(() => callOpenAICompatible('https://api.openai.com/v1', process.env.OPENAI_API_KEY, process.env.OPENAI_MODEL || 'gpt-4o-mini', systemPrompt, history, userMessage));

  let lastErr = null;
  for (const fn of attempts) {
    try { return await fn(); }
    catch (e) { lastErr = e; console.error('[ai:llm]', e.message); }
  }
  if (lastErr) throw lastErr;
  return null;
}

module.exports = { callLLM };
