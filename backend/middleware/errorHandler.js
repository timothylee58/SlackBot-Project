// Global error handler — must be registered last in app.js (after all routes)
// Catches any error passed via next(err) from controllers

function errorHandler(err, req, res, next) {
    console.error(`[Error] ${req.method} ${req.path}:`, err.message);

    const status = err.status || 500;
    res.status(status).json({
        error: err.message || 'Internal server error'
    });
}

module.exports = errorHandler;
