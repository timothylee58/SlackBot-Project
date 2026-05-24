const axios = require('axios');

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// In-memory cache keyed by locationKey
const weatherCache = {
    'klang-valley': { data: null, timestamp: 0 },
    'singapore': { data: null, timestamp: 0 },
    'hong-kong': { data: null, timestamp: 0 }
};

// Maps each location to its respective government weather API
function getApiUrl(locationKey) {
    const apiMap = {
        'klang-valley': 'https://api.data.gov.my/weather/warning?limit=3',
        'singapore': 'https://api.data.gov.sg/v1/environment/2-hour-weather-forecast',
        'hong-kong': 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=flw&lang=en'
    };
    return apiMap[locationKey] || null;
}

async function fetchWeatherData(locationKey) {
    if (!locationKey) {
        console.error('Error: locationKey is not defined');
        return null;
    }

    const now = Date.now();
    const cached = weatherCache[locationKey];

    // Return cached data if still fresh
    if (cached?.data && (now - cached.timestamp < CACHE_DURATION_MS)) {
        console.log(`Using cached data for ${locationKey}`);
        return cached.data;
    }

    const apiUrl = getApiUrl(locationKey);
    if (!apiUrl) {
        console.error('No API URL defined for location:', locationKey);
        return null;
    }

    try {
        const response = await axios.get(apiUrl);
        console.log('API Response for', locationKey, response.data);

        if (response.status === 200 && response.data) {
            weatherCache[locationKey] = { data: response.data, timestamp: now };
            return response.data;
        }

        console.error(`No data found for ${locationKey}`);
        return { error: `No data available for ${locationKey}` };
    } catch (error) {
        console.error(`Error fetching weather data for ${locationKey}:`, error.message);
        return { error: `Error fetching data for ${locationKey}` };
    }
}

module.exports = { fetchWeatherData };
