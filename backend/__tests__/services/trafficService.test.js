const axios = require('axios');

jest.mock('axios');

const { fetchSGTraffic, fetchHKTraffic } = require('../../services/trafficService');

describe('services/trafficService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('fetchSGTraffic', () => {
        it('should return traffic incidents from LTA DataMall', async () => {
            const mockIncidents = [
                { Type: 'Accident', Message: 'Accident on PIE' },
                { Type: 'Road Work', Message: 'Road work on CTE' }
            ];
            axios.get.mockResolvedValue({ data: { value: mockIncidents } });

            const result = await fetchSGTraffic();

            expect(axios.get).toHaveBeenCalledWith(
                'http://datamall2.mytransport.sg/ltaodataservice/TrafficIncidents',
                { headers: { 'AccountKey': process.env.LTA_ACCOUNT_KEY } }
            );
            expect(result).toEqual(mockIncidents);
        });

        it('should return empty array when value is missing', async () => {
            axios.get.mockResolvedValue({ data: {} });

            const result = await fetchSGTraffic();

            expect(result).toEqual([]);
        });

        it('should return empty array on API error', async () => {
            axios.get.mockRejectedValue(new Error('LTA API down'));

            const result = await fetchSGTraffic();

            expect(result).toEqual([]);
        });
    });

    describe('fetchHKTraffic', () => {
        it('should return traffic news from HK Transport Department', async () => {
            const mockSTN = [{ content: 'Road closure in Central' }];
            axios.get.mockResolvedValue({ data: { STN: mockSTN } });

            const result = await fetchHKTraffic();

            expect(axios.get).toHaveBeenCalledWith(
                'https://td.rtis.data.gov.hk/api/traffic/stn/v1/getSTN'
            );
            expect(result).toEqual(mockSTN);
        });

        it('should return empty array when STN is missing', async () => {
            axios.get.mockResolvedValue({ data: {} });

            const result = await fetchHKTraffic();

            expect(result).toEqual([]);
        });

        it('should return empty array on API error', async () => {
            axios.get.mockRejectedValue(new Error('HK API down'));

            const result = await fetchHKTraffic();

            expect(result).toEqual([]);
        });
    });
});
