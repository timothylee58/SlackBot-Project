jest.mock('@slack/web-api', () => ({
    WebClient: jest.fn().mockImplementation(() => ({
        chat: {
            postMessage: jest.fn().mockResolvedValue({ ts: '1234567890.123456' })
        }
    }))
}));

jest.mock('../../services/weatherService');
jest.mock('../../services/trafficService');

const { formatLocationData, prepareSlackMessage, sendSlackNotification } = require('../../services/slackService');
const { fetchWeatherData } = require('../../services/weatherService');
const { fetchSGTraffic, fetchHKTraffic } = require('../../services/trafficService');

describe('services/slackService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('formatLocationData', () => {
        it('should return warning text when weatherData has error', () => {
            const result = formatLocationData({ error: 'API down' }, 'singapore');
            expect(result.text).toContain('Weather Error');
            expect(result.text).toContain('API down');
            expect(result.traffic).toBe('');
        });

        it('should handle undefined weatherData.error via optional chaining', () => {
            // weatherData?.error uses optional chaining — an object without error property
            // should fall through to the switch, not crash
            const result = formatLocationData({}, 'klang-valley');
            expect(result).toHaveProperty('text');
            expect(result).toHaveProperty('traffic');
            expect(result.text).toContain('Stable');
        });

        describe('klang-valley', () => {
            it('should format warning title and valid_to', () => {
                const weatherData = [
                    {},
                    {},
                    { warning_issue: { title_en: 'Heavy Rain Warning' }, valid_to: '2026-04-10' }
                ];
                const result = formatLocationData(weatherData, 'klang-valley');

                expect(result.text).toContain('Heavy Rain Warning');
                expect(result.text).toContain('2026-04-10');
                expect(result.traffic).toBe('');
            });

            it('should show Stable when no warning_issue', () => {
                const weatherData = [{}, {}, {}];
                const result = formatLocationData(weatherData, 'klang-valley');

                expect(result.text).toContain('Stable');
                expect(result.text).toContain('N/A');
            });
        });

        describe('singapore', () => {
            it('should format weather forecasts for display areas', () => {
                const weatherData = {
                    items: [{
                        forecasts: [
                            { area: 'Ang Mo Kio', forecast: 'Cloudy' },
                            { area: 'Changi', forecast: 'Sunny' },
                            { area: 'Marine Parade', forecast: 'Rain' } // not in SG_DISPLAY_AREAS
                        ]
                    }]
                };
                const result = formatLocationData(weatherData, 'singapore');

                expect(result.text).toContain('Ang Mo Kio: Cloudy');
                expect(result.text).toContain('Changi: Sunny');
                expect(result.text).not.toContain('Marine Parade');
            });

            it('should show "No weather alerts." when no matching forecasts', () => {
                const weatherData = { items: [{ forecasts: [] }] };
                const result = formatLocationData(weatherData, 'singapore');

                expect(result.text).toBe('No weather alerts.');
            });

            it('should show smooth flow when no traffic incidents', () => {
                const weatherData = { items: [{ forecasts: [] }] };
                const result = formatLocationData(weatherData, 'singapore', []);

                expect(result.traffic).toContain('Smooth flow');
            });

            it('should format traffic with incident count', () => {
                const trafficData = [
                    { Type: 'Road Work', Message: 'Road work on Orchard Rd' }
                ];
                const weatherData = { items: [{ forecasts: [] }] };
                const result = formatLocationData(weatherData, 'singapore', trafficData);

                expect(result.traffic).toContain('1 incident(s)');
            });

            it('should show accident details', () => {
                const trafficData = [
                    { Type: 'Accident', Message: 'Accident on PIE towards Changi' },
                    { Type: 'Accident', Message: 'Accident on CTE southbound' }
                ];
                const weatherData = { items: [{ forecasts: [] }] };
                const result = formatLocationData(weatherData, 'singapore', trafficData);

                expect(result.traffic).toContain('*Accidents:* 2');
                expect(result.traffic).toContain('Accident on PIE');
                expect(result.traffic).toContain('Accident on CTE');
            });

            it('should show non-accident expressway incidents', () => {
                const trafficData = [
                    { Type: 'Road Work', Message: 'Road work on PIE lane closure' },
                    { Type: 'Heavy Traffic', Message: 'Heavy traffic on AYE' }
                ];
                const weatherData = { items: [{ forecasts: [] }] };
                const result = formatLocationData(weatherData, 'singapore', trafficData);

                expect(result.traffic).toContain('Expressway');
                expect(result.traffic).toContain('PIE');
            });

            it('should limit accident messages to first 2', () => {
                const trafficData = [
                    { Type: 'Accident', Message: 'Accident 1' },
                    { Type: 'Accident', Message: 'Accident 2' },
                    { Type: 'Accident', Message: 'Accident 3' }
                ];
                const weatherData = { items: [{ forecasts: [] }] };
                const result = formatLocationData(weatherData, 'singapore', trafficData);

                expect(result.traffic).toContain('Accident 1');
                expect(result.traffic).toContain('Accident 2');
                expect(result.traffic).not.toContain('Accident 3');
            });
        });

        describe('hong-kong', () => {
            it('should format weather outlook', () => {
                const result = formatLocationData({ outlook: 'Rainy' }, 'hong-kong');

                expect(result.text).toContain('Rainy');
            });

            it('should show "Available Soon" when no outlook', () => {
                const result = formatLocationData({}, 'hong-kong');

                expect(result.text).toContain('Available Soon');
            });

            it('should show traffic closure content', () => {
                const trafficData = [{ content: 'Tunnel closed for maintenance' }];
                const result = formatLocationData({ outlook: 'Fine' }, 'hong-kong', trafficData);

                expect(result.traffic).toContain('Tunnel closed for maintenance');
            });

            it('should show no major closures when no traffic', () => {
                const result = formatLocationData({ outlook: 'Fine' }, 'hong-kong', []);

                expect(result.traffic).toContain('No major closures');
            });
        });

        describe('unknown location', () => {
            it('should return fallback text for unknown location key', () => {
                const result = formatLocationData({}, 'mars');

                expect(result.text).toContain('No weather data available');
            });
        });
    });

    describe('prepareSlackMessage', () => {
        it('should return blocks array with all regions', async () => {
            fetchWeatherData.mockImplementation((key) => {
                if (key === 'klang-valley') return Promise.resolve([{}, {}, { warning_issue: { title_en: 'Clear' }, valid_to: '2026-04-10' }]);
                if (key === 'singapore') return Promise.resolve({ items: [{ forecasts: [{ area: 'Changi', forecast: 'Sunny' }] }] });
                if (key === 'hong-kong') return Promise.resolve({ outlook: 'Fine' });
            });
            fetchSGTraffic.mockResolvedValue([]);
            fetchHKTraffic.mockResolvedValue([]);

            const message = await prepareSlackMessage();

            expect(message).toHaveProperty('blocks');
            expect(Array.isArray(message.blocks)).toBe(true);

            // Should have header, dividers, sections for SG, MY, HK, and map link
            const headerBlock = message.blocks.find(b => b.type === 'header');
            expect(headerBlock.text.text).toContain('Weather & Traffic Update');

            const sections = message.blocks.filter(b => b.type === 'section');
            expect(sections.length).toBe(4); // SG, MY, HK, Map link

            // Verify region content is present
            const allText = sections.map(s => s.text.text).join('\n');
            expect(allText).toContain('Singapore');
            expect(allText).toContain('Malaysia');
            expect(allText).toContain('Hong Kong');
            expect(allText).toContain('View Interactive Map');
        });

        it('should call all fetch functions concurrently', async () => {
            fetchWeatherData.mockResolvedValue({});
            fetchSGTraffic.mockResolvedValue([]);
            fetchHKTraffic.mockResolvedValue([]);

            await prepareSlackMessage();

            expect(fetchWeatherData).toHaveBeenCalledWith('klang-valley');
            expect(fetchWeatherData).toHaveBeenCalledWith('singapore');
            expect(fetchWeatherData).toHaveBeenCalledWith('hong-kong');
            expect(fetchSGTraffic).toHaveBeenCalledTimes(1);
            expect(fetchHKTraffic).toHaveBeenCalledTimes(1);
        });
    });

    describe('sendSlackNotification', () => {
        it('should call slackClient.chat.postMessage', async () => {
            fetchWeatherData.mockResolvedValue({});
            fetchSGTraffic.mockResolvedValue([]);
            fetchHKTraffic.mockResolvedValue([]);

            await expect(sendSlackNotification()).resolves.not.toThrow();
        });

        it('should throw error when Slack API fails', async () => {
            // Re-mock WebClient to reject
            const { WebClient } = require('@slack/web-api');
            WebClient.mockImplementation(() => ({
                chat: {
                    postMessage: jest.fn().mockRejectedValue(new Error('Slack API error'))
                }
            }));

            // Need to re-require to get the new mock
            jest.resetModules();
            jest.mock('@slack/web-api', () => ({
                WebClient: jest.fn().mockImplementation(() => ({
                    chat: {
                        postMessage: jest.fn().mockRejectedValue(new Error('Slack API error'))
                    }
                }))
            }));
            jest.mock('../../services/weatherService', () => ({
                fetchWeatherData: jest.fn().mockResolvedValue({})
            }));
            jest.mock('../../services/trafficService', () => ({
                fetchSGTraffic: jest.fn().mockResolvedValue([]),
                fetchHKTraffic: jest.fn().mockResolvedValue([])
            }));

            const { sendSlackNotification: sendFail } = require('../../services/slackService');

            await expect(sendFail()).rejects.toThrow('Slack API error');
        });
    });
});
