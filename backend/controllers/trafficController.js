const { fetchSGTraffic, fetchHKTraffic } = require('../services/trafficService');

// GET /api/traffic/:region
async function getTraffic(req, res, next) {
    const { region } = req.params;

    const supported = ['singapore', 'hong-kong'];
    if (!supported.includes(region)) {
        return res.status(400).json({ error: `Unsupported region. Supported: ${supported.join(', ')}` });
    }

    try {
        let trafficData = [];
        if (region === 'singapore') trafficData = await fetchSGTraffic();
        if (region === 'hong-kong') trafficData = await fetchHKTraffic();

        res.json({ traffic: trafficData });
    } catch (error) {
        next(error);
    }
}

module.exports = { getTraffic };
