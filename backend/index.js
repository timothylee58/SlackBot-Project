const express = require('express');
const axios = require('axios');
const cron = require('node-cron') || require('./cron-schedule');
const { WebClient } = require('@slack/web-api'); 
const path = require('path');
const bodyParser = require('body-parser'); 
const rateLimit = require('express-rate-limit');
const LTA_KEY = process.env.LTA_ACCOUNT_KEY;
require('dotenv').config();

const app = express();
const port = 3000;

app.set('trust proxy', 1); // 1 indicates trusting a single proxy, like Render

const server = app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

// Set a timeout for server responses
server.timeout = 0; // Unlimited timeout

// Rate limiter configuration
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
});

// Apply rate limiter to all requests
app.use(limiter);

// Middleware to parse JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: '50mb' })); // Increase limit if necessary

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Define locations with detailed coordinates
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

// Singapore areas for weather display
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
    { area: "Clementi", coordinates: [1.3151, 103.7643] }
];

// Hong Kong regions
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

// Malaysia cities
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

// API keys and Slack channel info
const slackToken = process.env.SLACK_BOT_TOKEN;
const channelId = process.env.SLACK_CHANNEL_ID;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'; 
const slackClient = new WebClient(slackToken);

// Cache structure for weather data
let weatherCache = {
    'klang-valley': { data: null, timestamp: 0 },
    'singapore': { data: null, timestamp: 0 },
    'hong-kong': { data: null, timestamp: 0 }
};

// Fetch weather data function
async function fetchWeatherData(locationKey) {
    const now = Date.now();
    const cacheDuration = 5 * 60 * 1000; // Cache for 5 minutes


    if (!locationKey) {
        console.error('Error: locationKey is not defined');
        return null;
    }

    if (weatherCache[locationKey].data && (now - weatherCache[locationKey].timestamp < cacheDuration)) {
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
            return { error: `No data available for ${locationKey}` }; // Return an error object
        }
    }catch (error) {
        console.error(`Error fetching weather data for ${locationKey}:`, error.message);
        return { error: `Error fetching data for ${locationKey}` }; // Default response on error
    }
    
}

// Fetch Traffic Data for SG (LTA DataMall)
async function fetchSGTraffic() {
    try {
        const response = await axios.get('http://datamall2.mytransport.sg/ltaodataservice/TrafficIncidents', {
            headers: { 'AccountKey': LTA_KEY }
        });
        return response.data.value || [];
    } catch (error) {
        console.error('Error fetching SG traffic:', error.message);
        return [];
    }
}

// Fetch Traffic Data for HK (Transport Department)
async function fetchHKTraffic() {
    try {
        // Special Traffic News API (JSON)
        const response = await axios.get('https://td.rtis.data.gov.hk/api/traffic/stn/v1/getSTN');
        return response.data.STN || [];
    } catch (error) {
        console.error('Error fetching HK traffic:', error.message);
        return [];
    }
}


// Send formatted data to Slack
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
    
    const malaysiaData = formatLocationData(weatherMY, 'klang-valley');
    const singaporeData = formatLocationData(weatherSG, 'singapore', trafficSG);
    const hongKongData = formatLocationData(weatherHK, 'hong-kong', trafficHK);
    const mapUrlSG = `${BASE_URL}`;

    return {
        blocks: [
            { 
                type: "section", 
                text: { 
                    type: "mrkdwn", 
                    text: ":mostly_sunny: *Weather Update*" 
                } 
            },
            { type: "divider" },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `:flag-sg: *Singapore 2-H our Weather Forecast*\n${singaporeData.text}`
                }
            },
            { type: "divider" },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `:flag-my: *Malaysia Weather Warning*\n${malaysiaData.text}`
                }
            },
            { type: "divider" },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `:flag-hk: *Hong Kong Weather Update*\n${hongKongData.text}`
                }
            },
            { type: "divider" },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `<${mapUrlSG}|View Map For More>` 
                }
            },
            { 
                type: "header", 
                text: { type: "plain_text", text: "Traffic Update", emoji: true } 
            },
            { type: "divider" },
            // Singapore Section
            {
                type: "section",
                text: { type: "mrkdwn", text: `:flag-sg: *Singapore Update*\n${singaporeData.text}\n${singaporeData.traffic}` }
            },
            { type: "divider" },
            // Malaysia Section
            {
                type: "section",
                text: { type: "mrkdwn", text: `:flag-my: *Malaysia Weather Warning*\n${malaysiaData.text}` }
            },
            { type: "divider" },
            // Hong Kong Section
            {
                type: "section",
                text: { type: "mrkdwn", text: `:flag-hk: *Hong Kong Update*\n${hongKongData.text}\n${hongKongData.traffic}` }
            },
            { type: "divider" },
            {
                type: "section",
                text: { type: "mrkdwn", text: `<${mapUrl}|View Detailed Map>` }
            }
        ]
    };
}

    

