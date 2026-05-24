# Deployment Guide

## Fly.io

### Prerequisites
```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Authenticate
fly auth login
```

### First Deploy
```bash
# Create the app (skip the wizard — fly.toml is already configured)
fly launch --no-deploy --name slackbot-project

# Set required secrets
fly secrets set \
  SLACK_BOT_TOKEN=xoxb-... \
  SLACK_CHANNEL_ID=C... \
  LTA_ACCOUNT_KEY=... \
  BASE_URL=https://slackbot-project.fly.dev

# Deploy
fly deploy
```

### Subsequent Deploys
```bash
fly deploy
```

### Useful Commands
```bash
fly logs            # tail live logs
fly status          # machine health
fly ssh console     # shell into the container
fly secrets list    # view secret names (values hidden)
```

> **Note:** `fly.toml` sets `primary_region = "sin"` (Singapore) to minimise
> latency to the LTA DataMall API.  Change it to another region code if needed.

---

## Encore Cloud

### Prerequisites
```bash
# Install the Encore CLI
curl -L https://encore.dev/install.sh | bash

# Authenticate
encore auth login
```

### Local Development
```bash
# Install root-level deps (encore.dev package)
npm install

# Run locally with Encore's dev server
encore run
```

### Deploy to Encore Cloud
```bash
# Push to Encore Cloud (linked to your Encore app automatically)
git push encore main
```

Or via the Encore dashboard at https://app.encore.cloud — connect your
GitHub repository and Encore will build and deploy on every push to `main`.

### Environment Secrets (Encore Cloud)
Set secrets in the Encore dashboard under **Secrets**, or via CLI:
```bash
encore secret set --env=production SLACK_BOT_TOKEN
encore secret set --env=production SLACK_CHANNEL_ID
encore secret set --env=production LTA_ACCOUNT_KEY
encore secret set --env=production BASE_URL
```

### Build a Docker Image (Encore)
```bash
encore build docker slackbot-project:latest
```

This produces a self-contained image you can push to any registry.
