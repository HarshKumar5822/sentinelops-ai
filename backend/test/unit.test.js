'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { tok, makeMemory, recall } = require('../src/services/memory');
const { extractJSON } = require('../src/services/jsonUtil');

test('tokeniser splits hyphenated names and drops stop words', () => {
  const t = tok('The auth-service connection pool is exhausted');
  assert.ok(t.includes('auth-service') && t.includes('auth') && t.includes('service'));
  assert.ok(!t.includes('the') && !t.includes('is'));
});

test('recall ranks the matching post-mortem first', () => {
  const mems = [
    makeMemory({ cat: 'episodic', title: 'Connection leak', text: 'connections 250/250 low cpu idle orm session pool exhausted 5xx', service: 'auth-service' }),
    makeMemory({ cat: 'episodic', title: 'Disk full', text: 'no space left on device audit.log growing volume 98%', service: 'orders-db' }),
    makeMemory({ cat: 'fact', title: 'On-call policy', text: 'page the on-call sre for critical incidents' }),
  ];
  const hits = recall(mems, 'auth-service connections 250/250 idle sessions 5xx', { k: 3, service: 'auth-service' });
  assert.strictEqual(hits[0].memory.title, 'Connection leak');
  assert.ok(hits[0].cos > hits[1].cos);
});

test('extractJSON survives fences, <think> blocks and trailing commas', () => {
  assert.deepStrictEqual(extractJSON('<think>hmm</think>```json\n{"a":1}\n```'), { a: 1 });
  assert.deepStrictEqual(extractJSON('Sure! {"a":[1,2,],"b":"x",} done'), { a: [1, 2], b: 'x' });
  assert.strictEqual(extractJSON('no json here'), null);
});
