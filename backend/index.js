/**
 * index.js
 *
 * Main Express server for the Weather & Traffic SlackBot.
 *
 * Responsibilities:
 *   1. Serve the interactive Leaflet map frontend (static files).
 *   2. Expose REST API endpoints for weather/traffic data and manual triggers.
 *   3. Fetch and cache weather data from three government APIs
 *      (Malaysia, Singapore, Hong Kong).
 *   4. Fetch live traffic incident data (Singapore LTA, Hong Kong TD).
 *   5. Format and post a Slack Block Kit message via the Slack Web API.
 *
 * Environment variables required (see render.yaml):
 *   SLACK_BOT_TOKEN   – Bot OAuth token for posting to Slack
 *   SLACK_CHANNEL_ID  – Target Slack channel ID
 *   LTA_ACCOUNT_KEY   – API key for Singapore LTA DataMall (traffic)
 *   BASE_URL          – Public URL of this service (defaults to localhost:3000)
 */

// ─── External Dependencies ───────────────────────────────────────────────────
const express = require('express');
const axios = require('axios');
// node-cron is imported here so it is available if needed directly in this file;
// the actual schedule definitions live in cron-schedule.js.
const cron = require('node-cron') || require('./cron-schedule');
const { WebClient } = require('@slack/web-api');
const path = require('path');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');

// Read LTA API key early so it is available when fetchSGTraffic() is called.
const LTA_KEY = process.env.LTA_ACCOUNT_KEY;

// Load .env file values into process.env (no-op in production where env vars
// are injected by the host, e.g. Render).
require('dotenv').config();

// ─── Express App Initialisation ──────────────────────────────────────────────
const app = express();
const port = 3000;

// Tell Express to trust one layer of reverse-proxy headers (e.g. X-Forwarded-For).
// Required on Render so that rate limiting and IP detection work correctly.
app.set('trust proxy', 1); // 1 indicates trusting a single proxy, like Render

// Start the HTTP server immediately so the process is considered "live" by
// Render's health checks while the rest of the module finishes loading.
const server = app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

// Disable socket timeout entirely so long-running weather/Slack API calls are
// never cut off mid-flight by the underlying Node.js TCP layer.
server.timeout = 0; // Unlimited timeout

// ─── Rate Limiting ────────────────────────────────────────────────────────────
// Prevents abuse by capping each unique IP address at 100 requests per 15-minute
// sliding window. Applies to every route defined below.
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
});

// Apply rate limiter to all requests
app.use(limiter);

// ─── Request Parsing Middleware ───────────────────────────────────────────────
// Parse incoming JSON bodies (e.g. webhook payloads).
app.use(express.json());
// Parse URL-encoded form data submitted by HTML forms.
app.use(express.urlencoded({ extended: true }));
// bodyParser is redundant with express.json() but retained here for safety;
// the 50 MB limit accommodates any large payloads from map interactions.
app.use(bodyParser.json({ limit: '50mb' })); // Increase limit if necessary

// Serve everything inside /backend/public as static files (HTML, icons, JSON).
app.use(express.static(path.join(__dirname, 'public')));

// ─── Location Master Data ─────────────────────────────────────────────────────
// Three top-level regions tracked by this bot.
// `coordinates` is [lat, lng] and is consumed by the Leaflet map.
const locations = {
    'klang-valley': {
        name: 'Klang Valley',
        weatherLocation: 'Kuala Lumpur, Malaysia',
        coordinates: [3.1390, 101.6869],
        zoomLevel: 9
    },
    'singapore': {
        name: 'Singapore',
        weatherLocation: 'Singapore',
        coordinates: [1.3521, 103.8198],
        zoomLevel: 12
    },
    'hong-kong': {
        name: 'Hong Kong',
        weatherLocation: 'Hong Kong',
        coordinates: [22.3193, 114.1694],
        zoomLevel: 12
    }
};

