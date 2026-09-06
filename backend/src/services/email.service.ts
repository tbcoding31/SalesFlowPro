import nodemailer, { Transporter } from 'nodemailer';
import { pool } from '../db';
import { decryptSecret } from '../utils/encryption';

export interface SmtpConfig {
  host: string;
  port: number | string;
  fromEmail?: string;
  secure?: boolean;
  ignoreTls?: boolean;
  rejectUnauthorized?: boolean;
  username?: string;
}

export interface SmtpSecrets {
  username?: string;
  password?: string;
}

export interface SmtpVerificationResult {
  success: boolean;
  status: 'CONNECTED' | 'ERROR';
  code?: string;
  message: string;
  httpStatus?: number;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
}

/**
 * Loads SMTP configuration and decrypted secrets from DB.
 */
export async function getSmtpConfiguration(): Promise<{ config: SmtpConfig; secrets: SmtpSecrets; enabled: boolean } | null> {
  const [rows]: any = await pool.query('SELECT * FROM integration_configs WHERE provider = ?', ['smtp']);
  if (!rows.length) return null;

  const row = rows[0];
  const config = row.configurationJson ? JSON.parse(row.configurationJson) : {};
  let secrets: SmtpSecrets = {};
  if (row.encryptedSecrets) {
    try {
      secrets = JSON.parse(decryptSecret(row.encryptedSecrets));
    } catch (e) {
      secrets = {};
    }
  }

  return {
    config,
    secrets,
    enabled: !!row.enabled
  };
}

/**
 * Constructs a Nodemailer transporter using given or stored SMTP config.
 */
export function createSmtpTransporter(config: SmtpConfig, secrets: SmtpSecrets): Transporter {
  const host = (config.host || '').trim();
  const port = Number(config.port) || 587;
  const username = (secrets.username || config.username || '').trim();
  const password = secrets.password || '';

  const isSecurePort = port === 465;
  const secure = config.secure !== undefined ? Boolean(config.secure) : isSecurePort;
  const rejectUnauthorized = config.rejectUnauthorized !== undefined
    ? Boolean(config.rejectUnauthorized)
    : (config.ignoreTls === true ? false : true);

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: username ? {
      user: username,
      pass: password
    } : undefined,
    tls: {
      rejectUnauthorized,
      ...(rejectUnauthorized && host ? { servername: host } : {})
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000
  });
}

/**
 * Performs real live provider handshake (transporter.verify) and persists truthful status.
 */
export async function verifySmtpConnection(): Promise<SmtpVerificationResult> {
  const loaded = await getSmtpConfiguration();
  if (!loaded) {
    return {
      success: false,
      status: 'ERROR',
      code: 'SMTP_NOT_CONFIGURED',
      message: 'SMTP integration is not configured in database.',
      httpStatus: 404
    };
  }

  const { config, secrets } = loaded;
  const host = (config.host || '').trim();
  if (!host) {
    return {
      success: false,
      status: 'ERROR',
      code: 'SMTP_MISSING_HOST',
      message: 'SMTP host is required for connection testing.',
      httpStatus: 400
    };
  }

  const transporter = createSmtpTransporter(config, secrets);

  try {
    await transporter.verify();

    // Persist truthful success into database
    await pool.query(
      `UPDATE integration_configs 
       SET status = 'CONNECTED', 
           lastTestedAt = NOW(), 
           lastSuccessAt = NOW(), 
           lastErrorCode = NULL, 
           lastErrorMessage = NULL 
       WHERE provider = 'smtp'`
    );

    return {
      success: true,
      status: 'CONNECTED',
      message: 'SMTP connection verified successfully.'
    };
  } catch (err: any) {
    let code = 'SMTP_ERROR';
    let message = 'Unable to connect to SMTP server.';
    let httpStatus = 502;

    const errMsg = err.message || '';
    const errCode = err.code || '';
    const responseCode = err.responseCode;

    if (
      errCode === 'EAUTH' || 
      responseCode === 535 || 
      err.command === 'AUTH' || 
      errMsg.toLowerCase().includes('auth') || 
      errMsg.toLowerCase().includes('credential') || 
      errMsg.toLowerCase().includes('incorrect authentication')
    ) {
      code = 'SMTP_AUTH_FAILED';
      message = 'SMTP authentication failed. Check SMTP username or password.';
      httpStatus = 422;
    } else if (
      errCode === 'ETIMEDOUT' || 
      errCode === 'ESOCKETTIMEDOUT' || 
      errMsg.toLowerCase().includes('timeout') || 
      errMsg.toLowerCase().includes('timed out')
    ) {
      code = 'SMTP_TIMEOUT';
      message = 'Connection timed out.';
      httpStatus = 504;
    } else if (
      errCode === 'ESOCKET' || 
      errMsg.toLowerCase().includes('certificate') || 
      errMsg.toLowerCase().includes('altnames') || 
      errMsg.toLowerCase().includes('tls') || 
      errMsg.toLowerCase().includes('ssl')
    ) {
      code = 'SMTP_TLS_ERROR';
      message = `SMTP TLS negotiation failed: ${errMsg}`;
      httpStatus = 502;
    } else if (
      errCode === 'EDNS' || 
      errCode === 'ENOTFOUND' || 
      errCode === 'ECONNREFUSED' || 
      errCode === 'ECONNRESET' || 
      errCode === 'ENETUNREACH'
    ) {
      code = 'SMTP_CONNECTION_FAILED';
      message = `Unable to connect to SMTP server (${errCode || 'connection failed'}).`;
      httpStatus = 502;
    } else {
      code = 'SMTP_CONNECTION_FAILED';
      message = `SMTP connection failed: ${errMsg}`;
      httpStatus = 502;
    }

    // Persist truthful failure into database
    await pool.query(
      `UPDATE integration_configs 
       SET status = 'ERROR', 
           lastTestedAt = NOW(), 
           lastErrorCode = ?, 
           lastErrorMessage = ? 
       WHERE provider = 'smtp'`,
      [code, message]
    );

    return {
      success: false,
      status: 'ERROR',
      code,
      message,
      httpStatus
    };
  }
}

/**
 * Sends email using stored SMTP configuration.
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string }> {
  const loaded = await getSmtpConfiguration();
  if (!loaded) {
    throw new Error('SMTP integration is not configured');
  }
  if (!loaded.enabled) {
    throw new Error('SMTP integration is disabled');
  }

  const { config, secrets } = loaded;
  const transporter = createSmtpTransporter(config, secrets);
  const from = options.from || config.fromEmail || secrets.username || config.username;

  const info = await transporter.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
    replyTo: options.replyTo
  });

  return { success: true, messageId: info.messageId };
}
