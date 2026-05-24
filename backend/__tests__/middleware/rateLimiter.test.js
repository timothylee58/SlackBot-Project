const request = require('supertest');
const express = require('express');
const limiter = require('../../middleware/rateLimiter');

describe('middleware/rateLimiter', () => {
    it('should export a function (middleware)', () => {
        expect(typeof limiter).toBe('function');
    });

    it('should allow requests under the limit', async () => {
        const app = express();
        app.use(limiter);
        app.get('/test', (req, res) => res.json({ ok: true }));

        const res = await request(app).get('/test');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true });
    });

    it('should include rate limit headers in response', async () => {
        const app = express();
        app.use(limiter);
        app.get('/test', (req, res) => res.json({ ok: true }));

        const res = await request(app).get('/test');

        // standardHeaders: true should set RateLimit headers
        expect(res.headers).toHaveProperty('ratelimit-limit');
    });
});