function formatLocationData(weatherData, locationKey, trafficData = []) {
    let weatherText = '';
    let trafficText = '';

    if (weatherData.error) {
        return { text: `:warning: Weather Error: ${weatherData.error}`, traffic: '' };
    }

    switch (locationKey) {
        case 'klang-valley':
            const warningIssue = weatherData[2]?.warning_issue || {};
            weatherText = `*Weather:* ${warningIssue.title_en || 'Stable'}\n*Valid To:* ${weatherData[2]?.valid_to || 'N/A'}`;
            break;

        case 'singapore':
            const selectedAreas = ["Ang Mo Kio", "Changi", "City", "Jurong East", "Tuas"];
            weatherText = weatherData.items?.[0]?.forecasts
                ?.filter(item => selectedAreas.includes(item.area))
                .map(item => `• ${item.area}: ${item.forecast}`)
                .join('\n') || 'No weather alerts.';
            
            // Format SG Traffic with Google Maps-style indicators
            trafficText = trafficData.length > 0 
                ? `*🚦 Traffic:* 🔴 ${trafficData[0].Message}` 
                : `*🚦 Traffic:* 🟢 Smooth flow.`;
            break;

        case 'hong-kong':
            weatherText = `*Weather Outlook:* ${weatherData.outlook || 'Available Soon'}`;
            
            // Format HK Traffic with Google Maps-style indicators
            trafficText = trafficData.length > 0 
                ? `*🚦 Traffic:* 🔴 ${trafficData[0].content}` 
                : `*🚦 Traffic:* 🟢 No major closures.`;
            break;
    default:
        weatherText = `No weather data available for ${locations[locationKey].name}`;
}

return {
    text: weatherText, // Return the formatted weather text
    traffic: trafficText // Return the formatted traffic text
};
}    
// Send Slack notification function
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

// Home route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Manual trigger for sending Slack notification
app.get('/send-notification', async (req, res) => {
    console.log('Manual Slack notification trigger...');
    await sendSlackNotification();
    res.send('Slack notification sent!');
});

// Serve map page with location handling
app.get('/map', (req, res) => {
    const { lat, lng, zoom } = req.query;

    if (!lat || !lng || !zoom) {
        return res.status(400).send('Invalid or missing parameters. Please provide lat, lng, and zoom.');
    }

    // Serve the HTML file for the map
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API: Get locations data
app.get('/api/locations', (req, res) => {
    res.json({
        locations,
        singaporeAreas,
        hongKongRegions,
        klangValleyCities
    });
});

// API: Get weather data for a location
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

// API: Get traffic data
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

// API: Get combined weather and traffic status
app.get('/api/status/:locationKey', async (req, res) => {
    const { locationKey } = req.params;
    
    if (!locations[locationKey]) {
        return res.status(400).json({ error: 'Invalid location key' });
    }
    
    try {
        const weatherData = await fetchWeatherData(locationKey);
        let trafficData = [];
        
        if (locationKey === 'singapore') {
            trafficData = await fetchSGTraffic();
        } else if (locationKey === 'hong-kong') {
            trafficData = await fetchHKTraffic();
        }
        
        const formattedData = formatLocationData(weatherData, locationKey, trafficData);
        
        res.json({
            location: locations[locationKey],
            ...formattedData
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch status data' });
    }
});



