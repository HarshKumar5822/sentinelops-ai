'use strict';
const test = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const path = require('node:path');

test('without GROQ_API_KEY the AI routes explain how to fix it (503) and the rest still works', async () => {
  process.env.GROQ_API_KEY = '';
  process.env.DATA_FILE = path.join(os.tmpdir(), `sentinel-nokey-${process.pid}.json`);
  const { createApp } = require('../src/server');
  const server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const h = await (await fetch(base + '/health')).json();
  assert.strictEqual(h.ai.configured, false);
  const r = await fetch(base + '/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }) });
  assert.strictEqual(r.status, 503);
  const j = await r.json();
  assert.strictEqual(j.error.code, 'ai_not_configured');
  assert.ok(j.error.hint.includes('.env'));
  server.close();
});
