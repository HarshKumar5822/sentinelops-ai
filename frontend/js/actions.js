/* ═══ actions.js — click/keyboard action handlers
   SentinelOps AI · Created by Harsh Kumar ═══ */
'use strict';
/* ---------- actions ---------- */
const ACT={
 go:id=>go(id),
 navCollapse(){S.set.navCollapsed=!S.set.navCollapsed;save();$('#app').classList.toggle('collapsed',S.set.navCollapsed);setTimeout(markNav,60);setTimeout(markNav,460)},
 palette(){openPalette()},
 quickInject(){const inc=randomFault();if(inc)curInc=inc.id},
 aiInfo(){aiInfoModal()},
 async aiRecheck(id,a){if($('#apiBase')){S.set.apiBase=$('#apiBase').value.trim();if($('#autoSync'))S.set.autoSync=$('#autoSync').checked;save()}
  if(a)a.classList.add('loading');const ok=await API.detect();if(a)a.classList.remove('loading');if(ok)API.scheduleSync();
  toast(ok?(API.canAI()?'Connected · Groq is ready':'Backend connected, but GROQ_API_KEY is missing'):'Backend not reachable');updateChrome();if($('.modal')&&$('.modal h3')&&$('.modal h3').textContent==='AI status'){aiInfoModal()}else if(route==='lab')render()},
 async syncPush(id,a){if(!API.online)return toast('Backend not connected');if(a)a.classList.add('loading');await API.push(false);if(a)a.classList.remove('loading');if(route==='lab')render()},
 async syncPull(id,a){if(!API.online)return toast('Backend not connected');if(a)a.classList.add('loading');try{const ok=await API.pull();toast(ok?'Loaded data from the server':'The server has no saved data yet');if(ok){bench=null;chatLog=[];curInc=null}}catch(e){toast('Pull failed: '+e.message)}if(a)a.classList.remove('loading');render()},
 async aiReport(id,a){const inc=S.inc.find(i=>i.id===id);if(!inc)return;let r,model=null;
  if(a)a.classList.add('loading');
  if(API.canAI()){try{const pm=S.mem.find(m=>m.cat==='episodic'&&m.title.startsWith(inc.id));const j=await API.call('/ai/summary',{incident:{id:inc.id,service:inc.service,sev:inc.sev,title:inc.title,symptoms:inc.symptoms,status:inc.status,timeline:inc.timeline.map(e=>hms(e.ts)+' '+e.text),resolution:pm&&pm.steps?pm.steps.join('; '):''}});r=j.result;model=shortModel(j.model)}catch(e){toast('AI unavailable ('+e.message+'). Showing a local summary.')}}
  if(a)a.classList.remove('loading');if(!r)r=localReport(inc);
  openModal(`<h3>Incident report · ${esc(inc.id)} ${model?`<span class="aitag">✦ ${esc(model)}</span>`:''}</h3><div class="report"><div style="animation-delay:.05s"><b>Status page update</b>${esc(r.statusUpdate)}</div><div style="animation-delay:.15s"><b>Executive summary</b>${esc(r.executiveSummary)}</div><div style="animation-delay:.25s"><b>Customer impact</b>${esc(r.customerImpact)}</div><div style="animation-delay:.35s"><b>Next steps</b>${stepsHTML(r.nextSteps||[])}</div></div>
   ${model?'':'<p class="muted" style="margin-top:10px">Connect the backend with a Groq key for an AI-written report.</p>'}<div class="btns" style="margin-top:14px"><button class="btn ghost" data-act="closeOv">Close</button></div>`)},
 async aiDraft(id,a){const inc=S.inc.find(i=>i.id===id);if(!inc)return;if(!API.canAI())return toast('Connect the backend with a Groq key to use AI drafting');
  a.classList.add('loading');
  try{const hits=recall(incQuery(inc),{k:3}).filter(h=>h.cos>=.1).map(h=>({id:h.m.id,cat:h.m.cat,title:h.m.title,text:h.m.text,steps:h.m.steps,service:h.m.service,ts:h.m.ts}));
   const j=await API.call('/ai/postmortem',{incident:{id:inc.id,service:inc.service,sev:inc.sev,title:inc.title,symptoms:inc.symptoms,logs:inc.logs},notes:'Root cause draft: '+$('#pmRoot').value+'\nSteps: '+$('#pmSteps').value.replace(/\n/g,'; '),memories:hits});
   const r=j.result;if(r.rootCause)$('#pmRoot').value=r.rootCause;if(r.steps.length)$('#pmSteps').value=r.steps.join('\n');toast('Draft written by '+shortModel(j.model)+'. Review before retaining.')}
  catch(e){toast('AI draft failed: '+e.message)}
  a.classList.remove('loading')},
 memToggle(){S.set.memOn=!S.set.memOn;save();updateChrome();toast('Memory '+(S.set.memOn?'enabled':'disabled'));render()},
 selSvc(id){selSvc=id;$('#liveName')&&($('#liveName').textContent=id);refreshTiles();updateLive()},
 inject(){const inc=inject($('#injF').value,$('#injS').value);if(inc)curInc=inc.id},
 chaos(){S.set.chaos=!S.set.chaos;save();toast('Auto-chaos '+(S.set.chaos?'on: random faults will appear':'off'));render()},
 openInc(id){curInc=id;if(route!=='inc')go('inc');else{renderIncList();renderIncDetail()}},
 filterInc(){renderIncList()},
 triage:id=>doTriage(id),
 exec(id,a){execPlan(id,a.dataset.who)},
 resolveModal:id=>resolveModal(id),
 saveResolve(id){const inc=S.inc.find(i=>i.id===id),F=FAULTS[inc.fault],steps=$('#pmSteps').value.split('\n').map(s=>s.trim()).filter(Boolean),root=$('#pmRoot').value.trim()||F.root;
  const mttr=Math.max(5,Math.round(F.bad.mttr*rnd(.65,.85)+inc.penalty));closeModal();resolveInc(inc,{path:'manual',mttr,root,steps});toast(`Resolved in ${mttr} min · post-mortem retained`);updateChrome();renderIncList();renderIncDetail()},
 delInc(id){const i=S.inc.find(x=>x.id===id);if(i&&SV[i.service]&&SV[i.service].inc===id)SV[i.service].inc=null;S.inc=S.inc.filter(x=>x.id!==id);curInc=null;save();updateChrome();render()},
 ask(id,a){sendChat(a.dataset.q)},send(){sendChat()},
 retain(){const t=$('#mTitle').value.trim(),x=$('#mText').value.trim();if(!t||!x)return toast('Add a title and text first');addMem({cat:$('#mCat').value,title:t,text:x,service:$('#mSvc').value||undefined,tags:['manual']});save();updateChrome();toast('Memory retained');render()},
 reflect(){const n=reflect();save();updateChrome();toast(n?`Reflection updated ${n} pattern${n>1?'s':''}`:'Need 2+ resolved incidents of one type to reflect');render()},
 memTab(id){memTab=id;$$('#memTabs button').forEach(b=>b.classList.toggle('on',b.dataset.id===id));memList()},
 delMem(id){S.mem=S.mem.filter(m=>m.id!==id);save();updateChrome();if(route==='mem')memList();else render();toast('Memory forgotten')},
 editRb(id){const m=S.mem.find(x=>x.id===id);openModal(`<h3>Edit runbook steps</h3><label>${esc(m.title)} (one step per line)<textarea id="rbSteps" style="min-height:140px">${esc(m.steps.join('\n'))}</textarea></label><div class="btns"><button class="btn" data-act="saveRb" data-id="${id}">Save runbook</button><button class="btn ghost" data-act="closeOv">Cancel</button></div>`)},
 saveRb(id){const m=S.mem.find(x=>x.id===id),s=$('#rbSteps').value.split('\n').map(x=>x.trim()).filter(Boolean);if(!s.length)return toast('Add at least one step');m.steps=s;m.text=m.text.replace(/Do:.*$/,'Do: '+s.join('; '));reTok(m);save();closeModal();toast('Runbook updated');render()},
 testFault(k){const inc=inject(k,FAULTS[k].svc);if(inc){curInc=inc.id;go('inc')}},
 runBench(){runBench()},teachAll(){teachAll();bench=null;benchOut()},
 saveSet(){S.set.oncall=$('#setName').value.trim()||'Engineer';S.set.speed=+$('#setSpeed').value;save();startTick();toast('Settings saved')},
 reseed(){genSeed();initTelemetry();bench=null;chatLog=[];curInc=null;save();updateChrome();toast('Fresh demo data generated');render()},
 wipeMem(){S.mem=[];bench=null;save();updateChrome();toast('Memory erased. The agent is amnesic again.');render()},
 wipeAll(){S.mem=[];S.inc=[];S.seq=9001;Object.values(SV).forEach(v=>v.inc=null);bench=null;chatLog=[];curInc=null;save();updateChrome();toast('Everything erased');render()},
 exportD(){$('#ioBox').value=JSON.stringify(S)},
 importD(){try{const o=JSON.parse($('#ioBox').value);if(!o||o.v!==2||!Array.isArray(o.mem)||!Array.isArray(o.inc))throw 0;S=o;initTelemetry();save();updateChrome();toast('Data imported');render()}catch(e){toast('Import failed: invalid JSON')}},
 closeOv(){closeModal()}
};
document.addEventListener('click',e=>{const b=e.target.closest('.btn, .nav button, .sugg button');if(b&&!b.disabled)ripple(b,e);const a=e.target.closest('[data-act]');if(!a)return;if(a.classList.contains('ov')&&e.target!==a)return;const f=ACT[a.dataset.act];if(f&&a.tagName!=='SELECT')f(a.dataset.id,a,e)});
document.addEventListener('change',e=>{const a=e.target.closest('select[data-act]');if(a&&ACT[a.dataset.act])ACT[a.dataset.act](a.dataset.id,a,e)});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeModal();return}
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openPalette();return}
  if((e.key==='Enter'||e.key===' ')&&(e.target.id==='memSw'||e.target.id==='aiBadge')){e.preventDefault();if(e.target.id==='memSw')ACT.memToggle();else ACT.aiInfo();return}
  const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName||'');
  if(!typing&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&/^[1-8]$/.test(e.key)&&NAV_ITEMS[+e.key-1])go(NAV_ITEMS[+e.key-1][0])});

