# Render Environment Variables

## Backend service

Required:

- `MONGODB_URI`
- `JWT_SECRET`
- `CLIENT_URL`
- `ADMIN_URL`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_STREAM_CLOUD_NAME`
- `CLOUDINARY_STREAM_KEY`
- `CLOUDINARY_STREAM_RTMP_URL`
- `CLOUDINARY_STREAM_HLS_URL`

Optional:

- `CORS_ORIGINS`
- `BACKEND_URL` (optional override for self-ping keep-alive; Render also provides `RENDER_EXTERNAL_URL`)
- `CLOUDINARY_STREAM_HLS_PUBLIC_ID`
- `CLOUDINARY_STREAM_PLAYER_URL`
- `GOOGLE_CLIENT_ID`
- `EMAIL_USER`
- `EMAIL_PASS`

Cloudinary live note:

- `CLOUDINARY_STREAM_RTMP_URL` is the ingest URL, not the HLS playback URL.
- `CLOUDINARY_STREAM_HLS_URL` should be the `.m3u8` playback URL from your Cloudinary live stream.
- Cloudinary idle timeout is configured in the Cloudinary stream/channel settings, not in Render env vars.

## Frontend service

Required:

- `VITE_API_BASE_URL`

Optional:

- `VITE_API_URL`
- `VITE_APP_URL`
- `VITE_STREAM_POLL_INTERVAL_MS`
- `VITE_GOOGLE_CLIENT_ID`

## Admin panel

Required:

- `VITE_API_BASE_URL`

Optional:

- `VITE_API_URL`
