jest.mock('../models/User', () => ({
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
}));

jest.mock('../config/emailService', () => ({
    sendLoginEmail: jest.fn(),
}));

jest.mock('google-auth-library', () => ({
    OAuth2Client: jest.fn(() => ({
        verifyIdToken: jest.fn(),
    })),
}));

jest.mock('jsonwebtoken', () => ({
    sign: jest.fn(),
    verify: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
    register,
    refreshSession,
} = require('../controllers/authController');

function createMockRes() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
    };
}

describe('Auth controller', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns access and refresh tokens when registration succeeds', async () => {
        const save = jest.fn().mockResolvedValue(undefined);
        const getAuthProfile = jest.fn().mockReturnValue({
            _id: 'user-1',
            username: 'zuno',
            email: 'owner@example.com',
        });

        User.findOne.mockResolvedValue(null);
        User.create.mockResolvedValue({
            _id: 'user-1',
            save,
            getAuthProfile,
        });

        jwt.sign
            .mockReturnValueOnce('access-token')
            .mockReturnValueOnce('refresh-token');

        const req = {
            body: {
                username: 'zuno',
                email: 'OWNER@example.com',
                password: 'Secret123!',
                displayName: 'Zuno User',
                language: 'en',
            }
        };
        const res = createMockRes();

        await register(req, res);

        expect(User.findOne).toHaveBeenCalledWith({
            $or: [
                { email: 'owner@example.com' },
                { username: 'zuno' }
            ]
        });
        expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
            email: 'owner@example.com',
            username: 'zuno',
        }));
        expect(save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            message: expect.stringContaining('Welcome to ZUNO!'),
            data: {
                user: {
                    _id: 'user-1',
                    username: 'zuno',
                    email: 'owner@example.com',
                },
                token: 'access-token',
                refreshToken: 'refresh-token',
            }
        }));
    });

    it('requires a refresh token before refreshing a session', async () => {
        const req = { body: {} };
        const res = createMockRes();

        await refreshSession(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: 'Refresh token is required'
        });
    });
});
