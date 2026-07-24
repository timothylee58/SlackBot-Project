const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    registers: [register]
});

const cronRunsTotal = new client.Counter({
    name: 'cron_runs_total',
    help: 'Total cron notification runs, by schedule and outcome',
    labelNames: ['schedule', 'outcome'],
    registers: [register]
});

const circuitBreakerState = new client.Gauge({
    name: 'slack_circuit_breaker_open',
    help: 'Whether the Slack notification circuit breaker is currently open (1) or closed (0)',
    registers: [register]
});

const agentFetchDuration = new client.Histogram({
    name: 'agent_fetch_duration_seconds',
    help: 'Duration of per-region weather/traffic agent fetches',
    labelNames: ['region'],
    buckets: [0.1, 0.3, 0.5, 1, 2, 5, 10],
    registers: [register]
});

const slackNotificationDuration = new client.Histogram({
    name: 'slack_notification_duration_seconds',
    help: 'Duration of sendSlackNotification calls',
    buckets: [0.1, 0.3, 0.5, 1, 2, 5, 10],
    registers: [register]
});

function httpMetricsMiddleware(req, res, next) {
    const end = httpRequestDuration.startTimer();
    res.on('finish', () => {
        const route = req.route ? req.baseUrl + req.route.path : req.path;
        end({ method: req.method, route, status_code: res.statusCode });
    });
    next();
}

module.exports = {
    register,
    httpMetricsMiddleware,
    cronRunsTotal,
    circuitBreakerState,
    agentFetchDuration,
    slackNotificationDuration
};
