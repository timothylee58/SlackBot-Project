const { triggerNotification, getLocations } = require('../../controllers/slackController');
const { sendSlackNotification } = require('../../services/slackService');
const { locations, singaporeAreas, hongKongRegions, klangValleyCities } = require('../../config/locations');

jest.mock('../../services/slackService');

describe('controllers/slackController', () => {
    let req, res, next;

    beforeEach(() => {
        jest.clearAllMocks();
        req = {};
        res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };
        next = jest.fn();
    });

    describe('triggerNotification', () => {
        it('should send notification and return success JSON', async () => {
            sendSlackNotification.mockResolvedValue();

            await triggerNotification(req, res, next);

            expect(sendSlackNotification).toHaveBeenCalledTimes(1);
            expect(res.json).toHaveBeenCalledWith({ message: 'Slack notification sent successfully.' });
        });

        it('should call next on error', async () => {
            const error = new Error('Slack send failed');
            sendSlackNotification.mockRejectedValue(error);

            await triggerNotification(req, res, next);

            expect(next).toHaveBeenCalledWith(error);
            expect(res.json).not.toHaveBeenCalled();
        });
    });

    describe('getLocations', () => {
        it('should return all location metadata', () => {
            getLocations(req, res);

            expect(res.json).toHaveBeenCalledWith({
                locations,
                singaporeAreas,
                hongKongRegions,
                klangValleyCities
            });
        });
    });
});
