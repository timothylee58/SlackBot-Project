require('dotenv').config(); // Load env vars before anything else

const app = require('./app');
const { sendSlackNotification } = require('./services/slackService');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// 2-minute timeout for long-running Slack/API calls
server.timeout = 120000;

// Start cron jobs after server is ready
require('./cron-schedule');

// Export for use in tests (supertest mounts the app directly)
module.exports = { app, sendSlackNotification };
