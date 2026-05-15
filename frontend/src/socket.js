import { io } from 'socket.io-client';
import { SOCKET_URL } from './config';

let socket;
let currentToken;

export const getSocket = (token) => {
  // Re-use the same socket instance for a token, even while reconnecting.
  if (socket && currentToken === token) {
    socket.auth = { token };
    return socket;
  }

  // Disconnect old socket if token changed
  if (socket && currentToken !== token) {
    socket.disconnect();
    socket = null;
  }

  currentToken = token;
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],           // Skip polling for instant connection
    reconnection: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 500,              // Faster first reconnect
    reconnectionDelayMax: 8000,
    randomizationFactor: 0.35,
    timeout: 10000,
    autoConnect: Boolean(token),
    forceNew: false,
    multiplex: true
  });

  // Auto-update auth token on reconnect
  socket.on('reconnect_attempt', () => {
    socket.auth = { token: currentToken };
  });

  return socket;
};

export const updateSocketToken = (newToken) => {
  currentToken = newToken;
  if (socket?.connected) {
    socket.auth = { token: newToken };
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
};

export default getSocket;
