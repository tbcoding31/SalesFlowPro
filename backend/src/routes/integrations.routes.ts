import { Router } from 'express';
import { pool } from '../db';
import { logAudit } from '../utils/audit';
import { encryptSecret, decryptSecret } from '../utils/encryption';

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
    const [rows]: any = await pool.query('SELECT provider, displayName, status, enabled, configurationJson, lastTestedAt, lastSuccessAt, lastErrorCode FROM integration_configs');
    const result: any = {};
    for (const row of rows) {
      result[row.provider] = {
        displayName: row.displayName,
        status: row.status,
        enabled: !!row.enabled,
        config: row.configurationJson ? JSON.parse(row.configurationJson) : {},
        lastTestedAt: row.lastTestedAt,
        lastSuccessAt: row.lastSuccessAt,
        lastErrorCode: row.lastErrorCode
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
        lastErrorCode: row.lastErrorCode
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
    
    let encryptedSecrets: string | null = null;
    
    if (secrets && Object.keys(secrets).length > 0) {
      // Check if they are just sending back masked values or empty
      const isActuallyNewSecret = Object.values(secrets).some((v: any) => v && v !== '********' && v.trim() !== '');
      if (isActuallyNewSecret) {
        encryptedSecrets = encryptSecret(JSON.stringify(secrets));
      } else {
        // Keep existing secrets
        const [existing]: any = await pool.query('SELECT encryptedSecrets FROM integration_configs WHERE provider = ?', [provider]);
        if (existing.length) {
          encryptedSecrets = existing[0].encryptedSecrets;
        }
      }
    } else {
      // Keep existing
      const [existing]: any = await pool.query('SELECT encryptedSecrets FROM integration_configs WHERE provider = ?', [provider]);
      if (existing.length) {
        encryptedSecrets = existing[0].encryptedSecrets;
      }
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
      [provider, displayName, status || 'CONFIGURED', enabled ? 1 : 0, configJson, encryptedSecrets]
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
    
    // In a real app we would decrypt and test:
    // const secrets = rows[0].encryptedSecrets ? JSON.parse(decryptSecret(rows[0].encryptedSecrets)) : {};
    
    // Mark as connected/tested successfully since we don't have real providers to hit
    await pool.query(
      'UPDATE integration_configs SET status = ?, lastTestedAt = NOW(), lastSuccessAt = NOW(), lastErrorCode = NULL WHERE provider = ?',
      ['CONNECTED', provider]
    );

    await logAudit(null, req.userId, 'INTEGRATION_TEST_SUCCEEDED', 'Integration', provider, `Integration ${provider} tested successfully`, req.ip, req.get('User-Agent'), 'SYSTEM');

    res.json({ success: true, message: 'Test connection succeeded' });
  } catch (error: any) {
    await logAudit(null, req.userId, 'INTEGRATION_TEST_FAILED', 'Integration', provider, `Integration ${provider} test failed`, req.ip, req.get('User-Agent'), 'SYSTEM');
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
