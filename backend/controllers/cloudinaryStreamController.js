const {
  activeStreams,
  pruneExpiredStreams,
  isStreamJoinable,
  serializeStream,
} = require('../socket/socket');

const sanitizeValue = (value = '') => String(value || '').replace(/['"]+/g, '').trim();

const buildRoomId = (hostId) => `stream_${hostId}`;

const deriveHlsPublicId = (hlsUrl = '') => {
  const normalizedUrl = sanitizeValue(hlsUrl);
  if (!normalizedUrl) return '';

  const match = normalizedUrl.match(/\/video\/live\/(.+?)\.m3u8(?:\?|$)/i);
  return match?.[1] || '';
};

const buildPlayerUrl = ({ cloudName, hlsPublicId }) => {
  if (!cloudName || !hlsPublicId) return '';

  const params = new URLSearchParams({
    cloud_name: cloudName,
    public_id: hlsPublicId,
    profile: 'cld-live-streaming',
  });

  return `https://player.cloudinary.com/embed/?${params.toString()}`;
};

const getCloudinaryStreamConfig = () => {
  const cloudName = sanitizeValue(process.env.CLOUDINARY_STREAM_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME);
  const streamKey = sanitizeValue(process.env.CLOUDINARY_STREAM_KEY);
  const rtmpUrl = sanitizeValue(process.env.CLOUDINARY_STREAM_RTMP_URL);
  const hlsUrl = sanitizeValue(process.env.CLOUDINARY_STREAM_HLS_URL);
  const hlsPublicId = sanitizeValue(process.env.CLOUDINARY_STREAM_HLS_PUBLIC_ID) || deriveHlsPublicId(hlsUrl);
  const playerUrl = sanitizeValue(process.env.CLOUDINARY_STREAM_PLAYER_URL) || buildPlayerUrl({ cloudName, hlsPublicId });

  const missing = {
    cloudName: !cloudName,
    streamKey: !streamKey,
    rtmpUrl: !rtmpUrl,
    hlsUrl: !hlsUrl,
    hlsPublicId: !hlsPublicId && !playerUrl,
    playerUrl: !playerUrl,
  };

  return {
    isConfigured: Object.values(missing).every((value) => value === false),
    missing,
    cloudName,
    streamKey,
    rtmpUrl,
    hlsUrl,
    hlsPublicId,
    playerUrl,
  };
};

const findAnotherActiveStream = (currentHostId) => Array.from(activeStreams.values()).find((stream) => {
  if (!stream || stream.hostId === currentHostId) {
    return false;
  }

  return isStreamJoinable(stream);
});

const upsertHostedStream = ({ existingStream, user, title, description, requestTime }) => {
  const hostId = user._id.toString();
  const roomId = buildRoomId(hostId);

  activeStreams.set(hostId, {
    ...existingStream,
    id: roomId,
    roomId,
    hostId,
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
    cloudinaryProvisioned: true,
    cloudinaryProvisionedAt: existingStream.cloudinaryProvisionedAt || requestTime,
    streamProvider: 'cloudinary',
  });

  return activeStreams.get(hostId);
};

const buildResponsePayload = ({ stream, config, isHost }) => ({
  roomId: stream.roomId || stream.id,
  hostId: stream.hostId,
  streamProvider: 'cloudinary',
  stream: serializeStream(stream),
  playback: {
    cloudName: config.cloudName,
    playerUrl: config.playerUrl,
    hlsUrl: config.hlsUrl,
    hlsPublicId: config.hlsPublicId,
  },
  ...(isHost
    ? {
        broadcast: {
          streamKey: config.streamKey,
          rtmpUrl: config.rtmpUrl,
          ingestUrl: `${config.rtmpUrl.replace(/\/+$/, '')}/${config.streamKey}`,
        },
      }
    : {}),
});

const getCloudinaryStreamSession = async (req, res) => {
  try {
    const { isHost, title, description, hostId } = req.body || {};
    const currentUserId = req.user._id.toString();
    const requestTime = new Date().toISOString();
    const config = getCloudinaryStreamConfig();

    if (!config.isConfigured) {
      console.error('[Cloudinary Stream] Missing environment variables:', config.missing);
      return res.status(500).json({
        success: false,
        message: 'Cloudinary live streaming configuration is missing on the server.',
      });
    }

    pruneExpiredStreams();

    let targetStream = null;

    if (isHost) {
      const conflictingStream = findAnotherActiveStream(currentUserId);
      if (conflictingStream) {
        return res.status(409).json({
          success: false,
          message: `${conflictingStream.hostDisplayName || conflictingStream.hostUsername || 'Another creator'} is already live. End that stream before starting a new Cloudinary session.`,
        });
      }

      const existingStream = activeStreams.get(currentUserId) || {};
      targetStream = upsertHostedStream({
        existingStream,
        user: req.user,
        title,
        description,
        requestTime,
      });
    } else {
      if (!hostId) {
        return res.status(400).json({
          success: false,
          message: 'hostId is required to join a live stream.',
        });
      }

      targetStream = activeStreams.get(String(hostId));
      if (!isStreamJoinable(targetStream)) {
        return res.status(404).json({
          success: false,
          message: 'Stream not found or has ended.',
        });
      }
    }

    return res.json({
      success: true,
      data: buildResponsePayload({
        stream: targetStream,
        config,
        isHost: Boolean(isHost),
      }),
    });
  } catch (error) {
    console.error('[Cloudinary Stream] Failed to prepare stream session:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to prepare stream access.',
    });
  }
};

module.exports = {
  getCloudinaryStreamConfig,
  getCloudinaryStreamSession,
};
