const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');

const limiter = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const apiRoutes = require('./routes/api');
const pageRoutes = require('./routes/pages');

const app = express();

// Trust a single proxy (required for rate limiting to work correctly on Render)
app.set('trust proxy', 1);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api', apiRoutes);
app.use('/', pageRoutes);

// ── Global Error Handler (must be last) ───────────────────────────────────────
app.use(errorHandler);

module.exports = app;
