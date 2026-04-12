jest.mock('../models/Notification', () => ({
      find: jest.fn(),
      countDocuments: jest.fn(),
      updateMany: jest.fn()
}));

jest.mock('../socket/socket', () => ({
      getReceiverSocketId: jest.fn(),
      io: {
            to: jest.fn(() => ({ emit: jest.fn() }))
      }
}));

const Notification = require('../models/Notification');
const {
      getMyNotifications,
      markAllNotificationsRead
} = require('../controllers/notificationController');

function createMockRes() {
      return {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            setHeader: jest.fn()
      };
}

describe('Notification controller', () => {
      beforeEach(() => {
            jest.clearAllMocks();
      });

      it('returns mapped notifications with unread count', async () => {
            const lean = jest.fn().mockResolvedValue([
                  {
                        _id: 'notif-1',
                        type: 'follow',
                        title: 'New follower',
                        body: 'A creator followed you.',
                        entityType: 'user',
                        entityId: 'user-2',
                        metadata: { username: 'creator' },
                        isRead: false,
                        createdAt: '2026-04-12T00:00:00.000Z',
                        actor: {
                              _id: 'user-2',
                              username: 'creator',
                              displayName: 'Creator',
                              avatar: '/avatar.png'
                        }
                  }
            ]);

            const limit = jest.fn().mockReturnValue({ lean });
            const skip = jest.fn().mockReturnValue({ limit });
            const sort = jest.fn().mockReturnValue({ skip });
            const populate = jest.fn().mockReturnValue({ sort });

            Notification.find.mockReturnValue({ populate });
            Notification.countDocuments.mockResolvedValue(1);

            const req = {
                  user: { id: 'user-1' },
                  query: {}
            };
            const res = createMockRes();

            await getMyNotifications(req, res);

            expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                  success: true,
                  data: expect.objectContaining({
                        unreadCount: 1,
                        notifications: [
                              expect.objectContaining({
                                    _id: 'notif-1',
                                    type: 'follow',
                                    actionUrl: '/u/creator'
                              })
                        ]
                  })
            }));
      });

      it('marks all notifications as read for the current user', async () => {
            Notification.updateMany.mockResolvedValue({ acknowledged: true, modifiedCount: 2 });

            const req = { user: { id: 'user-1' } };
            const res = createMockRes();

            await markAllNotificationsRead(req, res);

            expect(Notification.updateMany).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({
                  success: true,
                  message: 'All notifications marked as read'
            });
      });
});
