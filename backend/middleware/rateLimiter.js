const rateLimit = require('express-rate-limit');

// Limits each IP to 100 requests per 15 minutes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,  // Return rate limit info in the RateLimit-* headers
    legacyHeaders: false,   // Disable the X-RateLimit-* headers
    message: { error: 'Too many requests, please try again later.' }
});

module.exports = limiter;
