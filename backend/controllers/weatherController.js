const { fetchWeatherData } = require('../services/weatherService');
const { fetchSGTraffic, fetchHKTraffic } = require('../services/trafficService');
const { formatLocationData } = require('../services/slackService');
const { locations } = require('../config/locations');

// GET /api/weather/:locationKey
async function getWeather(req, res, next) {
    const { locationKey } = req.params;

    if (!locations[locationKey]) {
        return res.status(400).json({ error: 'Invalid location key' });
    }

    try {
        const weatherData = await fetchWeatherData(locationKey);
        res.json({ location: locations[locationKey], weather: weatherData });
    } catch (error) {
        next(error);
    }
}

// GET /api/status/:locationKey — combined weather + traffic for a location
async function getStatus(req, res, next) {
    const { locationKey } = req.params;

    if (!locations[locationKey]) {
        return res.status(400).json({ error: 'Invalid location key' });
    }

    try {
        const weatherData = await fetchWeatherData(locationKey);

        let trafficData = [];
        if (locationKey === 'singapore') trafficData = await fetchSGTraffic();
        if (locationKey === 'hong-kong') trafficData = await fetchHKTraffic();

        const formatted = formatLocationData(weatherData, locationKey, trafficData);
        res.json({ location: locations[locationKey], ...formatted });
    } catch (error) {
        next(error);
    }
}

module.exports = { getWeather, getStatus };
