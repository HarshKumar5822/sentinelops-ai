/* ═══ memory.js — Hindsight-style memory engine: retain / recall / reflect
   SentinelOps AI · Created by Harsh Kumar ═══ */
'use strict';
/* ---------- Hindsight-style memory engine (retain / recall / reflect) ---------- */
const STOP=new Set('the a an and or of to in on for with is are was were be it this that at as by from we they you our their have has had will not no but if then so what which who how when do does did into than'.split(' '));
function tok(s){const out=[];(String(s).toLowerCase().match(/[a-z0-9][a-z0-9._\-\/%]*/g)||[]).forEach(w=>{w=w.replace(/[._\-\/]+$/,'');if(!w)return;const add=x=>{if(x.length>1&&!STOP.has(x))out.push(x.length>3&&x.endsWith('s')&&!x.endsWith('ss')?x.slice(0,-1):x)};add(w);if(/[-_\/.]/.test(w))w.split(/[-_\/.]+/).forEach(add)});return out}
function addMem(o){const m=Object.assign({id:uid(),ts:Date.now(),recalls:0,tags:[]},o);m.tok=tok([m.title,m.text,m.tags.join(' '),m.service||''].join(' '));S.mem.push(m);return m}
function reTok(m){m.tok=tok([m.title,m.text,m.tags.join(' '),m.service||''].join(' '))}
function cstats(){const df=new Map();S.mem.forEach(m=>new Set(m.tok).forEach(t=>df.set(t,(df.get(t)||0)+1)));return{N:S.mem.length,df}}
function vec(tokens,st){const tf=new Map();tokens.forEach(t=>tf.set(t,(tf.get(t)||0)+1));const v=new Map();let n=0;tf.forEach((c,t)=>{const w=(1+Math.log(c))*Math.log(1+(st.N+1)/((st.df.get(t)||0)+1));v.set(t,w);n+=w*w});return{v,n:Math.sqrt(n)||1}}
function cosine(a,b){let d=0;a.v.forEach((w,t)=>{const x=b.v.get(t);if(x)d+=w*x});return d/(a.n*b.n)}
/** recall(): semantic-ish retrieval — TF-IDF cosine + service match + recency + reinforcement */
function recall(q,o={}){const st=cstats(),qv=vec(tok(q),st);
  return S.mem.filter(m=>!o.cat||m.cat===o.cat).map(m=>{const cos=cosine(qv,vec(m.tok,st));let s=cos;if(o.service&&m.service===o.service)s+=.06;s+=.04*Math.exp(-(Date.now()-m.ts)/(45*DAY));s+=Math.min(.06,(m.recalls||0)*.004);return{m,cos,score:s}}).sort((a,b)=>b.score-a.score).slice(0,o.k||5)}
/** retain(): store a post-mortem as episodic memory, and create a runbook if the pattern is new */
function learn(k,o){const F=FAULTS[k],steps=o.steps&&o.steps.length?o.steps:F.fix,root=o.root||F.root,symp=o.inc?o.inc.symptoms:F.sym(),logs=o.inc?o.inc.logs:F.log();
  addMem({cat:'episodic',title:`${o.inc?o.inc.id:'Post-mortem'}: ${F.name} on ${o.service}`,text:`Symptoms: ${symp.join('; ')}. Logs: ${logs.join(' | ')}. Root cause: ${root} Resolution: ${steps.join('; ')}`,fault:k,service:o.service,steps,root,mttr:o.mttr,ts:o.ts,tags:[k,o.service]});
  let rb=S.mem.find(m=>m.cat==='runbook'&&m.fault===k);
  if(!rb)rb=addMem({cat:'runbook',title:`Runbook: ${F.name}`,text:`When you see: ${symp.slice(0,3).join('; ')}. Do: ${steps.join('; ')}`,fault:k,service:o.service,steps,root,ts:o.ts,tags:[k,'runbook']});
  return rb}
/** reflect(): consolidate repeated incidents into learned patterns */
function reflect(){let n=0;FKEYS.forEach(k=>{const done=S.inc.filter(i=>i.fault===k&&i.status==='resolved');if(done.length<2)return;const F=FAULTS[k],viaMem=done.filter(i=>i.path==='memory').length,avg=Math.round(done.reduce((a,i)=>a+i.mttr,0)/done.length),svcs=[...new Set(done.map(i=>i.service))].join(', ');
  const rb=S.mem.find(m=>m.cat==='runbook'&&m.fault===k),steps=rb?rb.steps:F.fix;
  const text=`Pattern learned: ${F.name}. Signature: ${F.sym().slice(0,2).join('; ')}. Seen ${done.length} times on ${svcs}; average MTTR ${avg} min; ${viaMem} resolved by recalled runbook. Best action: ${steps[0]}. Avoid: ${F.bad.steps[0]}.`;
  let r=S.mem.find(m=>m.cat==='reflection'&&m.fault===k);
  if(r){r.text=text;r.steps=steps;r.ts=Date.now();reTok(r)}else addMem({cat:'reflection',title:`Reflection: ${F.name}`,text,fault:k,service:F.svc,steps,root:F.root,tags:[k,'pattern']});n++});return n}

