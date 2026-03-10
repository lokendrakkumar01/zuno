/**
 * UserAvatar — Auto-generated Snapchat-style gradient avatar
 * Shows user photo if available, else generates a colorful gradient
 * avatar with the user's initial (like Google / Snapchat).
 *
 * Props:
 *  user      — { avatar, displayName, username }  (any object with these fields)
 *  src       — direct avatar URL override
 *  name      — fallback display name string
 *  size      — number (px) or string like '40px'. Default 40
 *  style     — extra inline styles on wrapper
 *  className — extra CSS classes on wrapper
 *  onClick   — click handler
 */

const GRADIENT_PALETTES = [
  'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', // violet
  'linear-gradient(135deg, #f43f5e 0%, #ec4899 100%)', // rose
  'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)', // ocean
  'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', // sunset
  'linear-gradient(135deg, #10b981 0%, #059669 100%)', // forest
  'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)', // aurora
  'linear-gradient(135deg, #ef4444 0%, #f97316 100%)', // fire
  'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)', // sky
  'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)', // candy
  'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', // gold
  'linear-gradient(135deg, #14b8a6 0%, #3b82f6 100%)', // teal
  'linear-gradient(135deg, #8b5cf6 0%, #f43f5e 100%)', // berry
];

/**
 * Pick a stable gradient from the palette based on the user's name string.
 * Same name always → same color.
 */
function getGradient(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % GRADIENT_PALETTES.length;
  return GRADIENT_PALETTES[idx];
}

const UserAvatar = ({
  user,
  src,
  name,
  size = 40,
  style = {},
  className = '',
  onClick,
  border,
}) => {
  const avatarUrl = src || user?.avatar;
  const displayName = name || user?.displayName || user?.username || '?';
  const initial = displayName.charAt(0).toUpperCase();
  const gradient = getGradient(displayName);
  const px = typeof size === 'number' ? `${size}px` : size;
  const fontSize = typeof size === 'number' ? `${Math.round(size * 0.42)}px` : '16px';

  const wrapperStyle = {
    width: px,
    height: px,
    borderRadius: '50%',
    flexShrink: 0,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: onClick ? 'pointer' : 'default',
    border: border || 'none',
    ...style,
  };

  if (avatarUrl) {
    return (
      <div style={wrapperStyle} className={className} onClick={onClick}>
        <img
          src={avatarUrl}
          alt={displayName}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => {
            // If image fails, show gradient fallback
            e.target.style.display = 'none';
            e.target.parentNode.style.background = gradient;
            e.target.parentNode.innerHTML = `<span style="color:white;font-size:${fontSize};font-weight:700;line-height:1">${initial}</span>`;
          }}
        />
      </div>
    );
  }

  // No avatar — show gradient with initial
  return (
    <div
      style={{ ...wrapperStyle, background: gradient }}
      className={className}
      onClick={onClick}
    >
      <span style={{
        color: 'white',
        fontSize,
        fontWeight: '700',
        lineHeight: '1',
        userSelect: 'none',
        fontFamily: 'system-ui, sans-serif',
        textShadow: '0 1px 4px rgba(0,0,0,0.25)',
      }}>
        {initial}
      </span>
    </div>
  );
};

export default UserAvatar;
