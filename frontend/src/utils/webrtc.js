export const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];

export const createPeerConnection = ({ onIceCandidate, onTrack, onConnectionFailed } = {}) => {
  const peer = new RTCPeerConnection({ iceServers });

  peer.onicecandidate = (event) => {
    if (event.candidate && onIceCandidate) onIceCandidate(event.candidate);
  };

  peer.ontrack = (event) => {
    if (onTrack) onTrack(event.streams[0]);
  };

  peer.oniceconnectionstatechange = async () => {
    try {
      if (['failed', 'disconnected'].includes(peer.iceConnectionState)) {
        if (onConnectionFailed) onConnectionFailed();
        if (peer.restartIce) peer.restartIce();
      }
    } catch (error) {
      console.error('ICE restart failed', error);
    }
  };

  return peer;
};

export const getLocalStream = async (video = true) => {
  try {
    return navigator.mediaDevices.getUserMedia({ audio: true, video });
  } catch (error) {
    throw new Error(error.message || 'Camera or microphone permission denied');
  }
};

export const stopStream = (stream) => {
  stream?.getTracks?.().forEach((track) => track.stop());
};

export const closePeer = (peer) => {
  try {
    peer?.getSenders?.().forEach((sender) => sender.track?.stop());
    peer?.close?.();
  } catch (error) {
    console.error('Peer cleanup failed', error);
  }
};
