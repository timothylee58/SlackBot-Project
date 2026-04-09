const express = require('express');
const path = require('path');
const router = express.Router();

const { triggerNotification } = require('../controllers/slackController');
const { requireNotificationAuth } = require('../middleware/notificationAuth');

// Serve the homepage
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Serve the interactive map page (lat/lng/zoom passed as query params)
router.get('/map', (req, res) => {
    const { lat, lng, zoom } = req.query;

    if (!lat || !lng || !zoom) {
        return res.status(400).send('Invalid or missing parameters. Please provide lat, lng, and zoom.');
    }

    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Manual trigger endpoint for testing Slack notifications (requires auth token)
router.get('/send-notification', requireNotificationAuth, triggerNotification);

module.exports = router;
