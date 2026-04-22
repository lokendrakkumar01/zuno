jest.mock('../models/Content', () => ({
    aggregate: jest.fn(),
}));

jest.mock('../models/User', () => ({
    aggregate: jest.fn(),
}));

const Content = require('../models/Content');
const { getFeed } = require('../controllers/feedController');

const createMockRes = () => ({
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
});

describe('Feed controller', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns the paginated feed shape expected by the home screen', async () => {
        Content.aggregate.mockResolvedValue([
            {
                contents: [
                    {
                        _id: 'content-2',
                        createdAt: '2026-01-02T00:00:00.000Z',
                        title: 'Newest',
                        creator: { username: 'alpha' },
                        metrics: { helpfulCount: 4, commentCount: 1, saveCount: 0, shareCount: 0 },
                        viewerState: { isHelpful: false, isSaved: false },
                    },
                    {
                        _id: 'content-1',
                        createdAt: '2026-01-01T00:00:00.000Z',
                        title: 'Older',
                        creator: { username: 'beta' },
                        metrics: { helpfulCount: 1, commentCount: 0, saveCount: 0, shareCount: 0 },
                        viewerState: { isHelpful: true, isSaved: false },
                    },
                ],
            },
        ]);

        const req = {
            query: { mode: 'all', limit: '1' },
            user: { _id: 'viewer-1', blockedUsers: [] },
        };
        const res = createMockRes();
        const next = jest.fn();

        await getFeed(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(Content.aggregate).toHaveBeenCalled();
        expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, max-age=45');

        const payload = res.json.mock.calls[0][0];
        expect(payload.success).toBe(true);
        expect(payload.data.mode).toBe('all');
        expect(payload.data.contents).toHaveLength(1);
        expect(payload.data.contents[0]._id).toBe('content-2');
        expect(payload.data.pagination).toEqual({
            limit: 1,
            hasMore: true,
            nextCursor: expect.any(String),
        });
    });
});
