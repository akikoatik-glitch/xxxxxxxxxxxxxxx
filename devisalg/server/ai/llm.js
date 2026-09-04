// Optional LLM provider hook (OpenAI-compatible chat completions).
// Only activated if the server has a provider configured via environment
// variables. When not configured, the deterministic engine is used instead.
// The business's real products/services/prices AND a strict instruction NEVER
// to invent prices are always injected, so the model cannot make things up.
const https = require('https');

const LLM_KEY = process.env.LLM_API_KEY;
const LLM_URL = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';

function available() {
  return !!(LLM_KEY && LLM_URL);
}

function chat(messages, { temperature = 0.4, maxTokens = 500 } = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: LLM_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
    });
    const url = new URL(`${LLM_URL}/chat/completions`);
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${LLM_KEY}`,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode >= 400) {
              return reject(new Error(`LLM error ${res.statusCode}: ${data}`));
            }
            resolve(json.choices[0].message.content.trim());
          } catch (e) {
            reject(new Error('LLM parse error: ' + e.message));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { available, chat, model: LLM_MODEL };
