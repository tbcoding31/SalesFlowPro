import { Router } from 'express';
import { pool } from '../db';
import { logAudit } from '../utils/audit';
import { encryptSecret, decryptSecret } from '../utils/encryption';
import { verifySmtpConnection } from '../services/email.service';

export const integrationsRoutes = Router();

// Middleware for SUPER_ADMIN only
integrationsRoutes.use((req: any, res: any, next) => {
  if (req.userRole !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Access denied. Super Admin required.' });
  }
  next();
});

// GET all integrations status
integrationsRoutes.get('/', async (req: any, res: any) => {
  try {
    const [rows]: any = await pool.query('SELECT provider, displayName, status, enabled, configurationJson, lastTestedAt, lastSuccessAt, lastErrorCode, lastErrorMessage FROM integration_configs');
    const result: any = {};
    for (const row of rows) {
      result[row.provider] = {
        displayName: row.displayName,
        status: row.status,
        enabled: !!row.enabled,
        config: row.configurationJson ? JSON.parse(row.configurationJson) : {},
        lastTestedAt: row.lastTestedAt,
        lastSuccessAt: row.lastSuccessAt,
        lastErrorCode: row.lastErrorCode,
        lastErrorMessage: row.lastErrorMessage
      };
    }
    res.json({ success: true, integrations: result });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch integrations', message: error.message });
  }
});

// GET single integration
integrationsRoutes.get('/:provider', async (req: any, res: any) => {
  try {
    const { provider } = req.params;
    const [rows]: any = await pool.query('SELECT * FROM integration_configs WHERE provider = ?', [provider]);
    if (!rows.length) return res.json({ success: true, integration: null });
    
    const row = rows[0];
    const config = row.configurationJson ? JSON.parse(row.configurationJson) : {};
    
    // For smtp, expose username in config if saved in secrets, but never expose password
    if (provider === 'smtp' && row.encryptedSecrets) {
      try {
        const sec = JSON.parse(decryptSecret(row.encryptedSecrets));
        if (sec.username && !config.username) {
          config.username = sec.username;
        }
      } catch (e) {}
    }
    
    // Mask secrets if they exist
    const hasSecrets = !!row.encryptedSecrets;
    
    res.json({
      success: true,
      integration: {
        provider: row.provider,
        displayName: row.displayName,
        status: row.status,
        enabled: !!row.enabled,
        config,
        hasSecrets, // Tell frontend a secret is saved
        lastTestedAt: row.lastTestedAt,
        lastSuccessAt: row.lastSuccessAt,
        lastErrorCode: row.lastErrorCode,
        lastErrorMessage: row.lastErrorMessage
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch integration', message: error.message });
  }
});

// PUT single integration
integrationsRoutes.put('/:provider', async (req: any, res: any) => {
  try {
    const { provider } = req.params;
    const { displayName, status, enabled, config, secrets } = req.body;
    
    // Fetch existing integration config & secrets
    const [existingRows]: any = await pool.query('SELECT * FROM integration_configs WHERE provider = ?', [provider]);
    const existing = existingRows.length ? existingRows[0] : null;
    let existingSecrets: any = {};
    if (existing && existing.encryptedSecrets) {
      try {
        existingSecrets = JSON.parse(decryptSecret(existing.encryptedSecrets));
      } catch (e) {
        existingSecrets = {};
      }
    }

    let mergedSecrets = { ...existingSecrets };
    if (secrets && typeof secrets === 'object') {
      for (const [key, val] of Object.entries(secrets)) {
        if (typeof val === 'string' && val.trim() !== '' && val !== '********') {
          mergedSecrets[key] = val.trim();
        }
      }
    }

    let encryptedSecrets: string | null = existing?.encryptedSecrets || null;
    if (Object.keys(mergedSecrets).length > 0) {
      encryptedSecrets = encryptSecret(JSON.stringify(mergedSecrets));
    }

    // Determine status semantics (Section 10):
    // Saving configuration resets CONNECTED -> CONFIGURED until tested again
    let newStatus = status;
    if (!newStatus || newStatus === 'CONNECTED') {
      newStatus = 'CONFIGURED';
    }

    const configJson = config ? JSON.stringify(config) : null;
    
    await pool.query(
      `INSERT INTO integration_configs 
      (provider, displayName, status, enabled, configurationJson, encryptedSecrets) 
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
      displayName = VALUES(displayName),
      status = VALUES(status),
      enabled = VALUES(enabled),
      configurationJson = VALUES(configurationJson),
      encryptedSecrets = VALUES(encryptedSecrets)`,
      [provider, displayName || provider, newStatus, enabled ? 1 : 0, configJson, encryptedSecrets]
    );

    await logAudit(null, req.userId, 'INTEGRATION_CONFIG_UPDATED', 'Integration', provider, `Integration ${provider} configuration updated`, req.ip, req.get('User-Agent'), 'SYSTEM');

    res.json({ success: true, message: 'Integration updated securely' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update integration', message: error.message });
  }
});

// POST test integration
integrationsRoutes.post('/:provider/test', async (req: any, res: any) => {
  const { provider } = req.params;
  try {
    const [rows]: any = await pool.query('SELECT * FROM integration_configs WHERE provider = ?', [provider]);
    if (!rows.length) return res.status(404).json({ error: 'Integration not configured' });

    if (provider === 'smtp') {
      const result = await verifySmtpConnection();

      if (result.success) {
        await logAudit(null, req.userId, 'SMTP_CONNECTION_TEST_SUCCESS', 'Integration', 'smtp', 'SMTP connection verified successfully', req.ip, req.get('User-Agent'), 'SYSTEM');
        return res.json({
          success: true,
          status: 'CONNECTED',
          message: result.message
        });
      } else {
        await logAudit(null, req.userId, 'SMTP_CONNECTION_TEST_FAILED', 'Integration', 'smtp', `SMTP connection test failed: ${result.code}`, req.ip, req.get('User-Agent'), 'SYSTEM');
        return res.status(result.httpStatus || 502).json({
          success: false,
          code: result.code,
          message: result.message
        });
      }
    }
    
    // For other providers not yet implemented
    await pool.query(
      'UPDATE integration_configs SET lastTestedAt = NOW(), lastErrorCode = ? WHERE provider = ?',
      ['PROVIDER_RUNTIME_NOT_IMPLEMENTED', provider]
    );

    res.status(501).json({
      success: false,
      code: 'PROVIDER_RUNTIME_NOT_IMPLEMENTED',
      message: 'Live provider connectivity testing is not implemented yet.'
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Integration test failed', message: error.message });
  }
});
// POST disconnect integration
integrationsRoutes.post('/:provider/disconnect', async (req: any, res: any) => {
  const { provider } = req.params;
  try {
    await pool.query(
      'UPDATE integration_configs SET status = ?, enabled = ?, encryptedSecrets = NULL WHERE provider = ?',
      ['NOT_CONNECTED', 0, provider]
    );

    await logAudit(null, req.userId, 'INTEGRATION_DISCONNECTED', 'Integration', provider, `Integration ${provider} disconnected and secrets purged`, req.ip, req.get('User-Agent'), 'SYSTEM');

    res.json({ success: true, message: 'Integration disconnected' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to disconnect integration', message: error.message });
  }
});
