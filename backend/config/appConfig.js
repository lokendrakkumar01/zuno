const DEFAULT_ALLOWED_ORIGINS = [
  'https://zunoworld.tech',
  'https://www.zunoworld.tech',
  'https://zuno-frontend.onrender.com',
  'https://zuno-admin.onrender.com',
  'http://localhost:3000',
  'https://localhost:3000',
  'http://localhost:3001',
  'https://localhost:3001',
  'http://localhost:4173',
  'https://localhost:4173',
  'http://localhost:4174',
  'https://localhost:4174',
  'http://localhost:5173',
  'https://localhost:5173',
  'http://localhost:5174',
  'https://localhost:5174'
];

const sanitizeValue = (value = '') => String(value || '').trim();

const splitCsv = (value = '') =>
  sanitizeValue(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const unique = (values) => Array.from(new Set(values.filter(Boolean)));

const getAllowedOrigins = () => {
  const clientUrl = sanitizeValue(process.env.CLIENT_URL);
  const adminUrl = sanitizeValue(process.env.ADMIN_URL);
  const extraOrigins = splitCsv(process.env.CORS_ORIGINS || process.env.ALLOWED_ORIGINS);

  return unique([
    ...DEFAULT_ALLOWED_ORIGINS,
    clientUrl,
    adminUrl,
    ...extraOrigins
  ]);
};

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (/\.onrender\.com$/i.test(origin)) return true;
  if (/^(capacitor|ionic):\/\//i.test(origin)) return true;

  return getAllowedOrigins().includes(origin);
};

module.exports = {
  getAllowedOrigins,
  isOriginAllowed,
  sanitizeValue
};
