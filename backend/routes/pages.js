const express = require('express');
const path = require('path');
const router = express.Router();

const { triggerNotification } = require('../controllers/slackController');

// Serve the homepage
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Serve the interactive map page (lat/lng/zoom passed as query params)
router.get('/map', (req, res) => {
    const { lat, lng, zoom } = req.query;

    if (!lat || !lng || !zoom) {
        return res.status(400).json({ error: 'Missing required query parameters: lat, lng, and zoom.' });
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const zoomNum = parseInt(zoom, 10);

    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
        return res.status(400).json({ error: 'Invalid lat: must be a number between -90 and 90.' });
    }
    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
        return res.status(400).json({ error: 'Invalid lng: must be a number between -180 and 180.' });
    }
    if (isNaN(zoomNum) || zoomNum < 1 || zoomNum > 18) {
        return res.status(400).json({ error: 'Invalid zoom: must be an integer between 1 and 18.' });
    }

    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Manual trigger endpoint for testing Slack notifications
router.get('/send-notification', triggerNotification);

module.exports = router;
