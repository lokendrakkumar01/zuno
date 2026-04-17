jest.mock('../models/Message', () => ({
    Message: {
        findById: jest.fn(),
        updateMany: jest.fn(),
    },
    Conversation: {
        findById: jest.fn(),
        findByIdAndUpdate: jest.fn(),
        findOneAndUpdate: jest.fn(),
    },
}));

jest.mock('../models/User', () => ({
    findById: jest.fn(),
}));

jest.mock('../socket/socket', () => ({
    getReceiverSocketId: jest.fn(),
    io: {
        to: jest.fn(),
    },
}));

const { Message, Conversation } = require('../models/Message');
const { io } = require('../socket/socket');
const { clearChat, reactToMessage } = require('../controllers/messageController');

const createMockRes = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
});

const createLeanQuery = (value) => ({
    select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(value),
    }),
});

describe('Message Endpoints', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('clears a DM only for the current user instead of deleting the shared thread', async () => {
        Conversation.findById.mockReturnValue(createLeanQuery(null));

        const req = {
            params: { userId: 'peer-1' },
            user: { id: 'viewer-1' },
        };
        const res = createMockRes();

        await clearChat(req, res);

        expect(Message.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                $or: [
                    { sender: 'viewer-1', receiver: 'peer-1' },
                    { sender: 'peer-1', receiver: 'viewer-1' },
                ],
                deletedBy: { $ne: 'viewer-1' },
            }),
            { $addToSet: { deletedBy: 'viewer-1' } }
        );
        expect(Conversation.findOneAndUpdate).toHaveBeenCalledWith(
            {
                participants: { $all: ['viewer-1', 'peer-1'] },
                isGroup: false,
            },
            { $set: { 'unreadCount.viewer-1': 0 } }
        );
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            message: 'Chat cleared successfully',
        });
    });

    it('broadcasts group reactions with the conversation id for all participants', async () => {
        const emit = jest.fn();
        io.to.mockReturnValue({ emit });

        const messageDoc = {
            _id: 'message-1',
            sender: 'sender-1',
            receiver: null,
            conversationId: 'group-1',
            reactions: [],
            save: jest.fn().mockResolvedValue(undefined),
            populate: jest.fn().mockResolvedValue(undefined),
        };

        Message.findById.mockResolvedValue(messageDoc);
        Conversation.findById.mockReturnValue(createLeanQuery({
            participants: ['viewer-1', 'sender-1', 'member-2'],
        }));

        const req = {
            params: { messageId: 'message-1' },
            body: { emoji: '🔥' },
            user: { id: 'viewer-1' },
        };
        const res = createMockRes();

        await reactToMessage(req, res);

        expect(io.to).toHaveBeenCalledWith('viewer-1');
        expect(io.to).toHaveBeenCalledWith('sender-1');
        expect(io.to).toHaveBeenCalledWith('member-2');
        expect(emit).toHaveBeenCalledWith('messageReaction', {
            messageId: 'message-1',
            reactions: [{ emoji: '🔥', user: 'viewer-1' }],
            conversationId: 'group-1',
        });
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            message: 'Reaction updated',
        }));
    });
});
