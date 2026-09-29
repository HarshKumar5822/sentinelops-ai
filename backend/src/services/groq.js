'use strict';
const cfg = require('../config');
const { HttpError } = require('../middleware/errorHandler');
const { stripThink, extractJSON } = require('./jsonUtil');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isConfigured = () => Boolean(cfg.groqKey);

/**
 * One chat completion against Groq's OpenAI-compatible endpoint.
 * Tries the primary model, then the fallback model, with a short retry on 429/5xx.
 * (The hackathon guide warns that models can fail — this is the "handle errors" part.)
 */
async function chat({ messages, temperature = 0.2, maxTokens = 1600, model } = {}) {
  if (!isConfigured()) {
    throw new HttpError(503, 'ai_not_configured', 'GROQ_API_KEY is not set on the backend.',
      'Copy backend/.env.example to backend/.env, add your key from https://console.groq.com/keys and restart.');
  }
  const models = [model || cfg.groqModel, cfg.groqFallback].filter((m, i, a) => m && a.indexOf(m) === i);
  let last;
  for (const m of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const payload = { model: m, messages, temperature, max_completion_tokens: maxTokens };
        if (/gpt-oss/i.test(m)) payload.reasoning_effort = 'low';
        const res = await fetch(`${cfg.groqBase}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.groqKey}` },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(cfg.timeoutMs),
        });
        const body = await res.json().catch(() => ({}));
        if (res.ok) {
          const text = stripThink(body?.choices?.[0]?.message?.content || '');
          if (!text) { last = new HttpError(502, 'ai_empty', `Model ${m} returned an empty reply.`); break; }
          return { text, model: m, usage: body.usage || null };
        }
        const msg = body?.error?.message || `Groq responded with HTTP ${res.status}`;
        if (res.status === 401) throw new HttpError(401, 'ai_bad_key', 'Groq rejected the API key.', 'Check GROQ_API_KEY in backend/.env.');
        last = new HttpError(res.status === 429 ? 429 : 502, res.status === 429 ? 'ai_rate_limited' : 'ai_upstream', msg);
        if (res.status === 429 || res.status >= 500) { await sleep(700 * (attempt + 1)); continue; }
        break; // 400/404 etc: this model won't work, try the next one
      } catch (e) {
        if (e instanceof HttpError && e.status === 401) throw e;
        last = e.name === 'TimeoutError' ? new HttpError(504, 'ai_timeout', `Model ${m} timed out.`) : (e instanceof HttpError ? e : new HttpError(502, 'ai_network', `Could not reach Groq: ${e.message}`));
        await sleep(400);
      }
    }
  }
  throw last || new HttpError(502, 'ai_failed', 'AI request failed.');
}

/** Chat that must return a JSON object. Retries once with a stricter reminder. */
async function chatJSON({ messages, ...opts }) {
  let r = await chat({ messages, ...opts });
  let data = extractJSON(r.text);
  if (!data) {
    r = await chat({
      messages: [...messages, { role: 'assistant', content: r.text.slice(0, 500) },
        { role: 'user', content: 'Your reply was not valid JSON. Reply again with ONLY the JSON object, no prose, no code fences.' }],
      ...opts,
    });
    data = extractJSON(r.text);
  }
  if (!data) throw new HttpError(502, 'ai_bad_json', 'The model did not return valid JSON.');
  return { data, model: r.model, usage: r.usage };
}

module.exports = { chat, chatJSON, isConfigured };
