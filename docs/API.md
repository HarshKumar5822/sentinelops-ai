# API reference

Base URL: `http://localhost:8787/api` · JSON in, JSON out · `/api` is rate-limited per IP (`RATE_LIMIT_PER_MIN`).

Errors always look like:

```json
{ "error": { "code": "ai_not_configured", "message": "GROQ_API_KEY is not set on the backend.", "hint": "Copy backend/.env.example to backend/.env …" } }
```

| Code | HTTP | Meaning |
|---|---|---|
| `bad_request` | 400 | Missing/invalid field |
| `ai_not_configured` | 503 | No `GROQ_API_KEY` |
| `ai_bad_key` | 401 | Groq rejected the key |
| `ai_rate_limited` | 429 | Groq (or this server) rate limit |
| `ai_timeout` / `ai_upstream` / `ai_network` | 504 / 502 | Groq unreachable or failing |
| `ai_bad_json` | 502 | Model didn't return valid JSON (after one retry) |
| `hindsight_disabled` | 503 | Bridge off |
| `not_found` | 404 | Unknown route / id |

---

## Health

`GET /health`

```bash
curl http://localhost:8787/api/health
```
```json
{ "ok": true, "ai": { "configured": true, "provider": "groq", "model": "openai/gpt-oss-120b" },
  "hindsight": { "enabled": false, "ready": false, "bank": "sentinelops-ai" } }
```

## AI

### `POST /ai/triage`
`mode`: `"stateless"` (memories ignored) or `"memory"`.

```bash
curl -X POST http://localhost:8787/api/ai/triage -H 'Content-Type: application/json' -d '{
  "mode": "memory",
  "incident": { "id": "INC-1", "service": "auth-service", "sev": "CRITICAL",
    "symptoms": ["Active DB connections 250/250", "PostgreSQL CPU 12%"], "logs": ["ERROR pool timeout"] },
  "memories": [{ "id": "m1", "cat": "runbook", "title": "Runbook: pool exhaustion",
    "text": "drain idle sessions", "steps": ["Run drain_db_connections.sh --force"] }]
}'
```
```json
{ "result": { "recognised": true, "pattern": "…", "diagnosis": "…", "rootCause": "…",
    "steps": ["…"], "risk": "…", "confidence": 93, "etaMinutes": 4, "usedMemoryIds": ["m1"] },
  "model": "openai/gpt-oss-120b" }
```

### `POST /agent/triage`: webhook triage with **server-side recall**
Point PagerDuty / Alertmanager / Datadog at this. It recalls from the synced memory bank (and Hindsight, if enabled) and returns a plan.

```bash
curl -X POST http://localhost:8787/api/agent/triage -H 'Content-Type: application/json' -d '{
  "service": "auth-service", "alert": "5xx above 80%",
  "symptoms": ["connections 250/250", "cpu 12%"], "logs": ["FATAL remaining connection slots reserved"] }'
```
Returns `{ result, model, recalled: [{ id, title, relevance }] }`. Push your data first (`PUT /state`, or let the app auto-sync).

### `POST /ai/chat`
`messages` = `[{role: "user"|"assistant", content}]`, last must be `user`. Optional `memories` (same shape as above).
Returns `{ reply, model }`.

### `POST /ai/postmortem`
`{ incident, notes?, memories? }` → `{ result: { rootCause, steps[], lessons, prevention[] }, model }`

### `POST /ai/summary`
`{ incident: { id, service, sev, title, symptoms[], status, timeline[], resolution } }` → `{ result: { statusUpdate, executiveSummary, customerImpact, nextSteps[] }, model }`

## Memory (server-side bank = the synced snapshot)

| Method & path | Body | Returns |
|---|---|---|
| `GET /memory?cat=runbook` | | `{ count, memories[] }` |
| `POST /memory/retain` | `{ title, text, cat?, service?, steps?, fault?, tags? }` | `201 { memory }` |
| `POST /memory/recall` | `{ query, k?, service?, cat? }` | `{ results: [{ memory, relevance, cosine }] }` |
| `POST /memory/reflect` | `{ query }` | `{ answer, memories[], model }` (Groq synthesis when configured) |
| `DELETE /memory/:id` | | `{ deleted }` |

```bash
curl -X POST http://localhost:8787/api/memory/retain -H 'Content-Type: application/json' \
  -d '{"title":"Search autoscaling","text":"search-index autoscaler caps at 12 nodes","service":"search-index"}'
curl -X POST http://localhost:8787/api/memory/recall -H 'Content-Type: application/json' \
  -d '{"query":"how many search nodes can we scale to"}'
```

## State sync

| Method & path | Notes |
|---|---|
| `GET /state` | `{ state, counts }` |
| `PUT /state` | `{ state: { v: 2, mem: [], inc: [], seq, set } }`, rejected if malformed or > 5000 items |

## Hindsight bridge (`HINDSIGHT_ENABLED=true`)

| Method & path | Body |
|---|---|
| `GET /hindsight/status` | |
| `POST /hindsight/retain` | `{ content, tags?, context? }` |
| `POST /hindsight/recall` | `{ query }` → `{ results[] }` |
| `POST /hindsight/reflect` | `{ query }` → `{ answer }` |
