const Notification = require('../models/Notification');
const { getReceiverSocketId, io } = require('../socket/socket');

const ACTOR_SELECT = 'username displayName avatar';

const buildActorPayload = (actor) => {
      if (!actor) return null;

      return {
            _id: actor._id,
            id: actor._id,
            username: actor.username,
            displayName: actor.displayName || actor.username,
            avatar: actor.avatar || ''
      };
};

const buildActionUrl = (notification) => {
      const entityId = notification.entityId || notification.metadata?.contentId || notification.metadata?.username || '';

      switch (notification.type) {
            case 'comment':
            case 'helpful':
                  return entityId ? `/content/${entityId}` : '/';
            case 'follow_request':
            case 'follow_request_accepted':
            case 'follow_request_rejected':
            case 'follow':
            case 'unfollow':
                  return notification.metadata?.username ? `/u/${notification.metadata.username}` : '/profile';
            default:
                  return '/profile';
      }
};

const mapNotificationForClient = (notification) => ({
      _id: notification._id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      entityType: notification.entityType,
      entityId: notification.entityId,
      metadata: notification.metadata || {},
      isRead: Boolean(notification.isRead),
      readAt: notification.readAt || null,
      createdAt: notification.createdAt,
      actor: buildActorPayload(notification.actor),
      actionUrl: buildActionUrl(notification)
});

const createNotification = async ({
      recipientId,
      actor = null,
      type,
      title,
      body,
      entityType = 'user',
      entityId = '',
      metadata = {}
}) => {
      const normalizedRecipientId = recipientId?.toString?.();
      const normalizedActorId = actor?._id?.toString?.() || actor?.id?.toString?.() || actor?.toString?.() || null;

      if (!normalizedRecipientId || !type || !title || !body) {
            return null;
      }

      if (normalizedRecipientId === normalizedActorId && type !== 'follow_request_rejected') {
            return null;
      }

      const notification = await Notification.create({
            recipient: normalizedRecipientId,
            actor: normalizedActorId,
            type,
            title,
            body,
            entityType,
            entityId: entityId?.toString?.() || entityId || '',
            metadata
      });

      const payload = mapNotificationForClient({
            ...notification.toObject(),
            actor: actor && actor.username ? actor : null
      });

      const receiverSocketId = getReceiverSocketId(normalizedRecipientId);
      if (receiverSocketId) {
            io.to(receiverSocketId).emit('notification:new', payload);
      }

      return payload;
};

const markNotificationsRead = async (recipientId, notificationIds = []) => {
      const now = new Date();
      const query = {
            recipient: recipientId
      };

      if (Array.isArray(notificationIds) && notificationIds.length > 0) {
            query._id = { $in: notificationIds };
      }

      await Notification.updateMany(query, {
            $set: {
                  isRead: true,
                  readAt: now
            }
      });

      const receiverSocketId = getReceiverSocketId(recipientId?.toString?.());
      if (receiverSocketId) {
            io.to(receiverSocketId).emit('notification:read', {
                  ids: notificationIds,
                  readAt: now.toISOString()
            });
      }
};

module.exports = {
      ACTOR_SELECT,
      createNotification,
      mapNotificationForClient,
      markNotificationsRead
};
