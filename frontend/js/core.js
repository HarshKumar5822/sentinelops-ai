/* ═══ core.js — utilities, domain data (faults, services) and app state
   SentinelOps AI · Created by Harsh Kumar ═══ */
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,9);
const rnd=(a,b)=>a+Math.random()*(b-a), ri=(a,b)=>Math.floor(rnd(a,b+1)), pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const DAY=864e5, MIN=6e4;
const ago=ts=>{const d=Date.now()-ts;if(d<MIN)return 'just now';if(d<36e5)return Math.round(d/MIN)+'m ago';if(d<DAY)return Math.round(d/36e5)+'h ago';return Math.round(d/DAY)+'d ago'};
const hms=ts=>new Date(ts).toTimeString().slice(0,8);
const money=v=>v>=1e6?'$'+(v/1e6).toFixed(1)+'M':v>=1e3?'$'+Math.round(v/1e3)+'k':'$'+Math.round(v);
const PALETTE=['#0ea5e9','#38bdf8','#0284c7','#7dd3fc','#0369a1','#bae6fd','#075985'];
const COST={CRITICAL:2400,HIGH:900,MEDIUM:250};

/* ---------- domain: faults, services ---------- */
const SERVICES=['auth-service','payments-api','cache-cluster','orders-db','search-index','api-gateway','order-worker'];
const FAULTS={
 conn_leak:{name:'Connection pool exhaustion',svc:'auth-service',sev:'CRITICAL',alert:'Auth API 5xx above 80%',mem:4,
  sym:()=>[`Active DB connections ${ri(248,250)}/250 (100%)`,`PostgreSQL CPU ${ri(9,15)}% low CPU with idle connections`,`HTTP 5xx error rate ${ri(78,91)}%`,`p95 latency ${ri(9800,11500)} ms`],
  log:()=>['ERROR pool.go:88 failed to acquire connection from pool: timeout after 10000ms','FATAL postgres: remaining connection slots are reserved for non-replication superuser connections','WARN orm session not closed in token refresh loop, connection idle in transaction',`ALERT connection pool capacity 250/250 active, 0 idle, ${ri(150,220)} queued`],
  root:'Unclosed ORM session in the token-refresh loop (release v2.14) leaked idle connections.',
  fix:['Run drain_db_connections.sh --force to flush orphaned idle sessions (no DB restart)','Roll back auth-service to v2.13-stable','Set DB_POOL_MAX_IDLE_TIME=5s and add a pool-leak alert'],
  bad:{text:'The database looks overloaded. Upgrade the instance and reboot the primary node.',steps:['Upgrade auth-db from db.m5.large to db.m5.2xlarge','Force reboot the primary auth-db node','Raise max_connections from 250 to 1000'],risk:'Rebooting the primary causes ~5 min of full downtime and the leak returns within the hour.',mttr:45},
  tel:{cpu:12,mem:64,lat:10400,err:84,sat:100}},
 redis_evict:{name:'Cache eviction storm',svc:'cache-cluster',sev:'HIGH',alert:'Redis cache hit ratio collapsed',mem:5,
  sym:()=>[`Redis memory ${ri(98,100)}% of maxmemory`,`Cache hit ratio dropped from 99.1% to ${ri(8,18)}%`,`Database queries surge +${ri(350,480)}% on users table`,`Evicted keys ${ri(40,90)}k per minute`],
  log:()=>['WARN redis: OOM command not allowed when used memory > maxmemory','ERROR session_store SETEX failed OOM eviction storm','WARN postgres unexpected query surge, cache miss on users table','ALERT cache hit ratio below 20 percent'],
  root:'Session keys were written without TTL and filled Redis; the noeviction policy caused OOM errors and cache misses hammered the database.',
  fix:['Set maxmemory-policy to allkeys-lru on cache-cluster','Apply a 30 minute TTL to session keys and flush stale keys','Warm the hot keys and rate-limit the database fallback path'],
  bad:{text:'Restart the Redis cluster and scale the database.',steps:['Restart the Redis cluster nodes','Scale orders database replicas x3','Increase Redis maxmemory to 16GB'],risk:'A restart wipes every user session (mass logout) and memory fills again within hours.',mttr:38},
  tel:{cpu:48,mem:99,lat:2600,err:14,sat:99}},
 bad_deploy:{name:'Bad deploy regression',svc:'payments-api',sev:'CRITICAL',alert:'Payments 5xx spike after release',mem:3,
  sym:()=>[`HTTP 5xx error rate ${ri(55,75)}% starting 3 minutes after deploy v2.15`,`CPU ${ri(30,45)}% and memory normal`,`NullPointerException ${ri(1200,4000)} per minute in checkout handler`,`Canary rollout reached ${ri(60,100)}% of pods`],
  log:()=>['ERROR checkout_handler NullPointerException at PaymentIntent.validate','INFO deploy release v2.15 rollout 100% complete','WARN payments-api readiness probe failing on new pods','ALERT payments 5xx error rate above 50 percent after deploy'],
  root:'Release v2.15 introduced a null dereference in checkout validation.',
  fix:['Run helm rollback payments-api to v2.14','Disable the new-checkout feature flag','Add a regression test and gate canary promotion on error budget'],
  bad:{text:'Traffic must have grown. Scale up the pods and raise limits.',steps:['Scale payments-api replicas from 12 to 40','Increase pod memory limits','Restart all pods'],risk:'More pods only serve more errors; the regression stays live while cost grows.',mttr:32},
  tel:{cpu:38,mem:58,lat:1800,err:66,sat:55}},
 disk_full:{name:'Disk full from log growth',svc:'orders-db',sev:'HIGH',alert:'orders-db disk above 97%',mem:6,
  sym:()=>[`Disk usage ${ri(97,100)}% on data volume`,'Write errors: no space left on device',`Inode usage ${ri(60,80)}%`,`Log volume grew ${ri(20,40)} GB in 6 hours`],
  log:()=>['ERROR postgres could not write to file: No space left on device','WARN disk usage 98% on volume vol-orders-data','WARN debug logging enabled: audit.log growing 4GB per hour','ALERT orders-db disk full imminent'],
  root:'Debug logging was left enabled after a hotfix; unrotated audit logs filled the data volume.',
  fix:['Rotate and compress audit.log and purge logs older than 7 days','Set the log level back to INFO and enable logrotate','Add a disk 80% alert with automatic cleanup'],
  bad:{text:'Storage is short. Add database nodes and resize the disk.',steps:['Provision two additional orders-db nodes','Resize the volume from 500GB to 2TB','Restart the primary'],risk:'Resizing takes 40+ minutes while logs keep growing; unnecessary spend.',mttr:55},
  tel:{cpu:30,mem:55,lat:1400,err:32,sat:99}},
 cpu_hot:{name:'Runaway regex CPU saturation',svc:'search-index',sev:'HIGH',alert:'search-index CPU pinned',mem:5,
  sym:()=>[`CPU ${ri(94,100)}% across all search nodes`,`Thread pool saturated with ${ri(300,900)} requests queued`,`p95 latency ${ri(6000,9000)} ms on query endpoint`,`Memory stable at ${ri(50,60)}%`],
  log:()=>['WARN regex evaluation exceeded 2000ms in query parser','ERROR thread pool exhausted, rejecting requests','WARN catastrophic backtracking detected in wildcard filter','ALERT search-index CPU 98 percent for 10 minutes'],
  root:'A user-supplied wildcard pattern triggered catastrophic regex backtracking in the query parser.',
  fix:['Enable the query-pattern guard flag to reject nested wildcards','Kill the runaway search threads on the affected nodes','Deploy the regex timeout patch (2s cap)'],
  bad:{text:'CPU is saturated. Scale out the search cluster.',steps:['Add 6 nodes to search-index','Raise the thread pool size','Restart the cluster'],risk:'New nodes saturate as soon as the same pattern hits them; wasted spend.',mttr:40},
  tel:{cpu:98,mem:55,lat:7400,err:24,sat:70}},
 cert_expiry:{name:'TLS certificate expiry',svc:'api-gateway',sev:'CRITICAL',alert:'Gateway TLS handshake failures',mem:4,
  sym:()=>[`TLS handshake failure rate ${ri(88,100)}%`,`Certificate expired ${ri(2,40)} minutes ago on api.example.com`,`Backend health normal with CPU ${ri(15,25)}%`,'Client error: SSL certificate has expired'],
  log:()=>['ERROR x509: certificate has expired or is not yet valid','WARN cert-manager renewal failed: ACME challenge timeout','ERROR tls handshake error from client','ALERT gateway TLS error rate above 85 percent'],
  root:'cert-manager ACME renewal failed silently (the DNS challenge record was removed) and the certificate expired.',
  fix:['Restore the _acme-challenge DNS record','Force renewal with cert-manager certificate renew api-gateway-tls','Reload the gateway and add a 14-day expiry alert'],
  bad:{text:'The gateway is unhealthy. Restart it and add replicas.',steps:['Restart api-gateway pods','Scale gateway replicas','Clear the CDN cache'],risk:'Restarting does not renew the certificate; clients keep failing throughout.',mttr:28},
  tel:{cpu:18,mem:40,lat:900,err:95,sat:35}},
 queue_backlog:{name:'Queue consumer lag',svc:'order-worker',sev:'MEDIUM',alert:'Order queue backlog growing',mem:6,
  sym:()=>[`Kafka consumer lag ${ri(400,900)}k messages on orders topic`,`Queue depth growing ${ri(15,30)}k per minute`,'Consumers active 2 of 12 after crash loop',`Order processing delay ${ri(20,45)} minutes`],
  log:()=>['WARN kafka consumer lag exceeds threshold on partition 3','ERROR poison message schema mismatch blocking partition','WARN consumer group rebalance loop detected','ALERT order queue depth above 500k'],
  root:'A poison message with an old schema crashed the consumers in a rebalance loop and blocked the partition.',
  fix:['Move the poison message to the dead-letter queue','Restart order-worker consumers after skipping the bad offset','Add schema validation and DLQ routing for malformed messages'],
  bad:{text:'Consumers are too slow. Add partitions and consumers.',steps:['Increase topic partitions from 12 to 48','Add 20 consumer pods','Purge the whole topic'],risk:'Purging loses orders and extra consumers crash on the same poison message.',mttr:50},
  tel:{cpu:22,mem:70,lat:2200,err:12,sat:92}}
};
const FKEYS=Object.keys(FAULTS);

/* ---------- state ---------- */
const KEY='sentinelops_ai_v2';
let S=null;
const DEFAULT_SET={memOn:true,oncall:'Harsh',speed:1500,chaos:false,navCollapsed:false,autoSync:true,apiBase:''};
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}if(typeof API!=='undefined')API.scheduleSync()};
const loadState=()=>{try{const r=localStorage.getItem(KEY);if(r){const o=JSON.parse(r);if(o&&o.v===2){o.set=Object.assign({},DEFAULT_SET,o.set);return o}}}catch(e){}return null};
const SV={}, LIVE={}, LOGS=[]; let selSvc='auth-service', curInc=null, route='war', tickT=null, chatLog=[], busy={};

