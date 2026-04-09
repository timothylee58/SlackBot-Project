// Global error handler — must be registered last in app.js (after all routes)
// Catches any error passed via next(err) from controllers

function errorHandler(err, req, res, next) {
    console.error(`[Error] ${req.method} ${req.path}:`, err.message);

    if (res.headersSent) {
        return next(err);
    }

    const status = err.status || 500;
    res.status(status).json({
        error: status === 500 ? 'Internal server error' : err.message
    });
}

module.exports = errorHandler;
