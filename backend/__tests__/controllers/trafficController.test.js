const { getTraffic } = require('../../controllers/trafficController');
const { fetchSGTraffic, fetchHKTraffic, fetchMYTraffic } = require('../../services/trafficService');

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
        it('should return 400 for completely unknown region', async () => {
            req.params.region = 'mars';

            await getTraffic(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.stringContaining('Unsupported region') })
            );
        });

        it('should return SG traffic for singapore', async () => {
            req.params.region = 'singapore';
            const mockTraffic = [{ Type: 'Accident', Message: 'Accident on PIE' }];
            fetchSGTraffic.mockResolvedValue(mockTraffic);

            await getTraffic(req, res, next);

            expect(fetchSGTraffic).toHaveBeenCalledTimes(1);
            expect(fetchHKTraffic).not.toHaveBeenCalled();
            expect(fetchMYTraffic).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({ region: 'singapore', traffic: mockTraffic });
        });

        it('should return HK traffic for hong-kong', async () => {
            req.params.region = 'hong-kong';
            const mockTraffic = [{ description: 'Road closure', district: 'C&W' }];
            fetchHKTraffic.mockResolvedValue(mockTraffic);

            await getTraffic(req, res, next);

            expect(fetchHKTraffic).toHaveBeenCalledTimes(1);
            expect(fetchSGTraffic).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({ region: 'hong-kong', traffic: mockTraffic });
        });

        it('should return MY traffic for klang-valley', async () => {
            req.params.region = 'klang-valley';
            const mockTraffic = [{ description: 'Roadworks: MRT', source: 'JKR Roadworks' }];
            fetchMYTraffic.mockResolvedValue(mockTraffic);

            await getTraffic(req, res, next);

            expect(fetchMYTraffic).toHaveBeenCalledTimes(1);
            expect(fetchSGTraffic).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({ region: 'klang-valley', traffic: mockTraffic });
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
