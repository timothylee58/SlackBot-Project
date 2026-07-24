describe('cron-schedule', () => {
    let cron;
    let sendSlackNotification;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        jest.mock('node-cron', () => ({
            schedule: jest.fn()
        }));
        jest.mock('../services/slackService', () => ({
            sendSlackNotification: jest.fn()
        }));

        cron = require('node-cron');
        sendSlackNotification = require('../services/slackService').sendSlackNotification;
    });

    it('should register four cron schedules', () => {
        require('../cron-schedule');

        // regular-2h, morning-peak, evening-peak, lunch
        expect(cron.schedule).toHaveBeenCalledTimes(4);
    });

    it('should register the every-2-hours schedule (8AM–8PM SGT)', () => {
        require('../cron-schedule');

        const calls = cron.schedule.mock.calls;
        const biHourlyCall = calls.find(c => c[0] === '0 8,10,12,14,16,18,20 * * *');
        expect(biHourlyCall).toBeDefined();
        expect(biHourlyCall[2]).toMatchObject({ timezone: 'Asia/Singapore' });
    });

    it('should register the morning peak schedule (7–9:30 AM SGT)', () => {
        require('../cron-schedule');

        const calls = cron.schedule.mock.calls;
        const morningPeakCall = calls.find(c => c[0] === '0,30 7-9 * * *');
        expect(morningPeakCall).toBeDefined();
        expect(morningPeakCall[2]).toMatchObject({ timezone: 'Asia/Singapore' });
    });

    it('should register the evening peak schedule (5–7:30 PM SGT)', () => {
        require('../cron-schedule');

        const calls = cron.schedule.mock.calls;
        const eveningPeakCall = calls.find(c => c[0] === '0,30 17-19 * * *');
        expect(eveningPeakCall).toBeDefined();
        expect(eveningPeakCall[2]).toMatchObject({ timezone: 'Asia/Singapore' });
    });

    it('should register the lunch schedule (12 PM SGT)', () => {
        require('../cron-schedule');

        const calls = cron.schedule.mock.calls;
        const lunchCall = calls.find(c => c[0] === '0 12 * * *');
        expect(lunchCall).toBeDefined();
    });

    it('cron callbacks should eventually call sendSlackNotification', async () => {
        sendSlackNotification.mockResolvedValue();
        require('../cron-schedule');

        // Execute first cron callback (regular-2h)
        const callback = cron.schedule.mock.calls[0][1];
        await callback();

        expect(sendSlackNotification).toHaveBeenCalledTimes(1);
    });

    it('cron callback should handle sendSlackNotification errors gracefully', async () => {
        jest.useFakeTimers();
        sendSlackNotification.mockRejectedValue(new Error('Slack down'));
        require('../cron-schedule');

        const callback = cron.schedule.mock.calls[0][1];
        const promise = callback();
        // Fast-forward past all retry delays
        await jest.runAllTimersAsync();
        await expect(promise).resolves.toBeUndefined();
        jest.useRealTimers();
    }, 15000);
});
