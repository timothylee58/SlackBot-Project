const { getWeather, getStatus } = require('../../controllers/weatherController');
const { fetchWeatherData } = require('../../services/weatherService');
const { fetchSGTraffic, fetchHKTraffic } = require('../../services/trafficService');

jest.mock('../../services/weatherService');
jest.mock('../../services/trafficService');
jest.mock('../../services/slackService', () => ({
    formatLocationData: jest.fn((weather, key, traffic) => ({
        text: `weather for ${key}`,
        traffic: traffic && traffic.length > 0 ? 'traffic data' : ''
    }))
}));

describe('controllers/weatherController', () => {
    let req, res, next;

    beforeEach(() => {
        jest.clearAllMocks();
        req = { params: {} };
        res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };
        next = jest.fn();
    });

    describe('getWeather', () => {
        it('should return 400 for invalid location key', async () => {
            req.params.locationKey = 'invalid';

            await getWeather(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Invalid location key' });
        });

        it('should return weather data for valid location', async () => {
            req.params.locationKey = 'singapore';
            const mockWeather = { items: [{ forecasts: [] }] };
            fetchWeatherData.mockResolvedValue(mockWeather);

            await getWeather(req, res, next);

            expect(fetchWeatherData).toHaveBeenCalledWith('singapore');
            expect(res.json).toHaveBeenCalledWith({
                location: expect.objectContaining({ name: 'Singapore' }),
                weather: mockWeather
            });
        });

        it('should return weather data for klang-valley', async () => {
            req.params.locationKey = 'klang-valley';
            fetchWeatherData.mockResolvedValue([]);

            await getWeather(req, res, next);

            expect(res.json).toHaveBeenCalledWith({
                location: expect.objectContaining({ name: 'Klang Valley' }),
                weather: []
            });
        });

        it('should return weather data for hong-kong', async () => {
            req.params.locationKey = 'hong-kong';
            fetchWeatherData.mockResolvedValue({ outlook: 'Sunny' });

            await getWeather(req, res, next);

            expect(res.json).toHaveBeenCalledWith({
                location: expect.objectContaining({ name: 'Hong Kong' }),
                weather: { outlook: 'Sunny' }
            });
        });

        it('should call next on error', async () => {
            req.params.locationKey = 'singapore';
            const error = new Error('Service failure');
            fetchWeatherData.mockRejectedValue(error);

            await getWeather(req, res, next);

            expect(next).toHaveBeenCalledWith(error);
        });
    });

    describe('getStatus', () => {
        it('should return 400 for invalid location key', async () => {
            req.params.locationKey = 'invalid';

            await getStatus(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Invalid location key' });
        });

        it('should return combined status for singapore (weather + SG traffic)', async () => {
            req.params.locationKey = 'singapore';
            fetchWeatherData.mockResolvedValue({ items: [] });
            fetchSGTraffic.mockResolvedValue([{ Type: 'Accident', Message: 'Accident on PIE' }]);

            await getStatus(req, res, next);

            expect(fetchWeatherData).toHaveBeenCalledWith('singapore');
            expect(fetchSGTraffic).toHaveBeenCalledTimes(1);
            expect(fetchHKTraffic).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                location: expect.objectContaining({ name: 'Singapore' })
            }));
        });

        it('should return combined status for hong-kong (weather + HK traffic)', async () => {
            req.params.locationKey = 'hong-kong';
            fetchWeatherData.mockResolvedValue({ outlook: 'Fine' });
            fetchHKTraffic.mockResolvedValue([{ content: 'Road closure' }]);

            await getStatus(req, res, next);

            expect(fetchWeatherData).toHaveBeenCalledWith('hong-kong');
            expect(fetchHKTraffic).toHaveBeenCalledTimes(1);
            expect(fetchSGTraffic).not.toHaveBeenCalled();
        });

        it('should return status for klang-valley (weather only, no traffic)', async () => {
            req.params.locationKey = 'klang-valley';
            fetchWeatherData.mockResolvedValue([]);

            await getStatus(req, res, next);

            expect(fetchSGTraffic).not.toHaveBeenCalled();
            expect(fetchHKTraffic).not.toHaveBeenCalled();
        });

        it('should call next on error', async () => {
            req.params.locationKey = 'singapore';
            const error = new Error('Service failure');
            fetchWeatherData.mockRejectedValue(error);

            await getStatus(req, res, next);

            expect(next).toHaveBeenCalledWith(error);
        });
    });
});
