'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const bool = (v, d) => (v === undefined || v === '' ? d : /^(1|true|yes|on)$/i.test(v));

module.exports = {
  port: Number(process.env.PORT) || 8787,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  rateLimitPerMin: Number(process.env.RATE_LIMIT_PER_MIN) || 60,
  groqKey: (process.env.GROQ_API_KEY || '').trim(),
  groqBase: (process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, ''),
  groqModel: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  groqFallback: process.env.GROQ_FALLBACK_MODEL || 'llama-3.3-70b-versatile',
  timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 30000,
  dataFile: process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'db.json'),
  frontendDir: path.join(__dirname, '..', '..', 'frontend'),
  hindsight: {
    enabled: bool(process.env.HINDSIGHT_ENABLED, false),
    baseUrl: process.env.HINDSIGHT_BASE_URL || 'http://localhost:8888',
    apiKey: (process.env.HINDSIGHT_API_KEY || '').trim(),
    bank: process.env.HINDSIGHT_BANK_ID || 'sentinelops-ai',
  },
};
