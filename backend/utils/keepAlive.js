const https = require('https');

const buildPingTarget = () => {
    const explicitUrl = process.env.BACKEND_URL;
    const externalUrl = process.env.RENDER_EXTERNAL_URL;
    const baseUrl = explicitUrl || externalUrl;

    if (!baseUrl) {
        return '';
    }

    try {
        const target = new URL(baseUrl);
        target.pathname = '/api/ping';
        target.search = '';
        return target.toString();
    } catch {
        return '';
    }
};

const pingUrl = (url) => new Promise((resolve) => {
    try {
        https.get(url, (res) => {
            if (res.statusCode === 200) {
                console.log(`[KeepAlive] Ping successful at ${new Date().toISOString()}`);
            } else {
                console.log(`[KeepAlive] Ping failed with status: ${res.statusCode}`);
            }
            res.resume();
            resolve();
        }).on('error', (err) => {
            console.error('[KeepAlive] Error during ping:', err.message);
            resolve();
        });
    } catch (error) {
        console.error('[KeepAlive] Failed to execute ping:', error.message);
        resolve();
    }
});

// Keep-alive job to prevent Render's free tier from spinning down
const keepAlive = () => {
    const url = buildPingTarget();
    
    if (!url) {
        console.log('[KeepAlive] Skipping - BACKEND_URL/RENDER_EXTERNAL_URL not available.');
        return;
    }

    console.log(`[KeepAlive] Starting ping cron job for ${url}`);
    pingUrl(url);

    // Ping every 14 minutes. Render spins down after 15 minutes of inactivity.
    // 14 * 60 * 1000 = 840000 ms
    setInterval(() => {
        pingUrl(url);
    }, 14 * 60 * 1000); // 14 mins
};

module.exports = keepAlive;
