const { WebClient } = require('@slack/web-api');
const { fetchWeatherData } = require('./weatherService');
const { fetchSGTraffic, fetchHKTraffic, fetchMYTraffic } = require('./trafficService');
const { locations } = require('../config/locations');
const runtimeSettings = require('../config/runtimeSettings');

const MAP_URL = process.env.BASE_URL || 'http://localhost:3000';
const AGENT_TIMEOUT_MS = 12000;
const AGENT_RETRIES    = 2;

// SG areas shown in the Slack message — subset of all areas
const SG_DISPLAY_AREAS = [
    "Ang Mo Kio", "Changi", "City", "Jurong East", "Jurong West", "Tuas",
    "Toa Payoh", "Kallang", "Pasir Ris", "Woodlands", "Bedok", "Clementi",
    "Bukit Merah", "Bukit Panjang", "Bukit Timah", "Serangoon", "Sengkang", "Yishun"
];

const SG_EXPRESSWAYS = ['Expressway', 'PIE', 'CTE', 'ECP', 'AYE', 'SLE', 'TPE', 'KPE', 'BKE', 'MCE'];

// Maps SG forecast keywords to a representative emoji
function sgForecastEmoji(forecast = '') {
    const f = forecast.toLowerCase();
    if (f.includes('thunder'))             return '⛈️';
    if (f.includes('heavy rain'))          return '🌧️';
    if (f.includes('moderate rain'))       return '🌦️';
    if (f.includes('light rain') || f.includes('drizzle')) return '🌦️';
    if (f.includes('cloudy'))              return '☁️';
    if (f.includes('partly cloudy'))       return '⛅';
    if (f.includes('fair') || f.includes('sunny') || f.includes('fine')) return '☀️';
    if (f.includes('windy'))               return '💨';
    if (f.includes('hazy'))                return '🌫️';
    return '🌤️';
}

