// dry.mjs - Smoke test script for npm run dry
// Tests the analysis logic with mock data without hitting real Oura API or webhook

import dotenv from 'dotenv';
import { analyzeSleep } from './index.mjs';

dotenv.config();

console.log('=== Dry Run - Smoke Test ===\n');
console.log('This test analyzes a mock sleep record without calling the Oura API or sending webhooks.\n');

// Mock sleep record (poor night example)
const mockSleepRecords = [
  {
    score: 65,
    total_sleep_duration: 19200, // 320 minutes = 5h 20m in seconds
    sleep_latency: 2700, // 45 minutes in seconds
    average_hrv: 35,
    end_time: '2025-10-29T08:00:00+00:00',
    type: 'long_sleep'
  },
  // Previous night (also poor for streak testing)
  {
    score: 68,
    total_sleep_duration: 20400, // 340 minutes
    sleep_latency: 2280, // 38 minutes
    average_hrv: 32,
    end_time: '2025-10-28T08:00:00+00:00',
    type: 'long_sleep'
  },
  // Third night back (good night, breaks streak)
  {
    score: 82,
    total_sleep_duration: 25200, // 420 minutes = 7 hours
    sleep_latency: 900, // 15 minutes
    average_hrv: 55,
    end_time: '2025-10-27T08:00:00+00:00',
    type: 'long_sleep'
  }
];

console.log('Mock sleep data (3 nights):');
console.log('- Latest: score 65, 320 min, latency 45 min');
console.log('- Previous: score 68, 340 min, latency 38 min');
console.log('- Third: score 82, 420 min, latency 15 min\n');

console.log('Current thresholds:');
console.log(`- SLEEP_SCORE_THRESHOLD: ${process.env.SLEEP_SCORE_THRESHOLD || 75}`);
console.log(`- MIN_TOTAL_SLEEP_MIN: ${process.env.MIN_TOTAL_SLEEP_MIN || 360}`);
console.log(`- MAX_SLEEP_LATENCY_MIN: ${process.env.MAX_SLEEP_LATENCY_MIN || 30}`);
console.log(`- POOR_NIGHTS_STREAK: ${process.env.POOR_NIGHTS_STREAK || 2}\n`);

try {
  const result = analyzeSleep(mockSleepRecords);
  
  if (!result) {
    console.log('Result: No alert data (null)');
  } else {
    console.log('Analysis result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');
    
    if (result.poorNight) {
      console.log('❌ Poor night detected!');
      
      if (result.streak >= (Number(process.env.POOR_NIGHTS_STREAK) || 2)) {
        console.log(`⚠️  STREAK ALERT: ${result.streak} consecutive poor nights\n`);
        console.log('Would send payload:');
        console.log(JSON.stringify({
          title: '⚠️ Sleep Streak Alert',
          message: `You've had ${result.streak} consecutive poor nights. Consider reviewing your sleep routine.`,
          meta: {
            sleep_score: result.sleep_score,
            total_sleep_min: result.total_sleep_min,
            sleep_latency_min: result.sleep_latency_min,
            hrv_avg_ms: result.hrv_avg_ms,
            date: result.date,
            streak: result.streak
          }
        }, null, 2));
      } else {
        console.log('Would send payload:');
        console.log(JSON.stringify({
          title: 'Poor Sleep Alert',
          message: `Your sleep last night fell below thresholds. Score: ${result.sleep_score}, Total: ${result.total_sleep_min} min, Latency: ${result.sleep_latency_min ?? 'N/A'} min.`,
          meta: {
            sleep_score: result.sleep_score,
            total_sleep_min: result.total_sleep_min,
            sleep_latency_min: result.sleep_latency_min,
            hrv_avg_ms: result.hrv_avg_ms,
            date: result.date
          }
        }, null, 2));
      }
    } else {
      console.log('✅ Good night - no alert would be sent.');
      console.log(`No alert: score ${result.sleep_score}, total ${result.total_sleep_min} min.`);
    }
  }
  
  console.log('\n✓ Dry run completed successfully (no API calls made, no webhooks sent)');
} catch (error) {
  console.error('Error during dry run:', error.message);
  process.exit(1);
}
