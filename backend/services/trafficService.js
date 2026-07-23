const axios = require('axios');

// Fetch live traffic incidents from Singapore LTA DataMall
async function fetchSGTraffic() {
    try {
        const response = await axios.get('https://datamall2.mytransport.sg/ltaodataservice/TrafficIncidents', {
            headers: { 'AccountKey': process.env.LTA_ACCOUNT_KEY }
        });
        return response.data.value || [];
    } catch (error) {
        console.error('Error fetching SG traffic:', error.message);
        return [];
    }
}

// Fetch special traffic news from Hong Kong Transport Department.
// Primary: data.one.gov.hk (English, structured)
// Fallback: td.rtis.data.gov.hk STN API
async function fetchHKTraffic() {
    try {
        const response = await axios.get(
            'https://resource.data.one.gov.hk/td/en/specialtrafficnews.json',
            { timeout: 8000 }
        );
        const news = response.data?.trafficNews || [];
        // Normalise to { description, district } shape
        return news.map(item => ({
            description: item.description || item.content || item.msgContent || '',
            district:    item.district    || item.subdistrict || '',
        }));
    } catch {
        // Fallback to RTIS STN endpoint
        try {
            const response = await axios.get(
                'https://td.rtis.data.gov.hk/api/traffic/stn/v1/getSTN',
                { timeout: 8000 }
            );
            const stn = response.data?.STN || [];
            return stn.map(item => ({
                description: item.content || item.description || item.msgContent || '',
                district:    item.district || '',
            }));
        } catch (error) {
            console.error('Error fetching HK traffic:', error.message);
            return [];
        }
    }
}

// Fetch Malaysia traffic data from two sources and merge results.
//
// Source 1 — data.gov.my road incidents/closures:
//   GET https://api.data.gov.my/data-catalogue/road_rci (Road Closure Index)
//
// Source 2 — PLUS highway incident alerts:
//   GET https://api.data.gov.my/data-catalogue/jkr_roadworks (JKR road works)
//
// Both return arrays; we normalise each item to { description, source }.
async function fetchMYTraffic() {
    const results = [];

    // Source 1: road closure / disruption notices (data.gov.my)
    try {
        const r = await axios.get(
            'https://api.data.gov.my/data-catalogue/road_rci?limit=5&sort=-date',
            { timeout: 8000 }
        );
        const items = Array.isArray(r.data) ? r.data : (r.data?.data || []);
        items.forEach(item => {
            const desc = item.road_name
                ? `Road closure: ${item.road_name}${item.reason ? ' — ' + item.reason : ''}`
                : item.description || item.title || null;
            if (desc) results.push({ description: desc, source: 'JKR/Road Closure' });
        });
    } catch (err) {
        console.error('MY traffic source 1 (road_rci) failed:', err.message);
    }

    // Source 2: JKR scheduled roadworks (data.gov.my)
    try {
        const r = await axios.get(
            'https://api.data.gov.my/data-catalogue/jkr_roadworks?limit=5&sort=-start_date',
            { timeout: 8000 }
        );
        const items = Array.isArray(r.data) ? r.data : (r.data?.data || []);
        items.forEach(item => {
            const desc = item.project_name || item.road || item.description || null;
            const loc  = item.location || item.state || '';
            if (desc) results.push({
                description: `Roadworks: ${desc}${loc ? ' (' + loc + ')' : ''}`,
                source: 'JKR Roadworks',
            });
        });
    } catch (err) {
        console.error('MY traffic source 2 (jkr_roadworks) failed:', err.message);
    }

    return results;
}

module.exports = { fetchSGTraffic, fetchHKTraffic, fetchMYTraffic };
