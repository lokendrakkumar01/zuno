export const DEFAULT_REQUEST_TIMEOUT_MS = 30000;

export const fetchWithTimeout = async (url, options = {}, timeout = DEFAULT_REQUEST_TIMEOUT_MS) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);

      try {
            const response = await fetch(url, {
                  ...options,
                  signal: controller.signal
            });
            clearTimeout(id);
            return response;
      } catch (error) {
            clearTimeout(id);
            throw error;
      }
};
