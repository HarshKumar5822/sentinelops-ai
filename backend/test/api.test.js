'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

// A tiny fake Groq server so the AI path is tested without a real key or network.
let groqCalls = [];
const fakeGroq = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const payload = JSON.parse(body || '{}');
    groqCalls.push(payload);
    const sys = payload.messages[0].content;
    let content;
    if (payload.model === 'boom-model') { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end('{"error":{"message":"down"}}'); }
    if (sys.includes('"recognised"')) content = '<think>x</think>```json\n{"recognised":true,"pattern":"Connection pool exhaustion","diagnosis":"Leaked ORM sessions","rootCause":"Unclosed session","steps":["Drain idle sessions","Roll back v2.14"],"risk":"low","confidence":93,"etaMinutes":4,"usedMemoryIds":["m1"]}\n```';
    else if (sys.includes('post-mortem')) content = '{"rootCause":"Leak","steps":["a","b","c"],"lessons":"l","prevention":["p"]}';
    else if (sys.includes('incident communications')) content = '{"statusUpdate":"We fixed it","executiveSummary":"Short outage","customerImpact":"Errors","nextSteps":["Monitor"]}';
    else content = 'Use the runbook **Connection pool exhaustion**.';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content } }], usage: { total_tokens: 10 } }));
  });
});

let server, base;
test.before(async () => {
  await new Promise((r) => fakeGroq.listen(0, r));
  process.env.GROQ_API_KEY = 'test-key';
  process.env.GROQ_BASE_URL = `http://127.0.0.1:${fakeGroq.address().port}`;
  process.env.DATA_FILE = path.join(os.tmpdir(), `sentinel-test-${process.pid}.json`);
  const { createApp } = require('../src/server');
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(() => { server.close(); fakeGroq.close(); });

const post = (p, body, method = 'POST') => fetch(base + p, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('health reports AI configured', async () => {
  const j = await (await fetch(base + '/health')).json();
  assert.strictEqual(j.ok, true);
  assert.strictEqual(j.ai.configured, true);
});

test('memory: retain -> recall -> delete', async () => {
  const r = await post('/memory/retain', { cat: 'runbook', title: 'Runbook: disk full', text: 'rotate audit.log when disk usage 98% no space left', service: 'orders-db', steps: ['rotate logs'] });
  assert.strictEqual(r.status, 201);
  const { memory } = await r.json();
  assert.ok(!('tok' in memory));
  const rec = await (await post('/memory/recall', { query: 'orders-db no space left on device audit.log' })).json();
  assert.strictEqual(rec.results[0].memory.id, memory.id);
  const del = await fetch(`${base}/memory/${memory.id}`, { method: 'DELETE' });
  assert.strictEqual(del.status, 200);
  assert.strictEqual((await fetch(`${base}/memory/${memory.id}`, { method: 'DELETE' })).status, 404);
});

test('state: rejects junk, accepts a valid snapshot', async () => {
  assert.strictEqual((await post('/state', { state: { nope: 1 } }, 'PUT')).status, 400);
  const ok = await post('/state', { state: { v: 2, mem: [], inc: [], seq: 9001, set: {} } }, 'PUT');
  assert.strictEqual(ok.status, 200);
});

test('ai/triage (memory mode) returns a normalised plan', async () => {
  const r = await post('/ai/triage', { mode: 'memory', incident: { id: 'INC-1', service: 'auth-service', symptoms: ['connections 250/250'], logs: ['ERROR pool'] }, memories: [{ id: 'm1', cat: 'runbook', title: 'Runbook', text: 'drain idle sessions', steps: ['Drain idle sessions'] }] });
  assert.strictEqual(r.status, 200);
  const j = await r.json();
  assert.strictEqual(j.result.recognised, true);
  assert.strictEqual(j.result.confidence, 93);
  assert.deepStrictEqual(j.result.usedMemoryIds, ['m1']);
  const sent = groqCalls.at(-1).messages[1].content;
  assert.ok(sent.includes('Drain idle sessions'), 'memories were injected into the prompt');
});

test('ai/triage (stateless mode) sends NO memories to the model', async () => {
  await post('/ai/triage', { mode: 'stateless', incident: { service: 'x', symptoms: ['s'] }, memories: [{ id: 'leak', title: 'SECRET-MEMORY', text: 'SECRET-MEMORY' }] });
  assert.ok(!JSON.stringify(groqCalls.at(-1)).includes('SECRET-MEMORY'));
});

test('ai/chat, postmortem and summary work', async () => {
  const c = await (await post('/ai/chat', { messages: [{ role: 'user', content: 'how to fix a leak?' }], memories: [] })).json();
  assert.ok(c.reply.includes('Connection pool exhaustion'));
  const p = await (await post('/ai/postmortem', { incident: { service: 'x', symptoms: ['a'] }, notes: 'n' })).json();
  assert.strictEqual(p.result.steps.length, 3);
  const s = await (await post('/ai/summary', { incident: { service: 'x', symptoms: ['a'], status: 'resolved' } })).json();
  assert.strictEqual(s.result.statusUpdate, 'We fixed it');
});

test('validation errors are clean 400s', async () => {
  assert.strictEqual((await post('/ai/triage', { mode: 'memory' })).status, 400);
  assert.strictEqual((await post('/ai/chat', { messages: [] })).status, 400);
  assert.strictEqual((await post('/memory/retain', { title: 'x' })).status, 400);
});

test('unknown api routes return JSON 404', async () => {
  const r = await fetch(base + '/nope');
  assert.strictEqual(r.status, 404);
  assert.strictEqual((await r.json()).error.code, 'not_found');
});
