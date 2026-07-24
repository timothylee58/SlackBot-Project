const fs   = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'runtime-settings.json');

// In-memory store — seeded from env vars, overridable at runtime
let settings = {
    SLACK_BOT_TOKEN:  process.env.SLACK_BOT_TOKEN  || '',
    SLACK_CHANNEL_ID: process.env.SLACK_CHANNEL_ID || '',
};

// Persist to disk on startup if a saved file exists
if (fs.existsSync(FILE)) {
    try {
        const saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));
        settings = { ...settings, ...saved };
    } catch { /* ignore corrupt file */ }
}

function get(key) {
    return settings[key] || '';
}

function set(updates) {
    settings = { ...settings, ...updates };
    // mode 0o600 = owner read/write only — protects the Slack token from other local users
    fs.writeFileSync(FILE, JSON.stringify(settings, null, 2), { encoding: 'utf8', mode: 0o600 });
}

function getAll() {
    return { ...settings };
}

module.exports = { get, set, getAll };
