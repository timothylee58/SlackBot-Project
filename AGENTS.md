# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Weather Notification Slackbot for DeliveryOps — a single Node.js/Express backend that fetches real-time weather data for Klang Valley (Malaysia), Singapore, and Hong Kong, and sends formatted updates to Slack. It also serves an interactive weather map UI.

All application code lives under `backend/`. There is no monorepo structure and no database.

### Running the application

```bash
cd backend && node index.js
```

The server starts on port 3000. It requires a `backend/.env` file (see README → Configuration). For local development without a real Slack workspace, use placeholder values for `SLACK_BOT_TOKEN` and `SLACK_CHANNEL_ID` — the server starts fine and all non-Slack endpoints work.

### Key endpoints for verification

- `GET /` — homepage with interactive weather map
- `GET /api/locations` — location metadata
- `GET /api/weather/:locationKey` — live weather data (`singapore`, `hong-kong`, `klang-valley`)
- `GET /api/status/:locationKey` — combined weather + traffic
- `GET /send-notification` — triggers Slack message (requires valid Slack credentials)

### Linting and testing

- **No linter** is configured (no ESLint/Prettier).
- **Jest** is in devDependencies but no test files exist. The `npm test` script is a placeholder that exits with code 1.
- If adding tests, use Jest + Supertest (already in devDependencies). Note that `index.js` starts the server on import (`app.listen` is called at module top-level), so Supertest-based tests need to account for this.

### Gotchas

- `dotenv` is loaded after `LTA_KEY` is assigned on line 8 of `index.js`, so the LTA key will be `undefined` unless the env var is set at the system level or the code is fixed. Weather endpoints work fine regardless.
- The `body-parser` package is used but not listed in `package.json` dependencies — it works because Express v4 bundles it, but imports may produce warnings in some environments.
- Puppeteer (for map screenshots) requires Chromium system dependencies. It is not needed for core weather/API functionality.