// Full list of Singapore planning areas/towns with their map coordinates.
// Used by the frontend to place per-area weather markers on the Leaflet map.
const singaporeAreas = [
    { area: "City", coordinates: [1.2830, 103.8514] },
    { area: "Changi", coordinates: [1.3644, 103.9915] },
    { area: "Toa Payoh", coordinates: [1.3346, 103.8560] },
    { area: "Ang Mo Kio", coordinates: [1.3691, 103.8454] },
    { area: "Jurong West", coordinates: [1.3404, 103.7064] },
    { area: "Jurong East", coordinates: [1.3324, 103.7438] },
    { area: "Kallang", coordinates: [1.3088, 103.8610] },
    { area: "Pasir Ris", coordinates: [1.3731, 103.9495] },
    { area: "Tuas", coordinates: [1.3214, 103.6490] },
    { area: "Woodlands", coordinates: [1.4360, 103.7863] },
    { area: "Bukit Merah", coordinates: [1.2830, 103.8000] },
    { area: "Bukit Panjang", coordinates: [1.3932, 103.7795] },
    { area: "Bukit Timah", coordinates: [1.3323, 103.7852] },
    { area: "Serangoon", coordinates: [1.3532, 103.8700] },
    { area: "Sengkang", coordinates: [1.3913, 103.8951] },
    { area: "Yishun", coordinates: [1.4304, 103.8354] },
    { area: "Marine Parade", coordinates: [1.3009, 103.8992] },
    { area: "Bedok", coordinates: [1.3236, 103.9304] },
    { area: "Clementi", coordinates: [1.3151, 103.7643] },
    { area: "Tampines", coordinates: [1.3496, 103.9568] },
    { area: "Queenstown", coordinates: [1.2942, 103.7861] },
    { area: "Geylang", coordinates: [1.3201, 103.8918] },
    { area: "Hougang", coordinates: [1.3612, 103.8863] },
    { area: "Punggol", coordinates: [1.3984, 103.9072] },
    { area: "Sembawang", coordinates: [1.4491, 103.8185] },
    { area: "Novena", coordinates: [1.3204, 103.8438] },
    { area: "Bishan", coordinates: [1.3526, 103.8352] },
    { area: "Tengah", coordinates: [1.3648, 103.7095] },
    { area: "Sentosa", coordinates: [1.2494, 103.8303] },
    { area: "Pulau Ubin", coordinates: [1.4044, 103.9625] },
    { area: "Mandai", coordinates: [1.4043, 103.8066] },
    { area: "Jurong Island", coordinates: [1.2660, 103.6991] },
    { area: "Lim Chu Kang", coordinates: [1.4305, 103.7178] },
    { area: "Choa Chu Kang", coordinates: [1.3840, 103.7470] }
];

// Hong Kong district centroids used for map marker placement.
const hongKongRegions = [
    { name: 'Central and Western', lat: 22.282, lng: 114.158 },
    { name: 'Eastern District', lat: 22.2849, lng: 114.221 },
    { name: 'Kowloon City', lat: 22.3163, lng: 114.186 },
    { name: 'New Territories', lat: 22.4477, lng: 114.1872 },
    { name: 'Kwun Tong', lat: 22.308, lng: 114.225 },
    { name: 'Sham Shui Po', lat: 22.327, lng: 114.163 },
    { name: 'Southern District', lat: 22.247, lng: 114.161 },
    { name: 'Wan Chai', lat: 22.276, lng: 114.176 },
    { name: 'Yau Tsim Mong', lat: 22.319, lng: 114.169 },
    { name: 'Tsuen Wan', lat: 22.372, lng: 114.114 },
    { name: 'Tuen Mun', lat: 22.391, lng: 113.973 },
    { name: 'Sha Tin', lat: 22.382, lng: 114.191 },
    { name: 'Tai Po', lat: 22.450, lng: 114.170 },
    { name: 'Yuen Long', lat: 22.445, lng: 114.022 },
    { name: 'Sai Kung', lat: 22.383, lng: 114.273 }
];

// Malaysia delivery cities in the Klang Valley corridor with map coordinates.
const klangValleyCities = [
    { city: "Kuala Lumpur", coordinates: [3.1390, 101.6869] },
    { city: "Petaling Jaya", coordinates: [3.1073, 101.6067] },
    { city: "Subang Jaya", coordinates: [3.0818, 101.5745] },
    { city: "Shah Alam", coordinates: [3.0738, 101.5183] },
    { city: "Puchong", coordinates: [3.0331, 101.6220] },
    { city: "Cheras", coordinates: [3.0851, 101.7441] },
    { city: "Ampang", coordinates: [3.1579, 101.7530] },
    { city: "Gombak", coordinates: [3.2910, 101.6744] },
    { city: "Bangi", coordinates: [2.9178, 101.7739] },
    { city: "Kajang", coordinates: [2.9936, 101.7875] }
];

