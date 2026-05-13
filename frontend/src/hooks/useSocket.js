import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSocket, disconnectSocket } from '../socket';

export const useSocket = (token) => {
  const [connectionError, setConnectionError] = useState('');
  const [connected, setConnected] = useState(false);
  const socket = useMemo(() => (token ? getSocket(token) : null), [token]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleConnect = () => {
      setConnected(true);
      setConnectionError('');
    };
    const handleDisconnect = () => setConnected(false);
    const handleError = (error) => {
      setConnectionError(error?.message || 'Realtime connection failed. Retrying...');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleError);
    socket.on('socket-error', handleError);
    if (!socket.connected) socket.connect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleError);
      socket.off('socket-error', handleError);
    };
  }, [socket]);

  const emitWithAck = useCallback((event, payload, timeout = 8000) => new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Socket is not connected'));
      return;
    }
    socket.timeout(timeout).emit(event, payload, (error, response) => {
      if (error) reject(error);
      else if (response?.success === false) reject(new Error(response.message || 'Socket event failed'));
      else resolve(response);
    });
  }), [socket]);

  return { socket, connected, connectionError, emitWithAck, disconnectSocket };
};

export default useSocket;
