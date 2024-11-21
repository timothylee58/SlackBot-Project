const cron = require('node-cron');
const axios = require('axios');
const { sendSlackNotification } = require('./index'); // Import your notification function

// Schedule the Slack notification every 2 hours from 8 AM to 10 PM
cron.schedule('0 8,10,12,14,16,18,20 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Running scheduled weather update (every 2 hours)...`);
  try {
    const response = await axios.get('https://slackbot-project.onrender.com/send-notification');
    console.log('Notification triggered successfully:', response.data);
} catch (error) {
    console.error('Error triggering /send-notification:', error.message);
}
});

// Schedule the Slack notification every 30 minutes from 10 AM to 11:30 AM
cron.schedule('*/30 10-11 * * *', () => {
  console.log(`[${new Date().toISOString()}] Running scheduled weather update (every 30 minutes from 10 AM to 11:30 AM)...`);
  try {
    const response = await axios.get('https://slackbot-project.onrender.com/send-notification');
    console.log('Notification triggered successfully:', response.data);
} catch (error) {
    console.error('Error triggering /send-notification:', error.message);
}
});

// Schedule the Slack notification every 30 minutes from 5 PM to 6:30 PM
cron.schedule('*/30 17-18 * * *', () => {
  console.log(`[${new Date().toISOString()}] Running scheduled weather update (every 30 minutes from 5 PM to 6:30 PM)...`);
  sendSlackNotification();
});

console.log('Cron schedules initialized!');
