import { sendSlackNotification } from '../index';

export default async function handler(req, res) {
    try {
        console.log("Cron job triggered via Vercel API route");
        await sendSlackNotification();
        res.status(200).json({ message: "Weather notification sent" });
    } catch (error) {
        console.error("Error in API route:", error.message);
        res.status(500).json({ error: "Failed to send notification" });
    }
}
        
        // Send the Slack notification for weather updates
        
        // Respond with a success message
        // Log error details to the console
        
        // Respond with an error message
