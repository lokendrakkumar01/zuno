/**
 * Keep-Alive utility for Render free-tier backend.
 * Pings the server every 10 minutes to prevent it from sleeping.
 * Only runs when the user is on a live domain (not localhost).
 */

import { API_URL } from '../config';

let keepAliveInterval = null;

const ping = async () => {
      try {
            const res = await fetch(`${API_URL}/ping`, {
                  method: 'GET',
                  cache: 'no-store',
                  signal: AbortSignal.timeout(10000)
            });
            if (res.ok) {
                  console.debug('[KeepAlive] Server ping OK');
            }
      } catch {
            // Silent fail — it's just a ping
      }
};

export const startKeepAlive = () => {
      // Only run on deployed domains, not localhost
      if (typeof window === 'undefined') return;
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') return;

      stopKeepAlive(); // Clear any existing interval

      // Ping immediately on start (to wake server ASAP)
      ping();

      // Then ping every 10 minutes (600,000 ms) — Render sleeps after 15 min
      keepAliveInterval = setInterval(ping, 10 * 60 * 1000);

      console.debug('[KeepAlive] Started — pinging every 10 minutes');
};

export const stopKeepAlive = () => {
      if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
      }
};
