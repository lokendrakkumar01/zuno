jest.mock('../models/User', () => ({
    findOne: jest.fn(),
}));

jest.mock('../socket/socket', () => ({
    getReceiverSocketId: jest.fn(),
    io: {
        to: jest.fn(() => ({ emit: jest.fn() })),
    },
}));

jest.mock('../config/emailService', () => ({
    sendProfileUpdateEmail: jest.fn(),
}));

const User = require('../models/User');
const { getUserProfile } = require('../controllers/userController');

function createMockRes() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
    };
}

describe('User profile controller', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns the authenticated profile shape for the owner', async () => {
        User.findOne.mockReturnValue({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue({
                    _id: 'user-1',
                    username: 'zuno',
                    displayName: 'Zuno User',
                    avatar: '/avatar.png',
                    bio: 'Hello',
                    role: 'admin',
                    interests: ['learning'],
                    isVerified: true,
                    verificationRequest: { status: 'approved', requestedAt: '2026-01-01T00:00:00.000Z' },
                    followers: ['a', 'b'],
                    following: ['c'],
                    profileSong: { name: 'Focus' },
                    stats: { contentCount: 3 },
                    createdAt: '2026-01-01T00:00:00.000Z',
                    email: 'owner@example.com',
                    preferredFeedMode: 'calm',
                    focusModeEnabled: true,
                    dailyUsageLimit: 45,
                    language: 'en',
                    notificationSettings: { pushNotifications: true },
                    blockedUsers: ['blocked-1'],
                    preferredContentTypes: ['post'],
                    isPrivate: true,
                    profileVisibility: 'private'
                }),
            }),
        });

        const req = {
            params: { username: 'zuno' },
            user: { _id: 'user-1' },
        };
        const res = createMockRes();

        await getUserProfile(req, res);

        expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: {
                user: expect.objectContaining({
                    username: 'zuno',
                    email: 'owner@example.com',
                    preferredFeedMode: 'calm',
                    blockedUsers: ['blocked-1'],
                    isPrivate: true,
                }),
            },
        });
    });

    it('returns the public profile shape for visitors', async () => {
        User.findOne.mockReturnValue({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue({
                    _id: 'user-2',
                    username: 'visitor',
                    displayName: 'Visitor',
                    avatar: '',
                    bio: '',
                    role: 'user',
                    interests: [],
                    isVerified: false,
                    verificationRequest: null,
                    followers: [],
                    following: [],
                    profileSong: null,
                    stats: {},
                    createdAt: '2026-01-01T00:00:00.000Z',
                    email: 'hidden@example.com',
                    preferredFeedMode: 'learning',
                    focusModeEnabled: false,
                    dailyUsageLimit: 0,
                    language: 'both',
                    notificationSettings: {},
                    blockedUsers: [],
                    preferredContentTypes: [],
                    isPrivate: false,
                    profileVisibility: 'community'
                }),
            }),
        });

        const req = {
            params: { username: 'visitor' },
            user: { _id: 'another-user' },
        };
        const res = createMockRes();

        await getUserProfile(req, res);

        expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=60');
        const payload = res.json.mock.calls[0][0];
        expect(payload.success).toBe(true);
        expect(payload.data.user.username).toBe('visitor');
        expect(payload.data.user.email).toBeUndefined();
        expect(payload.data.user.blockedUsers).toBeUndefined();
    });
});
