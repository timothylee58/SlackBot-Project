const { WebClient } = require('@slack/web-api');
const { fetchWeatherData } = require('./weatherService');
const { fetchSGTraffic, fetchHKTraffic, fetchMYTraffic } = require('./trafficService');
const { locations } = require('../config/locations');
const runtimeSettings = require('../config/runtimeSettings');

const MAP_URL = process.env.BASE_URL || 'http://localhost:3000';

// SG areas shown in the Slack message — subset of all areas
const SG_DISPLAY_AREAS = [
    "Ang Mo Kio", "Changi", "City", "Jurong East", "Jurong West", "Tuas",
    "Toa Payoh", "Kallang", "Pasir Ris", "Woodlands", "Bedok", "Clementi",
    "Bukit Merah", "Bukit Panjang", "Bukit Timah", "Serangoon", "Sengkang", "Yishun"
];

// SG expressway abbreviations used to detect expressway incidents
const SG_EXPRESSWAYS = ['Expressway', 'PIE', 'CTE', 'ECP', 'AYE', 'SLE', 'TPE', 'KPE', 'BKE', 'MCE'];

// Formats raw API data for a single location into display-ready strings
function formatLocationData(weatherData, locationKey, trafficData = []) {
    if (weatherData?.error) {
        return { text: `:warning: Weather Error: ${weatherData.error}`, traffic: '' };
    }

    let weatherText = '';
    let trafficText = '';

    switch (locationKey) {
        case 'klang-valley': {
            const warningIssue = weatherData[2]?.warning_issue || {};
            weatherText = `*Weather:* ${warningIssue.title_en || 'Stable'}\n*Valid To:* ${weatherData[2]?.valid_to || 'N/A'}`;

            if (trafficData.length > 0) {
                const lines = [`*🚦 Traffic:* 🔴 ${trafficData.length} disruption(s)`];
                trafficData.slice(0, 3).forEach(t => lines.push(`  • ${t.description}`));
                trafficText = lines.join('\n');
            } else {
                trafficText = `*🚦 Traffic:* 🟢 No reported disruptions.`;
            }
            break;
        }

        case 'singapore': {
            weatherText = weatherData.items?.[0]?.forecasts
                ?.filter(item => SG_DISPLAY_AREAS.includes(item.area))
                .map(item => `• ${item.area}: ${item.forecast}`)
                .join('\n') || 'No weather alerts.';

            if (trafficData.length > 0) {
                const accidents = trafficData.filter(i => i.Type === 'Accident');
                const expressway = trafficData.filter(i =>
                    SG_EXPRESSWAYS.some(kw => i.Message?.includes(kw))
                );

                const lines = [`*🚦 Traffic:* 🔴 ${trafficData.length} incident(s)`];

                if (accidents.length > 0) {
                    lines.push(`🚨 *Accidents:* ${accidents.length}`);
                    accidents.slice(0, 2).forEach(a => lines.push(`  • ${a.Message}`));
                }

                const nonAccidentExpressway = expressway.filter(e => e.Type !== 'Accident').slice(0, 2);
                if (nonAccidentExpressway.length > 0) {
                    lines.push(`🛣️ *Expressway:*`);
                    nonAccidentExpressway.forEach(e => lines.push(`  • ${e.Message}`));
                }

                trafficText = lines.join('\n');
            } else {
                trafficText = `*🚦 Traffic:* 🟢 Smooth flow.`;
            }
            break;
        }

        case 'hong-kong': {
            weatherText = `*Weather Outlook:* ${weatherData.outlook || 'Available Soon'}`;
            if (trafficData.length > 0) {
                const lines = [`*🚦 Traffic:* 🔴 ${trafficData.length} notice(s)`];
                trafficData.slice(0, 3).forEach(t => {
                    const loc  = t.district ? `[${t.district}] ` : '';
                    lines.push(`  • ${loc}${t.description}`);
                });
                trafficText = lines.join('\n');
            } else {
                trafficText = `*🚦 Traffic:* 🟢 No major closures.`;
            }
            break;
        }

        default:
            weatherText = `No weather data available for ${locations[locationKey]?.name || locationKey}`;
    }

    return { text: weatherText, traffic: trafficText };
}

// Fetches all data concurrently and builds the Slack Block Kit message payload
async function prepareSlackMessage() {
    const [weatherMY, weatherSG, weatherHK, trafficMY, trafficSG, trafficHK] = await Promise.all([
        fetchWeatherData('klang-valley'),
        fetchWeatherData('singapore'),
        fetchWeatherData('hong-kong'),
        fetchMYTraffic(),
        fetchSGTraffic(),
        fetchHKTraffic()
    ]);

    const malaysia = formatLocationData(weatherMY, 'klang-valley', trafficMY);
    const singapore = formatLocationData(weatherSG, 'singapore', trafficSG);
    const hongKong = formatLocationData(weatherHK, 'hong-kong', trafficHK);

    return {
        blocks: [
            {
                type: "header",
                text: { type: "plain_text", text: "🌤️ Weather & Traffic Update", emoji: true }
            },
            { type: "divider" },
            {
                type: "section",
                text: { type: "mrkdwn", text: `:flag-sg: *Singapore*\n${singapore.text}\n${singapore.traffic}` }
            },
            { type: "divider" },
            {
                type: "section",
                text: { type: "mrkdwn", text: `:flag-my: *Malaysia (Klang Valley)*\n${malaysia.text}\n${malaysia.traffic}` }
            },
            { type: "divider" },
            {
                type: "section",
                text: { type: "mrkdwn", text: `:flag-hk: *Hong Kong*\n${hongKong.text}\n${hongKong.traffic}` }
            },
            { type: "divider" },
            {
                type: "section",
                text: { type: "mrkdwn", text: `🗺️ <${MAP_URL}|View Interactive Map>` }
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

    try {
        const message = await prepareSlackMessage();
        console.log('Formatted Slack Message:', JSON.stringify(message, null, 2));

        const response = await slackClient.chat.postMessage({
            channel: channelId,
            blocks: message.blocks,
            text: "Weather update for Klang Valley, Singapore, and Hong Kong."
        });

        console.log('Message sent successfully:', response.ts);
    } catch (error) {
        console.error('Error sending Slack message:', error.message);
        throw error;
    }
}

module.exports = { sendSlackNotification, prepareSlackMessage, formatLocationData };
