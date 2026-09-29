/* ═══ api.js — talks to the SentinelOps backend (Groq AI, state sync, Hindsight bridge)
   Works offline too: every AI feature falls back to the local engine.
   SentinelOps AI · Created by Harsh Kumar ═══ */
'use strict';

const shortModel = m => String(m || '').split('/').pop();

/** Tiny markdown → safe HTML (bold, code, bullets, numbered lists, paragraphs). */
function fmt(t) {
  const lines = esc(t).replace(/\r/g, '').split('\n');
  let out = '', list = null;
  const close = () => { if (list) { out += `</${list}>`; list = null; } };
  const inl = s => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  lines.forEach(l => {
    const ul = l.match(/^\s*[-*•]\s+(.*)/), ol = l.match(/^\s*\d+[.)]\s+(.*)/);
    if (ul) { if (list !== 'ul') { close(); out += '<ul>'; list = 'ul'; } out += `<li>${inl(ul[1])}</li>`; }
    else if (ol) { if (list !== 'ol') { close(); out += '<ol>'; list = 'ol'; } out += `<li>${inl(ol[1])}</li>`; }
    else if (l.trim()) { close(); out += `<p>${inl(l)}</p>`; }
    else close();
  });
  close();
  return out;
}

const API = {
  base: null, online: false, ai: false, hs: false, model: '', info: null,
  checking: true, lastSync: null, syncT: null,

  canAI() { return this.online && this.ai; },

  async _fetch(base, path, opt = {}, ms = 8000) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    try {
      return await fetch(base + path, Object.assign({ signal: c.signal }, opt, { headers: Object.assign({ 'Content-Type': 'application/json' }, opt.headers || {}) }));
    } finally { clearTimeout(t); }
  },

  candidates() {
    const c = [];
    if (S && S.set && S.set.apiBase) c.push(S.set.apiBase.replace(/\/$/, ''));
    if (/^https?:$/.test(location.protocol)) c.push('');
    c.push('http://localhost:8787');
    return [...new Set(c)];
  },

  /** Find a running backend and read its capabilities. */
  async detect(quiet) {
    if (!quiet) { this.checking = true; renderAIBadge(); }
    for (const b of this.candidates()) {
      try {
        const r = await this._fetch(b, '/api/health', {}, 2500);
        if (!r.ok) continue;
        const j = await r.json();
        if (!j || !j.ok) continue;
        Object.assign(this, { base: b, online: true, ai: !!(j.ai && j.ai.configured), model: j.ai ? j.ai.model : '', hs: !!(j.hindsight && j.hindsight.enabled && j.hindsight.ready), info: j, checking: false });
        renderAIBadge();
        return true;
      } catch (e) { /* try next candidate */ }
    }
    Object.assign(this, { online: false, ai: false, hs: false, checking: false });
    renderAIBadge();
    return false;
  },

  async call(path, body, ms = 45000, method = 'POST') {
    if (!this.online) throw new Error('backend offline');
    const r = await this._fetch(this.base, '/api' + path, { method, body: body ? JSON.stringify(body) : undefined }, ms);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = new Error((j.error && j.error.message) || 'HTTP ' + r.status);
      e.code = j.error && j.error.code; e.hint = j.error && j.error.hint;
      throw e;
    }
    return j;
  },

  /* ── state sync ── */
  scheduleSync() {
    if (!this.online || !S || !S.set || !S.set.autoSync) return;
    clearTimeout(this.syncT);
    this.syncT = setTimeout(() => this.push(true), 2500);
  },
  async push(silent) {
    try {
      const r = await this.call('/state', { state: S }, 15000, 'PUT');
      this.lastSync = Date.now();
      if (!silent) toast(`Synced ${r.counts.memories} memories and ${r.counts.incidents} incidents to the server`);
      return true;
    } catch (e) { if (!silent) toast('Sync failed: ' + e.message); return false; }
  },
  async pull() {
    const r = await this.call('/state', null, 15000, 'GET');
    const s = r.state;
    if (!s || s.v !== 2 || (!s.mem.length && !s.inc.length)) return false;
    const keep = { apiBase: S.set.apiBase, autoSync: S.set.autoSync, navCollapsed: S.set.navCollapsed };
    S = s; S.set = Object.assign({}, DEFAULT_SET, s.set, keep);
    initTelemetry(); save();
    return true;
  },

  /** Mirror a resolved post-mortem to real Hindsight (if the backend bridge is on). */
  mirror(inc, root, steps, mttr) {
    if (!this.online || !this.hs) return;
    const content = `${inc.id} ${FAULTS[inc.fault].name} on ${inc.service}. Symptoms: ${inc.symptoms.join('; ')}. Root cause: ${root}. Resolution: ${steps.join('; ')}. MTTR ${mttr} minutes.`;
    this.call('/hindsight/retain', { content, tags: [inc.fault, inc.service, 'post-mortem'] }, 20000).catch(() => {});
  },

  /** Replace the scripted triage text with real Groq reasoning (memory is injected for the memory agent only). */
  async enrichTriage(inc) {
    const t = inc.triage;
    const brief = { id: inc.id, service: inc.service, sev: inc.sev, title: inc.title, symptoms: inc.symptoms, logs: inc.logs };
    const memOn = t.memory && !t.memory.off;
    const mems = memOn ? t.memory.hits.map(h => ({ id: h.m.id, cat: h.m.cat, title: h.m.title, text: h.m.text, steps: h.m.steps, service: h.m.service, ts: h.m.ts })) : [];
    const jobs = [this.call('/ai/triage', { incident: brief, mode: 'stateless' })];
    if (memOn) jobs.push(this.call('/ai/triage', { incident: brief, mode: 'memory', memories: mems }));
    const [sl, mm] = await Promise.allSettled(jobs);
    if (sl.status === 'fulfilled') {
      const d = sl.value.result;
      Object.assign(t.stateless, { analysis: d.diagnosis || t.stateless.analysis, steps: d.steps.length ? d.steps : t.stateless.steps, risk: d.risk || t.stateless.risk, conf: d.confidence, eta: d.etaMinutes, ai: shortModel(sl.value.model) });
    }
    if (mm && mm.status === 'fulfilled') {
      const d = mm.value.result, m = t.memory;
      m.memSteps = m.memSteps || m.steps.slice();
      m.analysis = d.diagnosis || m.analysis;
      if (d.steps.length) m.steps = d.steps;
      m.risk = d.risk || m.risk;
      m.eta = d.etaMinutes;
      m.conf = m.fallback ? Math.min(d.confidence, 58) : Math.max(m.conf, Math.min(98, d.confidence));
      m.ai = shortModel(mm.value.model);
    }
    const failed = [sl, mm].filter(x => x && x.status === 'rejected');
    if (failed.length === jobs.length) throw failed[0].reason;
    if (failed.length) toast('AI partially unavailable: ' + failed[0].reason.message);
    save();
  },

  /** Copilot answer from Groq, grounded in memories recalled locally. */
  async chat(q) {
    const hits = recall(q, { k: 5 }).filter(h => h.cos >= 0.1);
    hits.forEach(h => { h.m.recalls = (h.m.recalls || 0) + 1; });
    const messages = chatLog.slice(-8).map(m => ({ role: m.r === 'u' ? 'user' : 'assistant', content: m.raw || '' })).filter(m => m.content);
    const j = await this.call('/ai/chat', { messages, memories: hits.map(h => ({ id: h.m.id, cat: h.m.cat, title: h.m.title, text: h.m.text, steps: h.m.steps, service: h.m.service, ts: h.m.ts })) });
    save();
    return { html: fmt(j.reply), raw: j.reply, used: hits, model: shortModel(j.model) };
  },
};

