const { sendSlackNotification } = require('../services/slackService');
const { locations, singaporeAreas, hongKongRegions, klangValleyCities } = require('../config/locations');

// GET /send-notification — manual trigger for testing
async function triggerNotification(req, res, next) {
    console.log('Manual Slack notification trigger...');
    try {
        await sendSlackNotification();
        res.json({ message: 'Slack notification sent successfully.' });
    } catch (error) {
        next(error);
    }
}

// GET /api/locations — serves all location metadata to the frontend
function getLocations(req, res) {
    res.json({ locations, singaporeAreas, hongKongRegions, klangValleyCities });
}

module.exports = { triggerNotification, getLocations };
