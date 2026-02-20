/**
 * cron-schedule.js
 *
 * Defines the automated scheduling for Slack weather & traffic notifications.
 * Uses node-cron to trigger HTTP calls to the /send-notification endpoint at
 * specific times relevant to delivery and logistics operations:
 *   - Regular bi-hourly updates throughout the working day
 *   - Higher-frequency updates during lunch and dinner rush hours
 */

const cron = require('node-cron');
const axios = require('axios');

// Base URL of the deployed Render service.
// All scheduled triggers send an HTTP GET to this host's /send-notification route.
const BASE_URL = 'https://slackbot-project.onrender.com';

/**
 * triggerNotification(scheduleType)
 *
 * Sends an HTTP GET request to the /send-notification endpoint, which in turn
 * fetches weather & traffic data and posts a formatted message to Slack.
 *
 * @param {string} scheduleType - A human-readable label (e.g. 'lunch rush')
 *   used only for console logging to identify which cron job fired.
 */
async function triggerNotification(scheduleType) {
    console.log(`[${new Date().toISOString()}] Running scheduled weather update (${scheduleType})...`);
    try {
        const response = await axios.get(`${BASE_URL}/send-notification`);
        console.log('Notification triggered successfully:', response.data);
    } catch (error) {
        console.error('Error triggering notification:', error.message);
    }
}

/**
 * ─────────────────────────────────────────────────────────────
 *  CRON EXPRESSION FORMAT (node-cron uses 5-field syntax):
 *
 *    ┌──────────── minute        (0 – 59)
 *    │  ┌─────────── hour         (0 – 23)
 *    │  │  ┌────────── day of month (1 – 31)
 *    │  │  │  ┌───────── month       (1 – 12)
 *    │  │  │  │  ┌──────── day of week  (0 – 7, both 0 & 7 = Sunday)
 *    │  │  │  │  │
 *   [m] [h] [d] [M] [dow]
 *
 *  Special tokens:
 *    *        = every possible value (wildcard)
 *    ,        = list of specific values  (e.g. 8,10,12)
 *    -        = range of values          (e.g. 10-11 means hours 10 and 11)
 *    /n       = every n-th value         (e.g. */30 means every 30 minutes)
 * ─────────────────────────────────────────────────────────────
 */

/**
 * SCHEDULE 1 – Regular bi-hourly updates
 *
 * Cron: '0 8,10,12,14,16,18,20 * * *'
 *
 * Breakdown:
 *   0              → fires at minute 0 (top of the hour)
 *   8,10,12,14,16,18,20 → only on these specific hours (every 2 hours, 8 AM – 8 PM)
 *   * * *          → every day of the month, every month, every day of the week
 *
 * Result: triggers at 08:00, 10:00, 12:00, 14:00, 16:00, 18:00, and 20:00 daily.
 * Use case: Gives the operations team a broad overview of conditions throughout
 *           the standard working day without flooding the Slack channel.
 */
cron.schedule('0 8,10,12,14,16,18,20 * * *', () => {
    triggerNotification('every 2 hours');
});

/**
 * SCHEDULE 2 – Lunch rush (higher-frequency updates)
 *
 * Cron: '*/30 10-11 * * *'
 *
 * Breakdown:
 *   */30           → every 30 minutes (fires at :00 and :30 of each matching hour)
 *   10-11          → only during hours 10 and 11 (10 AM – 11:59 AM)
 *   * * *          → every day of the month, every month, every day of the week
 *
 * Result: triggers at 10:00, 10:30, 11:00, and 11:30 daily.
 * Use case: Lunch-hour delivery peak – more frequent alerts help dispatchers
 *           react quickly to sudden weather or traffic changes.
 *
 * Note: The 10:00 and 10:30 fires from this job overlap intentionally with the
 * bi-hourly schedule; node-cron will execute each matching job independently.
 */
cron.schedule('*/30 10-11 * * *', () => {
    triggerNotification('lunch rush - every 30 mins');
});

/**
 * SCHEDULE 3 – Dinner rush (higher-frequency updates)
 *
 * Cron: '*/30 17-18 * * *'
 *
 * Breakdown:
 *   */30           → every 30 minutes (fires at :00 and :30 of each matching hour)
 *   17-18          → only during hours 17 and 18 (5 PM – 6:59 PM)
 *   * * *          → every day of the month, every month, every day of the week
 *
 * Result: triggers at 17:00, 17:30, 18:00, and 18:30 daily.
 * Use case: Evening delivery surge – mirrors the lunch-rush logic for the
 *           busiest dinner delivery window.
 */
cron.schedule('*/30 17-18 * * *', () => {
    triggerNotification('dinner rush - every 30 mins');
});

// Confirmation log printed once at server startup when this module is loaded.
console.log('Cron schedules initialized!');
console.log('Schedule: Every 2 hours (8AM-8PM), Every 30 mins (10-11:30AM, 5-6:30PM)');
