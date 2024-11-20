const axios = require('axios');
const { WebClient } = require('@slack/web-api');
require('dotenv').config();

const slackToken = process.env.SLACK_BOT_TOKEN;
const channelId = process.env.SLACK_CHANNEL_ID;
const slackClient = new WebClient(slackToken);

// Cache structure for weather data
let weatherCache = {
    'klang-valley': { data: null, timestamp: 0 },
    'singapore': { data: null, timestamp: 0 },
    'hong-kong': { data: null, timestamp: 0 },
};

// Fetch weather data function
async function fetchWeatherData(locationKey) {
    const now = Date.now();
    const cacheDuration = 5 * 60 * 1000; // Cache for 5 minutes

    if (!locationKey) {
        console.error('Error: locationKey is not defined');
        return null;
    }

    if (weatherCache[locationKey].data && now - weatherCache[locationKey].timestamp < cacheDuration) {
        console.log(`Using cached data for ${locationKey}`);
        return weatherCache[locationKey].data;
    }

    let apiUrl;
    switch (locationKey) {
        case 'klang-valley':
            apiUrl = 'https://api.data.gov.my/weather/warning?limit=3';
            break;
        case 'singapore':
            apiUrl = 'https://api.data.gov.sg/v1/environment/2-hour-weather-forecast';
            break;
        case 'hong-kong':
            apiUrl = 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=flw&lang=en';
            break;
        default:
            console.error('No API URL defined for location:', locationKey);
            return null;
    }

    try {
        const response = await axios.get(apiUrl);
        console.log('API Response for', locationKey, response.data);

        if (response.status === 200 && response.data) {
            weatherCache[locationKey] = { data: response.data, timestamp: now };
            return response.data;
        } else {
            console.error(`No data found for ${locationKey}`);
            return { error: `No data available for ${locationKey}` };
        }
    } catch (error) {
        console.error(`Error fetching weather data for ${locationKey}:`, error.message);
        return { error: `Error fetching data for ${locationKey}` };
    }
}

function formatLocationData(weatherData, locationKey) {
    let weatherText = '';

    if (weatherData.error) {
        weatherText = `:warning: Error fetching weather data: ${weatherData.error}`;
        return {
            text: weatherText,
        };
    }

    switch (locationKey) {
        case 'klang-valley':
            const warningIssue = weatherData[2]?.warning_issue || {};
            weatherText = `*Warning Issue:* ${warningIssue.title_en || 'Available Soon'}\n` +
                          `*Issued:* ${warningIssue.issued || 'Available Soon'}\n` +
                          `*Valid To:* ${weatherData[2]?.valid_to || 'Available Soon'}\n` +
                          `*Description:* ${warningIssue.text_en || 'Available Soon'}`;
            break;
        case 'singapore':
            const selectedAreas = [
                "Ang Mo Kio", "Toa Payoh", "Changi", "City",
                "Jurong East", "Jurong West", "Tuas", "Kallang",
                "Pasir Ris", "Woodlands"
            ];

            const sgForecasts = weatherData.items[0]?.forecasts
                .filter(item => selectedAreas.includes(item.area))
                .map(item => `Area: ${item.area} - Forecast: ${item.forecast}`)
                .join('\n');

            weatherText = sgForecasts || 'No forecasts available';
            break;
        case 'hong-kong':
            weatherText = `*General Situation:* ${weatherData.generalSituation || 'Available Soon'}\n` +
                          `*Typhoon Info:* ${weatherData.tcInfo || 'No typhoon warnings'}\n` +
                          `*Outlook:* ${weatherData.outlook || 'Available Soon'}`;
            break;
        default:
            weatherText = `No weather data available for ${locationKey}`;
    }

    return {
        text: weatherText,
    };
}

async function prepareSlackMessage() {
    const malaysiaData = await formatLocationData(await fetchWeatherData('klang-valley'), 'klang-valley');
    const singaporeData = await formatLocationData(await fetchWeatherData('singapore'), 'singapore');
    const hongKongData = await formatLocationData(await fetchWeatherData('hong-kong'), 'hong-kong');

    const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
    const mapUrlSG = `${BASE_URL}`;

    return {
        blocks: [
            { type: "section", text: { type: "mrkdwn", text: ":mostly_sunny: *Weather Update*" } },
            { type: "divider" },
            { type: "section", text: { type: "mrkdwn", text: `:flag-sg: *Singapore 2-Hour Weather Forecast*\n${singaporeData.text}` } },
            { type: "divider" },
            { type: "section", text: { type: "mrkdwn", text: `:flag-my: *Malaysia Weather Warning*\n${malaysiaData.text}` } },
            { type: "divider" },
            { type: "section", text: { type: "mrkdwn", text: `:flag-hk: *Hong Kong Weather Update*\n${hongKongData.text}` } },
            { type: "divider" },
            { type: "section", text: { type: "mrkdwn", text: `<${mapUrlSG}|View Map For More>` } },
        ],
    };
}

async function sendSlackNotification() {
    try {
        const formattedSlackMessage = await prepareSlackMessage();
        await slackClient.chat.postMessage({
            channel: channelId,
            blocks: formattedSlackMessage.blocks,
            text: "Weather update for Klang Valley, Singapore, and Hong Kong.",
        });
    } catch (error) {
        console.error('Error sending Slack message:', error.message);
    }
}

module.exports = { sendSlackNotification };
