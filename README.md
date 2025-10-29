# poke-oura-sleep-alert

Oura sleep check alert – Node 18, MIT, webhook to Poke

## What This Does

Fetches your latest Oura sleep data, evaluates it against configurable thresholds, and sends notifications to Poke if your sleep is poor or if you've had multiple consecutive poor nights.

## Prerequisites

1. **Create Oura Personal Access Token**: Visit [https://cloud.ouraring.com/personal-access-tokens](https://cloud.ouraring.com/personal-access-tokens) to generate your token
2. **Get your Poke Custom Webhook URL**: Obtain this from your Poke account settings

## Setup

```bash
# Clone the repository
git clone https://github.com/lifecoacher/poke-oura-sleep-alert.git
cd poke-oura-sleep-alert

# Copy the environment template
cp .env.example .env

# Edit .env and fill in your values:
# - OURA_TOKEN
# - POKE_WEBHOOK_URL
# - Optionally adjust thresholds

# Install dependencies
npm install

# Run the check
npm start
```

## Threshold Tuning

Adjust these environment variables in your `.env` file:

- `SLEEP_SCORE_THRESHOLD` (default: 75) - Minimum acceptable sleep score
- `MIN_TOTAL_SLEEP_MIN` (default: 360) - Minimum total sleep in minutes (6 hours)
- `MAX_SLEEP_LATENCY_MIN` (default: 30) - Maximum acceptable time to fall asleep in minutes
- `POOR_NIGHTS_STREAK` (default: 2) - How many consecutive poor nights trigger an escalated alert
- `TIMEZONE` (default: America/New_York) - Your local timezone

## Connect to Poke

### Option A: Webhook Method

1. Paste your `POKE_WEBHOOK_URL` into `.env`
2. In Poke, configure the webhook to route notifications to your preferred channel
3. Run `npm start` manually or via cron

### Option B: Poke "Custom from GitHub"

If Poke supports running a GitHub repo as a "custom poke":

1. Add `OURA_TOKEN` and threshold values as secrets in Poke
2. Point Poke to this repo's `index.mjs` entrypoint
3. Schedule it to run daily at 8:00 AM

### Option C: GitHub Actions Schedule

Use the included `.github/workflows/run.yml` workflow:

1. Add repository secrets in Settings > Secrets and variables > Actions:
   - `OURA_TOKEN`
   - `POKE_WEBHOOK_URL`
   - Optional: threshold variables
2. Edit `.github/workflows/run.yml` and uncomment the cron schedule line
3. The workflow will run automatically at 8:00 AM Eastern Time daily

## Testing

```bash
# Test the main logic (will print to console if POKE_WEBHOOK_URL is not set)
npm start

# Test the webhook notification path with sample data
npm run test:notify
```

## Safety and Privacy

- Never commit your `.env` file or expose your `OURA_TOKEN`
- If using GitHub Actions, always store credentials as encrypted secrets
- The Oura API token grants access to your personal health data
- Review Poke's privacy policy for webhook data handling

## License

MIT
