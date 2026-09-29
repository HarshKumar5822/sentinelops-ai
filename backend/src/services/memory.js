'use strict';
/**
 * Server-side memory engine — same model as the browser engine:
 *  retain (makeMemory) · recall (TF-IDF cosine + service match + recency + reinforcement)
 */
const DAY = 864e5;
const STOP = new Set('the a an and or of to in on for with is are was were be it this that at as by from we they you our their have has had will not no but if then so what which who how when do does did into than'.split(' '));

function tok(s) {
  const out = [];
  (String(s).toLowerCase().match(/[a-z0-9][a-z0-9._\-/%]*/g) || []).forEach((w) => {
    w = w.replace(/[._\-/]+$/, '');
    if (!w) return;
    const add = (x) => { if (x.length > 1 && !STOP.has(x)) out.push(x.length > 3 && x.endsWith('s') && !x.endsWith('ss') ? x.slice(0, -1) : x); };
    add(w);
    if (/[-_/.]/.test(w)) w.split(/[-_/.]+/).forEach(add);
  });
  return out;
}

const uid = () => Math.random().toString(36).slice(2, 9);
const CATS = ['episodic', 'fact', 'reflection', 'runbook'];

function makeMemory(o = {}) {
  const m = {
    id: uid(), ts: Date.now(), recalls: 0, tags: [],
    cat: CATS.includes(o.cat) ? o.cat : 'fact',
    title: String(o.title || 'Untitled').slice(0, 160),
    text: String(o.text || '').slice(0, 4000),
    service: o.service ? String(o.service).slice(0, 60) : undefined,
    fault: o.fault ? String(o.fault).slice(0, 40) : undefined,
    steps: Array.isArray(o.steps) ? o.steps.map((s) => String(s).slice(0, 300)).slice(0, 12) : undefined,
    root: o.root ? String(o.root).slice(0, 600) : undefined,
    tags: Array.isArray(o.tags) ? o.tags.map(String).slice(0, 10) : [],
  };
  m.tok = tok([m.title, m.text, m.tags.join(' '), m.service || ''].join(' '));
  return m;
}

function stats(mems) {
  const df = new Map();
  mems.forEach((m) => new Set(m.tok || []).forEach((t) => df.set(t, (df.get(t) || 0) + 1)));
  return { N: mems.length, df };
}
function vec(tokens, st) {
  const tf = new Map();
  tokens.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1));
  const v = new Map();
  let n = 0;
  tf.forEach((c, t) => { const w = (1 + Math.log(c)) * Math.log(1 + (st.N + 1) / ((st.df.get(t) || 0) + 1)); v.set(t, w); n += w * w; });
  return { v, n: Math.sqrt(n) || 1 };
}
function cosine(a, b) { let d = 0; a.v.forEach((w, t) => { const x = b.v.get(t); if (x) d += w * x; }); return d / (a.n * b.n); }

function recall(mems, query, { k = 5, service, cat } = {}) {
  const st = stats(mems);
  const qv = vec(tok(query), st);
  return mems
    .filter((m) => !cat || m.cat === cat)
    .map((m) => {
      const cos = cosine(qv, vec(m.tok || tok(`${m.title} ${m.text}`), st));
      let score = cos;
      if (service && m.service === service) score += 0.06;
      score += 0.04 * Math.exp(-(Date.now() - m.ts) / (45 * DAY));
      score += Math.min(0.06, (m.recalls || 0) * 0.004);
      return { memory: m, cos, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

module.exports = { tok, makeMemory, recall, CATS };
