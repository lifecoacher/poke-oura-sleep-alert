import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const {
  OURA_TOKEN,
  POKE_WEBHOOK_URL,
  SLEEP_SCORE_THRESHOLD = '75',
  MIN_TOTAL_SLEEP_MIN = '360',
  MAX_SLEEP_LATENCY_MIN = '30',
  POOR_NIGHTS_STREAK = '2',
  TIMEZONE = 'America/New_York',
} = process.env;

function getISO(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

async function getSleepData() {
  const startDate = getISO(7), endDate = getISO(0);
  const url = `https://api.ouraring.com/v2/usercollection/sleep?start_date=${startDate}&end_date=${endDate}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${OURA_TOKEN}` } });
  if (!res.ok) throw new Error(`Oura API error: ${res.statusText}`);
  const { data } = await res.json();
  if (!data?.length) throw new Error('No sleep data found');
  data.sort((a, b) => new Date(b.end_time) - new Date(a.end_time));
  return data;
}

function analyzeSleep(records) {
  if (!records.length) return null;
  const latest = records[0];
  const sleep_score = Number(latest.score ?? 0);
  const total_sleep_min = Math.floor((latest.total_sleep_duration ?? 0) / 60);
  const sleep_latency_min = latest.sleep_latency != null ? Math.floor(latest.sleep_latency / 60) : null;
  const hrv_avg_ms = latest.average_hrv != null ? latest.average_hrv : null;
  const poorNight = sleep_score < SLEEP_SCORE_THRESHOLD || total_sleep_min < MIN_TOTAL_SLEEP_MIN || (sleep_latency_min != null && sleep_latency_min > MAX_SLEEP_LATENCY_MIN);
  let streak = 0;
  for (let rec of records) {
    const sScore = Number(rec.score ?? 0);
    const tSleep = Math.floor((rec.total_sleep_duration ?? 0) / 60);
    const sLatency = rec.sleep_latency != null ? Math.floor(rec.sleep_latency / 60) : null;
    const pn = sScore < SLEEP_SCORE_THRESHOLD || tSleep < MIN_TOTAL_SLEEP_MIN || (sLatency != null && sLatency > MAX_SLEEP_LATENCY_MIN);
    if (pn) streak++; else streak = 0;
    if (rec === latest) break;
  }
  return {
    poorNight,
    streak,
    sleep_score,
    total_sleep_min,
    sleep_latency_min,
    hrv_avg_ms,
    date: latest.end_time,
  };
}

async function notify(alert) {
  const streakMsg = alert.streak >= POOR_NIGHTS_STREAK ? `Two low nights in a row. Prioritize recovery.` : alert.poorNight ? 'Ease up this morning.' : '';
  const payload = {
    title: 'Oura Sleep Alert',
    message: `Sleep score ${alert.sleep_score}. Total ${alert.total_sleep_min} min. ${streakMsg}`,
    meta: {
      sleep_score: alert.sleep_score,
      total_sleep_min: alert.total_sleep_min,
      sleep_latency_min: alert.sleep_latency_min,
      hrv_avg_ms: alert.hrv_avg_ms,
      date: alert.date
    }
  };
  if (POKE_WEBHOOK_URL) {
    const resp = await fetch(POKE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      console.error('Webhook failed:', resp.statusText);
    } else {
      console.log('Webhook sent:', payload.message);
    }
  } else {
    console.log('Would notify:', payload.message, payload.meta);
  }
}

(async () => {
  try {
    const records = await getSleepData();
    const alert = analyzeSleep(records);
    if (!alert) return console.log('No data, nothing to alert.');
    if (alert.poorNight || alert.streak >= POOR_NIGHTS_STREAK) {
      await notify(alert);
    } else {
      console.log('All good. No alert.');
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
