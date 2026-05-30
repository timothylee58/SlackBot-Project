const request = require('supertest');
const express = require('express');
const path = require('path');

// Mock slackService to avoid real Slack calls
jest.mock('../../services/slackService', () => ({
    sendSlackNotification: jest.fn().mockResolvedValue(),
    prepareSlackMessage: jest.fn(),
    formatLocationData: jest.fn()
}));
jest.mock('@slack/web-api', () => ({
    WebClient: jest.fn().mockImplementation(() => ({
        chat: { postMessage: jest.fn().mockResolvedValue({ ts: '123' }) }
    }))
}));

const pageRoutes = require('../../routes/pages');
const errorHandler = require('../../middleware/errorHandler');
const { sendSlackNotification } = require('../../services/slackService');

function expectGoogleMapsPage(res) {
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('<script src="/app.js"></script>');
    expect(res.text).not.toContain('unpkg.com/leaflet');
    expect(res.text).not.toContain('onclick="switchLocation');
}

function createApp() {
    const app = express();
    app.use('/', pageRoutes);
    app.use(errorHandler);
    return app;
}

describe('routes/pages', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        app = createApp();
    });

    describe('GET /', () => {
        it('should return 200 and serve index.html', async () => {
            const res = await request(app).get('/');

            expect(res.status).toBe(200);
            expectGoogleMapsPage(res);
        });
    });

    describe('GET /map', () => {
        it('should return 400 when lat is missing', async () => {
            const res = await request(app).get('/map?lng=103&zoom=10');

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ error: 'Missing required query parameters: lat, lng, and zoom.' });
        });

        it('should return 400 when lng is missing', async () => {
            const res = await request(app).get('/map?lat=1.35&zoom=10');

            expect(res.status).toBe(400);
        });

        it('should return 400 when zoom is missing', async () => {
            const res = await request(app).get('/map?lat=1.35&lng=103');

            expect(res.status).toBe(400);
        });

        it('should return 400 when all params are missing', async () => {
            const res = await request(app).get('/map');

            expect(res.status).toBe(400);
        });

        it('should return 200 when all params provided', async () => {
            const res = await request(app).get('/map?lat=1.35&lng=103.82&zoom=11');

            expect(res.status).toBe(200);
            expectGoogleMapsPage(res);
        });
    });

    describe('GET /send-notification', () => {
        it('should return 200 with success message on successful send', async () => {
            sendSlackNotification.mockResolvedValue();

            const res = await request(app).get('/send-notification');

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ message: 'Slack notification sent successfully.' });
            expect(sendSlackNotification).toHaveBeenCalledTimes(1);
        });

        it('should return 500 when Slack send fails', async () => {
            sendSlackNotification.mockRejectedValue(new Error('Slack API error'));

            const res = await request(app).get('/send-notification');

            expect(res.status).toBe(500);
            expect(res.body).toHaveProperty('error');
        });
    });
});