// ─── Slack & API Configuration ────────────────────────────────────────────────
const slackToken = process.env.SLACK_BOT_TOKEN;
const channelId = process.env.SLACK_CHANNEL_ID;
// BASE_URL is used when constructing deep links (e.g. the interactive map link
// included in every Slack message).
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const slackClient = new WebClient(slackToken);

// ─── In-Memory Weather Cache ──────────────────────────────────────────────────
// Stores the last successful API response per location together with the
// Unix timestamp of when it was fetched.  fetchWeatherData() checks this
// before making a new HTTP call, keeping external API usage low.
let weatherCache = {
    'klang-valley': { data: null, timestamp: 0 },
    'singapore': { data: null, timestamp: 0 },
    'hong-kong': { data: null, timestamp: 0 }
};

/**
 * fetchWeatherData(locationKey)
 *
 * Fetches weather data for the given region from the appropriate government API.
 * Results are cached for 5 minutes so that rapid successive calls (e.g. from
 * the map frontend + a cron notification) do not each hit the upstream API.
 *
 * Cache logic:
 *   1. If cached data exists AND is younger than cacheDuration → return it.
 *   2. Otherwise select the correct API URL via a switch statement, call it,
 *      store the response in the cache, and return the fresh data.
 *
 * API sources:
 *   klang-valley → MET Malaysia open data (weather warnings, limit 3 records)
 *   singapore    → data.gov.sg 2-hour area forecast
 *   hong-kong    → Hong Kong Observatory general weather (flw = forecast)
 *
 * @param {string} locationKey – One of 'klang-valley' | 'singapore' | 'hong-kong'
 * @returns {Object|null} Raw API response body, an error object, or null on bad key.
 */
async function fetchWeatherData(locationKey) {
    const now = Date.now();
    // Cache TTL: 5 minutes expressed in milliseconds.
    const cacheDuration = 5 * 60 * 1000; // Cache for 5 minutes


    if (!locationKey) {
        console.error('Error: locationKey is not defined');
        return null;
    }

    // Return cached data if it is still within the TTL window.
    if (weatherCache[locationKey].data && (now - weatherCache[locationKey].timestamp < cacheDuration)) {
        console.log(`Using cached data for ${locationKey}`);
        return weatherCache[locationKey].data;
    }

    // Select the upstream API endpoint based on the requested region.
    let apiUrl;
    switch (locationKey) {
        case 'klang-valley':
            // MET Malaysia: returns the latest 3 active weather warnings (e.g. thunderstorm advisories).
            apiUrl = 'https://api.data.gov.my/weather/warning?limit=3';
            break;
        case 'singapore':
            // NEA Singapore: 2-hour area-level weather forecast grid.
            apiUrl = 'https://api.data.gov.sg/v1/environment/2-hour-weather-forecast';
            break;
        case 'hong-kong':
            // HKO: General weather forecast in English (dataType=flw, lang=en).
            apiUrl = 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=flw&lang=en';
            break;
        default:
            console.error('No API URL defined for location:', locationKey);
            return null;
    }

    try {
        const response = await axios.get(apiUrl);
        console.log('API Response for', locationKey, response.data);

        // Only cache and return data when the API responds with HTTP 200 and a body.
        if (response.status === 200 && response.data) {
            // Update the cache entry with fresh data and the current timestamp.
            weatherCache[locationKey] = { data: response.data, timestamp: now };
            return response.data;
        } else {
            console.error(`No data found for ${locationKey}`);
            return { error: `No data available for ${locationKey}` }; // Return an error object
        }
    }catch (error) {
        console.error(`Error fetching weather data for ${locationKey}:`, error.message);
        return { error: `Error fetching data for ${locationKey}` }; // Default response on error
    }

}

