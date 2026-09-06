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
 * Loads stored SMTP configuration and decrypted secrets from DB.
 */
export async function loadStoredSmtpConfiguration(): Promise<{ config: SmtpConfig; secrets: SmtpSecrets; enabled: boolean } | null> {
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

// Alias for backwards compatibility
export const getSmtpConfiguration = loadStoredSmtpConfiguration;

/**
 * Resolves SMTP test configuration from request payload merged with stored configuration.
 */
export function resolveSmtpTestConfiguration(
  requestPayload?: any,
  stored?: { config: SmtpConfig; secrets: SmtpSecrets } | null
): { config: SmtpConfig; secrets: SmtpSecrets; isUnsaved: boolean } {
  const req = requestPayload || {};
  const reqConfig = req.config || {};
  const reqSecrets = req.secrets || {};

  const storedConfig = stored?.config || ({} as SmtpConfig);
  const storedSecrets = stored?.secrets || ({} as SmtpSecrets);

  // Resolve host
  const rawHost = req.host !== undefined ? req.host : (reqConfig.host !== undefined ? reqConfig.host : storedConfig.host);
  const host = typeof rawHost === 'string' ? rawHost.trim() : '';

  // Resolve port
  const rawPort = req.port !== undefined ? req.port : (reqConfig.port !== undefined ? reqConfig.port : storedConfig.port);
  const port = rawPort !== undefined && String(rawPort).trim() !== '' ? Number(rawPort) : (Number(storedConfig.port) || 587);

  // Resolve secure
  const isSecurePort = port === 465;
  const rawSecure = req.secure !== undefined ? req.secure : (reqConfig.secure !== undefined ? reqConfig.secure : storedConfig.secure);
  const secure = rawSecure !== undefined ? Boolean(rawSecure) : isSecurePort;

  // Resolve ignoreTls
  const rawIgnoreTls = req.ignoreTls !== undefined ? req.ignoreTls : (reqConfig.ignoreTls !== undefined ? reqConfig.ignoreTls : storedConfig.ignoreTls);
  const ignoreTls = rawIgnoreTls !== undefined ? Boolean(rawIgnoreTls) : Boolean(storedConfig.ignoreTls);

  // Resolve rejectUnauthorized
  const rawRejectUnauthorized = req.rejectUnauthorized !== undefined ? req.rejectUnauthorized : reqConfig.rejectUnauthorized;
  const rejectUnauthorized = rawRejectUnauthorized !== undefined
    ? Boolean(rawRejectUnauthorized)
    : (ignoreTls ? false : true);

  // Resolve fromEmail
  const rawFrom = req.fromEmail !== undefined ? req.fromEmail : (reqConfig.fromEmail !== undefined ? reqConfig.fromEmail : storedConfig.fromEmail);
  const fromEmail = typeof rawFrom === 'string' ? rawFrom.trim() : '';

  // Resolve username
  const rawUser = req.username !== undefined ? req.username : (reqConfig.username !== undefined ? reqConfig.username : (reqSecrets.username !== undefined ? reqSecrets.username : (storedSecrets.username || storedConfig.username)));
  const username = typeof rawUser === 'string' ? rawUser.trim() : '';

  // Resolve password:
  // If request contains a non-empty, unmasked password, use it.
  // Otherwise resolve stored password.
  const rawPass = req.password !== undefined ? req.password : (reqSecrets.password !== undefined ? reqSecrets.password : undefined);
  let password = '';
  let passwordChanged = false;

  if (typeof rawPass === 'string' && rawPass.trim() !== '' && !rawPass.startsWith('********')) {
    password = rawPass;
    passwordChanged = password !== (storedSecrets.password || '');
  } else {
    password = storedSecrets.password || '';
  }

  // Determine if this test uses unsaved values compared to DB
  const isUnsaved = !stored ||
    host !== (storedConfig.host || '') ||
    port !== (Number(storedConfig.port) || 587) ||
    secure !== (storedConfig.secure !== undefined ? Boolean(storedConfig.secure) : (Number(storedConfig.port) === 465)) ||
    ignoreTls !== Boolean(storedConfig.ignoreTls) ||
    fromEmail !== (storedConfig.fromEmail || '') ||
    username !== (storedSecrets.username || storedConfig.username || '') ||
    passwordChanged;

  const resolvedConfig: SmtpConfig = {
    host,
    port,
    secure,
    ignoreTls,
    rejectUnauthorized,
    fromEmail,
    username
  };

  const resolvedSecrets: SmtpSecrets = {
    username,
    password
  };

  return { config: resolvedConfig, secrets: resolvedSecrets, isUnsaved };
}

/**
 * Constructs a Nodemailer transporter using given SMTP config and secrets.
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
 * Verifies resolved SMTP configuration and updates DB truthfully according to whether config was unsaved or saved.
 */
export async function verifySmtpConfiguration(
  config: SmtpConfig,
  secrets: SmtpSecrets,
  isUnsaved: boolean = false
): Promise<SmtpVerificationResult> {
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

  const port = Number(config.port);
  if (isNaN(port) || port < 1 || port > 65535) {
    return {
      success: false,
      status: 'ERROR',
      code: 'SMTP_INVALID_PORT',
      message: 'SMTP port must be a valid port number between 1 and 65535.',
      httpStatus: 400
    };
  }

  const password = secrets.password || '';
  if (!password) {
    return {
      success: false,
      status: 'ERROR',
      code: 'SMTP_MISSING_PASSWORD',
      message: 'SMTP password is required.',
      httpStatus: 400
    };
  }

  const transporter = createSmtpTransporter(config, secrets);

  try {
    await transporter.verify();

    // Persist truthful status into database:
    // If the test was for currently SAVED DB config, set CONNECTED.
    // If testing UNSAVED form values, do NOT mark stored DB config as CONNECTED!
    if (!isUnsaved) {
      await pool.query(
        `UPDATE integration_configs 
         SET status = 'CONNECTED', 
             lastTestedAt = NOW(), 
             lastSuccessAt = NOW(), 
             lastErrorCode = NULL, 
             lastErrorMessage = NULL 
         WHERE provider = 'smtp'`
      );
    } else {
      // Unsaved test only updates operational lastTestedAt without altering stored status
      await pool.query(
        `UPDATE integration_configs 
         SET lastTestedAt = NOW() 
         WHERE provider = 'smtp'`
      );
    }

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

    // If testing saved DB config, persist status ERROR.
    // If testing unsaved form values, do NOT overwrite stored DB status!
    if (!isUnsaved) {
      await pool.query(
        `UPDATE integration_configs 
         SET status = 'ERROR', 
             lastTestedAt = NOW(), 
             lastErrorCode = ?, 
             lastErrorMessage = ? 
         WHERE provider = 'smtp'`,
        [code, message]
      );
    } else {
      await pool.query(
        `UPDATE integration_configs 
         SET lastTestedAt = NOW() 
         WHERE provider = 'smtp'`
      );
    }

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
 * Top-level verify function supporting request body and stored config.
 */
export async function verifySmtpConnection(requestPayload?: any, storedRow?: any): Promise<SmtpVerificationResult> {
  const stored = storedRow ? {
    config: storedRow.configurationJson ? JSON.parse(storedRow.configurationJson) : {},
    secrets: storedRow.encryptedSecrets ? JSON.parse(decryptSecret(storedRow.encryptedSecrets)) : {},
    enabled: !!storedRow.enabled
  } : await loadStoredSmtpConfiguration();

  const { config, secrets, isUnsaved } = resolveSmtpTestConfiguration(requestPayload, stored);
  return verifySmtpConfiguration(config, secrets, isUnsaved);
}

/**
 * Sends email using stored SMTP configuration.
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string }> {
  const loaded = await loadStoredSmtpConfiguration();
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
