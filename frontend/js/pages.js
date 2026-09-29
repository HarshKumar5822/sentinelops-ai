/* ═══ pages.js — all screens (War Room, Incidents, Copilot, Memory, Runbooks, Analytics, Benchmark, Lab)
   SentinelOps AI · Created by Harsh Kumar ═══ */
'use strict';
/* ---------- pages ---------- */
const PAGES={};
PAGES.war={title:'War Room',fn(){const st=stats(),byF={},bySv={};S.inc.forEach(i=>{byF[i.fault]=(byF[i.fault]||0)+1;bySv[i.service]=(bySv[i.service]||0)+1});
  return `${heroHTML(st)}<div class="grid g5">${kpi('Open incidents',st.open.length,'n')}${kpi('MTTR (last 8)',st.mttr,'min')}${kpi('Memories retained',st.mems,'n')}${kpi('Recall hit-rate',st.hit,'pct')}${kpi('Downtime cost avoided',Math.round(st.cost),'money')}</div>
  <h3 class="mt" style="margin-bottom:10px">Services · live</h3>
  <div class="tiles">${SERVICES.map(s=>`<div class="tile ok" data-act="selSvc" data-id="${s}" data-svc="${s}"><span class="dot"></span><b>${s}</b><div class="m"><span>CPU <b data-m="cpu">-</b></span><span>Lat <b data-m="lat">-</b></span><span>5xx <b data-m="err">-</b></span><span>Sat <b data-m="sat">-</b></span></div></div>`).join('')}</div>
  <div class="grid g21 mt"><div class="card"><h3>Live telemetry · <span id="liveName">${selSvc}</span></h3><div class="sub">Streaming every ${(S.set.speed/1000).toFixed(1)}s. Click a service tile to switch.</div><div class="box tall"><canvas id="cLive"></canvas></div></div>
  <div class="grid" style="align-content:start"><div class="card"><h3>Inject a fault</h3><div class="sub">Simulate a production failure and watch the agent react.</div>
   <label>Failure type<select id="injF">${FKEYS.map(k=>`<option value="${k}">${FAULTS[k].name}</option>`).join('')}</select></label>
   <label>Service<select id="injS">${SERVICES.map(s=>`<option>${s}</option>`).join('')}</select></label>
   <div class="btns"><button class="btn" data-act="inject">Inject fault</button><button class="btn ghost" data-act="chaos">Auto-chaos: ${S.set.chaos?'ON':'OFF'}</button></div></div>
   <div class="card"><h3>Active incidents</h3>${st.open.length?st.open.map(i=>`<div class="inc-item" style="margin-top:8px" data-act="openInc" data-id="${i.id}"><span class="sev ${i.sev}">${i.sev}</span> <span class="muted">${i.id}</span><b>${esc(i.title)}</b><small class="muted">${ago(i.ts)}${i.triage?' · triaged':' · awaiting triage'}</small></div>`).join(''):'<div class="empty" style="margin-top:8px">All clear. Inject a fault to begin.</div>'}</div></div></div>
  <div class="grid g3 mt"><div class="card"><h3>Incidents by root cause</h3><div class="sub">Pie · all time</div><div class="box"><canvas id="cPie"></canvas></div></div>
   <div class="card"><h3>Incidents by service</h3><div class="sub">Bar chart</div><div class="box"><canvas id="cBar"></canvas></div></div>
   <div class="card"><h3>MTTR trend</h3><div class="sub">Line · minutes per incident</div><div class="box"><canvas id="cTr"></canvas></div></div></div>
  <div class="card mt"><h3>Live log stream</h3><div class="sub">Real-time entries from all services</div><div class="term" id="liveLog" style="max-height:200px"></div></div>`},
 after(){const st=stats(),byF={},bySv={};S.inc.forEach(i=>{byF[i.fault]=(byF[i.fault]||0)+1;bySv[i.service]=(bySv[i.service]||0)+1});
  const L=LIVE[selSvc];liveChart=mk('cLive',{type:'line',data:{labels:L.t,datasets:[{label:'p95 latency (ms)',data:L.lat,borderColor:'#0ea5e9',backgroundColor:'#0ea5e933',fill:true,tension:.35,pointRadius:0,yAxisID:'y'},{label:'5xx error %',data:L.err,borderColor:'#0369a1',tension:.35,pointRadius:0,yAxisID:'y1'},{label:'CPU %',data:L.cpu,borderColor:'#7dd3fc',borderDash:[5,4],tension:.35,pointRadius:0,yAxisID:'y1'}]},
    options:{animation:false,interaction:{mode:'index',intersect:false},plugins:{legend:Object.assign({position:'bottom'},legend)},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:6,color:cvar('--muted')}},y:{grid:{color:gridC()},ticks:{color:cvar('--muted')},beginAtZero:true},y1:{position:'right',min:0,max:100,grid:{display:false},ticks:{color:cvar('--muted')}}}}});
  mk('cPie',{type:'pie',data:pieData(Object.keys(byF).map(k=>FAULTS[k].name),Object.values(byF)),options:pieOpt()},S.inc.length>0);
  mk('cBar',{type:'bar',data:{labels:Object.keys(bySv),datasets:[{data:Object.values(bySv),backgroundColor:'#0ea5e9',borderRadius:8}]},options:{plugins:{legend:{display:false}},scales:axes()}},S.inc.length>0);
  const r=st.res.slice(-14);mk('cTr',{type:'line',data:{labels:r.map(i=>i.id.slice(-4)),datasets:[{label:'MTTR (min)',data:r.map(i=>i.mttr),borderColor:'#0ea5e9',backgroundColor:'#0ea5e933',fill:true,tension:.35,pointBackgroundColor:r.map(i=>i.path==='memory'?'#0ea5e9':'#0369a1'),pointRadius:5}]},options:{plugins:{legend:{display:false}},scales:axes()}},r.length>0);
  $('#injF').onchange=e=>{$('#injS').value=FAULTS[e.target.value].svc};$('#injS').value=FAULTS[$('#injF').value].svc;
  const box=$('#liveLog');LOGS.slice(0,30).forEach(e=>{const d=document.createElement('div');d.className='ln '+e.lvl;d.textContent=`[${hms(e.ts)}] ${e.lvl} ${e.s}: ${e.txt}`;box.appendChild(d)});refreshTiles()}};

