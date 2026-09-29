/* ═══ ui.js — charts and UI helpers
   SentinelOps AI · Created by Harsh Kumar ═══ */
'use strict';
/* ---------- chart helpers ---------- */
let CH=[];const cvar=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function mk(id,cfg,has=true){const el=document.getElementById(id);if(!el)return null;
  if(!has||typeof Chart==='undefined'){el.parentElement.innerHTML=`<div class="empty small">${has?'Chart library could not load. Check your connection.':'No data yet. Inject an incident to populate this chart.'}</div>`;return null}
  Chart.defaults.color=cvar('--muted');Chart.defaults.font.family=cvar('--font');cfg.options=Object.assign({responsive:true,maintainAspectRatio:false},cfg.options||{});const c=new Chart(el,cfg);CH.push(c);return c}
const gridC=()=>cvar('--line')+'aa';
const axes=(o={})=>({x:{grid:{color:gridC()},ticks:{color:cvar('--muted'),maxRotation:0,autoSkip:true}},y:Object.assign({grid:{color:gridC()},ticks:{color:cvar('--muted')},beginAtZero:true},o)});
const legend={labels:{color:cvar('--text'),boxWidth:12,usePointStyle:true}};
const pieOpt=()=>({plugins:{legend:Object.assign({position:'bottom'},legend)}});
const pieData=(labels,data)=>({labels,datasets:[{data,backgroundColor:PALETTE,borderColor:cvar('--surface'),borderWidth:3}]});
function destroyCharts(){CH.forEach(c=>c.destroy());CH=[];liveChart=null}

/* ---------- ui helpers ---------- */
const IC={shield:'<path d="M12 3l8 3v6c0 4.5-3.3 8-8 9-4.7-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',alert:'<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',bot:'<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4"/><circle cx="9" cy="14" r="1.2"/><circle cx="15" cy="14" r="1.2"/>',db:'<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/>',chart:'<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',gauge:'<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/>',flask:'<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/>'};
const icon=n=>`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${IC[n]}</svg>`;
const NAV_GROUPS=[['Operate',[['war','War Room','shield'],['inc','Incidents','alert'],['chat','Copilot','bot']]],['Knowledge',[['mem','Memory','db'],['run','Runbooks','book']]],['Insights',[['ana','Analytics','chart'],['bench','Benchmark','gauge']]],['System',[['lab','Lab & Docs','flask']]]];
const NAV_ITEMS=NAV_GROUPS.flatMap(g=>g[1]);
function toast(t){const d=document.createElement('div');d.className='toast';d.textContent=t;$('#toasts').appendChild(d);setTimeout(()=>{d.classList.add('out');setTimeout(()=>d.remove(),450)},3200)}
function openModal(html){$('#modalRoot').innerHTML=`<div class="ov" data-act="closeOv"><div class="modal">${html}</div></div>`}
const closeModal=()=>{$('#modalRoot').innerHTML=''};
function ripple(b,e){const r=b.getBoundingClientRect(),d=Math.max(r.width,r.height),s=document.createElement('span');s.className='ripple';s.style.cssText=`width:${d}px;height:${d}px;left:${e.clientX-r.left-d/2}px;top:${e.clientY-r.top-d/2}px`;b.appendChild(s);setTimeout(()=>s.remove(),600)}
function countUps(){$$('[data-count]').forEach(el=>{const to=+el.dataset.count,f=el.dataset.fmt,t0=performance.now();(function st(t){const p=Math.min(1,(t-t0)/900),v=to*(1-Math.pow(1-p,3));el.textContent=f==='money'?money(v):f==='pct'?Math.round(v)+'%':f==='min'?Math.round(v)+' min':Math.round(v);if(p<1)requestAnimationFrame(st)})(t0)})}
const kpi=(label,val,fmt)=>`<div class="card kpi"><b data-count="${val}" data-fmt="${fmt}">0</b><span>${label}</span></div>`;
const ring=(v,id)=>`<svg class="ring" viewBox="0 0 64 64" style="--v:0" data-v="${v}"><circle class="bg" cx="32" cy="32" r="28"/><circle class="fg" cx="32" cy="32" r="28"/><text x="32" y="33">${v}%</text></svg>`;
function animRings(){requestAnimationFrame(()=>setTimeout(()=>$$('.ring').forEach(r=>r.style.setProperty('--v',r.dataset.v)),60))}
const stepsHTML=a=>`<ol class="steps">${a.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`;
function memCard(h,full){const m=h.m||h,rel=h.cos!==undefined?Math.round(clamp(h.score,0,.99)*100):null;
  return `<div class="mem"><div class="mem-h"><span class="tag c-${m.cat}">${m.cat}</span><b>${esc(m.title)}</b>${rel!==null?`<span class="rel">${rel}%</span>`:''}</div><p>${esc(full||m.text.length<=250?m.text:m.text.slice(0,250)+'…')}</p>${full&&m.steps?stepsHTML(m.steps):''}${rel!==null?`<div class="bar"><i style="width:${rel}%"></i></div>`:''}<div class="mem-f"><small>${ago(m.ts)}${m.service?' · '+esc(m.service):''} · recalled ${m.recalls||0}×</small><button class="x" data-act="delMem" data-id="${m.id}">Forget</button></div></div>`}


