const errorHandler = require('../../middleware/errorHandler');

describe('middleware/errorHandler', () => {
    let req, res, next;

    beforeEach(() => {
        req = { method: 'GET', path: '/test' };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        next = jest.fn();
    });

    it('should return 500 by default when no status on error', () => {
        const err = new Error('Something broke');

        errorHandler(err, req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Something broke' });
    });

    it('should use error.status when provided', () => {
        const err = new Error('Not Found');
        err.status = 404;

        errorHandler(err, req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Not Found' });
    });

    it('should return generic message when error has no message', () => {
        const err = {};

        errorHandler(err, req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
});
