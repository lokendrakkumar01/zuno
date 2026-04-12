export const DEFAULT_REQUEST_TIMEOUT_MS = 30000;

/**
 * Fetch with timeout. If `options.signal` is passed, aborting that signal
 * also aborts the request (in addition to the timeout).
 */
export const fetchWithTimeout = async (url, options = {}, timeout = DEFAULT_REQUEST_TIMEOUT_MS) => {
      const { signal: externalSignal, ...rest } = options;
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);

      const onExternalAbort = () => controller.abort();
      if (externalSignal) {
            if (externalSignal.aborted) {
                  clearTimeout(id);
                  const err = new Error('Aborted');
                  err.name = 'AbortError';
                  throw err;
            }
            externalSignal.addEventListener('abort', onExternalAbort, { once: true });
      }

      try {
            const response = await fetch(url, {
                  ...rest,
                  signal: controller.signal
            });
            clearTimeout(id);
            if (externalSignal) {
                  externalSignal.removeEventListener('abort', onExternalAbort);
            }
            return response;
      } catch (error) {
            clearTimeout(id);
            if (externalSignal) {
                  externalSignal.removeEventListener('abort', onExternalAbort);
            }
            throw error;
      }
};
