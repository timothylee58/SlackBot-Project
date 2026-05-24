const axios = require('axios');

// Fetch live traffic incidents from Singapore LTA DataMall
async function fetchSGTraffic() {
    try {
        const response = await axios.get('http://datamall2.mytransport.sg/ltaodataservice/TrafficIncidents', {
            headers: { 'AccountKey': process.env.LTA_ACCOUNT_KEY }
        });
        return response.data.value || [];
    } catch (error) {
        console.error('Error fetching SG traffic:', error.message);
        return [];
    }
}

// Fetch special traffic news from Hong Kong Transport Department
async function fetchHKTraffic() {
    try {
        const response = await axios.get('https://td.rtis.data.gov.hk/api/traffic/stn/v1/getSTN');
        return response.data.STN || [];
    } catch (error) {
        console.error('Error fetching HK traffic:', error.message);
        return [];
    }
}

module.exports = { fetchSGTraffic, fetchHKTraffic };
