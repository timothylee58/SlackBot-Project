const { fetchSGTraffic, fetchHKTraffic } = require('../services/trafficService');

const SUPPORTED_TRAFFIC_REGIONS = ['singapore', 'hong-kong'];

// GET /api/traffic/:region
async function getTraffic(req, res, next) {
    const { region } = req.params;

    if (!region || typeof region !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid region parameter.' });
    }

    if (!SUPPORTED_TRAFFIC_REGIONS.includes(region)) {
        return res.status(400).json({ error: `Unsupported region '${region}'. Supported: ${SUPPORTED_TRAFFIC_REGIONS.join(', ')}` });
    }

    try {
        let trafficData = [];
        if (region === 'singapore') trafficData = await fetchSGTraffic();
        if (region === 'hong-kong') trafficData = await fetchHKTraffic();

        if (!Array.isArray(trafficData)) {
            return res.status(502).json({ error: 'Failed to fetch traffic data from upstream API.' });
        }

        res.json({ region, traffic: trafficData });
    } catch (error) {
        next(error);
    }
}

module.exports = { getTraffic };
