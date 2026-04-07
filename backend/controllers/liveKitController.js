const { AccessToken } = require('livekit-server-sdk');
const { activeStreams } = require('../socket/socket'); // We still use this to track stream metadata

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
        let wsUrl = process.env.LIVEKIT_URL?.replace(/['"]+/g, '');

        if (!apiKey || !apiSecret || !wsUrl) {
            console.error('[LiveKit] Missing API keys or URL in environment');
            return res.status(500).json({ success: false, message: 'LiveKit configuration missing on server.' });
        }

        // Host must define their own room Name
        if (isHost && !roomName) {
            roomName = `stream_${userId}`;
        }
        
        if (!roomName) {
             return res.status(400).json({ success: false, message: 'roomName is required for viewers.' });
        }

        // Generate the token
        const participantName = displayName;
        const at = new AccessToken(apiKey, apiSecret, {
            identity: userId,
            name: participantName,
        });

        // Add Grants
        at.addGrant({
            roomJoin: true,
            room: roomName,
            canPublish: isHost ? true : false,
            canPublishData: true,
            canSubscribe: true,
        });

        const token = await at.toJwt();

        // If host, update the activeStreams store
        if (isHost) {
            // End any existing stream for this user first
            if (activeStreams.has(userId)) {
                activeStreams.delete(userId);
            }
            
            activeStreams.set(userId, {
                id: roomName,
                hostId: userId,
                hostUsername: username,
                hostAvatar: avatar,
                hostDisplayName: displayName,
                title: title || `${displayName}'s Live Stream`,
                description: '',
                startedAt: new Date().toISOString(),
                viewerCount: 0,
                hostSocketId: 'livekit_managed' // flag to indicate it's a livekit stream
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