/* incidents */
function incItem(i){return `<button class="inc-item ${i.id===curInc?'sel':''}" data-act="openInc" data-id="${i.id}"><span class="sev ${i.sev}">${i.sev}</span> <span class="pill st-${i.status}">${i.status}</span><b>${esc(i.title)}</b><small class="muted">${i.id} · ${ago(i.ts)}${i.mttr?' · '+i.mttr+' min':''}</small></button>`}
function renderIncList(){const el=$('#incList');if(!el)return;const f=$('#incFilter')?$('#incFilter').value:'all';const l=[...S.inc].reverse().filter(i=>f==='all'||i.status===f);el.innerHTML=l.length?l.map(incItem).join(''):'<div class="empty">No incidents match. Inject one from the War Room.</div>'}
function triCards(inc){const t=inc.triage,m=t.memory,open=inc.status==='open';
  const sl=`<div class="tri"><h4>Stateless LLM <span class="pill">no memory</span>${t.stateless.ai?`<span class="aitag">✦ ${esc(t.stateless.ai)}</span>`:''}</h4><div class="conf">${ring(t.stateless.conf)}<div><b>Confidence</b><br><small class="muted">Generic reasoning from the alert alone</small></div></div><p>${esc(t.stateless.analysis)}</p>${stepsHTML(t.stateless.steps)}<div class="risk bad"><b>Risk:</b> ${esc(t.stateless.risk)}</div><p class="muted" style="margin-top:8px">Estimated time: ${t.stateless.eta} min</p>${open?`<div class="btns" style="margin-top:12px"><button class="btn ghost sm" data-act="exec" data-id="${inc.id}" data-who="stateless">Execute this plan</button></div>`:''}</div>`;
  let mc;if(m.off)mc=`<div class="tri mem"><h4>Hindsight memory agent <span class="pill">off</span></h4><div class="empty" style="margin-top:12px">Memory is switched off. Use the Memory switch in the top bar to compare.</div></div>`;
  else mc=`<div class="tri mem"><h4>Hindsight memory agent <span class="pill">${m.fallback?'unknown pattern':'pattern recognised'}</span>${m.ai?`<span class="aitag">✦ ${esc(m.ai)}</span>`:''}</h4><div class="conf">${ring(m.conf)}<div><b>Confidence</b><br><small class="muted">${m.fallback?'Nothing relevant in memory yet':'Grounded in recalled post-mortems'}</small></div></div>
   <div class="recall">${m.hits.length?m.hits.map((h,i)=>`<div style="animation-delay:${i*.12}s"><span class="tag c-${h.m.cat}">${h.m.cat}</span> <b>${esc(h.m.title)}</b> <span class="rel">${Math.round(clamp(h.score,0,.99)*100)}%</span></div>`).join(''):'<div>No related memories recalled.</div>'}</div>
   <p>${esc(m.analysis)}</p>${stepsHTML(m.steps)}<div class="risk ${m.fallback?'bad':''}"><b>Risk:</b> ${esc(m.risk)}</div><p class="muted" style="margin-top:8px">Estimated time: ${m.eta} min</p>${open?`<div class="btns" style="margin-top:12px"><button class="btn sm" data-act="exec" data-id="${inc.id}" data-who="memory">${m.fallback?'Try generic plan':'Execute runbook'}</button></div>`:''}</div>`;
  return `<div class="grid g2 mt">${sl}${mc}</div>`}
