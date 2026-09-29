'use strict';
/** Pull a JSON object out of an LLM reply (handles <think> blocks, code fences and chatter). */
function stripThink(text) {
  return String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}
function extractJSON(text) {
  const t = stripThink(text).replace(/```(?:json)?/gi, '').trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a === -1 || b <= a) return null;
  const slice = t.slice(a, b + 1);
  try { return JSON.parse(slice); } catch (_) { /* try repair */ }
  try { return JSON.parse(slice.replace(/,\s*([}\]])/g, '$1')); } catch (_) { return null; }
}
const clip = (s, n) => String(s ?? '').slice(0, n);
const num = (v, lo, hi, d) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
const strArr = (v, max = 8, len = 300) => (Array.isArray(v) ? v : []).map((x) => clip(x, len).trim()).filter(Boolean).slice(0, max);
module.exports = { stripThink, extractJSON, clip, num, strArr };
