const cron = require('node-cron');
const { sendSlackNotification } = require('./services/slackService');

// Runs the notification and logs the schedule type for traceability
async function triggerNotification(scheduleType) {
    console.log(`[${new Date().toISOString()}] Running scheduled weather update (${scheduleType})...`);
    try {
        await sendSlackNotification();
        console.log(`[${scheduleType}] Notification sent successfully.`);
    } catch (error) {
        console.error(`[${scheduleType}] Error sending notification:`, error.message);
    }
}

// Every 2 hours from 8 AM to 8 PM — regular updates
cron.schedule('0 8,10,12,14,16,18,20 * * *', () => {
    triggerNotification('every-2-hours');
});

// Every 30 minutes from 10 AM to 11:30 AM — morning peak hour
cron.schedule('*/30 10-11 * * *', () => {
    triggerNotification('morning-peak');
});

// Every 30 minutes from 5 PM to 6:30 PM — evening peak hour
cron.schedule('*/30 17-18 * * *', () => {
    triggerNotification('evening-peak');
});

console.log('Cron schedules initialized.');
console.log('Schedule: Every 2 hours (8AM–8PM) | Every 30 mins (10–11:30AM, 5–6:30PM)');
