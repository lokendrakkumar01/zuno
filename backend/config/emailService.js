const nodemailer = require('nodemailer');

// Create transporter using Gmail SMTP
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

/**
 * Send login alert email to user
 */
const sendLoginEmail = async (email, displayName, loginTime) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('[Email] Email not configured, skipping login email');
      return;
    }

    const transporter = createTransporter();

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login Alert - ZUNO</title>
</head>
<body style="margin:0;padding:0;background:#0d0d1a;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;width:60px;height:60px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:16px;line-height:60px;font-size:28px;font-weight:900;color:#fff;margin-bottom:12px;">Z</div>
      <h1 style="margin:0;color:#f1f5f9;font-size:24px;font-weight:700;">ZUNO</h1>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">Value Platform</p>
    </div>

    <!-- Card -->
    <div style="background:linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.1));border:1px solid rgba(99,102,241,0.3);border-radius:20px;padding:32px;">
      <div style="text-align:center;font-size:48px;margin-bottom:16px;">🔐</div>
      <h2 style="color:#f1f5f9;margin:0 0 8px;text-align:center;font-size:22px;">Login Successful!</h2>
      <p style="color:#94a3b8;text-align:center;margin:0 0 28px;font-size:15px;">Hi <strong style="color:#a5b4fc;">${displayName}</strong>, you have successfully logged in to your ZUNO account.</p>

      <!-- Info Box -->
      <div style="background:rgba(0,0,0,0.3);border-radius:12px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="color:#94a3b8;font-size:13px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">⏰ Login Time</td>
            <td style="color:#f1f5f9;font-size:13px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);text-align:right;font-weight:600;">${loginTime}</td>
          </tr>
          <tr>
            <td style="color:#94a3b8;font-size:13px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">📧 Account</td>
            <td style="color:#f1f5f9;font-size:13px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);text-align:right;font-weight:600;">${email}</td>
          </tr>
          <tr>
            <td style="color:#94a3b8;font-size:13px;padding:8px 0;">🌐 Platform</td>
            <td style="color:#f1f5f9;font-size:13px;padding:8px 0;text-align:right;font-weight:600;">ZUNO Web App</td>
          </tr>
        </table>
      </div>

      <!-- Warning -->
      <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:12px;padding:16px;margin-bottom:24px;">
        <p style="color:#fca5a5;margin:0;font-size:13px;text-align:center;">⚠️ If this wasn't you, please change your password immediately.</p>
      </div>

      <!-- CTA -->
      <div style="text-align:center;">
        <a href="${process.env.CLIENT_URL || 'https://zuno-frontend-bevi.onrender.com'}/profile" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;">Visit Your Profile →</a>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:32px;">
      <p style="color:#475569;font-size:12px;margin:0;">© 2026 ZUNO • Built with ❤️ by Lokendra Kumar</p>
      <p style="color:#334155;font-size:11px;margin:8px 0 0;">This is an automated security notification. Please do not reply.</p>
    </div>
  </div>
</body>
</html>`;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `ZUNO <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔐 Login Alert - You have logged into ZUNO',
      html: htmlContent
    });

    console.log(`[Email] Login alert sent to ${email}`);
  } catch (error) {
    console.error('[Email] Failed to send login email:', error.message);
    // Don't throw - email failure should never block auth
  }
};

/**
 * Send profile update confirmation email to user
 */
const sendProfileUpdateEmail = async (email, displayName, changedFields) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('[Email] Email not configured, skipping profile update email');
      return;
    }

    const transporter = createTransporter();

    // Build change list HTML
    const fieldLabels = {
      displayName: '👤 Display Name',
      bio: '📝 Bio',
      avatar: '🖼️ Profile Photo',
      language: '🌐 Language',
      interests: '🎯 Interests',
      profileVisibility: '🔒 Profile Visibility',
      isPrivate: '🔒 Private Account',
      focusModeEnabled: '🧘 Focus Mode',
      dailyUsageLimit: '⏱️ Daily Usage Limit',
      preferredFeedMode: '📰 Feed Mode',
      profileSong: '🎵 Profile Song'
    };

    const changesHtml = changedFields.map(field => {
      const label = fieldLabels[field] || field;
      return `<li style="color:#a5b4fc;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);list-style:none;">${label}</li>`;
    }).join('');

    const updateTime = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Profile Updated - ZUNO</title>
