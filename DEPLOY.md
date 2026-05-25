# Deployment Guide

Railway is the **confirmed deployment platform**.

---

## Railway

Railway builds from `railway.json` using the Nixpacks builder.

### Prerequisites
```bash
npm install -g @railway/cli
railway login
```

### First Deploy
```bash
# Link to a new Railway project
railway init

# Set required environment variables
railway variables set \
  LTA_ACCOUNT_KEY=... \
  BASE_URL=https://<your-app>.up.railway.app \
  GOOGLE_MAPS_API_KEY=AIza... \
  OPENWEATHERMAP_API_KEY=...

# Deploy
railway up
```

> **Slack credentials** (`SLACK_BOT_TOKEN`, `SLACK_CHANNEL_ID`) can be set
> via the in-app **⚙️ Slack Settings** panel instead of as environment variables.

### Subsequent Deploys
```bash
railway up
```
Or connect your GitHub repo in the Railway dashboard for automatic deploys on
every push to `main`.

### Useful Commands
```bash
railway logs          # tail live logs
railway status        # deployment status
railway shell         # shell into the running container
railway variables     # list environment variables
```

---

## Fallbacks

If Railway is unavailable, the app can also be deployed to:

- **Fly.io** — `fly.toml` + `Dockerfile` are present. See `fly deploy` docs.
- **Encore Cloud** — `encore.app` + `slackbot/` service wrapper are present.
  See `encore run` / `git push encore main`.
