const cron = require('node-cron');
const { sendSlackNotification } = require('./index'); // Adjust path as necessary

// Schedule every 2 hours from 8 AM to 10 PM
cron.schedule('0 8,10,12,14,16,18,20 * * *', async () => {
    console.log('Running scheduled weather update (every 2 hours)...');
    await sendSlackNotification();
});

cron.schedule('*/30 10-11,17-18 * * *', () => {
    console.log('Running scheduled weather update (every 30 minutes during selected hours)...');
    sendSlackNotification();
});

console.log('Cron schedules initialized.');
