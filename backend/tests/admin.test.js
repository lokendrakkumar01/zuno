jest.mock('../models/User', () => ({
    findById: jest.fn(),
}));

jest.mock('../models/Content', () => ({
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
}));

jest.mock('../models/AdminConfig', () => ({
    find: jest.fn(),
}));

jest.mock('../models/Interaction', () => ({
    find: jest.fn(),
    countDocuments: jest.fn(),
}));

jest.mock('../config/emailService', () => ({
    sendCustomAdminEmail: jest.fn(),
}));

jest.mock('../socket/socket', () => ({
    io: { emit: jest.fn() },
}));

const User = require('../models/User');
const Interaction = require('../models/Interaction');
const adminController = require('../controllers/adminController');

const { handleVerification, getReports, _private } = adminController;

function createMockRes() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
    };
}

describe('Admin controller regressions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('normalizes report payloads for admin clients', () => {
        const normalized = _private.mapReportForAdmin({
            user: { username: 'reporter1' },
            reportReason: 'spam',
            reportNote: 'Repeated scam links',
            content: { _id: 'content123', creator: { username: 'creator1' } },
        });

        expect(normalized.reporter).toEqual({ username: 'reporter1' });
        expect(normalized.reason).toBe('spam');
        expect(normalized.details).toBe('Repeated scam links');
        expect(normalized.targetModel).toBe('content');
        expect(normalized.targetId).toBe('content123');
    });

    it('rejects invalid verification actions before mutating a user', async () => {
        const save = jest.fn();
        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
            _id: 'user123',
            verificationRequest: { status: 'pending', reason: 'Public figure' },
            save,
            }),
        });

        const req = {
            params: { id: 'user123' },
            body: { action: 'archive' },
        };
        const res = createMockRes();

        await handleVerification(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: 'Invalid verification action'
        });
        expect(save).not.toHaveBeenCalled();
    });

    it('returns normalized report fields from getReports', async () => {
        const reports = [{
            _id: 'report1',
            user: { username: 'reporter1' },
            reportReason: 'harmful',
            reportNote: 'Unsafe advice',
            content: { _id: 'content42', creator: { username: 'mentor1' } },
        }];

        const queryChain = {
            populate: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(reports),
        };

        Interaction.find.mockReturnValue(queryChain);
        Interaction.countDocuments.mockResolvedValue(1);

        const req = { query: {} };
        const res = createMockRes();

        await getReports(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            data: expect.objectContaining({
                reports: [expect.objectContaining({
                    reporter: { username: 'reporter1' },
                    reason: 'harmful',
                    details: 'Unsafe advice',
                    targetModel: 'content',
                    targetId: 'content42',
                })]
            })
        }));
    });
});