/* ── UI bits that depend on the API ── */
function renderAIBadge() {
  const b = $('#aiBadge'), t = $('#aiTxt');
  if (!b) return;
  b.classList.toggle('on', API.canAI());
  b.classList.toggle('chk', API.checking);
  t.textContent = API.checking ? 'AI: checking…' : API.canAI() ? 'Groq · ' + shortModel(API.model) : API.online ? 'AI: add Groq key' : 'AI: offline (local)';
}

function aiCardHTML() {
  return `<div class="card"><h3>AI & backend</h3><div class="sub">Groq powers triage, the Copilot, post-mortem drafts and incident reports. Your API key stays on the server in <code>backend/.env</code>, never in the browser.</div>
  <div class="kv"><b>Backend</b><span>${API.online ? '✔ connected · ' + esc(API.base || 'same origin') : '✘ not reachable'}</span>
  <b>Groq</b><span>${API.canAI() ? '✔ ' + esc(API.model) : API.online ? '✘ GROQ_API_KEY missing' : '—'}</span>
  <b>Hindsight bridge</b><span>${API.hs ? '✔ mirroring memories' : API.online ? 'off (HINDSIGHT_ENABLED=false)' : '—'}</span>
  <b>Last sync</b><span>${API.lastSync ? ago(API.lastSync) : 'never'}</span></div>
  <label>Backend URL (empty = auto-detect)<input id="apiBase" value="${esc(S.set.apiBase || '')}" placeholder="http://localhost:8787"></label>
  <label style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" id="autoSync" ${S.set.autoSync ? 'checked' : ''} style="width:auto;margin:0"> Auto-sync data to the server</label>
  <div class="btns"><button class="btn" data-act="aiRecheck">Test connection</button><button class="btn ghost" data-act="syncPush">Push to server</button><button class="btn ghost" data-act="syncPull">Pull from server</button></div>
  ${API.online ? '' : '<p class="muted" style="margin-top:12px">Start the backend with <code>cd backend &amp;&amp; npm start</code> and open <code>http://localhost:8787</code>. See the README.</p>'}</div>`;
}

