const express = require('express');
const path    = require('path');
const helmet  = require('helmet');

const limiter      = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const apiRoutes    = require('./routes/api');
const pageRoutes   = require('./routes/pages');

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
                'https://maps.googleapis.com',
                'https://maps.gstatic.com',
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
                // Google Maps
                'https://maps.googleapis.com',
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
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api', apiRoutes);
app.use('/', pageRoutes);

// ── Global Error Handler (must be last) ───────────────────────────────────────
app.use(errorHandler);

module.exports = app;
