// GET /api/gmaps/key — returns the Google Maps JS API key for dynamic script loading
function getGoogleMapsKey(req, res) {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) {
        return res.status(503).json({ error: 'Google Maps API key not configured' });
    }
    res.json({ key });
}

module.exports = { getGoogleMapsKey };