function incDetailHTML(inc){if(!inc)return '<div class="empty">Select an incident on the left, or inject a fault from the War Room.</div>';
  const open=inc.status==='open';
  let mid='';if(busy[inc.id])mid=`<div class="card mt"><div class="loader"><div class="orbs"><i></i><i></i><i></i></div><div class="scan"></div><b>Recalling memories and reasoning…</b></div></div>`;else if(inc.triage)mid=triCards(inc);
  return `<div class="card"><div class="d-head"><div><span class="sev ${inc.sev}">${inc.sev}</span> <span class="pill st-${inc.status}">${inc.status}</span><h2>${esc(inc.title)}</h2><p class="muted">${inc.id} · ${esc(inc.service)} · opened ${ago(inc.ts)}${inc.mttr?` · MTTR ${inc.mttr} min (${inc.path})`:''}</p></div>
   <div class="btns">${open&&!inc.triage&&!busy[inc.id]?`<button class="btn" data-act="triage" data-id="${inc.id}">Run triage</button>`:''}${open?`<button class="btn ghost" data-act="resolveModal" data-id="${inc.id}">Resolve manually</button>`:''}<button class="btn ghost" data-act="aiReport" data-id="${inc.id}">✦ AI report</button><button class="btn danger" data-act="delInc" data-id="${inc.id}">Delete</button></div></div>
   <div class="chips">${inc.symptoms.map((s,i)=>`<span class="chip" style="animation-delay:${i*.08}s">${esc(s)}</span>`).join('')}</div>
   <div class="term">${inc.logs.map((l,i)=>{const m=l.match(/^(\w+)\s/);return `<div class="ln ${m?m[1]:''}" style="animation-delay:${i*.15}s">[${hms(inc.ts+i*900)}] ${esc(l)}</div>`}).join('')}</div></div>
   ${mid}<div id="execWrap">${inc.execLog.length?`<div class="term small" id="execTerm">${inc.execLog.map(l=>`<div class="ln ${l.c||''}">${esc(l.t)}</div>`).join('')}</div>`:''}</div>
   <div class="card mt"><h3>Timeline</h3><ul class="tl">${inc.timeline.map(e=>`<li><small>${hms(e.ts)}</small> ${esc(e.text)}</li>`).join('')}</ul></div>`}
function renderIncDetail(){const el=$('#incDetail');if(!el)return;el.innerHTML=incDetailHTML(S.inc.find(i=>i.id===curInc));animRings()}
PAGES.inc={title:'Incidents',fn(){if(!curInc||!S.inc.find(i=>i.id===curInc)){const o=S.inc.filter(i=>i.status==='open').pop()||S.inc[S.inc.length-1];curInc=o?o.id:null}
  return `<div class="inc-layout"><div><label>Filter<select id="incFilter" data-act="filterInc"><option value="all">All incidents</option><option value="open">Open</option><option value="resolved">Resolved</option></select></label><div class="inc-list" id="incList"></div></div><div id="incDetail"></div></div>`},after(){renderIncList();renderIncDetail()}};
async function doTriage(id){const inc=S.inc.find(i=>i.id===id);if(!inc||busy[id])return;busy[id]=true;renderIncDetail();const t0=Date.now();
  runTriage(inc);
  if(API.canAI()){try{await API.enrichTriage(inc)}catch(e){toast('AI unavailable ('+e.message+'). Used the local engine.')}}
  await sleep(Math.max(0,1400-(Date.now()-t0)));busy[id]=false;if(route==='inc'&&curInc===id)renderIncDetail();renderIncList();updateChrome()}
