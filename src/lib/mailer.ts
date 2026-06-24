import nodemailer from 'nodemailer';
import { env } from '../config/env';

const smtpSecure = String(env.SMTP_SECURE || '').toLowerCase();

export const mailer = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: Number(env.SMTP_PORT),
  secure: smtpSecure === 'ssl',      // true only for port 465
  requireTLS: smtpSecure === 'tls',  // STARTTLS for port 587
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS
  }
});

export const defaultSender = env.SMTP_FROM;