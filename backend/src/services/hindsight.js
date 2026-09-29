'use strict';
/**
 * Optional bridge to a real Hindsight memory service (https://github.com/vectorize-io/hindsight).
 * Enabled with HINDSIGHT_ENABLED=true. Uses the official @vectorize-io/hindsight-client.
 * Every method is non-fatal: if Hindsight is down the app keeps working with its local engine.
 */
const cfg = require('../config');

let client = null;
let loadError = null;
let bankReady = false;

function getClient() {
  if (!cfg.hindsight.enabled) return null;
  if (client) return client;
  try {
    const { HindsightClient } = require('@vectorize-io/hindsight-client');
    client = new HindsightClient({ baseUrl: cfg.hindsight.baseUrl, apiKey: cfg.hindsight.apiKey || undefined });
  } catch (e) {
    loadError = e.message;
  }
  return client;
}

async function ensureBank(c) {
  if (bankReady) return;
  try {
    if (typeof c.createBank === 'function') await c.createBank(cfg.hindsight.bank, { name: 'SentinelOps AI' });
  } catch (_) { /* already exists or not supported: fine */ }
  bankReady = true;
}

const status = () => ({
  enabled: cfg.hindsight.enabled,
  ready: Boolean(getClient()),
  bank: cfg.hindsight.bank,
  baseUrl: cfg.hindsight.baseUrl,
  error: loadError,
});

async function retain(content, { tags = [], context } = {}) {
  const c = getClient();
  if (!c) return { skipped: true };
  await ensureBank(c);
  await c.retain(cfg.hindsight.bank, String(content).slice(0, 8000), { tags, context });
  return { retained: true };
}

async function recall(query, { maxTokens = 1200 } = {}) {
  const c = getClient();
  if (!c) return [];
  await ensureBank(c);
  const res = await c.recall(cfg.hindsight.bank, String(query).slice(0, 2000), { maxTokens });
  const items = res?.results || res?.memories || [];
  return items.map((r, i) => ({
    id: `hs-${r.id || i}`, cat: 'fact', title: `Hindsight: ${String(r.type || r.fact_type || 'memory')}`,
    text: String(r.text || r.content || '').slice(0, 900), ts: Date.now(),
  })).filter((m) => m.text);
}

async function reflect(query) {
  const c = getClient();
  if (!c) return null;
  await ensureBank(c);
  const res = await c.reflect(cfg.hindsight.bank, String(query).slice(0, 2000));
  return res?.text || res?.answer || null;
}

module.exports = { status, retain, recall, reflect };
