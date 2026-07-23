const cron = require('node-cron');
const { sendSlackNotification } = require('./services/slackService');

// ── Circuit breaker state ─────────────────────────────────────────────────────
// Prevents runaway retries when Slack or upstream APIs are persistently down.
const breaker = {
    failures:      0,
    OPEN_THRESHOLD: 3,          // open after N consecutive failures
    RESET_AFTER_MS: 15 * 60 * 1000, // try again after 15 min
    openedAt:      null,

    isOpen() {
        if (!this.openedAt) return false;
        if (Date.now() - this.openedAt >= this.RESET_AFTER_MS) {
            console.log('[cron] circuit breaker: half-open — allowing next attempt');
            this.openedAt = null;   // half-open: let one attempt through
            return false;
        }
        return true;
    },

    recordSuccess() {
        this.failures  = 0;
        this.openedAt  = null;
    },

    recordFailure(label) {
        this.failures++;
        if (this.failures >= this.OPEN_THRESHOLD && !this.openedAt) {
            this.openedAt = Date.now();
            const resetMin = Math.round(this.RESET_AFTER_MS / 60000);
            console.error(`[cron] circuit breaker OPEN after ${this.failures} failures — pausing for ${resetMin} min`);
        }
        console.error(`[cron][${label}] failure #${this.failures}`);
    }
};

// ── Retry helper ─────────────────────────────────────────────────────────────
const MAX_RETRIES   = 2;
const BASE_DELAY_MS = 5000;

async function sendWithRetry(scheduleType) {
    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
        try {
            await sendSlackNotification();
            breaker.recordSuccess();
            console.log(`[cron][${scheduleType}] ✓ sent (attempt ${attempt})`);
            return;
        } catch (err) {
            const isLast = attempt === MAX_RETRIES + 1;
            if (isLast) {
                breaker.recordFailure(scheduleType);
                console.error(`[cron][${scheduleType}] ✗ all ${MAX_RETRIES + 1} attempts failed — ${err.message}`);
            } else {
                const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
                console.warn(`[cron][${scheduleType}] attempt ${attempt} failed (${err.message}) — retry in ${delay / 1000}s`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
}

// ── Dispatcher ───────────────────────────────────────────────────────────────
async function triggerNotification(scheduleType) {
    const ts = new Date().toLocaleString('en-SG', {
        timeZone: 'Asia/Singapore',
        hour: '2-digit', minute: '2-digit', weekday: 'short'
    });
    console.log(`[cron][${scheduleType}] firing at ${ts} SGT`);

    if (breaker.isOpen()) {
        const remainMs = breaker.RESET_AFTER_MS - (Date.now() - breaker.openedAt);
        console.warn(`[cron][${scheduleType}] circuit breaker open — skipping (resets in ~${Math.ceil(remainMs / 60000)} min)`);
        return;
    }

    await sendWithRetry(scheduleType);
}

// ── Schedules (all times = SGT, Asia/Singapore) ───────────────────────────────
// node-cron uses server local time; cron expressions here are written in SGT.
// Railway/Fly containers default to UTC, so SGT = UTC+8.
// Regular updates every 2 hours 8 AM–8 PM SGT
cron.schedule('0 8,10,12,14,16,18,20 * * *', () => triggerNotification('regular-2h'), {
    timezone: 'Asia/Singapore'
});

// Morning peak every 30 min 7:00–9:30 AM SGT
cron.schedule('0,30 7-9 * * *', () => triggerNotification('morning-peak'), {
    timezone: 'Asia/Singapore'
});

// Evening peak every 30 min 5:00–7:30 PM SGT
cron.schedule('0,30 17-19 * * *', () => triggerNotification('evening-peak'), {
    timezone: 'Asia/Singapore'
});

// Lunch nudge at 12:00 PM SGT
cron.schedule('0 12 * * *', () => triggerNotification('lunch'), {
    timezone: 'Asia/Singapore'
});

console.log('[cron] schedules initialized (timezone: Asia/Singapore)');
console.log('[cron] regular: every 2 h (8 AM – 8 PM) | peaks: 30 min (7–9:30 AM, 5–7:30 PM) | lunch: 12 PM');
