// Global error handler — must be registered last in app.js (after all routes)
// Catches any error passed via next(err) from controllers

function errorHandler(err, req, res, next) {
    console.error(`[Error] ${req.method} ${req.path}:`, err.message);

    const status = err.status || 500;
    const message = process.env.NODE_ENV === 'production' && status === 500
        ? 'Internal server error'
        : err.message || 'Internal server error';

    res.status(status).json({ error: message });
}

module.exports = errorHandler;
