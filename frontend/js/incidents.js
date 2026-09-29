/* ═══ incidents.js — incidents, triage, demo seed and live telemetry
   SentinelOps AI · Created by Harsh Kumar ═══ */
'use strict';
/* ---------- incidents / telemetry ---------- */
function newIncident(k,service,ts=Date.now()){const F=FAULTS[k];return{id:'INC-2026-'+(S.seq++),fault:k,service,sev:F.sev,title:`${F.alert} · ${service}`,ts,status:'open',symptoms:F.sym(),logs:F.log(),triage:null,attempts:[],execLog:[],timeline:[{ts,text:'Alert fired: '+F.alert}],penalty:0}}
const incQuery=i=>`${i.service} ${i.symptoms.join(' ')} ${i.logs.join(' ')}`;
const COS_MIN=.24;
/** diagnose(): recall -> weighted vote across recalled memories -> plan */
function diagnose(inc,touch){
  const hits=recall(incQuery(inc),{k:6,service:inc.service}),votes={};
  hits.forEach(h=>{if(h.m.fault&&h.cos>=COS_MIN)votes[h.m.fault]=(votes[h.m.fault]||0)+h.score});
  const rk=Object.entries(votes).sort((a,b)=>b[1]-a[1]),key=rk[0]?rk[0][0]:null,F=FAULTS[inc.fault],shown=hits.filter(h=>h.cos>=.1).slice(0,4);
  if(touch)hits.filter(h=>h.cos>=COS_MIN).forEach(h=>h.m.recalls=(h.m.recalls||0)+1);
  if(key){const rb=S.mem.find(m=>m.cat==='runbook'&&m.fault===key)||S.mem.find(m=>m.fault===key&&m.steps),ep=S.mem.filter(m=>m.cat==='episodic'&&m.fault===key).sort((a,b)=>b.ts-a.ts),top=hits.find(h=>h.m.fault===key),n=hits.filter(h=>h.m.fault===key&&h.cos>=COS_MIN).length;
    const ms=S.inc.filter(i=>i.fault===key&&i.path==='memory'&&i.status==='resolved').slice(-3).map(i=>i.mttr);
    const eta=ms.length?Math.max(2,Math.round(ms.reduce((a,b)=>a+b,0)/ms.length)):Math.round(FAULTS[key].mem*1.5);
    return{key,hits:shown,conf:clamp(Math.round(55+top.cos*45+Math.min(8,n*2)),60,98),steps:rb.steps,root:(ep[0]&&ep[0].root)||rb.root,analysis:`Recalled ${n} similar memories. The symptom pattern matches “${FAULTS[key].name}”. ${(ep[0]&&ep[0].root)||''}`,risk:'Low. This runbook resolved earlier incidents without a restart or reboot.',eta,fallback:false}}
  return{key:null,hits:shown,conf:clamp(Math.round(38+(hits[0]?hits[0].cos*40:0)),38,58),steps:F.bad.steps,root:null,analysis:'No memory matches this failure pattern (nothing above the similarity threshold), so I am falling back to generic reasoning. Resolve it, then retain the post-mortem so I recognise it next time.',risk:F.bad.risk,eta:F.bad.mttr,fallback:true}}
function runTriage(inc){const F=FAULTS[inc.fault];const stateless={analysis:F.bad.text,steps:F.bad.steps,risk:F.bad.risk,conf:ri(41,49),eta:F.bad.mttr};
  const memory=S.set.memOn?diagnose(inc,true):{off:true};inc.triage={stateless,memory,ts:Date.now()};
  inc.hit=S.set.memOn?memory.key===inc.fault:undefined;
  inc.timeline.push({ts:Date.now(),text:S.set.memOn?(memory.fallback?'Memory agent: no matching memory, fell back to generic plan':`Memory agent recognised “${FAULTS[memory.key].name}” (${memory.conf}% confidence)`):'Triage run with memory disabled'});save()}
