import { sendSlackNotification } from '@slack/web-api'; 

export default async function handler(req, res) {
    console.log('Running weather notification...');
    await sendSlackNotification();
    res.status(200).json({ message: 'Slack notification sent!' });
}
