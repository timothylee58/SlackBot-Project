const axios = require('axios');

jest.mock('axios');

const { fetchSGTraffic, fetchHKTraffic, fetchMYTraffic } = require('../../services/trafficService');

describe('services/trafficService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ── SG ────────────────────────────────────────────────────────────────────

    describe('fetchSGTraffic', () => {
        it('should return traffic incidents from LTA DataMall', async () => {
            const mockIncidents = [
                { Type: 'Accident', Message: 'Accident on PIE' },
                { Type: 'Road Work', Message: 'Road work on CTE' }
            ];
            axios.get.mockResolvedValue({ data: { value: mockIncidents } });

            const result = await fetchSGTraffic();

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

    // ── HK ────────────────────────────────────────────────────────────────────

    describe('fetchHKTraffic', () => {
        it('should return normalised items from primary data.one.gov.hk source', async () => {
            const mockNews = [
                { description: 'Road closure in Central', district: 'C&W' },
                { msgContent: 'Tunnel diversion', district: 'ET' }
            ];
            axios.get.mockResolvedValue({ data: { trafficNews: mockNews } });

            const result = await fetchHKTraffic();

            expect(axios.get).toHaveBeenCalledWith(
                'https://resource.data.one.gov.hk/td/en/specialtrafficnews.json',
                expect.objectContaining({ timeout: 8000 })
            );
            expect(result[0]).toMatchObject({ description: 'Road closure in Central', district: 'C&W' });
            expect(result[1]).toMatchObject({ description: 'Tunnel diversion', district: 'ET' });
        });

        it('should return empty array when trafficNews is missing', async () => {
            axios.get.mockResolvedValue({ data: {} });
            const result = await fetchHKTraffic();
            expect(result).toEqual([]);
        });

        it('should fall back to RTIS STN endpoint when primary fails', async () => {
            const mockSTN = [{ content: 'Road closure on Nathan Road', district: 'KT' }];
            axios.get
                .mockRejectedValueOnce(new Error('primary down'))
                .mockResolvedValueOnce({ data: { STN: mockSTN } });

            const result = await fetchHKTraffic();

            expect(result[0]).toMatchObject({ description: 'Road closure on Nathan Road', district: 'KT' });
        });

        it('should return empty array when both sources fail', async () => {
            axios.get.mockRejectedValue(new Error('all down'));
            const result = await fetchHKTraffic();
            expect(result).toEqual([]);
        });
    });

    // ── MY ────────────────────────────────────────────────────────────────────

    describe('fetchMYTraffic', () => {
        it('should return merged results from both sources', async () => {
            axios.get
                .mockResolvedValueOnce({ data: [{ road_name: 'Lebuhraya Damansara–Puchong', reason: 'Flood' }] })
                .mockResolvedValueOnce({ data: [{ project_name: 'MRT works', location: 'Petaling Jaya' }] });

            const result = await fetchMYTraffic();

            expect(result.length).toBe(2);
            expect(result[0].description).toContain('Lebuhraya Damansara');
            expect(result[1].description).toContain('MRT works');
        });

        it('should include items from source 2 even if source 1 fails', async () => {
            axios.get
                .mockRejectedValueOnce(new Error('source 1 down'))
                .mockResolvedValueOnce({ data: [{ project_name: 'Bridge works', location: 'Shah Alam' }] });

            const result = await fetchMYTraffic();

            expect(result.length).toBe(1);
            expect(result[0].source).toBe('JKR Roadworks');
        });

        it('should throw when both sources fail (so withRetry can retry)', async () => {
            axios.get.mockRejectedValue(new Error('all down'));

            await expect(fetchMYTraffic()).rejects.toThrow('All Malaysia traffic sources returned no data');
        });
    });
});