function resolveInc(inc,{path,mttr,root,steps}){const F=FAULTS[inc.fault];inc.status='resolved';inc.resolvedTs=Date.now();inc.path=path;inc.mttr=mttr;inc.baseline=F.bad.mttr;
  inc.conf=inc.triage?(inc.triage.memory.off?inc.triage.stateless.conf:inc.triage.memory.conf):42;
  inc.timeline.push({ts:Date.now(),text:(path==='memory'?'Memory runbook resolved the incident':'Engineer resolved the incident manually')+` in ${mttr} min`});
  if(SV[inc.service])SV[inc.service].inc=null;
  learn(inc.fault,{service:inc.service,ts:Date.now(),mttr,root,steps,inc});API.mirror(inc,root||F.root,steps||F.fix,mttr);
  if(path==='memory'){const rb=S.mem.find(m=>m.cat==='runbook'&&m.fault===inc.fault);if(rb)rb.recalls=(rb.recalls||0)+1}
  const n=reflect();inc.timeline.push({ts:Date.now(),text:'Post-mortem retained to memory'+(n?` · ${n} reflection${n>1?'s':''} updated`:'')});save()}
function stats(){const res=S.inc.filter(i=>i.status==='resolved').sort((a,b)=>a.ts-b.ts),open=S.inc.filter(i=>i.status!=='resolved'),last=res.slice(-8),mm=res.filter(i=>i.path==='memory');
  const avoided=mm.reduce((a,i)=>a+Math.max(0,i.baseline-i.mttr),0),cost=mm.reduce((a,i)=>a+Math.max(0,i.baseline-i.mttr)*COST[i.sev],0),hs=S.inc.filter(i=>i.hit!==undefined);
  return{res,open,mttr:last.length?Math.round(last.reduce((a,i)=>a+i.mttr,0)/last.length):0,avoided,cost,hit:hs.length?Math.round(hs.filter(i=>i.hit).length/hs.length*100):0,mems:S.mem.length}}

/* ---------- seed ---------- */
function genSeed(){
  const prev=S&&S.set?S.set:null;
  S={v:2,mem:[],inc:[],seq:9001,set:Object.assign({},DEFAULT_SET,prev?{oncall:prev.oncall,apiBase:prev.apiBase,autoSync:prev.autoSync,navCollapsed:prev.navCollapsed,speed:prev.speed}:{})};
  [['auth-service architecture','auth-service runs on Kubernetes with 12 pods and connects to PostgreSQL auth-db through a connection pool capped at 250 connections.','auth-service'],
   ['cache-cluster configuration','cache-cluster is a 6-node Redis cluster storing user sessions with maxmemory 8gb; sessions are written with SETEX.','cache-cluster'],
   ['Deploy process','payments-api ships through helm with a canary at 10 percent then full rollout; rollback is helm rollback to the previous release.','payments-api'],
   ['orders-db topology','orders-db is PostgreSQL with one primary and two replicas on a 500GB gp3 data volume; audit logging writes to audit.log.','orders-db'],
   ['Edge TLS','api-gateway terminates TLS for api.example.com; certificates are issued by cert-manager using ACME DNS challenges and rotate every 90 days.','api-gateway'],
   ['On-call policy','Severity CRITICAL incidents page the on-call SRE immediately. Always prefer non-destructive fixes before restarts or reboots.',null]]
   .forEach(([t,x,s],i)=>addMem({cat:'fact',title:t,text:x,service:s||undefined,ts:Date.now()-(70-i)*DAY,tags:['architecture']}));
  const known=['conn_leak','redis_evict','bad_deploy'];
  for(let i=0;i<14;i++){const k=known[i%3],F=FAULTS[k],ts=Date.now()-(60-i*4.2)*DAY-ri(0,8)*36e5,manual=i<3,prog=Math.min(1,(i-3)/9);
    const inc=newIncident(k,F.svc,ts);inc.status='resolved';inc.path=manual?'manual':'memory';inc.baseline=F.bad.mttr;
    inc.mttr=manual?Math.round(F.bad.mttr*rnd(.7,.85)):Math.max(2,Math.round(F.mem*(1.9-prog)+rnd(0,1.5)));
    inc.conf=manual?ri(41,48):Math.round(62+prog*32+rnd(-2,2));inc.hit=!manual;inc.resolvedTs=ts+inc.mttr*MIN;
    inc.timeline=[{ts,text:'Alert fired: '+F.alert},{ts:ts+MIN,text:manual?'Engineer investigated manually':'Memory agent executed the recalled runbook'},{ts:inc.resolvedTs,text:`Resolved in ${inc.mttr} min · post-mortem retained`}];
    S.inc.push(inc);const rb=learn(k,{service:inc.service,ts:inc.resolvedTs,mttr:inc.mttr,inc});if(!manual)rb.recalls++}
  reflect();S.mem.forEach(m=>{if(m.cat==='episodic')m.recalls=ri(0,3)});S.inc.sort((a,b)=>a.ts-b.ts)}

