let axios;
let fetchWeatherData;

beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.mock('axios');
    axios = require('axios');
    fetchWeatherData = require('../../services/weatherService').fetchWeatherData;
});

describe('services/weatherService', () => {
    describe('fetchWeatherData', () => {
        it('should return null when locationKey is falsy', async () => {
            const result = await fetchWeatherData(undefined);
            expect(result).toBeNull();
            expect(axios.get).not.toHaveBeenCalled();
        });

        it('should return null when locationKey is empty string', async () => {
            const result = await fetchWeatherData('');
            expect(result).toBeNull();
        });

        it('should return null for an unknown location key', async () => {
            const result = await fetchWeatherData('unknown-city');
            expect(result).toBeNull();
        });

        it('should fetch weather data for klang-valley', async () => {
            const mockData = [{ warning_issue: { title_en: 'Storm' } }];
            axios.get.mockResolvedValue({ status: 200, data: mockData });

            const result = await fetchWeatherData('klang-valley');

            expect(axios.get).toHaveBeenCalledWith('https://api.data.gov.my/weather/warning?limit=3');
            expect(result).toEqual(mockData);
        });

        it('should fetch weather data for singapore', async () => {
            const mockData = { items: [{ forecasts: [] }] };
            axios.get.mockResolvedValue({ status: 200, data: mockData });

            const result = await fetchWeatherData('singapore');

            expect(axios.get).toHaveBeenCalledWith('https://api.data.gov.sg/v1/environment/2-hour-weather-forecast');
            expect(result).toEqual(mockData);
        });

        it('should fetch weather data for hong-kong', async () => {
            const mockData = { outlook: 'Sunny' };
            axios.get.mockResolvedValue({ status: 200, data: mockData });

            const result = await fetchWeatherData('hong-kong');

            expect(axios.get).toHaveBeenCalledWith(
                'https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=flw&lang=en'
            );
            expect(result).toEqual(mockData);
        });

        it('should cache data and return cached on second call', async () => {
            const mockData = { items: [] };
            axios.get.mockResolvedValue({ status: 200, data: mockData });

            const first = await fetchWeatherData('singapore');
            const second = await fetchWeatherData('singapore');

            expect(axios.get).toHaveBeenCalledTimes(1);
            expect(second).toEqual(first);
        });

        it('should return error object on API failure', async () => {
            axios.get.mockRejectedValue(new Error('Network error'));

            const result = await fetchWeatherData('singapore');

            expect(result).toEqual({ error: 'Error fetching data for singapore' });
        });

        it('should return error object when response has no data', async () => {
            axios.get.mockResolvedValue({ status: 200, data: null });

            const result = await fetchWeatherData('klang-valley');

            expect(result).toEqual({ error: 'No data available for klang-valley' });
        });

        it('should return error object for non-200 status', async () => {
            axios.get.mockResolvedValue({ status: 500, data: null });

            const result = await fetchWeatherData('hong-kong');

            expect(result).toEqual({ error: 'No data available for hong-kong' });
        });
    });
});
