const { AccessToken } = require('livekit-server-sdk');
const { activeStreams } = require('../socket/socket'); // We still use this to track stream metadata

const normalizeLiveKitUrl = (value = '') => {
    const trimmed = value.replace(/['"]+/g, '').trim().replace(/\/+$/, '');

    if (!trimmed) {
        return '';
    }

    if (trimmed.startsWith('https://')) {
        return `wss://${trimmed.slice('https://'.length)}`;
    }

    if (trimmed.startsWith('http://')) {
        return `ws://${trimmed.slice('http://'.length)}`;
    }

    return trimmed;
};

const sanitizeRoomName = (value, fallback) => {
    const normalized = String(value || fallback || '')
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');

    return normalized || fallback;
};

// Generate an access token for LiveKit
// Used by both host (creating stream) and viewers (joining stream)
const getLiveKitToken = async (req, res) => {
    try {
        let { roomName, isHost, title } = req.body;
        const userId = req.user._id.toString();
        const username = req.user.username;
        const displayName = req.user.displayName || username;
        const avatar = req.user.avatar || '';

        // If the API keys aren't set in environment, throw an error
        let apiKey = process.env.LIVEKIT_API_KEY?.replace(/['"]+/g, '');
        let apiSecret = process.env.LIVEKIT_API_SECRET?.replace(/['"]+/g, '');
        let wsUrl = normalizeLiveKitUrl(process.env.LIVEKIT_URL);

        if (!apiKey || !apiSecret || !wsUrl) {
            console.error('[LiveKit] Missing API keys or URL in environment');
            return res.status(500).json({ success: false, message: 'LiveKit configuration missing on server.' });
        }

        // Host must define their own room Name
        const fallbackRoomName = `stream_${userId}`;
        if (isHost && !roomName) {
            roomName = fallbackRoomName;
        }
        
        if (!roomName) {
             return res.status(400).json({ success: false, message: 'roomName is required for viewers.' });
        }

        roomName = sanitizeRoomName(roomName, fallbackRoomName);

        // Generate the token
        const participantName = displayName;
        const at = new AccessToken(apiKey, apiSecret, {
            identity: userId,
            name: participantName,
            ttl: '6h'
        });

        at.metadata = JSON.stringify({
            userId,
            username,
            displayName,
            avatar,
            role: isHost ? 'host' : 'viewer'
        });

        // Add Grants
        at.addGrant({
            roomJoin: true,
            room: roomName,
            canPublish: isHost ? true : false,
            canPublishData: true,
            canSubscribe: true,
            roomCreate: !!isHost,
            roomAdmin: !!isHost
        });

        const token = await at.toJwt();

        // If host, pre-register stream metadata. Socket lifecycle will finalize live presence.
        if (isHost) {
            const existingStream = activeStreams.get(userId) || {};

            activeStreams.set(userId, {
                ...existingStream,
                id: roomName,
                roomId: roomName,
                hostId: userId,
                hostUsername: username,
                hostAvatar: avatar,
                hostDisplayName: displayName,
                title: title || `${displayName}'s Live Stream`,
                description: req.body.description || existingStream.description || '',
                startedAt: existingStream.startedAt || new Date().toISOString(),
                viewerCount: existingStream.viewers ? existingStream.viewers.size : 0,
                hostSocketId: existingStream.hostSocketId || null,
                viewers: existingStream.viewers || new Set(),
                bannedViewers: existingStream.bannedViewers || new Set(),
                slowMode: existingStream.slowMode || false,
                pinnedComment: existingStream.pinnedComment || null,
                liveKitProvisioned: true
            });
        }

        res.json({
            success: true,
            data: {
                token,
                roomName,
                wsUrl // The frontend needs this URL to connect
            }
        });
    } catch (error) {
        console.error('[LiveKit] Error generating token:', error);
        res.status(500).json({ success: false, message: 'Failed to generate access token' });
    }
};

module.exports = {
    getLiveKitToken
};
