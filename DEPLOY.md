# Deployment Guide

Railway is the **confirmed deployment platform**.

---

## Railway

Railway builds from `railway.json` using the Dockerfile builder.

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
  GOOGLE_MAPS_API_KEY=AIza...

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
- **Encore Cloud** — a `slackbot/` service wrapper is present.
  See `encore run` / `git push encore main`.

---

## Monitoring (Prometheus + Grafana)

The app exposes Prometheus-format metrics at `GET /metrics` (HTTP request
latency, cron run outcomes, circuit breaker state, per-region agent fetch
duration, Slack notification duration). If `SETTINGS_SECRET` is set, the
endpoint requires the same `x-settings-token` header as `/api/settings`.

### Local stack
```bash
cd monitoring
docker compose up -d
```
- Prometheus: http://localhost:9090 (scrapes the app on `host.docker.internal:3000`)
- Grafana: http://localhost:3001 (login `admin` / `admin`), add Prometheus
  (`http://prometheus:9090`) as a data source and build dashboards from the
  metrics above.

### Hosted alternative
Skip running your own Prometheus/Grafana by using
[Grafana Cloud](https://grafana.com/products/cloud/)'s free tier — configure
its Prometheus remote-write/scrape agent to hit your Railway app's public
`/metrics` URL.
