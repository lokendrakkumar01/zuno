'use strict';

const { Resend } = require('resend');

const DEFAULT_FROM = 'ZUNO <onboarding@resend.dev>';

const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }
  return new Resend(apiKey);
};

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const sendOtpEmail = async ({ to, name, otp, expiresInMinutes }) => {
  const resend = getResendClient();
  const safeName = escapeHtml(name || 'there');
  const safeOtp = escapeHtml(otp);
  const minutes = Number(expiresInMinutes || 10);

  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
    to,
    subject: 'Verify your ZUNO email',
    html: `
      <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#111827">
        <h1 style="margin:0 0 12px;font-size:24px">Verify your email</h1>
        <p style="margin:0 0 16px;line-height:1.6">Hi ${safeName}, use this code to finish creating your ZUNO account.</p>
        <div style="font-size:34px;font-weight:800;letter-spacing:8px;background:#f3f4f6;border-radius:12px;padding:18px 20px;text-align:center;margin:20px 0">${safeOtp}</div>
        <p style="margin:0 0 8px;line-height:1.6">This code expires in ${minutes} minutes.</p>
        <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5">If you did not request this, you can ignore this email.</p>
      </div>
    `
  });
};

module.exports = { sendOtpEmail };
