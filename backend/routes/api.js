const express = require('express');
const router = express.Router();

const { getWeather, getStatus } = require('../controllers/weatherController');
const { getTraffic } = require('../controllers/trafficController');
const { getLocations } = require('../controllers/slackController');
const { getOWMWeather, getOWMOneCall, getOWMTileUrl } = require('../controllers/weatherProxyController');

// Location metadata (used by the frontend map)
router.get('/locations', getLocations);

// Weather data for a single location
router.get('/weather/:locationKey', getWeather);

// Traffic incidents for a region
router.get('/traffic/:region', getTraffic);

// Combined weather + traffic status for a location
router.get('/status/:locationKey', getStatus);

// OpenWeatherMap proxy endpoints (keeps API key server-side)
router.get('/owm/weather', getOWMWeather);
router.get('/owm/onecall', getOWMOneCall);
router.get('/owm/tile-url', getOWMTileUrl);

module.exports = router;
