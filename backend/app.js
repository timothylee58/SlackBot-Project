const express = require('express');
const path    = require('path');
const helmet  = require('helmet');

const limiter      = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const apiRoutes    = require('./routes/api');
const pageRoutes   = require('./routes/pages');
const { register, httpMetricsMiddleware } = require('./services/metrics');
const { requireSettingsAuth } = require('./controllers/settingsController');

const app = express();

// Trust a single proxy (required for rate limiting on Railway/Render)
app.set('trust proxy', 1);

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc:  ["'self'"],
            scriptSrc: [
                "'self'",
                // Bootstrap, jQuery, Popper (loaded with SRI hashes in HTML)
                'https://code.jquery.com',
                'https://cdn.jsdelivr.net',
                'https://stackpath.bootstrapcdn.com',
                // Google Maps SDK (loaded dynamically in app.js)
                'https://maps.googleapis.com',
                'https://maps.gstatic.com',
            ],
            styleSrc: [
                "'self'",
                'https://stackpath.bootstrapcdn.com',
                // Google Maps injects inline styles
                "'unsafe-inline'",
            ],
            imgSrc: [
                "'self'",
                'data:',
                'blob:',
                // Google Maps full allowlist (tiles, Street View, icons, etc.)
                'https://maps.googleapis.com',
                'https://maps.gstatic.com',
                'https://*.googleapis.com',
                'https://*.gstatic.com',
                'https://streetviewpixels-pa.googleapis.com',
                'https://www.hko.gov.hk',       // HK weather icons
                'https://tilecache.rainviewer.com',
            ],
            connectSrc: [
                "'self'",
                // Weather APIs
                'https://api.data.gov.sg',
                'https://api.data.gov.my',
                'https://data.weather.gov.hk',
                'https://resource.data.one.gov.hk',
                // RainViewer
                'https://api.rainviewer.com',
                'https://tilecache.rainviewer.com',
                // Google Maps full allowlist (Places, Directions, Geocoding, etc.)
                'https://maps.googleapis.com',
                'https://*.googleapis.com',
            ],
            frameSrc:   ["'none'"],
            objectSrc:  ["'none'"],
            workerSrc:  ["'self'", 'blob:'],   // Google Maps uses blob workers
        },
    },
    crossOriginEmbedderPolicy: false,  // Google Maps requires this to be off
}));

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(limiter);
app.use(httpMetricsMiddleware);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Metrics endpoint (Prometheus scrape target) ───────────────────────────────
// Gated behind the same token as /api/settings — metrics can reveal traffic
// patterns and shouldn't be public on a shared/free-tier host.
app.get('/metrics', requireSettingsAuth, async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api', apiRoutes);
app.use('/', pageRoutes);

// ── Global Error Handler (must be last) ───────────────────────────────────────
app.use(errorHandler);

module.exports = app;
