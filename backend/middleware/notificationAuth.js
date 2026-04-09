// Simple token-based auth for the /send-notification endpoint.
// Set NOTIFICATION_SECRET in your .env to restrict access.
// If no secret is configured, the endpoint is left open (backwards-compatible).

function requireNotificationAuth(req, res, next) {
    const secret = process.env.NOTIFICATION_SECRET;

    // If no secret is configured, skip auth (dev/legacy mode)
    if (!secret) {
        return next();
    }

    const token = req.query.token || req.headers['x-notification-token'];

    if (!token || token !== secret) {
        return res.status(401).json({ error: 'Unauthorized: invalid or missing token' });
    }

    next();
}

module.exports = { requireNotificationAuth };
