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

const buildPlayerLink = ({ cloudName, hlsPublicId, playerLink }) => {
    if (playerLink) {
        return playerLink;
    }

    if (!cloudName || !hlsPublicId) {
        return '';
    }

    return `https://player.cloudinary.com/embed/?cloud_name=${encodeURIComponent(cloudName)}&public_id=${encodeURIComponent(hlsPublicId)}&profile=cld-live-streaming`;
};

const getCloudinaryStreamConfig = () => {
    const cloudName = sanitizeValue(process.env.CLOUDINARY_STREAM_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME);
    const streamKey = sanitizeValue(process.env.CLOUDINARY_STREAM_KEY);
    const rtmpUrl = sanitizeValue(process.env.CLOUDINARY_STREAM_RTMP_URL || 'rtmp://live.cloudinary.com/streams');
    const hlsUrl = sanitizeValue(process.env.CLOUDINARY_STREAM_HLS_URL);
    const hlsPublicId = sanitizeValue(process.env.CLOUDINARY_STREAM_HLS_PUBLIC_ID);
    const playerLink = buildPlayerLink({
        cloudName,
        hlsPublicId,
        playerLink: sanitizeValue(process.env.CLOUDINARY_STREAM_PLAYER_URL)
    });

    const playbackReady = Boolean(hlsUrl && hlsPublicId && playerLink);
    const ingestReady = Boolean(rtmpUrl && streamKey);

    return {
        isConfigured: playbackReady && ingestReady,
        missing: {
            cloudName: !cloudName,
            streamKey: !streamKey,
            rtmpUrl: !rtmpUrl,
            hlsUrl: !hlsUrl,
            hlsPublicId: !hlsPublicId,
            playerLink: !playerLink
        },
        playback: {
            cloudName,
            hlsUrl,
            hlsPublicId,
            playerLink
        },
        hostIngest: {
            rtmpUrl,
            streamKey
        }
    };
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
        cloudinaryProvisioned: true,
        streamProvider: 'cloudinary',
        liveKitProvisionedAt: existingStream.liveKitProvisionedAt || requestTime
    });
};

// Legacy route name retained for compatibility, but the provider is now Cloudinary.
const getLiveKitToken = async (req, res) => {
    try {
        let { roomName, isHost, title, description, hostId } = req.body;
        const userId = req.user._id.toString();
        const requestTime = new Date().toISOString();
        const config = getCloudinaryStreamConfig();

        if (!config.isConfigured) {
            console.error('[Cloudinary Stream] Missing stream environment variables:', config.missing);
            return res.status(500).json({
                success: false,
                message: 'Cloudinary streaming configuration is missing on the server.'
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

        res.json({
            success: true,
            data: {
                roomName,
                hostId: isHost ? userId : targetStream?.hostId,
                streamProvider: 'cloudinary',
                playback: config.playback,
                hostIngest: isHost ? config.hostIngest : undefined
            }
        });
    } catch (error) {
        console.error('[Cloudinary Stream] Error building stream access:', error);
        res.status(500).json({ success: false, message: 'Failed to prepare stream access' });
    }
};

module.exports = {
    getLiveKitToken
};
