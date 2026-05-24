# 🌦️ Weather Notification Slackbot for DeliveryOps

A weather notification Slackbot designed for delivery and logistics operations. It fetches and sends real-time weather updates for three regions — **Klang Valley (Malaysia)**, **Singapore**, and **Hong Kong** — to a designated Slack channel at scheduled intervals using cron jobs. The bot also includes an interactive map feature for visualizing weather updates based on coordinates.

---

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Cron Schedule](#cron-schedule)
- [Deployment](#deployment)
- [Future Development](#future-development)
- [Contributing](#contributing)
- [Contact](#contact)

---

## ✨ Features

- **Multi-region weather data** — Fetches real-time weather from official government APIs:
  - 🇲🇾 Klang Valley: [MET Malaysia via Data.gov.my](https://data.gov.my)
  - 🇸🇬 Singapore: [2-hour forecast via Data.gov.sg](https://data.gov.sg)
  - 🇭🇰 Hong Kong: [Hong Kong Observatory API](https://www.hko.gov.hk)
- **Automated Slack notifications** — Sends weather updates to a Slack channel on a cron schedule
- **Peak hour alerts** — More frequent updates during peak delivery hours (10 AM–11:30 AM, 5 PM–6:30 PM)
- **Interactive Slack messages** — Buttons linking directly to weather maps
- **5-minute data caching** — Minimizes redundant API calls
- **Interactive map interface** — View weather on a map using lat/lng/zoom parameters
- **Manual trigger endpoint** — Trigger notifications on demand for testing

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | Backend runtime |
| Express | Web server and routing |
| Axios | HTTP requests to external APIs |
| node-cron | Scheduled weather notifications |
| @slack/web-api | Slack bot integration |
| dotenv | Environment variable management |
| Puppeteer | Headless browser for map screenshots |
| Chart.js | Weather data visualization |
| Imgur | Image hosting for map snapshots |
| OpenAI | AI-powered weather summaries |
| Jest + Sinon + Supertest | Testing framework |

---

## 📁 Project Structure

```
SlackBot-Project/
├── backend/
│   ├── index.js              # Entry point — starts server + cron
│   ├── app.js                # Express setup, middleware, routes
│   ├── cron-schedule.js      # Cron job definitions
│   ├── index.html            # Homepage
│   ├── package.json
│   ├── .env.example          # Environment variable template
│   ├── config/
│   │   └── locations.js      # Static location/area data
│   ├── middleware/
│   │   ├── rateLimiter.js    # Express rate limiter
│   │   └── errorHandler.js   # Global error handler
│   ├── services/
│   │   ├── weatherService.js # Weather API fetch + cache
│   │   ├── trafficService.js # SG & HK traffic fetch
│   │   └── slackService.js   # Slack message build + send
│   ├── controllers/
│   │   ├── weatherController.js
│   │   ├── trafficController.js
│   │   └── slackController.js
│   ├── routes/
│   │   ├── api.js            # /api/* routes
│   │   └── pages.js          # /, /map, /send-notification
│   ├── public/               # Static assets
│   └── icon/                 # Icon assets
├── render.yaml               # Render deployment config
└── README.md
```

---

## ✅ Prerequisites

- [Node.js](https://nodejs.org/) v18+
- A [Slack workspace](https://slack.com) with bot permissions
- Slack Bot Token and Channel ID
- (Optional) LTA Account Key for additional transport data

---

## 🚀 Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/timothylee58/SlackBot-Project.git
   cd SlackBot-Project/backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables** (see [Configuration](#configuration))

4. **Start the server:**
   ```bash
   npm start
   ```

---

## ⚙️ Configuration

Copy `.env.example` to `.env` inside the `backend/` directory and fill in your values:

```bash
cp backend/.env.example backend/.env
```

```env
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_CHANNEL_ID=your-slack-channel-id
LTA_ACCOUNT_KEY=your-lta-account-key
BASE_URL=https://your-app.onrender.com
```

### Setting up a Slack Bot

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App**
2. Under **OAuth & Permissions**, add these Bot Token Scopes:
   - `chat:write`
   - `files:write`
3. Install the app to your workspace and copy the **Bot User OAuth Token**
4. Invite the bot to your channel: `/invite @your-bot-name`
5. Copy the **Channel ID** from the channel settings

---

## 📖 Usage

### Local Weather Map

View an interactive weather map in your browser:
```
http://localhost:3000/map?lat=3.1390&lng=101.6869&zoom=10
```

Parameters:
- `lat` — Latitude of the location
- `lng` — Longitude of the location
- `zoom` — Map zoom level (1–18)

**Example coordinates:**
| Region | lat | lng | zoom |
|---|---|---|---|
| Klang Valley | 3.1390 | 101.6869 | 10 |
| Singapore | 1.3521 | 103.8198 | 11 |
| Hong Kong | 22.3193 | 114.1694 | 11 |

### Manual Slack Notification

Trigger a weather notification manually (useful for testing):
```
GET http://localhost:3000/send-notification
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Serves the homepage (`index.html`) |
| GET | `/map?lat=&lng=&zoom=` | Interactive map view with coordinates |
| GET | `/send-notification` | Manually trigger a Slack weather notification |

---

## ⏰ Cron Schedule

The bot sends automated weather updates on the following schedule:

| Frequency | Time | Reason |
|---|---|---|
| Every 2 hours | 8 AM – 10 PM | Regular updates throughout the day |
| Every 30 minutes | 10 AM – 11:30 AM | Morning peak hour |
| Every 30 minutes | 5 PM – 6:30 PM | Evening peak hour |

---

## ☁️ Deployment

This project is configured for deployment on [Render](https://render.com) via `render.yaml`:

- **Runtime:** Node.js
- **Region:** Singapore
- **Build command:** `npm install`
- **Start command:** `node index.js`
- **Auto-deploy:** Enabled on push to main branch

Set the following environment variables in your Render dashboard:
- `SLACK_BOT_TOKEN`
- `SLACK_CHANNEL_ID`
- `LTA_ACCOUNT_KEY`
- `BASE_URL`

---

## 🔍 Debugging

Console logs are printed when:
- Weather data is fetched from APIs
- Notifications are sent to Slack
- Cron jobs are triggered

Run with Node.js debug mode for more verbose output:
```bash
DEBUG=* node index.js
```

---

## 🔮 Future Development

- **More locations** — Extend support by adding entries to the `locations` object in `index.js`. Each location needs: `name`, weather API endpoint, `coordinates`, and `zoom` level.
- **Severity alerts** — Push urgent notifications for extreme weather conditions
- **Dashboard UI** — Web dashboard for viewing historical weather notifications
- **Multi-channel support** — Route different regions to different Slack channels

---

## 🤝 Contributing

1. Fork the repository
2. Create a new branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Commit: `git commit -m 'Add some feature'`
5. Push: `git push origin feature/your-feature`
6. Open a Pull Request

---

## 📬 Contact

For issues, questions, or suggestions:
- **GitHub:** [timothylee58](https://github.com/timothylee58)
- **LinkedIn:** [Timothy Lee](https://www.linkedin.com/in/lee-yung-yau-timothy-lee-01a650158/)