/**
 * fetchSGTraffic()
 *
 * Retrieves live traffic incident records from the Singapore LTA DataMall API.
 * The LTA_ACCOUNT_KEY header authenticates the request.
 *
 * @returns {Array} Array of traffic incident objects, or [] on failure.
 *   Each object typically contains: { Type, Message, Latitude, Longitude }
 */
async function fetchSGTraffic() {
    try {
        const response = await axios.get('http://datamall2.mytransport.sg/ltaodataservice/TrafficIncidents', {
            headers: { 'AccountKey': LTA_KEY }
        });
        // The LTA API wraps its results in a `value` array; fall back to empty if missing.
        return response.data.value || [];
    } catch (error) {
        console.error('Error fetching SG traffic:', error.message);
        return [];
    }
}

/**
 * fetchHKTraffic()
 *
 * Retrieves Special Traffic News (STN) from the Hong Kong Transport Department
 * real-time information service (RTIS).
 *
 * @returns {Array} Array of special traffic news objects, or [] on failure.
 *   Each object typically contains: { content, ... }
 */
async function fetchHKTraffic() {
    try {
        // Special Traffic News API (JSON)
        const response = await axios.get('https://td.rtis.data.gov.hk/api/traffic/stn/v1/getSTN');
        // The RTIS API wraps results under the `STN` key.
        return response.data.STN || [];
    } catch (error) {
        console.error('Error fetching HK traffic:', error.message);
        return [];
    }
}


/**
 * prepareSlackMessage()
 *
 * Orchestrates all data fetches and assembles the final Slack Block Kit payload.
 *
 * Fetching strategy – all five calls are issued in parallel via Promise.all()
 * so the total wait time equals the slowest individual API rather than the
 * sum of all five:
 *   weatherMY  → Malaysia weather warnings
 *   weatherSG  → Singapore 2-hour area forecasts
 *   weatherHK  → Hong Kong general weather outlook
 *   trafficSG  → Singapore LTA live incidents
 *   trafficHK  → Hong Kong TD special traffic news
 *
 * Each region's raw API data is then formatted by formatLocationData() into
 * plain Slack markdown strings before being embedded into Block Kit sections.
 *
 * @returns {Object} Slack message payload { blocks: [...] }
 */
async function prepareSlackMessage() {

    // Fetch all data concurrently for efficiency
    const [
        weatherMY, weatherSG, weatherHK,
        trafficSG, trafficHK
    ] = await Promise.all([
        fetchWeatherData('klang-valley'),
        fetchWeatherData('singapore'),
        fetchWeatherData('hong-kong'),
        fetchSGTraffic(),
        fetchHKTraffic()
    ]);

    // Convert raw API payloads into { text, traffic } string objects.
    const malaysiaData = formatLocationData(weatherMY, 'klang-valley');
    const singaporeData = formatLocationData(weatherSG, 'singapore', trafficSG);
    const hongKongData = formatLocationData(weatherHK, 'hong-kong', trafficHK);
    const mapUrlSG = 'https://slackbot-project.onrender.com';

    // Build the Slack Block Kit message structure.
    // Blocks render in order: Header → divider → SG → divider → MY → divider → HK → divider → Map link.
    return {
        blocks: [
            // Weather Update Header
            {
                type: "header",
                text: { type: "plain_text", text: "🌤️ Weather & Traffic Update", emoji: true }
            },
            { type: "divider" },

            // Singapore Section - Weather + Traffic
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `:flag-sg: *Singapore*\n${singaporeData.text}\n${singaporeData.traffic}`
                }
            },
            { type: "divider" },

            // Malaysia Section - Weather only
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `:flag-my: *Malaysia (Klang Valley)*\n${malaysiaData.text}`
                }
            },
            { type: "divider" },

            // Hong Kong Section - Weather + Traffic
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `:flag-hk: *Hong Kong*\n${hongKongData.text}\n${hongKongData.traffic}`
                }
            },
            { type: "divider" },

            // Map Link
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `🗺️ <${mapUrlSG}|View Interactive Map>`
                }
            }
        ]
    };
}



