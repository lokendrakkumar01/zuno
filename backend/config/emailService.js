const nodemailer = require('nodemailer');

const DEFAULT_CLIENT_URL = 'https://zunoworld.tech';

const escapeHtml = (value = '') => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const createTransporter = () => nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const getClientUrl = () => process.env.CLIENT_URL || DEFAULT_CLIENT_URL;

const buildEmailLayout = ({
  title,
  accent = '#6366f1',
  badge = 'ZUNO',
  headline,
  intro,
  bodyHtml,
  ctaHref,
  ctaLabel,
  footerNote
}) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#0d0d1a;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;width:60px;height:60px;background:linear-gradient(135deg,${accent},#8b5cf6);border-radius:16px;line-height:60px;font-size:28px;font-weight:900;color:#fff;margin-bottom:12px;">Z</div>
      <h1 style="margin:0;color:#f1f5f9;font-size:24px;font-weight:700;">${escapeHtml(badge)}</h1>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">Value Platform</p>
    </div>

    <div style="background:linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.08));border:1px solid rgba(99,102,241,0.3);border-radius:20px;padding:32px;">
      <h2 style="color:#f1f5f9;margin:0 0 10px;text-align:center;font-size:22px;">${escapeHtml(headline)}</h2>
      <p style="color:#94a3b8;text-align:center;margin:0 0 28px;font-size:15px;">${intro}</p>
      ${bodyHtml}
      <div style="text-align:center;margin-top:24px;">
        <a href="${ctaHref}" style="display:inline-block;background:linear-gradient(135deg,${accent},#8b5cf6);color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;">${escapeHtml(ctaLabel)}</a>
      </div>
    </div>

    <div style="text-align:center;margin-top:32px;">
      <p style="color:#475569;font-size:12px;margin:0;">&copy; 2026 ZUNO</p>
      <p style="color:#334155;font-size:11px;margin:8px 0 0;">${escapeHtml(footerNote)}</p>
    </div>
  </div>
</body>
</html>`;

const sendLoginEmail = async (email, displayName, loginTime) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('[Email] Email not configured, skipping login email');
      return;
    }

    const transporter = createTransporter();
    const safeDisplayName = escapeHtml(displayName);
    const safeEmail = escapeHtml(email);
    const safeLoginTime = escapeHtml(loginTime);
    const clientUrl = getClientUrl();

    const html = buildEmailLayout({
      title: 'Login Alert - ZUNO',
      headline: 'Login Successful',
      intro: `Hi <strong style="color:#a5b4fc;">${safeDisplayName}</strong>, you have successfully logged in to your ZUNO account.`,
      bodyHtml: `
        <div style="background:rgba(0,0,0,0.3);border-radius:12px;padding:20px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="color:#94a3b8;font-size:13px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Login Time</td>
              <td style="color:#f1f5f9;font-size:13px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);text-align:right;font-weight:600;">${safeLoginTime}</td>
            </tr>
            <tr>
              <td style="color:#94a3b8;font-size:13px;padding:8px 0;">Account</td>
              <td style="color:#f1f5f9;font-size:13px;padding:8px 0;text-align:right;font-weight:600;">${safeEmail}</td>
            </tr>
          </table>
        </div>
        <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:12px;padding:16px;margin-top:18px;">
          <p style="color:#fca5a5;margin:0;font-size:13px;text-align:center;">If this was not you, please change your password immediately.</p>
        </div>`,
      ctaHref: `${clientUrl}/profile`,
      ctaLabel: 'Visit Your Profile',
      footerNote: 'This is an automated security notification. Please do not reply.'
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `ZUNO <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Login Alert - You have logged into ZUNO',
      html
    });

    console.log(`[Email] Login alert sent to ${email}`);
  } catch (error) {
    console.error('[Email] Failed to send login email:', error.message);
  }
};

const sendProfileUpdateEmail = async (email, displayName, changedFields = []) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('[Email] Email not configured, skipping profile update email');
      return;
    }

    const transporter = createTransporter();
    const safeDisplayName = escapeHtml(displayName);
    const clientUrl = getClientUrl();
    const updateTime = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const fieldLabels = {
      displayName: 'Display Name',
      bio: 'Bio',
      avatar: 'Profile Photo',
      language: 'Language',
      interests: 'Interests',
      profileVisibility: 'Profile Visibility',
      isPrivate: 'Private Account',
      focusModeEnabled: 'Focus Mode',
      dailyUsageLimit: 'Daily Usage Limit',
      preferredFeedMode: 'Feed Mode',
      profileSong: 'Profile Song'
    };

    const changesHtml = changedFields.length > 0
      ? `<div style="background:rgba(0,0,0,0.3);border-radius:12px;padding:20px;margin-bottom:18px;">
          <p style="color:#94a3b8;margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Updated Fields</p>
          <ul style="margin:0;padding:0;list-style:none;">
            ${changedFields.map((field) => `<li style="color:#a7f3d0;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">${escapeHtml(fieldLabels[field] || field)}</li>`).join('')}
          </ul>
        </div>`
      : '';

    const html = buildEmailLayout({
      title: 'Profile Updated - ZUNO',
      accent: '#22c55e',
      headline: 'Profile Updated Successfully',
      intro: `Hi <strong style="color:#86efac;">${safeDisplayName}</strong>, your ZUNO profile has been updated.`,
      bodyHtml: `
        ${changesHtml}
        <div style="background:rgba(0,0,0,0.2);border-radius:12px;padding:16px;">
          <p style="color:#94a3b8;margin:0;font-size:13px;text-align:center;">Updated on <strong style="color:#f1f5f9;">${escapeHtml(updateTime)}</strong> (IST)</p>
        </div>
        <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:12px;padding:16px;margin-top:18px;">
          <p style="color:#fca5a5;margin:0;font-size:13px;text-align:center;">If you did not make these changes, please secure your account immediately.</p>
        </div>`,
      ctaHref: `${clientUrl}/profile`,
      ctaLabel: 'View Your Profile',
      footerNote: 'This is an automated notification. Please do not reply.'
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `ZUNO <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Profile Updated - Your ZUNO profile has been changed',
      html
    });

    console.log(`[Email] Profile update email sent to ${email}`);
  } catch (error) {
    console.error('[Email] Failed to send profile update email:', error.message);
  }
};

const sendCustomAdminEmail = async (email, displayName, subject, message) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('[Email] Email not configured, skipping custom admin email');
      return;
    }

    const transporter = createTransporter();
    const clientUrl = getClientUrl();
    const safeDisplayName = escapeHtml(displayName);
    const formattedMessage = escapeHtml(message).replace(/\n/g, '<br/>');

    const html = buildEmailLayout({
      title: subject,
      badge: 'ZUNO Admin',
      headline: 'Admin Message',
      intro: `Hello <strong style="color:#a5b4fc;">${safeDisplayName}</strong>,`,
      bodyHtml: `
        <div style="color:#cbd5e1;font-size:15px;line-height:1.6;background:rgba(0,0,0,0.2);padding:24px;border-radius:12px;border:1px solid rgba(255,255,255,0.05);">
          ${formattedMessage}
        </div>`,
      ctaHref: clientUrl,
      ctaLabel: 'Open ZUNO',
      footerNote: 'This email was sent by ZUNO Administration. Please do not reply directly.'
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `ZUNO <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      html
    });

    console.log(`[Email] Custom admin email sent to ${email}`);
  } catch (error) {
    console.error('[Email] Failed to send custom admin email:', error.message);
    throw error;
  }
};

module.exports = { sendLoginEmail, sendProfileUpdateEmail, sendCustomAdminEmail };