async function execPlan(id,who){const inc=S.inc.find(i=>i.id===id);if(!inc||inc.status!=='open'||busy['x'+id])return;busy['x'+id]=true;const t=inc.triage[who];
  const F=FAULTS[inc.fault],ok=who==='memory'&&!t.fallback&&t.key===inc.fault;inc.execLog=[];
  let wrap=$('#execWrap');wrap.innerHTML='<div class="term small" id="execTerm"></div>';const term=$('#execTerm');
  const line=async(text,c)=>{inc.execLog.push({t:text,c});if(term.isConnected){const d=document.createElement('div');d.className='ln '+(c||'');d.textContent=text;term.appendChild(d);term.scrollTop=term.scrollHeight}await sleep(750)};
  await line(`$ executing ${who==='memory'?'memory-agent runbook':'stateless plan'} on ${inc.service}`,'ok');
  for(const s of t.steps){await line('> '+s)}
  if(ok){const mttr=Math.max(2,Math.round(F.mem+rnd(-1,1.5)))+inc.penalty;await line(`✔ Telemetry recovered. Error rate back to baseline. MTTR ${mttr} min`,'ok');resolveInc(inc,{path:'memory',mttr,root:t.root,steps:t.memSteps||t.steps});burst();toast('Resolved by memory runbook · post-mortem retained')}
  else{inc.penalty+=12;inc.attempts.push({who,ts:Date.now()});inc.timeline.push({ts:Date.now(),text:`${who==='memory'?'Fallback':'Stateless'} plan failed. +12 min lost`});
    await line(`✖ Plan did not fix the incident: ${t.risk}`,'ERROR');await line('Engineer intervention required. Use “Resolve manually”, then retain the post-mortem.','WARN');toast('Plan failed. 12 minutes lost')}
  save();busy['x'+id]=false;updateChrome();if(route==='inc'&&curInc===id)renderIncDetail();renderIncList()}
function resolveModal(id){const inc=S.inc.find(i=>i.id===id),F=FAULTS[inc.fault];openModal(`<h3>Resolve ${inc.id} and retain the post-mortem</h3><p class="muted" style="margin-bottom:12px">What you write here becomes memory. Next time this pattern appears, the agent recalls it.</p>
  <label>Root cause<textarea id="pmRoot">${esc(F.root)}</textarea></label><label>Resolution steps (one per line)<textarea id="pmSteps" style="min-height:120px">${esc(F.fix.join('\n'))}</textarea></label>
  <div class="btns"><button class="btn ghost" data-act="aiDraft" data-id="${id}">✦ Draft with AI</button><button class="btn" data-act="saveResolve" data-id="${id}">Retain to memory & resolve</button><button class="btn ghost" data-act="closeOv">Cancel</button></div>`)}

/* copilot */
function answer(q){const t=q.toLowerCase();
  if(!S.set.memOn)return{html:'<b>Memory is off, so I only have generic knowledge.</b><ul><li>Check recent deploys and config changes</li><li>Look at CPU, memory, connections and error rates</li><li>Restart only as a last resort</li></ul>Turn Memory on (top bar) and I can recall your past incidents and runbooks.',used:[]};
  if(/^(remember|note|retain|learn)\b/.test(t)){const x=q.replace(/^(remember|note|retain|learn)( that)?[:\s]*/i,'').trim();if(x.length<6)return{html:'Tell me what to remember, for example: “remember that payments-api needs the feature flag off during a rollback”.',used:[]};
    const svc=SERVICES.find(s=>t.includes(s));addMem({cat:'fact',title:'Note from '+S.set.oncall,text:x,service:svc,tags:['chat']});save();updateChrome();return{html:`Retained to memory: “${esc(x)}”. I will recall it for related incidents.`,used:[]}}
  if(/pattern|reflect|insight|what have you learn|learned/.test(t)){const r=S.mem.filter(m=>m.cat==='reflection');return{html:r.length?`I have consolidated <b>${r.length}</b> patterns:<ul>${r.map(m=>`<li>${esc(m.text)}</li>`).join('')}</ul>`:'I have not consolidated any patterns yet. Resolve two incidents of the same type and I will reflect.',used:r.map(m=>({m,cos:1,score:.9}))}}
  if(/mttr|metric|stats|summary|kpi|performance|how are we/.test(t)){const s=stats();return{html:`<ul><li><b>${s.res.length}</b> incidents resolved, <b>${s.open.length}</b> open</li><li>Recent MTTR: <b>${s.mttr} min</b></li><li>Downtime avoided by memory: <b>${s.avoided} min</b> (~${money(s.cost)})</li><li>Recall hit-rate: <b>${s.hit}%</b> across ${S.mem.length} memories</li></ul>`,used:[]}}
  const idm=q.match(/INC-\d{4}-\d+/i),inc=idm&&S.inc.find(i=>i.id.toLowerCase()===idm[0].toLowerCase());
  let query=q,cat;if(inc)query=incQuery(inc);else if(/fix|runbook|resolve|steps|how do|how to|procedure/.test(t))cat='runbook';
  const svc=SERVICES.find(s=>t.includes(s)),hits=recall(query,{k:4,service:svc,cat}).filter(h=>h.cos>=.1);hits.forEach(h=>{h.m.recalls=(h.m.recalls||0)+1});save();
  if(!hits.length)return{html:'I could not find anything relevant in memory. Try naming a service or symptom, or teach me with “remember that …”.',used:[]};
  const top=hits[0].m;
  if(cat==='runbook'&&top.steps)return{html:`Best match: <b>${esc(top.title)}</b> (${Math.round(clamp(hits[0].score,0,.99)*100)}% relevant).${stepsHTML(top.steps)}${top.root?`<small class="muted">Root cause on record: ${esc(top.root)}</small>`:''}`,used:hits};
  return{html:`${inc?`Similar to <b>${inc.id}</b>:`:'Here is what I remember:'}<ul>${hits.map(h=>`<li><b>${esc(h.m.title)}</b> (${ago(h.m.ts)}): ${esc(h.m.text.length>170?h.m.text.slice(0,170)+'…':h.m.text)}</li>`).join('')}</ul>`,used:hits}}
