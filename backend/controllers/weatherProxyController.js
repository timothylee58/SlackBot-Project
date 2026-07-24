// GET /api/gmaps/key — returns the Google Maps JS API key for dynamic script loading.
// Restricted to same-origin requests: the Origin or Referer header must match BASE_URL.
// Without BASE_URL configured the check is skipped (dev mode).
function getGoogleMapsKey(req, res) {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) {
        return res.status(503).json({ error: 'Google Maps API key not configured' });
    }

    const baseUrl = process.env.BASE_URL;
    if (baseUrl) {
        const origin   = req.headers['origin']  || '';
        const referer  = req.headers['referer'] || '';
        const allowed  = baseUrl.replace(/\/$/, '');
        const fromSameOrigin = origin.startsWith(allowed) || referer.startsWith(allowed);
        if (!fromSameOrigin) {
            return res.status(403).json({ error: 'Forbidden' });
        }
    }

    res.json({ key });
}

module.exports = { getGoogleMapsKey };