/* ---------- live telemetry ---------- */
const baseFor=()=>({cpu:rnd(22,38),mem:rnd(40,60),lat:rnd(110,240),err:rnd(.1,.6),sat:rnd(25,45)});
function initTelemetry(){SERVICES.forEach(s=>{SV[s]=Object.assign(baseFor(),{base:baseFor(),inc:null});LIVE[s]={t:[],lat:[],err:[],cpu:[]}});S.inc.filter(i=>i.status==='open').forEach(i=>{if(SV[i.service])SV[i.service].inc=i.id})}
const svStatus=v=>v.err>20||v.lat>2000?'crit':(v.err>3||v.lat>600||v.cpu>85||v.sat>92)?'warn':'ok';
function tick(){if(document.hidden)return;
  SERVICES.forEach(s=>{const v=SV[s],inc=v.inc&&S.inc.find(i=>i.id===v.inc),T=inc?FAULTS[inc.fault].tel:v.base;
    ['cpu','mem','lat','err','sat'].forEach(m=>{const scale=m==='lat'?.06:m==='err'?.08:.05;v[m]+=(T[m]-v[m])*.3+(Math.random()-.5)*Math.max(T[m],1)*scale;v[m]=clamp(v[m],m==='lat'?40:0,m==='lat'?20000:100)});
    const L=LIVE[s];L.t.push(hms(Date.now()));L.lat.push(Math.round(v.lat));L.err.push(+v.err.toFixed(1));L.cpu.push(Math.round(v.cpu));['t','lat','err','cpu'].forEach(k=>{if(L[k].length>40)L[k].shift()})});
  if(S.set.chaos&&Math.random()<.04&&S.inc.filter(i=>i.status==='open').length<3){const free=SERVICES.filter(s=>!SV[s].inc);if(free.length)inject(pick(FKEYS),pick(free),true)}
  pushLog();refreshTiles();updateLive()}
function pushLog(){const s=pick(SERVICES),v=SV[s],inc=v.inc&&S.inc.find(i=>i.id===v.inc);let lvl='INFO',txt;
  if(inc&&Math.random()<.7){const l=pick(inc.logs);const m=l.match(/^(ERROR|WARN|FATAL|ALERT|INFO)\s+(.*)$/);lvl=m?m[1]:'WARN';txt=m?m[2]:l}else txt=`GET /v1/${pick(['users','orders','session','search','health','pay'])} 200 ${ri(12,90)}ms`;
  const e={ts:Date.now(),lvl,s,txt};LOGS.unshift(e);if(LOGS.length>40)LOGS.pop();
  const box=$('#liveLog');if(box){const d=document.createElement('div');d.className='ln '+lvl;d.textContent=`[${hms(e.ts)}] ${lvl} ${s}: ${txt}`;box.prepend(d);while(box.children.length>30)box.lastChild.remove()}}
function refreshTiles(){SERVICES.forEach(s=>{const t=$(`.tile[data-svc="${s}"]`);if(!t)return;const v=SV[s];t.className='tile '+svStatus(v)+(s===selSvc?' sel':'');
  t.querySelector('[data-m=cpu]').textContent=Math.round(v.cpu)+'%';t.querySelector('[data-m=lat]').textContent=Math.round(v.lat)+'ms';t.querySelector('[data-m=err]').textContent=v.err.toFixed(1)+'%';t.querySelector('[data-m=sat]').textContent=Math.round(v.sat)+'%'})}
let liveChart=null;
function updateLive(){if(!liveChart)return;const L=LIVE[selSvc];liveChart.data.labels=L.t;liveChart.data.datasets[0].data=L.lat;liveChart.data.datasets[1].data=L.err;liveChart.data.datasets[2].data=L.cpu;liveChart.update('none')}
function inject(k,service,auto){if(SV[service].inc){toast(`${service} already has an active incident`);return null}
  const inc=newIncident(k,service);S.inc.push(inc);SV[service].inc=inc.id;save();
  toast((auto?'Auto-chaos: ':'')+`${inc.sev} alert on ${service}`);if(route==='war')render();else if(route==='inc'){renderIncList()}
  updateChrome();return inc}

