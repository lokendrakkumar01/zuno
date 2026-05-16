/**
 * frontend/src/socket.js — FIX: PROBLEM 3
 *
 * Changes:
 *  - transports: ['websocket'] only — eliminates HTTP polling round-trip on connect
 *  - Sensible reconnection config with exponential backoff
 *  - Auth token injected into every reconnect attempt automatically
 *  - Token-change detection: disconnect old socket cleanly, create new one
 */

import { io } from 'socket.io-client';
import { SOCKET_URL } from './config';

let socket = null;
let currentToken = null;

/**
 * Returns the singleton socket, creating it if needed.
 * Safe to call on every render — returns same instance while token is unchanged.
 */
export const getSocket = (token) => {
  // Same token → return existing socket (may be reconnecting — that's fine)
  if (socket && currentToken === token) {
    socket.auth = { token };
    return socket;
  }

  // Token changed (e.g. refresh) → tear down old connection
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  currentToken = token;

  // FIX PROBLEM 3: websocket-only transport = no polling handshake delay
  socket = io(SOCKET_URL, {
    auth:       { token },
    transports: ['websocket'],     // skip XHR polling entirely

    // FIX PROBLEM 3: automatic reconnection with backoff
    reconnection:         true,
    reconnectionAttempts: 20,
    reconnectionDelay:    500,     // first retry after 500 ms
    reconnectionDelayMax: 10_000,  // cap at 10 s
    randomizationFactor:  0.3,

    timeout:     12_000,  // connection timeout
    autoConnect: Boolean(token),
    forceNew:    false,
    multiplex:   true,
  });

  // FIX PROBLEM 3: refresh auth token on every reconnect attempt
  socket.on('reconnect_attempt', () => {
    socket.auth = { token: currentToken };
  });

  return socket;
};

/** Update the token used for reconnects (call after silent token refresh) */
export const updateSocketToken = (newToken) => {
  currentToken = newToken;
  if (socket) socket.auth = { token: newToken };
};

/** Hard disconnect + teardown — call on logout */
export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
};

export default getSocket;