/* ═════ sidebar / dock navigation ═════ */
function buildNav(){const nav=$('#nav');let n=0;
  nav.insertAdjacentHTML('beforeend',NAV_GROUPS.map(([g,items])=>`<div class="grp">${g}</div>`+items.map(([id,t,ic])=>{n++;return `<button data-act="go" data-id="${id}" data-r="${id}" data-tip="${t}" aria-label="${t}"><span class="ni">${icon(ic)}</span><span class="nl">${t}</span><span class="nb" id="nb-${id}"></span><span class="kbd">${n}</span></button>`}).join('')).join(''));
  nav.addEventListener('mouseover',e=>{const b=e.target.closest('button');if(!b||innerWidth<=900)return;moveEl($('#navHover'),b);nav.classList.add('hov')});
  nav.addEventListener('mouseleave',()=>nav.classList.remove('hov'))}
function moveEl(el,b){el.style.transform=`translateY(${b.offsetTop}px)`;el.style.height=b.offsetHeight+'px'}
function markNav(){$$('#nav button').forEach(b=>{const on=b.dataset.r===route;b.classList.toggle('active',on);b.setAttribute('aria-current',on?'page':'false');
  if(on){if(innerWidth>900)moveEl($('#navInd'),b);else if(b.scrollIntoView)b.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'})}})}
function setBadge(id,v,alert){const b=$('#nb-'+id);if(!b)return;const prev=b.textContent;b.textContent=v>99?'99+':v;b.classList.toggle('show',v>0);b.classList.toggle('alert',!!alert&&v>0);b.parentElement.classList.toggle('hasbadge',v>0);
  if(prev!==String(v)&&v>0){b.style.animation='none';void b.offsetWidth;b.style.animation=''}}
function updateChrome(){const open=S.inc.filter(i=>i.status!=='resolved').length,n=S.mem.length;
  $('#orbS').textContent=`${n} memories · ${open} open`;$('#orbT').textContent=S.set.memOn?'Memory online':'Memory disabled';$('#orb').classList.toggle('off',!S.set.memOn);
  const sw=$('#memSw');sw.classList.toggle('on',S.set.memOn);sw.setAttribute('aria-checked',S.set.memOn);
  setBadge('inc',open,open>0);setBadge('mem',n,false);
  $('#app').classList.toggle('collapsed',!!S.set.navCollapsed);
  const st=$('#heroStat');if(st){st.className='hstat'+(open?' bad':'');st.lastChild.textContent=open?`${open} active incident${open>1?'s':''}`:'All systems nominal'}
  renderAIBadge()}

/* ═════ page polish: progress bar + staggered reveal ═════ */
function progress(){const p=$('#prog');if(!p)return;p.style.transition='none';p.style.width='0%';p.style.opacity=1;void p.offsetWidth;p.style.transition='';requestAnimationFrame(()=>{p.style.width='78%';setTimeout(()=>{p.style.width='100%';setTimeout(()=>{p.style.opacity=0},280)},240)})}
function stagger(){$$('#view .card,#view .tile,#view .tri,#view .mem,#view .inc-item,#view .kpi').slice(0,44).forEach((el,i)=>{el.classList.add('rv');el.style.animationDelay=Math.min(i*35,480)+'ms'})}

/* ═════ hero banner (War Room) ═════ */
function heroHTML(st){const open=st.open.length;
  return `<div class="hero rv"><div><span class="hstat${open?' bad':''}" id="heroStat"><i></i>${open?open+' active incident'+(open>1?'s':''):'All systems nominal'}</span><h2>Live War Room</h2><p>${S.mem.length} memories standing guard. Inject a failure and watch the agent recall, reason and learn.${API.canAI()?' Groq reasoning is online.':''}</p>
  <div class="btns"><button class="btn" data-act="quickInject">⚡ Inject random fault</button><button class="btn ghost" data-act="go" data-id="chat">Ask the Copilot</button><button class="btn ghost" data-act="palette">Command palette</button></div></div>
  <div class="radar2"><b></b><b></b><b></b><div class="core"></div><div class="sweep"></div></div>
  <svg class="wave a" viewBox="0 0 1200 44" preserveAspectRatio="none"><path fill="#fff" d="M0 22 Q150 0 300 22 T600 22 T900 22 T1200 22 V44 H0Z"/></svg>
  <svg class="wave b" viewBox="0 0 1200 30" preserveAspectRatio="none"><path fill="#f0f9ff" d="M0 15 Q100 0 200 15 T400 15 T600 15 T800 15 T1000 15 T1200 15 V30 H0Z"/></svg></div>`}

/* ═════ command palette (Ctrl/⌘ + K) ═════ */
function randomFault(){const free=SERVICES.filter(s=>!SV[s].inc);if(!free.length){toast('Every service already has an incident');return null}
  const k=pick(FKEYS),svc=SV[FAULTS[k].svc].inc?pick(free):FAULTS[k].svc;return inject(k,svc)}
function paletteCommands(){const nav=NAV_ITEMS.map(([id,t,ic],i)=>({t:'Go to '+t,ic,k:String(i+1),run:()=>go(id)}));
  return [...nav,
   {t:'Inject a random fault',ic:'alert',run:()=>{const inc=randomFault();if(inc){curInc=inc.id;go('inc')}}},
   {t:'Toggle memory on / off',ic:'db',run:()=>ACT.memToggle()},
   {t:'Toggle auto-chaos',ic:'flask',run:()=>ACT.chaos()},
   {t:'Run the benchmark',ic:'gauge',run:()=>{go('bench');setTimeout(runBench,300)}},
   {t:'Teach the agent unknown patterns',ic:'book',run:()=>{teachAll();bench=null;if(route==='bench')benchOut()}},
   {t:'Collapse / expand sidebar',ic:'shield',run:()=>ACT.navCollapse()},
   {t:'Check AI connection',ic:'bot',run:()=>ACT.aiRecheck()},
   {t:'Push data to the server',ic:'db',run:()=>ACT.syncPush()},
   {t:'Regenerate demo data',ic:'flask',run:()=>ACT.reseed()}]}
function openPalette(){let sel=0,list=[];const cmds=paletteCommands();
  $('#modalRoot').innerHTML=`<div class="ov top-al" data-act="closeOv"><div class="pal"><input id="palIn" placeholder="Type a command or page…" autocomplete="off" aria-label="Command"><div class="pal-l" id="palL"></div><div class="pal-f"><span>↑↓ navigate</span><span>↵ run</span><span>esc close</span></div></div></div>`;
  const inp=$('#palIn'),box=$('#palL');
  const mark=()=>{$$('.pal-i',box).forEach((x,i)=>{x.classList.toggle('on',i===sel);if(i===sel&&x.scrollIntoView)x.scrollIntoView({block:'nearest'})})};
  const draw=()=>{const q=inp.value.trim().toLowerCase();list=cmds.filter(c=>!q||c.t.toLowerCase().includes(q));sel=0;
    box.innerHTML=list.length?list.map((c,i)=>`<div class="pal-i ${i===0?'on':''}" data-i="${i}" style="animation-delay:${Math.min(i*18,220)}ms"><span class="pi">${icon(c.ic)}</span>${esc(c.t)}${c.k?`<small>${c.k}</small>`:''}</div>`).join(''):'<div class="empty" style="margin:8px">No matching command</div>'};
  const run=i=>{const c=list[i];if(!c)return;closeModal();setTimeout(c.run,140)};
  inp.addEventListener('input',draw);
  inp.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();sel=(sel+1)%Math.max(1,list.length);mark()}else if(e.key==='ArrowUp'){e.preventDefault();sel=(sel-1+list.length)%Math.max(1,list.length);mark()}else if(e.key==='Enter'){e.preventDefault();run(sel)}});
  box.addEventListener('click',e=>{const it=e.target.closest('.pal-i');if(it)run(+it.dataset.i)});
  box.addEventListener('mousemove',e=>{const it=e.target.closest('.pal-i');if(it&&+it.dataset.i!==sel){sel=+it.dataset.i;mark()}});
  draw();inp.focus()}

/* ═════ confetti burst (sky-blue) ═════ */
const fx={p:[],run:false};
function burst(x,y){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;const c=$('#fx');if(!c||!c.getContext)return;const ctx=c.getContext('2d');if(!ctx)return;
  c.width=innerWidth;c.height=innerHeight;x=x==null?innerWidth/2:x;y=y==null?innerHeight*.35:y;
  const cols=['#0ea5e9','#38bdf8','#7dd3fc','#0284c7','#bae6fd','#0369a1'];
  for(let i=0;i<100;i++){const a=Math.random()*Math.PI*2,sp=rnd(3,11);fx.p.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-5,r:rnd(3,7),c:pick(cols),l:1,rot:rnd(0,6),vr:rnd(-.3,.3),sq:Math.random()<.5})}
  const step=()=>{ctx.clearRect(0,0,c.width,c.height);fx.p=fx.p.filter(p=>p.l>0);
    fx.p.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.22;p.vx*=.985;p.l-=.011;p.rot+=p.vr;ctx.save();ctx.globalAlpha=Math.max(0,p.l);ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.fillStyle=p.c;
      if(p.sq)ctx.fillRect(-p.r,-p.r/2,p.r*2,p.r);else{ctx.beginPath();ctx.arc(0,0,p.r/1.5,0,7);ctx.fill()}ctx.restore()});
    if(fx.p.length)requestAnimationFrame(step);else{fx.run=false;ctx.clearRect(0,0,c.width,c.height)}};
  if(!fx.run){fx.run=true;requestAnimationFrame(step)}}
