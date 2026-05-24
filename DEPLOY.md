# Deployment Guide

Railway is the **primary** platform. Fly.io and Encore Cloud are fallbacks.

---

## Railway (Primary)

Railway builds from the `Dockerfile` at the repo root and serves the app
with zero extra configuration.

### Prerequisites
```bash
# Install the Railway CLI
npm install -g @railway/cli

# Authenticate
railway login
```

### First Deploy
```bash
# Link to a new or existing Railway project
railway init          # creates a new project
# — or —
railway link          # link to an existing project

# Set required environment variables
railway variables set \
  SLACK_BOT_TOKEN=xoxb-... \
  SLACK_CHANNEL_ID=C... \
  LTA_ACCOUNT_KEY=... \
  BASE_URL=https://<your-app>.up.railway.app

# Deploy
railway up
```

### Subsequent Deploys
```bash
railway up
```
Or connect your GitHub repo in the Railway dashboard and Railway will
auto-deploy on every push to `main`.

### Useful Commands
```bash
railway logs          # tail live logs
railway status        # deployment status
railway shell         # shell into the running container
railway variables     # list environment variables
```

> **Note:** `railway.toml` sets `region = "asia-southeast1"` (Singapore)
> to minimise latency to the LTA DataMall API.

---

## Fly.io (Fallback)

### Prerequisites
```bash
curl -L https://fly.io/install.sh | sh
fly auth login
```

### First Deploy
```bash
# Create the app (fly.toml is already configured)
fly launch --no-deploy --name slackbot-project

# Set required secrets
fly secrets set \
  SLACK_BOT_TOKEN=xoxb-... \
  SLACK_CHANNEL_ID=C... \
  LTA_ACCOUNT_KEY=... \
  BASE_URL=https://slackbot-project.fly.dev

fly deploy
```

### Subsequent Deploys
```bash
fly deploy
```

### Useful Commands
```bash
fly logs
fly status
fly ssh console
fly secrets list
```

> **Note:** `fly.toml` sets `primary_region = "sin"` (Singapore).

---

## Encore Cloud (Fallback)

### Prerequisites
```bash
curl -L https://encore.dev/install.sh | bash
encore auth login
```

### Local Development
```bash
npm install        # installs encore.dev package
encore run
```

### Deploy to Encore Cloud
```bash
git push encore main
```

Or connect your GitHub repo in the Encore dashboard at
https://app.encore.cloud for automatic deploys on push.

### Environment Secrets
```bash
encore secret set --env=production SLACK_BOT_TOKEN
encore secret set --env=production SLACK_CHANNEL_ID
encore secret set --env=production LTA_ACCOUNT_KEY
encore secret set --env=production BASE_URL
```

### Build a Docker Image
```bash
encore build docker slackbot-project:latest
```
