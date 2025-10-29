import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

// Coerce environment variables to proper types at load time with guards against NaN
const OURA_TOKEN = process.env.OURA_TOKEN;
const POKE_WEBHOOK_URL = process.env.POKE_WEBHOOK_URL;

const SLEEP_SCORE_THRESHOLD = (() => {
  const val = Number(process.env.SLEEP_SCORE_THRESHOLD);
  return isNaN(val) ? 75 : val;
})();

const MIN_TOTAL_SLEEP_MIN = (() => {
  const val = Number(process.env.MIN_TOTAL_SLEEP_MIN);
  return isNaN(val) ? 360 : val;
})();

const MAX_SLEEP_LATENCY_MIN = (() => {
  const val = Number(process.env.MAX_SLEEP_LATENCY_MIN);
  return isNaN(val) ? 30 : val;
})();

const POOR_NIGHTS_STREAK = (() => {
  const val = Number(process.env.POOR_NIGHTS_STREAK);
  return isNaN(val) ? 2 : val;
})();

const TIMEZONE = process.env.TIMEZONE || 'America/New_York';

function getISO(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

async function getSleepData() {
  const startDate = getISO(7), endDate = getISO(0);
  const url = `https://api.ouraring.com/v2/usercollection/sleep?start_date=${startDate}&end_date=${endDate}`;
  
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${OURA_TOKEN}` } });
    
    if (!res.ok) {
      // Log HTTP status and try to get JSON error details from Oura
      const errorText = await res.text();
      let errorJson = null;
      try {
        errorJson = JSON.parse(errorText);
      } catch (e) {
        // Not JSON, that's okay
      }
      
      console.error(`Oura API error: HTTP ${res.status} ${res.statusText}`);
      if (errorJson) {
        console.error('Oura response:', JSON.stringify(errorJson));
      }
      throw new Error(`Oura API error: ${res.status} ${res.statusText}`);
    }
    
    const { data } = await res.json();
    
    // Filter for completed sleep sessions only
    const completedSleep = data?.filter(d => d.type === 'long_sleep' || d.type === 'sleep') || [];
    
    if (!completedSleep.length) {
      return null; // No completed sleep in window
    }
    
    completedSleep.sort((a, b) => new Date(b.end_time) - new Date(a.end_time));
    return completedSleep;
  } catch (err) {
    throw err;
  }
}

function analyzeSleep(records) {
  if (!records || !records.length) return null;
  
  const latest = records[0];
  const sleep_score = Number(latest.score ?? 0);
  const total_sleep_min = Math.floor((latest.total_sleep_duration ?? 0) / 60);
  
  // If sleep_latency is missing, treat it as null (don't penalize)
  const sleep_latency_min = latest.sleep_latency != null ? Math.floor(latest.sleep_latency / 60) : null;
  const hrv_avg_ms = latest.average_hrv != null ? latest.average_hrv : null;
  
  // Determine if latest night was poor
  const poorNight = sleep_score < SLEEP_SCORE_THRESHOLD || 
                    total_sleep_min < MIN_TOTAL_SLEEP_MIN || 
                    (sleep_latency_min != null && sleep_latency_min > MAX_SLEEP_LATENCY_MIN);
  
  // Calculate streak: count consecutive poor nights ending at the latest night
  let streak = 0;
  if (poorNight) {
    for (let rec of records) {
      const sScore = Number(rec.score ?? 0);
      const tSleep = Math.floor((rec.total_sleep_duration ?? 0) / 60);
      const sLatency = rec.sleep_latency != null ? Math.floor(rec.sleep_latency / 60) : null;
      
      const isPoor = sScore < SLEEP_SCORE_THRESHOLD || 
                     tSleep < MIN_TOTAL_SLEEP_MIN || 
                     (sLatency != null && sLatency > MAX_SLEEP_LATENCY_MIN);
      
      if (isPoor) {
        streak++;
      } else {
        break; // Stop counting at first good night
      }
    }
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

export { analyzeSleep }; // Export for dry run testing

async function notify(alert) {
  const isStreak = alert.streak >= POOR_NIGHTS_STREAK;
  const title = isStreak ? '⚠️ Sleep Streak Alert' : 'Poor Sleep Alert';
  const streakMsg = isStreak 
    ? `You've had ${alert.streak} consecutive poor nights. Consider reviewing your sleep routine.`
    : `Your sleep last night fell below thresholds. Score: ${alert.sleep_score}, Total: ${alert.total_sleep_min} min, Latency: ${alert.sleep_latency_min ?? 'N/A'} min.`;
  
  const payload = {
    title,
    message: streakMsg,
    meta: {
      sleep_score: alert.sleep_score,
      total_sleep_min: alert.total_sleep_min,
      sleep_latency_min: alert.sleep_latency_min,
      hrv_avg_ms: alert.hrv_avg_ms,
      date: alert.date
    }
  };
  
  // Add streak to meta if it's a streak alert
  if (isStreak) {
    payload.meta.streak = alert.streak;
  }
  
  if (POKE_WEBHOOK_URL) {
    try {
      const resp = await fetch(POKE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!resp.ok) {
        console.error(`Webhook failed: HTTP ${resp.status} ${resp.statusText}`);
        const errorText = await resp.text();
        console.error('Webhook response:', errorText);
      } else {
        console.log(`Alert sent: score ${alert.sleep_score}, total ${alert.total_sleep_min} min, streak ${alert.streak}.`);
      }
    } catch (err) {
      console.error('Webhook error:', err.message);
    }
  } else {
    console.log('Would notify:', payload.message, payload.meta);
  }
}

// Main execution (only run if not imported as module)
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    try {
      const records = await getSleepData();
      
      if (!records) {
        console.log('No completed sleep records in window.');
        process.exit(0);
      }
      
      const alert = analyzeSleep(records);
      
      if (!alert) {
        console.log('No completed sleep records in window.');
        process.exit(0);
      }
      
      if (alert.poorNight || alert.streak >= POOR_NIGHTS_STREAK) {
        await notify(alert);
      } else {
        console.log(`No alert: score ${alert.sleep_score}, total ${alert.total_sleep_min} min.`);
      }
    } catch (e) {
      console.error('Error:', e.message);
      process.exit(1);
    }
  })();
}