/**
 * formatLocationData(weatherData, locationKey, trafficData)
 *
 * Parses the raw API response for a given region and converts it into
 * human-readable Slack markdown strings for weather and traffic.
 *
 * ── Parsing logic per region ──────────────────────────────────────────────────
 *
 * KLANG VALLEY (Malaysia)
 *   Source: MET Malaysia weather/warning endpoint (array of warning objects).
 *   Parsing: Reads the third element (index 2) of the warnings array, which
 *   represents the most current or relevant warning record.  Extracts:
 *     - warning_issue.title_en  → English title of the warning (or 'Stable')
 *     - valid_to               → Expiry timestamp of the warning
 *   No traffic data is available for Malaysia, so trafficText is left empty.
 *
 * SINGAPORE
 *   Source: NEA 2-hour forecast endpoint.
 *   Structure: response.items[0].forecasts – an array of { area, forecast } objects
 *   covering all planning areas island-wide.
 *
 *   Parsing:
 *     1. selectedAreas whitelist  – Only 18 operationally relevant zones are
 *        retained (e.g. logistics hubs like Jurong, Tuas, Changi); the other
 *        ~50 areas are filtered out to keep the Slack message concise.
 *     2. Array.filter()           – Keeps only forecasts whose `area` field
 *        appears in selectedAreas.
 *     3. Array.map()              – Transforms each { area, forecast } pair into
 *        a bullet-point string "• AreaName: Forecast text".
 *     4. Array.join('\n')         – Joins all bullet points into a single
 *        newline-separated block ready for Slack markdown.
 *
 *   Traffic parsing (SG – LTA DataMall):
 *     The raw incident array can contain hundreds of entries.  Two subsets are
 *     extracted to surface the most delivery-relevant information:
 *
 *     a) accidents   – Items where Type === 'Accident'.  Up to 2 are shown
 *        with their full Message text.
 *
 *     b) expressway  – Items whose Message text mentions a known expressway
 *        code (PIE, CTE, ECP, AYE, SLE, TPE, KPE, BKE, MCE, or the word
 *        'Expressway').  Up to 2 non-accident expressway incidents are shown.
 *        The guard `expressway.length !== accidents.length` prevents showing
 *        the same incidents twice when all expressway hits are also accidents.
 *
 *     If no incidents exist at all → green "Smooth flow." indicator.
 *
 * HONG KONG
 *   Source: HKO general weather forecast (flw).
 *   Parsing: The `outlook` field contains a plain-text multi-day weather
 *   forecast sentence directly from the Observatory.  It is displayed as-is.
 *
 *   Traffic parsing (HK – Transport Department RTIS):
 *     The STN array contains special traffic news items.  Only the first item's
 *     `content` field is shown to keep the message brief.
 *     If the array is empty → green "No major closures." indicator.
 *
 * @param {Object} weatherData   – Raw API response from fetchWeatherData().
 * @param {string} locationKey   – 'klang-valley' | 'singapore' | 'hong-kong'
 * @param {Array}  trafficData   – Raw traffic incident array (default []).
 * @returns {{ text: string, traffic: string }} Formatted Slack markdown strings.
 */
