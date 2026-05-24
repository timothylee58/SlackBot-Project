const axios = require('axios');

const OWM_API_KEY = process.env.OPENWEATHERMAP_API_KEY;

// GET /api/owm/weather?lat=...&lng=...
async function getOWMWeather(req, res, next) {
    if (!OWM_API_KEY) {
        return res.status(503).json({ error: 'OpenWeatherMap API key not configured' });
    }

    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
        return res.status(400).json({ error: 'Invalid lat/lng parameters' });
    }

    try {
        const response = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${OWM_API_KEY}`
        );
        res.json(response.data);
    } catch (error) {
        next(error);
    }
}

// GET /api/owm/onecall?lat=...&lng=...
async function getOWMOneCall(req, res, next) {
    if (!OWM_API_KEY) {
        return res.status(503).json({ error: 'OpenWeatherMap API key not configured' });
    }

    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
        return res.status(400).json({ error: 'Invalid lat/lng parameters' });
    }

    try {
        const response = await axios.get(
            `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lng}&exclude=minutely,hourly,daily&appid=${OWM_API_KEY}`
        );
        res.json(response.data);
    } catch (error) {
        next(error);
    }
}

// Returns the tile URL template (key injected server-side)
function getOWMTileUrl(req, res) {
    if (!OWM_API_KEY) {
        return res.status(503).json({ error: 'OpenWeatherMap API key not configured' });
    }

    const { layer } = req.query;
    const allowedLayers = ['clouds', 'precipitation_new', 'temp_new', 'wind_new'];

    if (!layer || !allowedLayers.includes(layer)) {
        return res.status(400).json({ error: `Invalid layer. Allowed: ${allowedLayers.join(', ')}` });
    }

    res.json({
        tileUrl: `https://{s}.tile.openweathermap.org/map/${layer}/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`
    });
}

module.exports = { getOWMWeather, getOWMOneCall, getOWMTileUrl };