function aiInfoModal() {
  const steps = !API.online
    ? '<ol class="steps"><li>Open a terminal in the project folder</li><li><code>cd backend &amp;&amp; npm install</code></li><li>Copy <code>.env.example</code> to <code>.env</code> and paste your Groq key</li><li><code>npm start</code>, then open <code>http://localhost:8787</code></li></ol>'
    : !API.ai ? '<ol class="steps"><li>Get a free key at console.groq.com/keys</li><li>Put it in <code>backend/.env</code> as <code>GROQ_API_KEY=…</code></li><li>Restart the backend</li></ol>' : '';
  openModal(`<h3>AI status</h3><div class="kv"><b>Backend</b><span>${API.online ? '✔ ' + esc(API.base || 'same origin') : '✘ offline'}</span><b>Groq</b><span>${API.canAI() ? '✔ ' + esc(API.model) : '✘ not ready'}</span><b>Hindsight bridge</b><span>${API.hs ? '✔ on' : 'off'}</span></div>
  <p class="muted">${API.canAI() ? 'Triage, Copilot, post-mortem drafts and AI reports are powered by Groq, grounded in your memory bank.' : 'Everything still works with the built-in local engine. Connect the backend to unlock Groq-powered reasoning.'}</p>${steps}
  <div class="btns" style="margin-top:14px"><button class="btn" data-act="aiRecheck">Test connection</button><button class="btn ghost" data-act="closeOv">Close</button></div>`);
}

/** Offline stand-in for the AI incident report. */
function localReport(inc) {
  const F = FAULTS[inc.fault];
  return {
    statusUpdate: inc.status === 'resolved' ? `We resolved an issue affecting ${inc.service}. Service is back to normal.` : `We are investigating elevated errors on ${inc.service} and are working on a fix.`,
    executiveSummary: `${inc.sev} incident ${inc.id}: ${F.alert.toLowerCase()} on ${inc.service}. ${inc.status === 'resolved' ? `Resolved in ${inc.mttr} minutes via ${inc.path === 'memory' ? 'a recalled runbook' : 'manual investigation'}.` : 'Investigation in progress.'}`,
    customerImpact: inc.symptoms[0] || 'Degraded service.',
    nextSteps: inc.status === 'resolved' ? ['Review the retained post-mortem', 'Add monitoring for this signature'] : ['Run triage', 'Execute the recommended runbook'],
  };
}
