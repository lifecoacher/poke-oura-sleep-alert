# poke-oura-sleep-alert

Oura sleep check alert – Node 18, MIT, webhook to Poke

## What This Does

Fetches your latest Oura sleep data, evaluates it against configurable thresholds, and sends notifications to Poke if your sleep is poor or if you've had multiple consecutive poor nights.

## Use it in 60 seconds

```bash
# Clone the repository
git clone https://github.com/lifecoacher/poke-oura-sleep-alert.git
cd poke-oura-sleep-alert

# Copy the environment template
cp .env.example .env

# Edit .env and fill in your actual values (see Secrets Setup below)

# Install dependencies
npm install

# Run the check
npm start
```

## Prerequisites

1. **Create Oura Personal Access Token**: Visit [https://cloud.ouraring.com/personal-access-tokens](https://cloud.ouraring.com/personal-access-tokens) to generate your token
2. **Get your Poke Custom Webhook URL**: Obtain this from your Poke account settings

## Secrets Setup

**IMPORTANT**: Never commit secrets, tokens, or API keys to the repository. Use environment variables and GitHub Secrets.

### Local Development

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your actual values in `.env`:
   ```env
   OURA_TOKEN=your_actual_oura_personal_access_token_here
   POKE_WEBHOOK_URL=your_actual_poke_webhook_url_here
   SLEEP_SCORE_THRESHOLD=75
   MIN_TOTAL_SLEEP_MIN=360
   MAX_SLEEP_LATENCY_MIN=30
   POOR_NIGHTS_STREAK=2
   TIMEZONE=America/New_York
   ```

3. `.env` is already in `.gitignore` and will never be committed

### GitHub Actions Secrets

To run this automatically via GitHub Actions:

1. Go to your repository's **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** and add each of the following:

   **Required secrets**:
   - `OURA_TOKEN` – Your Oura Personal Access Token from [cloud.ouraring.com/personal-access-tokens](https://cloud.ouraring.com/personal-access-tokens)
   - `POKE_WEBHOOK_URL` – Your Poke Custom Webhook URL (see below)

   **Optional secrets** (if you want to override defaults):
   - `SLEEP_SCORE_THRESHOLD` – Minimum acceptable sleep score (default: 75)
   - `MIN_TOTAL_SLEEP_MIN` – Minimum total sleep in minutes (default: 360 = 6 hours)
   - `MAX_SLEEP_LATENCY_MIN` – Maximum time to fall asleep in minutes (default: 30)
   - `POOR_NIGHTS_STREAK` – Number of consecutive poor nights for escalation (default: 2)
   - `TIMEZONE` – Your local timezone (default: America/New_York)

### Getting Your Poke Webhook URL

1. Log into your Poke account
2. Navigate to **Settings** or **Integrations**
3. Look for **Custom Webhooks** or **Incoming Webhooks**
4. Click **Create New Webhook** or similar
5. Give it a name like "Oura Sleep Alert"
6. Copy the generated webhook URL (looks like `https://api.poke.com/webhooks/...`)
7. Paste this URL into `POKE_WEBHOOK_URL` in your `.env` file (local) or GitHub Secret (Actions)

## Threshold Tuning

Adjust these environment variables in your `.env` file:

- `SLEEP_SCORE_THRESHOLD` (default: 75) - Minimum acceptable sleep score
- `MIN_TOTAL_SLEEP_MIN` (default: 360) - Minimum total sleep in minutes (6 hours)
- `MAX_SLEEP_LATENCY_MIN` (default: 30) - Maximum acceptable time to fall asleep in minutes
- `POOR_NIGHTS_STREAK` (default: 2) - How many consecutive poor nights trigger an escalated alert
- `TIMEZONE` (default: America/New_York) - Your local timezone

## Run on a Schedule with GitHub Actions

The included `.github/workflows/run.yml` workflow runs automatically on a schedule.

### Schedule Configuration

GitHub Actions uses **UTC time** for cron schedules. The workflow is currently set to:

```yaml
schedule:
  - cron: '0 12 * * *'  # 12:00 UTC = 8:00 AM EDT (New York during DST)
```

**Time Zone Reference**:
- **8:00 AM New York during Daylight Saving Time (EDT)**: `0 12 * * *` (12:00 UTC)
- **8:00 AM New York during Standard Time (EST)**: `0 13 * * *` (13:00 UTC)

You can edit `.github/workflows/run.yml` and change the cron line to match your preferred time. Remember to convert your local time to UTC.

### How It Works

The workflow:
1. Uses Node.js 18
2. Runs `npm ci` to install dependencies from lock file
3. Executes `node index.mjs`
4. Reads secrets from **Actions → Repository secrets** (not from `.env`)
5. Runs daily at the scheduled time

### Screenshots/Gifs

<!-- TODO: Add screenshots showing:
- GitHub Actions secrets setup page
- Workflow run success
- Poke notification example
-->

## Webhook Contract

When a poor night is detected, this script POSTs a JSON payload to your `POKE_WEBHOOK_URL`:

### Sample Poke Payload (poor night)

```json
{
  "title": "Poor Sleep Alert",
  "message": "Your sleep last night fell below thresholds. Score: 65, Total: 320 min, Latency: 45 min.",
  "meta": {
    "sleep_score": 65,
    "total_sleep_min": 320,
    "sleep_latency_min": 45,
    "hrv_avg_ms": 35,
    "date": "2025-10-28"
  }
}
```

### Sample Poke Payload (streak escalation)

```json
{
  "title": "⚠️ Sleep Streak Alert",
  "message": "You've had 3 consecutive poor nights. Consider reviewing your sleep routine.",
  "meta": {
    "sleep_score": 68,
    "total_sleep_min": 340,
    "sleep_latency_min": 38,
    "hrv_avg_ms": 32,
    "date": "2025-10-28",
    "streak": 3
  }
}
```

**Important**: Consumers of this webhook may rely on the keys `title`, `message`, and the `meta` object structure. Do not change these without considering downstream integrations.

## Safe Testing

Before running in production, test each component:

### 1. Dry Run (Mock Data)

Run a smoke test with mock sleep data (no real Oura API call, no webhook POST):

```bash
npm run dry
```

This loads your `.env`, analyzes a mock sleep record, and prints what would be sent without actually sending anything.

### 2. Webhook Test (Real Network)

Test webhook connectivity with a harmless test payload:

```bash
npm run test:notify
```

This sends a test message to your Poke webhook to verify connectivity.

### 3. Full Run (Real Data + Real Webhook)

```bash
npm start
```

Fetches real Oura data, evaluates it, and sends alerts if thresholds are breached.

## Troubleshooting

### 401 or 403 from Oura

- **Cause**: Expired or invalid `OURA_TOKEN`, or insufficient scopes
- **Fix**: 
  1. Regenerate your Personal Access Token at [cloud.ouraring.com/personal-access-tokens](https://cloud.ouraring.com/personal-access-tokens)
  2. Ensure the token has `daily` scope
  3. Update `OURA_TOKEN` in `.env` or GitHub Secrets

### 404 or No Data from Oura

- **Cause**: Ring not synced yet, or no sleep data for the requested date
- **Fix**:
  1. Open the Oura app on your phone to trigger sync
  2. Wait a few minutes for sync to complete
  3. Re-run the script

### Webhook 4xx or 5xx Errors

- **Cause**: Invalid `POKE_WEBHOOK_URL` or Poke service issue
- **Fix**:
  1. Verify the webhook URL is correct (copy from Poke settings)
  2. Check Poke logs/dashboard for errors
  3. Test with `npm run test:notify` to isolate the issue

### "No completed sleep records in window"

- **Cause**: No sleep sessions recorded in the last 7 days
- **Fix**: Wear your ring and ensure it's syncing. This is an informational message, not an error.

### NaN or undefined in alerts

- **Cause**: Environment variables not properly set or coerced
- **Fix**: Ensure all numeric thresholds in `.env` are valid numbers (no quotes, no letters)

## Optional: OAuth Setup

By default, this script uses a **Personal Access Token (PAT)** for Oura authentication. If you prefer **OAuth 2.0** (for longer-lived access or refresh tokens), you can use the optional OAuth exchange script.

### Prerequisites

1. Register an Oura OAuth app at [cloud.ouraring.com/oauth/applications](https://cloud.ouraring.com/oauth/applications)
2. Note your `CLIENT_ID` and `CLIENT_SECRET`
3. Set redirect URI to `http://localhost:8787/callback`

### Steps

1. Create a `.env.oauth` file (or add to `.env`):
   ```env
   OURA_CLIENT_ID=your_client_id_here
   OURA_CLIENT_SECRET=your_client_secret_here
   OURA_REDIRECT_URI=http://localhost:8787/callback
   ```

2. Run the OAuth exchange script:
   ```bash
   node scripts/oauth_exchange.mjs
   ```

3. The script will:
   - Print an authorization URL
   - Open your browser (or copy the URL manually)
   - Start a local server on port 8787
   - Capture the authorization code
   - Exchange it for `access_token` and `refresh_token`
   - Print the tokens and optionally write them to `.env`

4. Copy the `access_token` to `OURA_TOKEN` in `.env` or GitHub Secrets

**⚠️ Warning**: Never commit `CLIENT_SECRET`, `access_token`, or `refresh_token` to version control. Keep them in `.env` (which is gitignored) or GitHub Secrets only.

## Testing

```bash
# Test the main logic (will print to console if POKE_WEBHOOK_URL is not set)
npm start

# Run the test suite (if available)
npm test
```

## Production Checklist

Before going live, verify:

- [ ] Added `OURA_TOKEN` secret (in `.env` for local or GitHub Secrets for Actions)
- [ ] Added `POKE_WEBHOOK_URL` secret (in `.env` for local or GitHub Secrets for Actions)
- [ ] Enabled GitHub Actions schedule (uncommented cron line in `.github/workflows/run.yml`)
- [ ] Performed `npm run test:notify` successfully (webhook received)
- [ ] Verified one real run after a sync (`npm start` returned expected output)
- [ ] Confirmed Poke notifications appear in the correct channel
- [ ] Reviewed threshold values match your sleep goals
- [ ] Set correct timezone in `TIMEZONE` environment variable

## License

MIT – see [LICENSE](LICENSE)