function formatLocationData(weatherData, locationKey, trafficData = []) {
    let weatherText = '';
    let trafficText = '';

    // Short-circuit if the weather fetch returned an error object instead of data.
    if (weatherData.error) {
        return { text: `:warning: Weather Error: ${weatherData.error}`, traffic: '' };
    }

    switch (locationKey) {
        // ── Malaysia ─────────────────────────────────────────────────────────
        case 'klang-valley':
            // The API returns an array of warning records sorted by recency.
            // Index 2 (the third record) is used as the primary active warning.
            // Optional chaining (?.) safely handles cases where fewer than 3
            // records are returned (falls back to empty object / undefined).
            const warningIssue = weatherData[2]?.warning_issue || {};
            weatherText = `*Weather:* ${warningIssue.title_en || 'Stable'}\n*Valid To:* ${weatherData[2]?.valid_to || 'N/A'}`;
            break;

        // ── Singapore ────────────────────────────────────────────────────────
        case 'singapore':
            // Whitelist of planning areas relevant to delivery operations.
            // Keeps the Slack message focused instead of listing all 60+ areas.
            const selectedAreas = [
                "Ang Mo Kio", "Changi", "City", "Jurong East", "Jurong West", "Tuas",
                "Toa Payoh", "Kallang", "Pasir Ris", "Woodlands", "Bedok", "Clementi",
                "Bukit Merah", "Bukit Panjang", "Bukit Timah", "Serangoon", "Sengkang", "Yishun"
            ];

            // Navigate into the nested API structure:
            //   items[0]         → first (most recent) forecast set
            //   .forecasts       → array of { area, forecast } for each planning area
            //   .filter(...)     → keep only areas in the whitelist
            //   .map(...)        → format as "• AreaName: Forecast"
            //   .join('\n')      → combine into a single multiline string
            weatherText = weatherData.items?.[0]?.forecasts
                ?.filter(item => selectedAreas.includes(item.area))
                .map(item => `• ${item.area}: ${item.forecast}`)
                .join('\n') || 'No weather alerts.';

            // Format SG Traffic with Google Maps-style indicators - include expressway and accident info
            if (trafficData.length > 0) {
                // ── Accident filter ────────────────────────────────────────────
                // Isolate all incidents typed as 'Accident' by the LTA.
                const accidents = trafficData.filter(i => i.Type === 'Accident');

                // ── Expressway filter ──────────────────────────────────────────
                // Singapore's major expressways are referred to by their short codes
                // (PIE, CTE, ECP, AYE, SLE, TPE, KPE, BKE, MCE) in LTA messages.
                // This filter catches any incident mentioning these codes or the
                // generic word 'Expressway' in its message body.
                const expressway = trafficData.filter(i =>
                    i.Message?.includes('Expressway') ||
                    i.Message?.includes('PIE') ||
                    i.Message?.includes('CTE') ||
                    i.Message?.includes('ECP') ||
                    i.Message?.includes('AYE') ||
                    i.Message?.includes('SLE') ||
                    i.Message?.includes('TPE') ||
                    i.Message?.includes('KPE') ||
                    i.Message?.includes('BKE') ||
                    i.Message?.includes('MCE')
                );

                // Start the traffic block with a summary count (red indicator).
                let trafficLines = [`*🚦 Traffic:* 🔴 ${trafficData.length} incident(s)`];

                // Show up to 2 accident messages under a dedicated sub-heading.
                if (accidents.length > 0) {
                    trafficLines.push(`🚨 *Accidents:* ${accidents.length}`);
                    accidents.slice(0, 2).forEach(a => {
                        trafficLines.push(`  • ${a.Message}`);
                    });
                }

                // Show up to 2 expressway incidents that are NOT already shown
                // in the accidents block to avoid duplication.
                if (expressway.length > 0 && expressway.length !== accidents.length) {
                    const nonAccidentExpressway = expressway.filter(e => e.Type !== 'Accident').slice(0, 2);
                    if (nonAccidentExpressway.length > 0) {
                        trafficLines.push(`🛣️ *Expressway:*`);
                        nonAccidentExpressway.forEach(e => {
                            trafficLines.push(`  • ${e.Message}`);
                        });
                    }
                }

                trafficText = trafficLines.join('\n');
            } else {
                // No incidents in the LTA feed → display green smooth-flow status.
                trafficText = `*🚦 Traffic:* 🟢 Smooth flow.`;
            }
            break;

        // ── Hong Kong ─────────────────────────────────────────────────────────
        case 'hong-kong':
            // The HKO `outlook` field is a pre-formatted weather outlook paragraph.
            // Fall back to 'Available Soon' if the field is absent in the response.
            weatherText = `*Weather Outlook:* ${weatherData.outlook || 'Available Soon'}`;

            // Format HK Traffic with Google Maps-style indicators
            // Display only the first special traffic news item to avoid verbosity.
            trafficText = trafficData.length > 0
                ? `*🚦 Traffic:* 🔴 ${trafficData[0].content}`
                : `*🚦 Traffic:* 🟢 No major closures.`;
            break;

        // ── Unknown location ──────────────────────────────────────────────────
        default:
            weatherText = `No weather data available for ${locations[locationKey].name}`;
}

return {
    text: weatherText, // Return the formatted weather text
    traffic: trafficText // Return the formatted traffic text
};
}