// Runs an async fn with a timeout and up to `retries` attempts
async function withRetry(fn, retries = AGENT_RETRIES, timeoutMs = AGENT_TIMEOUT_MS) {
    let lastError;
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
        try {
            const result = await Promise.race([
                fn(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Agent timeout')), timeoutMs)
                )
            ]);
            return result;
        } catch (err) {
            lastError = err;
            if (attempt <= retries) {
                const delay = 500 * Math.pow(2, attempt - 1);
                console.warn(`[agent] retry ${attempt}/${retries} after ${delay}ms — ${err.message}`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    console.error(`[agent] all retries exhausted — ${lastError.message}`);
    return { error: lastError.message };
}

// ── Per-region agents ─────────────────────────────────────────────────────────

async function agentSingapore() {
    const [weather, traffic] = await Promise.all([
        withRetry(() => fetchWeatherData('singapore')),
        withRetry(() => fetchSGTraffic())
    ]);
    return { weather, traffic };
}

async function agentMalaysia() {
    const [weather, traffic] = await Promise.all([
        withRetry(() => fetchWeatherData('klang-valley')),
        withRetry(() => fetchMYTraffic())
    ]);
    return { weather, traffic };
}

async function agentHongKong() {
    const [weather, traffic] = await Promise.all([
        withRetry(() => fetchWeatherData('hong-kong')),
        withRetry(() => fetchHKTraffic())
    ]);
    return { weather, traffic };
}

// ── Formatters ────────────────────────────────────────────────────────────────

function formatSingapore({ weather, traffic }) {
    let weatherText = ':warning: Weather unavailable';
    let trafficText = '';

    if (!weather?.error && weather?.items?.[0]?.forecasts) {
        const forecasts = weather.items[0].forecasts.filter(f => SG_DISPLAY_AREAS.includes(f.area));

        // Group areas by forecast description so the message stays concise
        const groups = {};
        forecasts.forEach(({ area, forecast }) => {
            const key = forecast.trim();
            if (!groups[key]) groups[key] = [];
            groups[key].push(area);
        });

        const updateTime = weather.items[0].update_timestamp
            ? `_(updated ${new Date(weather.items[0].update_timestamp).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Singapore' })})_`
            : '';

        weatherText = Object.entries(groups)
            .map(([forecast, areas]) => `${sgForecastEmoji(forecast)} *${forecast}:* ${areas.join(', ')}`)
            .join('\n');
        if (updateTime) weatherText = `${updateTime}\n${weatherText}`;
    } else if (weather?.error) {
        weatherText = `:warning: ${weather.error}`;
    }

    const trafficArr = Array.isArray(traffic) ? traffic : [];
    if (trafficArr.length > 0) {
        const accidents  = trafficArr.filter(i => i.Type === 'Accident');
        const expressway = trafficArr.filter(i =>
            SG_EXPRESSWAYS.some(kw => i.Message?.includes(kw)) && i.Type !== 'Accident'
        );
        const lines = [`*🚦 Traffic:* 🔴 ${trafficArr.length} incident(s) reported`];
        if (accidents.length > 0) {
            lines.push(`🚨 *Accidents (${accidents.length}):*`);
            accidents.slice(0, 3).forEach(a => lines.push(`  • ${a.Message}`));
        }
        if (expressway.length > 0) {
            lines.push(`🛣️ *Expressway alerts:*`);
            expressway.slice(0, 2).forEach(e => lines.push(`  • ${e.Message}`));
        }
        trafficText = lines.join('\n');
    } else {
        trafficText = '*🚦 Traffic:* 🟢 Smooth flow on all roads.';
    }

    return { weatherText, trafficText };
}

function formatMalaysia({ weather, traffic }) {
    let weatherText = ':warning: Weather unavailable';
    let trafficText = '';

    if (!weather?.error && Array.isArray(weather) && weather.length > 0) {
        // MY API returns array; index 2 is a typical summary entry
        const entry = weather[2] || weather[0];
        const warning = entry?.warning_issue || {};
        const validTo = entry?.valid_to ? ` _(valid to ${entry.valid_to})_` : '';
        const title   = warning.title_en || 'No active weather warnings';
        const summary = warning.summary_en || '';
        weatherText = `*${title}*${validTo}`;
        if (summary) weatherText += `\n${summary}`;
    } else if (weather?.error) {
        weatherText = `:warning: ${weather.error}`;
    }

    const trafficArr = Array.isArray(traffic) ? traffic : [];
    if (trafficArr.length > 0) {
        const lines = [`*🚦 Traffic:* 🔴 ${trafficArr.length} disruption(s)`];
        trafficArr.slice(0, 4).forEach(t => {
            const src = t.source ? ` _(${t.source})_` : '';
            lines.push(`  • ${t.description}${src}`);
        });
        trafficText = lines.join('\n');
    } else {
        trafficText = '*🚦 Traffic:* 🟢 No reported disruptions.';
    }

    return { weatherText, trafficText };
}

function formatHongKong({ weather, traffic }) {
    let weatherText = ':warning: Weather unavailable';
    let trafficText = '';

    if (!weather?.error) {
        const outlook = weather?.outlook || '';
        const general = weather?.generalSituation || '';
        if (outlook || general) {
            weatherText = [general && `*Situation:* ${general}`, outlook && `*Outlook:* ${outlook}`]
                .filter(Boolean).join('\n');
        }
    } else {
        weatherText = `:warning: ${weather.error}`;
    }

    const trafficArr = Array.isArray(traffic) ? traffic : [];
    if (trafficArr.length > 0) {
        const lines = [`*🚦 Traffic:* 🔴 ${trafficArr.length} notice(s)`];
        trafficArr.slice(0, 4).forEach(t => {
            const loc = t.district ? `[${t.district}] ` : '';
            lines.push(`  • ${loc}${t.description}`);
        });
        trafficText = lines.join('\n');
    } else {
        trafficText = '*🚦 Traffic:* 🟢 No major closures reported.';
    }

    return { weatherText, trafficText };
}

// ── Message assembly ──────────────────────────────────────────────────────────

async function prepareSlackMessage() {
    const startMs = Date.now();

    // Run all three regional agents in parallel (each handles its own retries)
    const [sgResult, myResult, hkResult] = await Promise.all([
        agentSingapore(),
        agentMalaysia(),
        agentHongKong()
    ]);

    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
    console.log(`[slackService] data fetched in ${elapsed}s`);

    const sg = formatSingapore(sgResult);
    const my = formatMalaysia(myResult);
    const hk = formatHongKong(hkResult);

    const now = new Date();
    const timestamp = now.toLocaleString('en-SG', {
        timeZone: 'Asia/Singapore',
        weekday: 'short', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    return {
        blocks: [
            {
                type: "header",
                text: { type: "plain_text", text: "🌤️ Weather & Traffic Update", emoji: true }
            },
            {
                type: "context",
                elements: [{ type: "mrkdwn", text: `📅 ${timestamp} SGT  •  🗺️ <${MAP_URL}|View Live Map>` }]
            },
            { type: "divider" },
            {
                type: "section",
                text: { type: "mrkdwn", text: `:flag-sg: *Singapore*\n${sg.weatherText}` }
            },
            {
                type: "section",
                text: { type: "mrkdwn", text: sg.trafficText }
            },
            { type: "divider" },
            {
                type: "section",
                text: { type: "mrkdwn", text: `:flag-my: *Malaysia (Klang Valley)*\n${my.weatherText}` }
            },
            {
                type: "section",
                text: { type: "mrkdwn", text: my.trafficText }
            },
            { type: "divider" },
            {
                type: "section",
                text: { type: "mrkdwn", text: `:flag-hk: *Hong Kong*\n${hk.weatherText}` }
            },
            {
                type: "section",
                text: { type: "mrkdwn", text: hk.trafficText }
            },
            { type: "divider" },
            {
                type: "context",
                elements: [{ type: "mrkdwn", text: `_Data from data.gov.sg · data.gov.my · weather.gov.hk · LTA DataMall_` }]
            }
        ]
    };
}

// Posts the weather + traffic update to the configured Slack channel
async function sendSlackNotification() {
    const token     = runtimeSettings.get('SLACK_BOT_TOKEN');
    const channelId = runtimeSettings.get('SLACK_CHANNEL_ID');

    if (!token || !channelId) {
        throw new Error('Slack credentials not configured. Set SLACK_BOT_TOKEN and SLACK_CHANNEL_ID via the Settings panel.');
    }

    const slackClient = new WebClient(token);
    const message = await prepareSlackMessage();

    console.log('Formatted Slack Message:', JSON.stringify(message, null, 2));

    const response = await slackClient.chat.postMessage({
        channel: channelId,
        blocks: message.blocks,
        text: "🌤️ Weather & Traffic Update — SG · MY · HK"
    });

    console.log('Message sent successfully:', response.ts);
    return response;
}

// Backwards-compatible shim used by weatherController and tests.
// Maps the old (weatherData, locationKey, trafficData) signature to the new per-region formatters.
function formatLocationData(weatherData, locationKey, trafficData = []) {
    if (weatherData?.error) {
        return { text: `:warning: Weather Error: ${weatherData.error}`, traffic: '' };
    }
    const input = { weather: weatherData, traffic: trafficData };
    switch (locationKey) {
        case 'singapore': {
            const { weatherText, trafficText } = formatSingapore(input);
            return { text: weatherText, traffic: trafficText };
        }
        case 'klang-valley': {
            const { weatherText, trafficText } = formatMalaysia(input);
            return { text: weatherText, traffic: trafficText };
        }
        case 'hong-kong': {
            const { weatherText, trafficText } = formatHongKong(input);
            return { text: weatherText, traffic: trafficText };
        }
        default:
            return { text: `No weather data available for ${locations[locationKey]?.name || locationKey}`, traffic: '' };
    }
}

module.exports = { sendSlackNotification, prepareSlackMessage, formatLocationData };
