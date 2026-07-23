jest.mock('../../config/runtimeSettings', () => ({
    get: jest.fn((key) => key === 'SLACK_BOT_TOKEN' ? 'xoxb-test' : key === 'SLACK_CHANNEL_ID' ? 'C000TEST' : ''),
    set: jest.fn(),
    getAll: jest.fn(() => ({ SLACK_BOT_TOKEN: 'xoxb-test', SLACK_CHANNEL_ID: 'C000TEST' }))
}));

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
const { fetchSGTraffic, fetchHKTraffic, fetchMYTraffic } = require('../../services/trafficService');

describe('services/slackService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ── formatLocationData (backwards-compat shim) ───────────────────────────

    describe('formatLocationData', () => {
        it('should return warning text when weatherData has error', () => {
            const result = formatLocationData({ error: 'API down' }, 'singapore');
            expect(result.text).toContain('Weather Error');
            expect(result.text).toContain('API down');
            expect(result.traffic).toBe('');
        });

        it('should handle non-array weatherData for klang-valley gracefully', () => {
            // Empty object is not an array — shim delegates to formatMalaysia
            const result = formatLocationData({}, 'klang-valley');
            expect(result).toHaveProperty('text');
            expect(result).toHaveProperty('traffic');
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
                expect(result.traffic).toContain('No reported disruptions');
            });

            it('should show no-warning message when warning_issue is empty', () => {
                const weatherData = [{}, {}, {}];
                const result = formatLocationData(weatherData, 'klang-valley');

                expect(result.text).toContain('No active weather warnings');
            });

            it('should list traffic disruptions', () => {
                const trafficData = [{ description: 'Flood on LDP', source: 'road_rci' }];
                const result = formatLocationData([{}, {}, {}], 'klang-valley', trafficData);

                expect(result.traffic).toContain('1 disruption(s)');
                expect(result.traffic).toContain('Flood on LDP');
            });
        });

        describe('singapore', () => {
            it('should group forecasts by condition and include the area', () => {
                const weatherData = {
                    items: [{
                        forecasts: [
                            { area: 'Ang Mo Kio', forecast: 'Cloudy' },
                            { area: 'Changi',     forecast: 'Sunny' },
                            { area: 'Marine Parade', forecast: 'Rain' } // not in SG_DISPLAY_AREAS
                        ]
                    }]
                };
                const result = formatLocationData(weatherData, 'singapore');

                expect(result.text).toContain('Ang Mo Kio');
                expect(result.text).toContain('Changi');
                expect(result.text).not.toContain('Marine Parade');
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

                expect(result.traffic).toContain('Accidents');
                expect(result.traffic).toContain('Accident on PIE');
                expect(result.traffic).toContain('Accident on CTE');
            });

            it('should show non-accident expressway incidents', () => {
                const trafficData = [
                    { Type: 'Road Work',    Message: 'Road work on PIE lane closure' },
                    { Type: 'Heavy Traffic', Message: 'Heavy traffic on AYE' }
                ];
                const weatherData = { items: [{ forecasts: [] }] };
                const result = formatLocationData(weatherData, 'singapore', trafficData);

                expect(result.traffic).toContain('Expressway');
                expect(result.traffic).toContain('PIE');
            });

            it('should cap accident messages at 3', () => {
                const trafficData = [
                    { Type: 'Accident', Message: 'Accident 1' },
                    { Type: 'Accident', Message: 'Accident 2' },
                    { Type: 'Accident', Message: 'Accident 3' },
                    { Type: 'Accident', Message: 'Accident 4' }
                ];
                const weatherData = { items: [{ forecasts: [] }] };
                const result = formatLocationData(weatherData, 'singapore', trafficData);

                expect(result.traffic).toContain('Accident 1');
                expect(result.traffic).toContain('Accident 3');
                expect(result.traffic).not.toContain('Accident 4');
            });
        });

        describe('hong-kong', () => {
            it('should format weather outlook', () => {
                const result = formatLocationData({ outlook: 'Rainy' }, 'hong-kong');

                expect(result.text).toContain('Rainy');
            });

            it('should show unavailable when neither outlook nor generalSituation present', () => {
                const result = formatLocationData({}, 'hong-kong');

                expect(result.text).toContain('unavailable');
            });

            it('should show generalSituation when present', () => {
                const result = formatLocationData({ generalSituation: 'Fine and dry', outlook: 'Sunny' }, 'hong-kong');

                expect(result.text).toContain('Fine and dry');
                expect(result.text).toContain('Sunny');
            });

            it('should show traffic description content', () => {
                const trafficData = [{ description: 'Tunnel closed for maintenance', district: 'KT' }];
                const result = formatLocationData({ outlook: 'Fine' }, 'hong-kong', trafficData);

                expect(result.traffic).toContain('Tunnel closed for maintenance');
                expect(result.traffic).toContain('[KT]');
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

    // ── prepareSlackMessage ──────────────────────────────────────────────────

    describe('prepareSlackMessage', () => {
        beforeEach(() => {
            fetchWeatherData.mockImplementation((key) => {
                if (key === 'klang-valley') return Promise.resolve([{}, {}, { warning_issue: { title_en: 'Clear' }, valid_to: '2026-04-10' }]);
                if (key === 'singapore')    return Promise.resolve({ items: [{ forecasts: [{ area: 'Changi', forecast: 'Sunny' }] }] });
                if (key === 'hong-kong')    return Promise.resolve({ outlook: 'Fine' });
            });
            fetchSGTraffic.mockResolvedValue([]);
            fetchHKTraffic.mockResolvedValue([]);
            fetchMYTraffic.mockResolvedValue([]);
        });

        it('should return blocks array with header', async () => {
            const message = await prepareSlackMessage();

            expect(message).toHaveProperty('blocks');
            expect(Array.isArray(message.blocks)).toBe(true);

            const header = message.blocks.find(b => b.type === 'header');
            expect(header.text.text).toContain('Weather & Traffic Update');
        });

        it('should include 6 section blocks (weather + traffic per region)', async () => {
            const message = await prepareSlackMessage();
            const sections = message.blocks.filter(b => b.type === 'section');

            // 2 sections per region (weather, traffic) × 3 regions = 6
            expect(sections.length).toBe(6);
        });

        it('should contain all three region flags in section text', async () => {
            const message = await prepareSlackMessage();
            const allText = message.blocks
                .filter(b => b.type === 'section')
                .map(b => b.text.text)
                .join('\n');

            expect(allText).toContain('Singapore');
            expect(allText).toContain('Malaysia');
            expect(allText).toContain('Hong Kong');
        });

        it('should include a context block with map link', async () => {
            const message = await prepareSlackMessage();
            const contexts = message.blocks.filter(b => b.type === 'context');
            const contextText = contexts.flatMap(c => c.elements.map(e => e.text)).join('\n');

            expect(contextText).toContain('View Live Map');
        });

        it('should include a data-source footer context block', async () => {
            const message = await prepareSlackMessage();
            const contexts = message.blocks.filter(b => b.type === 'context');
            const footerText = contexts.flatMap(c => c.elements.map(e => e.text)).join('\n');

            expect(footerText).toContain('data.gov.sg');
        });

        it('should call all fetch functions', async () => {
            await prepareSlackMessage();

            expect(fetchWeatherData).toHaveBeenCalledWith('klang-valley');
            expect(fetchWeatherData).toHaveBeenCalledWith('singapore');
            expect(fetchWeatherData).toHaveBeenCalledWith('hong-kong');
            expect(fetchSGTraffic).toHaveBeenCalledTimes(1);
            expect(fetchHKTraffic).toHaveBeenCalledTimes(1);
            expect(fetchMYTraffic).toHaveBeenCalledTimes(1);
        });
    });

    // ── sendSlackNotification ────────────────────────────────────────────────

    describe('sendSlackNotification', () => {
        beforeEach(() => {
            fetchWeatherData.mockResolvedValue({});
            fetchSGTraffic.mockResolvedValue([]);
            fetchHKTraffic.mockResolvedValue([]);
            fetchMYTraffic.mockResolvedValue([]);
        });

        it('should resolve without throwing when Slack is configured', async () => {
            await expect(sendSlackNotification()).resolves.not.toThrow();
        });

        it('should throw when Slack API rejects', async () => {
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
                fetchHKTraffic: jest.fn().mockResolvedValue([]),
                fetchMYTraffic: jest.fn().mockResolvedValue([])
            }));

            const { sendSlackNotification: sendFail } = require('../../services/slackService');
            await expect(sendFail()).rejects.toThrow('Slack API error');
        });
    });
});
