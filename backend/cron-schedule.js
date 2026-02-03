const cron = require('node-cron');
const axios = require('axios');

const BASE_URL = 'https://slackbot-project.onrender.com';

// Helper function to trigger notification
async function triggerNotification(scheduleType) {
    console.log(`[${new Date().toISOString()}] Running scheduled weather update (${scheduleType})...`);
    try {
        const response = await axios.get(`${BASE_URL}/send-notification`);
        console.log('Notification triggered successfully:', response.data);
    } catch (error) {
        console.error('Error triggering notification:', error.message);
    }
}

// Schedule the Slack notification every 2 hours from 8 AM to 8 PM
cron.schedule('0 8,10,12,14,16,18,20 * * *', () => {
    triggerNotification('every 2 hours');
});

// Schedule the Slack notification every 30 minutes from 10 AM to 11:30 AM (lunch rush)
cron.schedule('*/30 10-11 * * *', () => {
    triggerNotification('lunch rush - every 30 mins');
});

// Schedule the Slack notification every 30 minutes from 5 PM to 6:30 PM (dinner rush)
cron.schedule('*/30 17-18 * * *', () => {
    triggerNotification('dinner rush - every 30 mins');
});

console.log('Cron schedules initialized!');
console.log('Schedule: Every 2 hours (8AM-8PM), Every 30 mins (10-11:30AM, 5-6:30PM)');
