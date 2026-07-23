const request = require('supertest');
const express = require('express');

// Mock all service dependencies before requiring routes
jest.mock('../../services/weatherService', () => ({
    fetchWeatherData: jest.fn()
}));
jest.mock('../../services/trafficService', () => ({
    fetchSGTraffic: jest.fn(),
    fetchHKTraffic: jest.fn(),
    fetchMYTraffic: jest.fn()
}));
jest.mock('@slack/web-api', () => ({
    WebClient: jest.fn().mockImplementation(() => ({
        chat: { postMessage: jest.fn().mockResolvedValue({ ts: '123' }) }
    }))
}));

const apiRoutes = require('../../routes/api');
const errorHandler = require('../../middleware/errorHandler');
const { fetchWeatherData } = require('../../services/weatherService');
const { fetchSGTraffic, fetchHKTraffic } = require('../../services/trafficService');

// Build a minimal app for testing just the API routes
function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api', apiRoutes);
    app.use(errorHandler);
    return app;
}

describe('routes/api', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        app = createApp();
    });

    describe('GET /api/locations', () => {
        it('should return 200 with location metadata', async () => {
            const res = await request(app).get('/api/locations');

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('locations');
            expect(res.body).toHaveProperty('singaporeAreas');
            expect(res.body).toHaveProperty('hongKongRegions');
            expect(res.body).toHaveProperty('klangValleyCities');
        });

        it('should contain all three location keys', async () => {
            const res = await request(app).get('/api/locations');

            expect(Object.keys(res.body.locations)).toEqual(['klang-valley', 'singapore', 'hong-kong']);
        });
    });

    describe('GET /api/weather/:locationKey', () => {
        it('should return 400 for invalid location key', async () => {
            const res = await request(app).get('/api/weather/mars');

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ error: 'Invalid location key' });
        });

        it('should return 200 with weather data for singapore', async () => {
            const mockWeather = { items: [{ forecasts: [] }] };
            fetchWeatherData.mockResolvedValue(mockWeather);

            const res = await request(app).get('/api/weather/singapore');

            expect(res.status).toBe(200);
            expect(res.body.location.name).toBe('Singapore');
            expect(res.body.weather).toEqual(mockWeather);
        });

        it('should return 500 when service throws', async () => {
            fetchWeatherData.mockRejectedValue(new Error('API down'));

            const res = await request(app).get('/api/weather/singapore');

            expect(res.status).toBe(500);
            expect(res.body).toHaveProperty('error');
        });
    });

    describe('GET /api/traffic/:region', () => {
        it('should return 400 for unsupported region', async () => {
            const res = await request(app).get('/api/traffic/mars');

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Unsupported region');
        });

        it('should return SG traffic data', async () => {
            const mockTraffic = [{ Type: 'Accident', Message: 'PIE accident' }];
            fetchSGTraffic.mockResolvedValue(mockTraffic);

            const res = await request(app).get('/api/traffic/singapore');

            expect(res.status).toBe(200);
            expect(res.body.traffic).toEqual(mockTraffic);
        });

        it('should return HK traffic data', async () => {
            const mockTraffic = [{ content: 'Tunnel closure' }];
            fetchHKTraffic.mockResolvedValue(mockTraffic);

            const res = await request(app).get('/api/traffic/hong-kong');

            expect(res.status).toBe(200);
            expect(res.body.traffic).toEqual(mockTraffic);
        });

        it('should return 500 when service throws', async () => {
            fetchSGTraffic.mockRejectedValue(new Error('LTA down'));

            const res = await request(app).get('/api/traffic/singapore');

            expect(res.status).toBe(500);
            expect(res.body).toHaveProperty('error');
        });
    });

    describe('GET /api/status/:locationKey', () => {
        it('should return 400 for invalid location', async () => {
            const res = await request(app).get('/api/status/invalid');

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ error: 'Invalid location key' });
        });

        it('should return combined weather + traffic for singapore', async () => {
            fetchWeatherData.mockResolvedValue({ items: [{ forecasts: [{ area: 'Changi', forecast: 'Sunny' }] }] });
            fetchSGTraffic.mockResolvedValue([]);

            const res = await request(app).get('/api/status/singapore');

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('location');
            expect(res.body).toHaveProperty('text');
            expect(res.body).toHaveProperty('traffic');
        });

        it('should return combined weather + traffic for hong-kong', async () => {
            fetchWeatherData.mockResolvedValue({ outlook: 'Fine' });
            fetchHKTraffic.mockResolvedValue([]);

            const res = await request(app).get('/api/status/hong-kong');

            expect(res.status).toBe(200);
            expect(res.body.location.name).toBe('Hong Kong');
        });

        it('should return status for klang-valley (no traffic fetch)', async () => {
            fetchWeatherData.mockResolvedValue([{}, {}, { warning_issue: { title_en: 'Clear' } }]);

            const res = await request(app).get('/api/status/klang-valley');

            expect(res.status).toBe(200);
            expect(res.body.location.name).toBe('Klang Valley');
            expect(fetchSGTraffic).not.toHaveBeenCalled();
            expect(fetchHKTraffic).not.toHaveBeenCalled();
        });

        it('should return 500 when service throws', async () => {
            fetchWeatherData.mockRejectedValue(new Error('Fetch failed'));

            const res = await request(app).get('/api/status/singapore');

            expect(res.status).toBe(500);
        });
    });
});