/**
 * sendSlackNotification()
 *
 * Top-level function called by the /send-notification route and (indirectly)
 * by the cron job in cron-schedule.js.
 *
 * Flow:
 *   1. prepareSlackMessage() → fetches all data and builds the Block Kit payload.
 *   2. slackClient.chat.postMessage() → posts the payload to the configured channel.
 *
 * The `text` fallback is required by Slack for accessibility and push notifications
 * in environments where Block Kit is not rendered (e.g. mobile previews).
 */
async function sendSlackNotification() {
    // Fallback to localhost
    try {
        const formattedSlackMessage = await prepareSlackMessage();

        console.log('Formatted Slack Message:', JSON.stringify(formattedSlackMessage, null, 2));

        // Post the message with the weather data
        const response = await slackClient.chat.postMessage({
            channel: channelId,
            blocks: formattedSlackMessage.blocks,
            text: "Weather update for Klang Valley, Singapore, and Hong Kong."
        });

        console.log('Message sent successfully:', response);

    } catch (error) {
        console.error('Error sending Slack message:', error.message);
    }
}

// ─── Express Routes ───────────────────────────────────────────────────────────

// Home route – serves the Leaflet map frontend (index.html from /public).
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Manual trigger for sending Slack notification.
// Also called by the cron job via an HTTP GET from cron-schedule.js.
app.get('/send-notification', async (req, res) => {
    console.log('Manual Slack notification trigger...');
    await sendSlackNotification();
    res.send('Slack notification sent!');
});

// Serve map page with location handling.
// The frontend passes lat/lng/zoom as query params when deep-linking to a region.
app.get('/map', (req, res) => {
    const { lat, lng, zoom } = req.query;

    // Reject requests that are missing any of the three required parameters.
    if (!lat || !lng || !zoom) {
        return res.status(400).send('Invalid or missing parameters. Please provide lat, lng, and zoom.');
    }

    // Serve the HTML file for the map
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API: Get locations data.
// Returns all static location configs + area lists used by the frontend map.
app.get('/api/locations', (req, res) => {
    res.json({
        locations,
        singaporeAreas,
        hongKongRegions,
        klangValleyCities
    });
});

// API: Get weather data for a specific location key.
// Validates the key against the known locations map before fetching.
app.get('/api/weather/:locationKey', async (req, res) => {
    const { locationKey } = req.params;

    if (!locations[locationKey]) {
        return res.status(400).json({ error: 'Invalid location key' });
    }

    try {
        const weatherData = await fetchWeatherData(locationKey);
        res.json({
            location: locations[locationKey],
            weather: weatherData
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch weather data' });
    }
});

// API: Get traffic data for a specific region.
// Only Singapore and Hong Kong have live traffic integrations.
app.get('/api/traffic/:region', async (req, res) => {
    const { region } = req.params;

    try {
        let trafficData = [];
        if (region === 'singapore') {
            trafficData = await fetchSGTraffic();
        } else if (region === 'hong-kong') {
            trafficData = await fetchHKTraffic();
        }
        res.json({ traffic: trafficData });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch traffic data' });
    }
});

// API: Get combined weather and traffic status for a location.
// Used by the frontend to populate the status panel on the map.
app.get('/api/status/:locationKey', async (req, res) => {
    const { locationKey } = req.params;

    if (!locations[locationKey]) {
        return res.status(400).json({ error: 'Invalid location key' });
    }

    try {
        const weatherData = await fetchWeatherData(locationKey);
        let trafficData = [];

        // Fetch traffic only for regions that have a traffic API integration.
        if (locationKey === 'singapore') {
            trafficData = await fetchSGTraffic();
        } else if (locationKey === 'hong-kong') {
            trafficData = await fetchHKTraffic();
        }

        // Format both weather and traffic into Slack-markdown strings and
        // spread the result alongside the location metadata.
        const formattedData = formatLocationData(weatherData, locationKey, trafficData);

        res.json({
            location: locations[locationKey],
            ...formattedData
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch status data' });
    }
});

// Export for cron job
// cron-schedule.js imports sendSlackNotification indirectly via HTTP, but this
// export makes the function available for unit testing without an HTTP round-trip.
module.exports = { sendSlackNotification };



