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

    it('should register three cron schedules', () => {
        require('../cron-schedule');

        expect(cron.schedule).toHaveBeenCalledTimes(3);
    });

    it('should register the every-2-hours schedule (8AM-8PM)', () => {
        require('../cron-schedule');

        const calls = cron.schedule.mock.calls;
        const biHourlyCall = calls.find(c => c[0] === '0 8,10,12,14,16,18,20 * * *');
        expect(biHourlyCall).toBeDefined();
    });

    it('should register the morning peak schedule (10-11:30 AM)', () => {
        require('../cron-schedule');

        const calls = cron.schedule.mock.calls;
        const morningPeakCall = calls.find(c => c[0] === '*/30 10-11 * * *');
        expect(morningPeakCall).toBeDefined();
    });

    it('should register the evening peak schedule (5-6:30 PM)', () => {
        require('../cron-schedule');

        const calls = cron.schedule.mock.calls;
        const eveningPeakCall = calls.find(c => c[0] === '*/30 17-18 * * *');
        expect(eveningPeakCall).toBeDefined();
    });

    it('cron callbacks should call sendSlackNotification', async () => {
        sendSlackNotification.mockResolvedValue();
        require('../cron-schedule');

        // Execute each cron callback
        for (const call of cron.schedule.mock.calls) {
            const callback = call[1];
            await callback();
        }

        expect(sendSlackNotification).toHaveBeenCalledTimes(3);
    });

    it('cron callback should handle sendSlackNotification errors gracefully', async () => {
        sendSlackNotification.mockRejectedValue(new Error('Slack down'));
        require('../cron-schedule');

        const callback = cron.schedule.mock.calls[0][1];

        // Should not throw — the internal try/catch handles the error
        await callback();
        // If we reach here, the error was caught gracefully
        expect(sendSlackNotification).toHaveBeenCalledTimes(1);
    });
});