</head>
<body style="margin:0;padding:0;background:#0d0d1a;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;width:60px;height:60px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:16px;line-height:60px;font-size:28px;font-weight:900;color:#fff;margin-bottom:12px;">Z</div>
      <h1 style="margin:0;color:#f1f5f9;font-size:24px;font-weight:700;">ZUNO</h1>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">Value Platform</p>
    </div>

    <!-- Card -->
    <div style="background:linear-gradient(135deg,rgba(34,197,94,0.1),rgba(16,185,129,0.08));border:1px solid rgba(34,197,94,0.3);border-radius:20px;padding:32px;">
      <div style="text-align:center;font-size:48px;margin-bottom:16px;">✅</div>
      <h2 style="color:#f1f5f9;margin:0 0 8px;text-align:center;font-size:22px;">Profile Updated Successfully!</h2>
      <p style="color:#94a3b8;text-align:center;margin:0 0 28px;font-size:15px;">Hi <strong style="color:#86efac;">${displayName}</strong>, your ZUNO profile has been updated.</p>

      <!-- Changes List -->
      ${changedFields.length > 0 ? `
      <div style="background:rgba(0,0,0,0.3);border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="color:#94a3b8;margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Updated Fields:</p>
        <ul style="margin:0;padding:0;">
          ${changesHtml}
        </ul>
      </div>` : ''}

      <!-- Time -->
      <div style="background:rgba(0,0,0,0.2);border-radius:12px;padding:16px;margin-bottom:24px;">
        <p style="color:#94a3b8;margin:0;font-size:13px;text-align:center;">⏰ Updated on <strong style="color:#f1f5f9;">${updateTime}</strong> (IST)</p>
      </div>

      <!-- Warning -->
      <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:12px;padding:16px;margin-bottom:24px;">
        <p style="color:#fca5a5;margin:0;font-size:13px;text-align:center;">⚠️ If you didn't make these changes, please secure your account immediately.</p>
      </div>

      <!-- CTA -->
      <div style="text-align:center;">
        <a href="${process.env.CLIENT_URL || 'https://zuno-frontend-bevi.onrender.com'}/profile" style="display:inline-block;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;">View Your Profile →</a>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:32px;">
      <p style="color:#475569;font-size:12px;margin:0;">© 2026 ZUNO • Built with ❤️ by Lokendra Kumar</p>
      <p style="color:#334155;font-size:11px;margin:8px 0 0;">This is an automated notification. Please do not reply.</p>
    </div>
  </div>
</body>
</html>`;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `ZUNO <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '✅ Profile Updated - Your ZUNO profile has been changed',
      html: htmlContent
    });

    console.log(`[Email] Profile update email sent to ${email}`);
  } catch (error) {
    console.error('[Email] Failed to send profile update email:', error.message);
    // Don't throw - email failure should never block profile update
  }
};

/**
 * Send custom email to a user from admin
 */
const sendCustomAdminEmail = async (email, displayName, subject, message) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('[Email] Email not configured, skipping custom admin email');
      return;
    }

    const transporter = createTransporter();

    // Replace line breaks with HTML breaks
    const formattedMessage = message.replace(/\n/g, '<br/>');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#0d0d1a;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;width:60px;height:60px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:16px;line-height:60px;font-size:28px;font-weight:900;color:#fff;margin-bottom:12px;">Z</div>
      <h1 style="margin:0;color:#f1f5f9;font-size:24px;font-weight:700;">ZUNO Admin</h1>
    </div>

    <!-- Card -->
    <div style="background:linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.08));border:1px solid rgba(99,102,241,0.3);border-radius:20px;padding:32px;">
      <h2 style="color:#f1f5f9;margin:0 0 16px;font-size:20px;">Hello <strong style="color:#a5b4fc;">${displayName}</strong>,</h2>
      
      <div style="color:#cbd5e1;font-size:15px;line-height:1.6;margin-bottom:24px;background:rgba(0,0,0,0.2);padding:24px;border-radius:12px;border:1px solid rgba(255,255,255,0.05);">
        ${formattedMessage}
      </div>

      <!-- CTA -->
      <div style="text-align:center;">
        <a href="${process.env.CLIENT_URL || 'https://zuno-frontend-bevi.onrender.com'}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;">Go to ZUNO →</a>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:32px;">
      <p style="color:#475569;font-size:12px;margin:0;">© 2026 ZUNO • Built with ❤️ by Lokendra Kumar</p>
      <p style="color:#334155;font-size:11px;margin:8px 0 0;">This email was sent by ZUNO Administration. Please do not reply directly.</p>
    </div>
  </div>
</body>
</html>`;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `ZUNO <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      html: htmlContent
    });

    console.log(`[Email] Custom admin email sent to ${email}`);
  } catch (error) {
    console.error('[Email] Failed to send custom admin email:', error.message);
    throw error;
  }
};

module.exports = { sendLoginEmail, sendProfileUpdateEmail, sendCustomAdminEmail };