function msgHTML(){return chatLog.map(m=>`<div class="msg ${m.r}">${m.r==='a'&&m.ai?`<div class="aitag">✦ ${esc(m.ai)}</div>`:''}${m.r==='u'?esc(m.t):m.t}</div>`).join('')}
function usedHTML(u){return u.length?u.map(h=>memCard(h)).join(''):'<div class="empty">Memories used for the last answer appear here.</div>'}
PAGES.chat={title:'Copilot',fn(){if(!chatLog.length)chatLog.push({r:'a',t:`Hi ${esc(S.set.oncall)}. I remember ${S.mem.length} things about your infrastructure. Ask about past incidents, fixes or patterns. You can also teach me: “remember that …”.`});
  return `<div class="chat"><div class="card"><h3>SRE Copilot</h3><div class="sub">Answers are grounded in recalled memory. Toggle Memory in the top bar to see the difference.</div><div class="msgs" id="msgs">${msgHTML()}</div>
  <div class="sugg">${['What patterns have you learned?','How do I fix a connection leak?','Show similar incidents to '+(S.inc.length?S.inc[S.inc.length-1].id:'INC-2026-9001'),'Summarise our MTTR','What happened with payments-api before?','remember that api-gateway certs are rotated on the 1st'].map(s=>`<button data-act="ask" data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div>
  <div class="ask"><input id="chatIn" placeholder="Ask about an incident, service or fix…" autocomplete="off"><button class="btn" data-act="send">Send</button></div></div>
  <div class="card"><h3>Recalled memories</h3><div class="sub">What the agent used to answer</div><div id="usedBox" style="display:grid;gap:10px">${usedHTML([])}</div></div></div>`},
 after(){const i=$('#chatIn');i.addEventListener('keydown',e=>{if(e.key==='Enter')sendChat()});const m=$('#msgs');m.scrollTop=m.scrollHeight}};
async function sendChat(text){const inp=$('#chatIn'),q=(text||(inp?inp.value:'')).trim();if(!q||busy.chat)return;if(inp)inp.value='';busy.chat=true;chatLog.push({r:'u',t:q,raw:q});
  const m=$('#msgs');m.innerHTML=msgHTML()+'<div class="msg a typing"><i></i><i></i><i></i></div>';m.scrollTop=m.scrollHeight;
  let a=null;const teach=/^(remember|note|retain|learn)\b/i.test(q);
  if(API.canAI()&&S.set.memOn&&!teach){try{a=await API.chat(q)}catch(e){toast('AI unavailable ('+e.message+'). Answered from local memory.')}}
  if(!a){await sleep(650+Math.random()*450);a=answer(q);a.raw=a.html.replace(/<[^>]+>/g,' ')}
  chatLog.push({r:'a',t:a.html,raw:a.raw,ai:a.model||null});busy.chat=false;if(route!=='chat')return;
  m.innerHTML=msgHTML();$$('p,li',m.lastElementChild).forEach((c,i)=>{c.classList.add('st');c.style.animationDelay=i*110+'ms'});m.scrollTop=m.scrollHeight;
  $('#usedBox').innerHTML=usedHTML(a.used);updateChrome()}

/* memory */
let memTab='all',memQ='';
function memList(){const el=$('#memList');if(!el)return;let items;
  if(memQ.trim()){items=recall(memQ,{k:60,cat:memTab==='all'?undefined:memTab}).filter(h=>h.cos>0.03)}
  else items=S.mem.filter(m=>memTab==='all'||m.cat===memTab).sort((a,b)=>b.ts-a.ts);
  el.innerHTML=items.length?items.slice(0,60).map(h=>memCard(h,true)).join(''):'<div class="empty">No memories match. Retain a post-mortem or note to teach the agent.</div>';
  const c=$('#memCount');if(c)c.textContent=`${items.length} shown of ${S.mem.length}`}
PAGES.mem={title:'Memory Explorer',fn(){const cats=['all','episodic','fact','reflection','runbook'];
  return `<div class="grid g12"><div style="display:grid;gap:16px;align-content:start"><div class="card"><h3>Retain a memory</h3><div class="sub">Store knowledge the agent should remember.</div>
   <label>Title<input id="mTitle" placeholder="e.g. Search cluster autoscaling limits"></label><label>Memory<textarea id="mText" placeholder="Describe the fact, decision or lesson…"></textarea></label>
   <div class="row"><label>Category<select id="mCat"><option value="fact">fact</option><option value="episodic">episodic</option><option value="reflection">reflection</option><option value="runbook">runbook</option></select></label><label>Service<select id="mSvc"><option value="">any</option>${SERVICES.map(s=>`<option>${s}</option>`).join('')}</select></label></div>
   <div class="btns"><button class="btn" data-act="retain">Retain</button><button class="btn ghost" data-act="reflect">Run reflection</button></div></div>
   <div class="card"><h3>Memory by category</h3><div class="box"><canvas id="cMem"></canvas></div></div></div>
  <div class="card"><div class="tabs" id="memTabs">${cats.map(c=>`<button class="${c===memTab?'on':''}" data-act="memTab" data-id="${c}">${c}</button>`).join('')}</div>
   <label style="margin-top:14px">Recall test: type a symptom or question and see what is retrieved<input id="memQ" value="${esc(memQ)}" placeholder="e.g. connections 250/250 low cpu"></label><small class="muted" id="memCount"></small>
   <div class="memgrid" id="memList" style="margin-top:12px"></div></div></div>`},
 after(){memList();$('#memQ').addEventListener('input',e=>{memQ=e.target.value;memList()});
  const c={};S.mem.forEach(m=>c[m.cat]=(c[m.cat]||0)+1);mk('cMem',{type:'doughnut',data:pieData(Object.keys(c),Object.values(c)),options:Object.assign(pieOpt(),{cutout:'58%'})},S.mem.length>0)}};

/* runbooks */
PAGES.run={title:'Runbooks',fn(){return `<div class="card" style="margin-bottom:16px"><h3>Learned runbooks</h3><div class="sub">Runbooks are created automatically when a post-mortem is retained. Success rate = incidents of this type resolved by the recalled runbook.</div></div><div class="memgrid" style="grid-template-columns:repeat(auto-fill,minmax(340px,1fr))">${FKEYS.map(k=>{const F=FAULTS[k],rb=S.mem.find(m=>m.cat==='runbook'&&m.fault===k),inc=S.inc.filter(i=>i.fault===k&&i.status==='resolved'),mm=inc.filter(i=>i.path==='memory'),rate=inc.length?Math.round(mm.length/inc.length*100):0,avg=mm.length?Math.round(mm.reduce((a,i)=>a+i.mttr,0)/mm.length):0;
  return rb?`<div class="card"><div class="rb">${ring(rate)}<div><h3>${esc(F.name)}</h3><small class="muted">${esc(F.svc)} · <span class="sev ${F.sev}">${F.sev}</span></small><br><small class="muted">${inc.length} incidents · avg memory MTTR ${avg||'-'} min · recalled ${rb.recalls||0}×</small></div></div>${stepsHTML(rb.steps)}<div class="btns" style="margin-top:12px"><button class="btn ghost sm" data-act="editRb" data-id="${rb.id}">Edit steps</button><button class="btn ghost sm" data-act="testFault" data-id="${k}">Inject test</button></div></div>`
   :`<div class="card"><h3>${esc(F.name)}</h3><small class="muted">${esc(F.svc)} · <span class="sev ${F.sev}">${F.sev}</span></small><div class="empty" style="margin-top:12px">No runbook yet. The agent has never seen this failure.</div><div class="btns" style="margin-top:12px"><button class="btn sm" data-act="testFault" data-id="${k}">Inject to teach the agent</button></div></div>`}).join('')}</div>`},after(){animRings()}};

/* analytics */
PAGES.ana={title:'Analytics',fn(){return `<div class="grid g2"><div class="card"><h3>MTTR: memory vs. stateless baseline</h3><div class="sub">Solid line: actual MTTR. Dashed: what the stateless agent would have needed.</div><div class="box tall"><canvas id="a1"></canvas></div></div>
  <div class="card"><h3>Agent confidence learning curve</h3><div class="sub">Confidence at triage time, per incident</div><div class="box tall"><canvas id="a2"></canvas></div></div>
  <div class="card"><h3>Downtime cost avoided by fault type</h3><div class="sub">Bar · estimated $ saved through memory</div><div class="box"><canvas id="a3"></canvas></div></div>
  <div class="card"><h3>Root-cause distribution</h3><div class="sub">Doughnut</div><div class="box"><canvas id="a4"></canvas></div></div>
  <div class="card"><h3>Memory bank growth</h3><div class="sub">Line · cumulative memories over time</div><div class="box"><canvas id="a5"></canvas></div></div>
  <div class="card"><h3>Service × failure heatmap</h3><div class="sub">Incident counts</div><div style="overflow-x:auto" id="heat"></div></div></div>`},
 after(){const r=stats().res,lab=r.map(i=>i.id.slice(-4));
  mk('a1',{type:'line',data:{labels:lab,datasets:[{label:'Actual MTTR',data:r.map(i=>i.mttr),borderColor:'#0ea5e9',backgroundColor:'#0ea5e933',fill:true,tension:.35,pointRadius:4},{label:'Stateless baseline',data:r.map(i=>i.baseline),borderColor:'#0369a1',borderDash:[6,5],tension:.35,pointRadius:0}]},options:{plugins:{legend:Object.assign({position:'bottom'},legend)},scales:axes()}},r.length>0);
  mk('a2',{type:'line',data:{labels:lab,datasets:[{label:'Confidence %',data:r.map(i=>i.conf),borderColor:'#0369a1',backgroundColor:'#38bdf844',fill:true,tension:.4,pointRadius:4}]},options:{plugins:{legend:{display:false}},scales:axes({max:100})}},r.length>0);
  const cost={};r.filter(i=>i.path==='memory').forEach(i=>cost[i.fault]=(cost[i.fault]||0)+Math.max(0,i.baseline-i.mttr)*COST[i.sev]);
  mk('a3',{type:'bar',data:{labels:Object.keys(cost).map(k=>FAULTS[k].name),datasets:[{data:Object.values(cost).map(Math.round),backgroundColor:PALETTE,borderRadius:8}]},options:{plugins:{legend:{display:false}},scales:axes()}},Object.keys(cost).length>0);
  const by={};S.inc.forEach(i=>by[i.fault]=(by[i.fault]||0)+1);mk('a4',{type:'doughnut',data:pieData(Object.keys(by).map(k=>FAULTS[k].name),Object.values(by)),options:Object.assign(pieOpt(),{cutout:'55%'})},S.inc.length>0);
  const ms=[...S.mem].sort((a,b)=>a.ts-b.ts),days=[];for(let d=30;d>=0;d--)days.push(Date.now()-d*DAY);
  mk('a5',{type:'line',data:{labels:days.map(d=>new Date(d).toLocaleDateString(undefined,{month:'short',day:'numeric'})),datasets:[{label:'Memories',data:days.map(d=>ms.filter(m=>m.ts<=d).length),borderColor:'#0ea5e9',backgroundColor:'#0ea5e933',fill:true,stepped:true,pointRadius:0}]},options:{plugins:{legend:{display:false}},scales:axes()}},ms.length>0);
  const svcs=[...new Set(S.inc.map(i=>i.service))],fs=[...new Set(S.inc.map(i=>i.fault))];let mx=1;const cnt={};S.inc.forEach(i=>{const k=i.service+'|'+i.fault;cnt[k]=(cnt[k]||0)+1;mx=Math.max(mx,cnt[k])});
  $('#heat').innerHTML=svcs.length?`<table><tr><th></th>${fs.map(f=>`<th>${FAULTS[f].name.split(' ').slice(0,2).join(' ')}</th>`).join('')}</tr>${svcs.map(s=>`<tr><td class="l">${s}</td>${fs.map(f=>{const c=cnt[s+'|'+f]||0,a=c?.15+c/mx*.85:.05;return `<td style="background:rgba(14,165,233,${a});color:${a>.55?'#fff':'var(--text)'}">${c||''}</td>`}).join('')}</tr>`).join('')}</table>`:'<div class="empty">No incidents yet.</div>'}};

/* benchmark */
let bench=null;
PAGES.bench={title:'Benchmark',fn(){return `<div class="card"><h3>Does memory actually help?</h3><div class="sub">Runs a fresh alert for every failure type through both agents. The stateless baseline is a scripted generic recommendation that treats the symptom instead of the root cause. The memory agent must recognise the pattern from what it has retained.</div><div class="btns"><button class="btn" data-act="runBench">Run benchmark</button><button class="btn ghost" data-act="teachAll">Teach unknown patterns</button></div></div><div id="benchOut" class="mt"></div>`},
 after(){benchOut()}};
function benchOut(){const el=$('#benchOut');if(!el)return;if(!bench){el.innerHTML='<div class="empty">Run the benchmark to see how many failure types the agent recognises today. Then teach it and run again.</div>';return}
  const ok=bench.filter(b=>b.ok).length,n=FKEYS.length;
  el.innerHTML=`<div class="grid g3">${kpi('Memory agent accuracy',Math.round(ok/n*100),'pct')}${kpi('Stateless baseline accuracy',0,'pct')}${kpi('Patterns recognised',ok,'n')}</div>
  <div class="grid g21 mt"><div class="card"><h3>Confidence by failure type</h3><div class="box"><canvas id="bC"></canvas></div></div><div class="card"><h3>Results</h3><div style="display:grid;gap:8px">${bench.map((b,i)=>`<div class="recall" style="margin:0"><div style="animation-delay:${i*.06}s"><b>${esc(FAULTS[b.k].name)}</b><br><span class="tag ${b.ok?'c-runbook':'c-reflection'}">${b.ok?'recognised':b.key?'misdiagnosed':'unknown'}</span> <small class="muted">${b.conf}% confidence</small></div></div>`).join('')}</div></div></div>`;
  mk('bC',{type:'bar',data:{labels:bench.map(b=>FAULTS[b.k].name.split(' ').slice(0,2).join(' ')),datasets:[{label:'Memory agent',data:bench.map(b=>b.conf),backgroundColor:'#0ea5e9',borderRadius:8},{label:'Stateless',data:bench.map(()=>45),backgroundColor:'#bae6fd',borderRadius:8}]},options:{plugins:{legend:Object.assign({position:'bottom'},legend)},scales:axes({max:100})}});countUps()}
async function runBench(){const el=$('#benchOut');bench=[];for(const k of FKEYS){const tmp=Object.assign(newIncident(k,FAULTS[k].svc),{});S.seq--;const d=S.set.memOn?diagnose(tmp,false):{key:null,conf:45};bench.push({k,ok:d.key===k,key:d.key,conf:d.conf});el.innerHTML=`<div class="card"><div class="loader"><div class="orbs"><i></i><i></i><i></i></div><div class="scan"></div><b>Testing ${bench.length}/${FKEYS.length}: ${esc(FAULTS[k].name)}</b></div></div>`;await sleep(420)}benchOut()}
function teachAll(){let n=0;FKEYS.forEach(k=>{if(!S.mem.find(m=>m.cat==='runbook'&&m.fault===k)){learn(k,{service:FAULTS[k].svc,ts:Date.now(),mttr:FAULTS[k].mem+2});n++}});save();updateChrome();toast(n?`Retained ${n} imported post-mortems`:'Nothing left to teach. All patterns known.')}

/* lab */
PAGES.lab={title:'Lab & Docs',fn(){return `${aiCardHTML()}<div class="grid g2 mt"><div class="card"><h3>Settings</h3><label>On-call engineer<input id="setName" value="${esc(S.set.oncall)}"></label><label>Telemetry refresh: <b id="spV">${(S.set.speed/1000).toFixed(1)}s</b><input id="setSpeed" type="range" min="500" max="4000" step="250" value="${S.set.speed}"></label><button class="btn" data-act="saveSet">Save settings</button></div>
  <div class="card"><h3>Data controls</h3><div class="sub">Everything in this app is stored in your browser.</div><div class="btns"><button class="btn" data-act="reseed">Regenerate demo data</button><button class="btn ghost" data-act="wipeMem">Erase memory only</button><button class="btn danger" data-act="wipeAll">Erase everything</button></div>
   <label style="margin-top:14px">Export / import JSON<textarea id="ioBox" placeholder="Click Export, or paste JSON here and click Import"></textarea></label><div class="btns"><button class="btn ghost sm" data-act="exportD">Export</button><button class="btn ghost sm" data-act="importD">Import</button></div></div></div>
  <div class="card mt"><h3>How Hindsight memory is used here</h3><div class="sub">Memory is the product, not a feature. Every screen reads from or writes to it.</div>
  <table style="text-align:left"><tr><th style="text-align:left">Hindsight operation</th><th style="text-align:left">Where it happens</th></tr>
  <tr><td class="l">retain</td><td style="text-align:left">Resolving an incident stores an episodic post-mortem and creates a runbook if the pattern is new. The Copilot and Memory Explorer can retain notes too.</td></tr>
  <tr><td class="l">recall</td><td style="text-align:left">Triage, Copilot, the Memory recall test and the Benchmark search memory for the alert’s symptoms and vote on the matching pattern.</td></tr>
  <tr><td class="l">reflect</td><td style="text-align:left">After each resolution, repeated incidents are consolidated into learned patterns with MTTR and success stats.</td></tr></table>
  <p class="muted" style="margin-top:12px"><b>How the pieces fit:</b> the browser keeps a fast local memory engine (TF-IDF cosine similarity, recency, service match and reinforcement) so recall works offline. When the backend is running, Groq writes the triage plans, Copilot answers, post-mortem drafts and incident reports, grounded in the memories recalled locally. The optional Hindsight bridge mirrors every post-mortem to a real Hindsight bank. Executing a plan is simulated, and the stateless baseline uses scripted advice when Groq is offline.</p></div>`},
 after(){$('#setSpeed').oninput=e=>{$('#spV').textContent=(e.target.value/1000).toFixed(1)+'s'}}};

