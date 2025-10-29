import dotenv from 'dotenv';
import fetch from 'node-fetch';
dotenv.config();

const { POKE_WEBHOOK_URL } = process.env;

const sample = {
  title: 'Oura Sleep Alert',
  message: 'Sleep score 68. Total 325 min. Ease up this morning.',
  meta: {
    sleep_score: 68,
    total_sleep_min: 325,
    sleep_latency_min: 35,
    hrv_avg_ms: null,
    date: '2025-10-29T07:00:00.123Z'
  }
};

if (POKE_WEBHOOK_URL) {
  fetch(POKE_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sample)
  }).then(r => console.log('Test webhook status:', r.status)).catch(e => console.error('Test error:', e.message));
} else {
  console.log('Would notify: %o', sample);
}
