/* ═══ main.js — router and boot
   SentinelOps AI · Created by Harsh Kumar ═══ */
'use strict';

function go(r) {
  if (!PAGES[r]) r = 'war';
  route = r;
  try { history.replaceState(null, '', '#' + r); } catch (e) { /* sandboxed frames */ }
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function render() {
  destroyCharts();
  progress();
  const p = PAGES[route] || PAGES.war;
  $('#title').textContent = p.title;
  $('#view').innerHTML = `<div class="page">${p.fn()}</div>`;
  if (p.after) p.after();
  stagger();
  markNav();
  animRings();
  countUps();
  updateChrome();
}

function startTick() { clearInterval(tickT); tickT = setInterval(tick, S.set.speed); }

function boot() {
  S = loadState();
  if (!S) { genSeed(); save(); }
  initTelemetry();
  // pre-fill the live charts so they never start empty
  for (let i = 0; i < 24; i++) {
    SERVICES.forEach(s => {
      const v = SV[s], L = LIVE[s];
      L.t.push(hms(Date.now() - (24 - i) * 1500));
      L.lat.push(Math.round(v.lat + rnd(-20, 20)));
      L.err.push(+(v.err + rnd(-.1, .1)).toFixed(1));
      L.cpu.push(Math.round(v.cpu + rnd(-3, 3)));
    });
  }
  buildNav();
  const h = location.hash.slice(1);
  if (PAGES[h]) route = h;
  render();
  startTick();
  const clock = () => { $('#clock').textContent = new Date().toTimeString().slice(0, 8); };
  clock(); setInterval(clock, 1000);
  setTimeout(() => $('#splash').classList.add('hide'), 1100);
  window.addEventListener('resize', markNav);

  // look for the backend (Groq AI, sync, Hindsight bridge); re-check every 30s
  API.detect().then(ok => { if (ok) API.scheduleSync(); if (route === 'lab') render(); });
  setInterval(() => API.detect(true).then(() => updateChrome()), 30000);
}
boot();
