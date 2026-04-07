const https = require('https');

// Keep-alive job to prevent Render's free tier from spinning down
const keepAlive = () => {
    // Only run if BACKEND_URL is provided (set this in Render env variables)
    // E.g., https://your-render-backend-url.onrender.com
    const url = process.env.BACKEND_URL;
    
    if (!url) {
        console.log('[KeepAlive] Skipping - BACKEND_URL not set in environment.');
        return;
    }

    console.log(`[KeepAlive] Starting ping cron job for ${url}`);

    // Ping every 14 minutes. Render spins down after 15 minutes of inactivity.
    // 14 * 60 * 1000 = 840000 ms
    setInterval(() => {
        try {
            https.get(url, (res) => {
                if (res.statusCode === 200) {
                    console.log(`[KeepAlive] Ping successful at ${new Date().toISOString()}`);
                } else {
                    console.log(`[KeepAlive] Ping failed with status: ${res.statusCode}`);
                }
            }).on('error', (err) => {
                console.error('[KeepAlive] Error during ping:', err.message);
            });
        } catch (error) {
            console.error('[KeepAlive] Failed to execute cron:', error.message);
        }
    }, 14 * 60 * 1000); // 14 mins
};

module.exports = keepAlive;
