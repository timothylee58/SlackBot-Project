const runtimeSettings = require('../config/runtimeSettings');

// GET /api/settings — returns current values (token masked)
function getSettings(req, res) {
    const { SLACK_BOT_TOKEN, SLACK_CHANNEL_ID } = runtimeSettings.getAll();
    res.json({
        SLACK_BOT_TOKEN:  SLACK_BOT_TOKEN  ? '***configured***' : '',
        SLACK_CHANNEL_ID: SLACK_CHANNEL_ID || '',
    });
}

// POST /api/settings — update Slack credentials
function updateSettings(req, res) {
    const { SLACK_BOT_TOKEN, SLACK_CHANNEL_ID } = req.body;

    const updates = {};
    if (typeof SLACK_BOT_TOKEN  === 'string' && SLACK_BOT_TOKEN.trim())  updates.SLACK_BOT_TOKEN  = SLACK_BOT_TOKEN.trim();
    if (typeof SLACK_CHANNEL_ID === 'string' && SLACK_CHANNEL_ID.trim()) updates.SLACK_CHANNEL_ID = SLACK_CHANNEL_ID.trim();

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid fields provided' });
    }

    runtimeSettings.set(updates);
    res.json({ message: 'Settings saved successfully' });
}

module.exports = { getSettings, updateSettings };
