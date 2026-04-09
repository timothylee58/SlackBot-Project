const { getTraffic } = require('../../controllers/trafficController');
const { fetchSGTraffic, fetchHKTraffic } = require('../../services/trafficService');

jest.mock('../../services/trafficService');

describe('controllers/trafficController', () => {
    let req, res, next;

    beforeEach(() => {
        jest.clearAllMocks();
        req = { params: {} };
        res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };
        next = jest.fn();
    });

    describe('getTraffic', () => {
        it('should return 400 for unsupported region', async () => {
            req.params.region = 'klang-valley';

            await getTraffic(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.stringContaining('Unsupported region') })
            );
        });

        it('should return 400 for completely unknown region', async () => {
            req.params.region = 'mars';

            await getTraffic(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return SG traffic for singapore', async () => {
            req.params.region = 'singapore';
            const mockTraffic = [{ Type: 'Accident', Message: 'Accident on PIE' }];
            fetchSGTraffic.mockResolvedValue(mockTraffic);

            await getTraffic(req, res, next);

            expect(fetchSGTraffic).toHaveBeenCalledTimes(1);
            expect(fetchHKTraffic).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({ traffic: mockTraffic });
        });

        it('should return HK traffic for hong-kong', async () => {
            req.params.region = 'hong-kong';
            const mockTraffic = [{ content: 'Road closure' }];
            fetchHKTraffic.mockResolvedValue(mockTraffic);

            await getTraffic(req, res, next);

            expect(fetchHKTraffic).toHaveBeenCalledTimes(1);
            expect(fetchSGTraffic).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({ traffic: mockTraffic });
        });

        it('should call next on error', async () => {
            req.params.region = 'singapore';
            const error = new Error('Traffic service down');
            fetchSGTraffic.mockRejectedValue(error);

            await getTraffic(req, res, next);

            expect(next).toHaveBeenCalledWith(error);
        });
    });
});
