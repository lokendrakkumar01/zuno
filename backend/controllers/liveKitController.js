const { AccessToken } = require('livekit-server-sdk');
const { activeStreams, pruneExpiredStreams, isStreamJoinable } = require('../socket/socket');

const sanitizeValue = (value = '') => String(value || '').replace(/['"]+/g, '').trim();

const sanitizeRoomName = (value, fallback) => {
    const normalized = String(value || fallback || '')
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');

    return normalized || fallback;
};

const getLiveKitConfig = () => {
    const wsUrl = sanitizeValue(process.env.LIVEKIT_URL);
    const apiKey = sanitizeValue(process.env.LIVEKIT_API_KEY);
    const apiSecret = sanitizeValue(process.env.LIVEKIT_API_SECRET);

    return {
        isConfigured: Boolean(wsUrl && apiKey && apiSecret),
        missing: {
            wsUrl: !wsUrl,
            apiKey: !apiKey,
            apiSecret: !apiSecret,
        },
        wsUrl,
        apiKey,
        apiSecret,
    };
};

const buildParticipantIdentity = ({ userId, isHost }) => `${isHost ? 'host' : 'viewer'}_${userId}`;

const buildAccessToken = ({ config, roomName, user, isHost }) => {
    const token = new AccessToken(config.apiKey, config.apiSecret, {
        identity: buildParticipantIdentity({ userId: user._id.toString(), isHost }),
        name: user.displayName || user.username,
        ttl: '2h',
    });

    token.addGrant({
        room: roomName,
        roomJoin: true,
        canPublish: Boolean(isHost),
        canSubscribe: true,
        canPublishData: true,
    });

    return token.toJwt();
};

const upsertHostedStream = ({ existingStream, user, roomName, title, description, requestTime }) => {
    activeStreams.set(user._id.toString(), {
        ...existingStream,
        id: roomName,
        roomId: roomName,
        hostId: user._id.toString(),
        hostUsername: user.username,
        hostAvatar: user.avatar || '',
        hostDisplayName: user.displayName || user.username,
        title: title || `${user.displayName || user.username}'s Live Stream`,
        description: description || existingStream.description || '',
        startedAt: existingStream.startedAt || requestTime,
        updatedAt: requestTime,
        viewerCount: existingStream.viewers ? existingStream.viewers.size : 0,
        hostSocketId: existingStream.hostSocketId || null,
        viewers: existingStream.viewers || new Set(),
        viewerSockets: existingStream.viewerSockets || new Map(),
        bannedViewers: existingStream.bannedViewers || new Set(),
        slowMode: existingStream.slowMode || false,
        pinnedComment: existingStream.pinnedComment || null,
        liveKitProvisioned: true,
        cloudinaryProvisioned: false,
        streamProvider: 'livekit',
        liveKitProvisionedAt: existingStream.liveKitProvisionedAt || requestTime,
    });
};

const getLiveKitToken = async (req, res) => {
    try {
        let { roomName, isHost, title, description, hostId } = req.body;
        const userId = req.user._id.toString();
        const requestTime = new Date().toISOString();
        const config = getLiveKitConfig();

        if (!config.isConfigured) {
            console.error('[LiveKit] Missing environment variables:', config.missing);
            return res.status(500).json({
                success: false,
                message: 'LiveKit streaming configuration is missing on the server.'
            });
        }

        const fallbackRoomName = `stream_${userId}`;
        if (isHost && !roomName) {
            roomName = fallbackRoomName;
        }

        if (!roomName && !hostId) {
            return res.status(400).json({ success: false, message: 'roomName or hostId is required for viewers.' });
        }

        pruneExpiredStreams();

        let targetStream = null;

        if (!isHost) {
            targetStream = Array.from(activeStreams.values()).find((stream) => {
                if (!stream) return false;
                const candidateRoomId = stream.roomId || stream.id;
                return (
                    candidateRoomId === roomName
                    || stream.id === roomName
                    || stream.hostId === hostId
                );
            });

            if (!targetStream || !isStreamJoinable(targetStream)) {
                return res.status(404).json({ success: false, message: 'Stream not found or has ended.' });
            }

            roomName = targetStream.roomId || targetStream.id || roomName;
        } else {
            roomName = sanitizeRoomName(roomName, fallbackRoomName);
        }

        if (isHost) {
            const existingStream = activeStreams.get(userId) || {};
            upsertHostedStream({
                existingStream,
                user: req.user,
                roomName,
                title,
                description,
                requestTime
            });
        }

        const jwt = await buildAccessToken({
            config,
            roomName,
            user: req.user,
            isHost: Boolean(isHost),
        });

        res.json({
            success: true,
            data: {
                token: jwt,
                wsUrl: config.wsUrl,
                roomName,
                hostId: isHost ? userId : targetStream?.hostId,
                streamProvider: 'livekit',
            }
        });
    } catch (error) {
        console.error('[LiveKit] Error building stream access:', error);
        res.status(500).json({ success: false, message: 'Failed to prepare stream access' });
    }
};

module.exports = {
    getLiveKitToken
};
