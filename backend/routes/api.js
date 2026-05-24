const express = require('express');
const router = express.Router();

const { getWeather, getStatus } = require('../controllers/weatherController');
const { getTraffic } = require('../controllers/trafficController');
const { getLocations } = require('../controllers/slackController');
const { getOWMWeather, getOWMOneCall, getOWMTileUrl, getGoogleMapsKey } = require('../controllers/weatherProxyController');

// Location metadata (used by the frontend map)
router.get('/locations', getLocations);

// Weather data for a single location
router.get('/weather/:locationKey', getWeather);

// Traffic incidents for a region
router.get('/traffic/:region', getTraffic);

// Combined weather + traffic status for a location
router.get('/status/:locationKey', getStatus);

// OpenWeatherMap proxy routes (keep API key server-side)
router.get('/owm/weather', getOWMWeather);
router.get('/owm/onecall', getOWMOneCall);
router.get('/owm/tile-url', getOWMTileUrl);

// Google Maps API key (served server-side to avoid exposing it in HTML source)
router.get('/gmaps/key', getGoogleMapsKey);

// Catch-all for undefined /api/* routes
router.use((req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} /api${req.path}` });
});

module.exports = router;
