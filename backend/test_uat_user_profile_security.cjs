const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('./dist/db.js');
const { app } = require('./dist/server.js');
const { migrateUserProfileSecurity } = require('./dist/migrations/migrate_user_profile_security.js');

async function runUserProfileSecurityTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`  [PASS] ${testName}${detail ? ' — ' + detail : ''}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}${detail ? ' — ' + detail : ''}`);
      failed++;
    }
  }

  console.log('================================================================');
  console.log('SALESFLOW PRO: USER PROFILE, AVATAR SYNC & SECURITY VERIFICATION');
  console.log('================================================================\n');

  let server;
  let baseUrl;
  const cleanupSessions = [];
  const cleanupUsers = [];
  const cleanupFiles = [];
  const cleanupTenants = [];

  try {
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
    console.log(`Server listening on ${baseUrl}\n`);

    // Helper: make HTTP request
    function httpRequest({ method, path, headers = {}, body = null }) {
      return new Promise((resolve, reject) => {
        const url = new URL(path, baseUrl);
        const options = {
          method,
          hostname: url.hostname,
          port: url.port,
          path: url.pathname + url.search,
          headers
        };

        const req = http.request(options, (res) => {
          let data = Buffer.alloc(0);
          res.on('data', (chunk) => {
            data = Buffer.concat([data, chunk]);
          });
          res.on('end', () => {
            let json = null;
            const contentType = res.headers['content-type'] || '';
            if (contentType.includes('application/json')) {
              try {
                json = JSON.parse(data.toString('utf8'));
              } catch (e) {
                json = null;
              }
            }
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: json,
              rawBody: data
            });
          });
        });

        req.on('error', reject);

        if (body) {
          if (Buffer.isBuffer(body)) {
            req.write(body);
          } else if (typeof body === 'string') {
            req.write(body);
          } else {
            req.write(JSON.stringify(body));
          }
        }
        req.end();
      });
    }

    // Helper: multipart builder
    function createMultipartBody(fieldName, fileName, mimeType, buffer) {
      const boundary = '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex');
      const header = Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`
      );
      const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
      const payload = Buffer.concat([header, buffer, footer]);
      return {
        contentType: `multipart/form-data; boundary=${boundary}`,
        body: payload
      };
    }

    // Test User Setup
    const testUserIdA = `USR-TEST-${Date.now()}-A`;
    const testUserEmailA = `test.profile.a.${Date.now()}@salesflow.co`;
    const testPasswordInitial = 'InitialPass123!';
    const passwordHashA = await bcrypt.hash(testPasswordInitial, 10);

    const testUserIdB = `USR-TEST-${Date.now()}-B`;
    const testUserEmailB = `test.profile.b.${Date.now()}@salesflow.co`;
    const passwordHashB = await bcrypt.hash('AnotherPass123!', 10);

    // Insert test users
    await pool.query(
      'INSERT INTO users (id, email, name, passwordHash, status, createdAt) VALUES (?, ?, ?, ?, ?, NOW())',
      [testUserIdA, testUserEmailA, 'Tester Alpha', passwordHashA, 'ACTIVE']
    );
    cleanupUsers.push(testUserIdA);

    await pool.query(
      'INSERT INTO users (id, email, name, passwordHash, status, createdAt) VALUES (?, ?, ?, ?, ?, NOW())',
      [testUserIdB, testUserEmailB, 'Tester Beta', passwordHashB, 'ACTIVE']
    );
    cleanupUsers.push(testUserIdB);

    const [tenantRows] = await pool.query('SELECT id FROM tenants WHERE status = "ACTIVE" ORDER BY id ASC LIMIT 5');
    const tenantIdA = tenantRows.length > 0 ? tenantRows[0].id : 'TEN-00001';
    let tenantIdB = tenantRows.find(t => t.id !== tenantIdA)?.id;
    if (!tenantIdB) {
      tenantIdB = `TEN-TEST-ISOLATION-${Date.now()}`;
      await pool.query('INSERT INTO tenants (id, name, status, plan, createdAt) VALUES (?, ?, "ACTIVE", "ENTERPRISE", NOW())', [tenantIdB, 'Isolation Test Tenant']);
      cleanupTenants.push(tenantIdB);
    }

    const [roleRows] = await pool.query('SELECT id, name, scope, tenantId FROM roles LIMIT 5');
    const roleId = roleRows.length > 0 ? roleRows[0].id : 'ROL-ADM-001';

    // Membership for user A (in tenantIdA)
    const tuIdA = `TU-TEST-${Date.now()}-A`;
    await pool.query(
      'INSERT INTO tenant_users (id, tenantId, userId, isPrimary, status) VALUES (?, ?, ?, 1, "ACTIVE")',
      [tuIdA, tenantIdA, testUserIdA]
    );
    await pool.query(
      'INSERT INTO tenant_user_roles (id, tenantUserId, roleId) VALUES (?, ?, ?)',
      [`TUR-${Date.now()}-A`, tuIdA, roleId]
    );

    // Membership for user B (in separate tenantIdB)
    const tuIdB = `TU-TEST-${Date.now()}-B`;
    await pool.query(
      'INSERT INTO tenant_users (id, tenantId, userId, isPrimary, status) VALUES (?, ?, ?, 1, "ACTIVE")',
      [tuIdB, tenantIdB, testUserIdB]
    );
    await pool.query(
      'INSERT INTO tenant_user_roles (id, tenantUserId, roleId) VALUES (?, ?, ?)',
      [`TUR-${Date.now()}-B`, tuIdB, roleId]
    );

    // Helper: create session token
    async function createToken(userId) {
      const token = 'TEST_SESS_' + userId + '_' + crypto.randomBytes(8).toString('hex');
      await pool.query(
        'INSERT INTO auth_sessions (id, userId, token, expiresAt, createdAt) VALUES (UUID(), ?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY), NOW())',
        [userId, token]
      );
      cleanupSessions.push(token);
      return token;
    }

    const tokenA = await createToken(testUserIdA);
    const tokenB = await createToken(testUserIdB);

    console.log('--- TEST GROUP 1: DATABASE MIGRATION IDEMPOTENCY ---');
    const migResult = await migrateUserProfileSecurity();
    assert(migResult.success === true, 'Migration re-runs idempotently without error');

    const [colCheck] = await pool.query(`
      SELECT COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME IN ('phone', 'location', 'timezone', 'passwordChangedAt', 'avatar')
    `);
    const foundCols = colCheck.map(c => c.COLUMN_NAME.toLowerCase());
    assert(foundCols.includes('phone'), 'Column phone exists in users table');
    assert(foundCols.includes('location'), 'Column location exists in users table');
    assert(foundCols.includes('timezone'), 'Column timezone exists in users table');
    assert(foundCols.includes('passwordchangedat'), 'Column passwordChangedAt exists in users table');
    const avatarCol = colCheck.find(c => c.COLUMN_NAME.toLowerCase() === 'avatar');
    assert(avatarCol && avatarCol.CHARACTER_MAXIMUM_LENGTH >= 500, 'Column avatar expanded to >= 500 length', `length=${avatarCol?.CHARACTER_MAXIMUM_LENGTH}`);

    console.log('\n--- TEST GROUP 2: GET PROFILE API ---');
    const resGetProfile = await httpRequest({
      method: 'GET',
      path: '/api/users/me/profile',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(resGetProfile.status === 200, 'GET /api/users/me/profile returns 200', `status=${resGetProfile.status}`);
    assert(resGetProfile.body?.success === true, 'Profile response has success: true');
    assert(resGetProfile.body?.profile?.id === testUserIdA, 'Profile id matches authenticated userId');
    assert(resGetProfile.body?.profile?.email === testUserEmailA, 'Profile email matches authenticated user');
    assert(resGetProfile.body?.profile?.name === 'Tester Alpha', 'Profile name matches database');

    console.log('\n--- TEST GROUP 3: PUT PROFILE API ---');
    const resUpdateProfile = await httpRequest({
      method: 'PUT',
      path: '/api/users/me/profile',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json'
      },
      body: {
        name: 'Ahmad Ricky Updated',
        phone: '+62 812 9999 8888',
        location: 'Bandung, Indonesia',
        timezone: 'GMT+7 (WIB)'
      }
    });
    assert(resUpdateProfile.status === 200, 'PUT /api/users/me/profile returns 200', `status=${resUpdateProfile.status}`);
    assert(resUpdateProfile.body?.profile?.name === 'Ahmad Ricky Updated', 'Updated name reflected in response');
    assert(resUpdateProfile.body?.profile?.phone === '+62 812 9999 8888', 'Updated phone reflected in response');
    assert(resUpdateProfile.body?.profile?.location === 'Bandung, Indonesia', 'Updated location reflected in response');

    // Verify DB persistence
    const [dbUserRows] = await pool.query('SELECT name, phone, location, timezone FROM users WHERE id = ?', [testUserIdA]);
    assert(dbUserRows[0]?.name === 'Ahmad Ricky Updated', 'Database row name persisted');
    assert(dbUserRows[0]?.phone === '+62 812 9999 8888', 'Database row phone persisted');
    assert(dbUserRows[0]?.location === 'Bandung, Indonesia', 'Database row location persisted');

    // Test duplicate email rejection
    const resDupEmail = await httpRequest({
      method: 'PUT',
      path: '/api/users/me/profile',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json'
      },
      body: {
        name: 'Ahmad Ricky Updated',
        email: testUserEmailB // email owned by user B
      }
    });
    assert(resDupEmail.status === 409, 'Duplicate email update rejected with 409 Conflict', `status=${resDupEmail.status}`);
    assert(resDupEmail.body?.code === 'EMAIL_ALREADY_EXISTS', 'Rejection code is EMAIL_ALREADY_EXISTS');

    console.log('\n--- TEST GROUP 4: AVATAR UPLOAD VALIDATION & SECURITY ---');
    // Valid JPEG with magic bytes: FF D8 FF E0
    const validJpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x60, 0x00, 0x60, 0x00, 0x00, 0xff, 0xd9
    ]);
    const mpJpeg = createMultipartBody('avatar', 'avatar.jpg', 'image/jpeg', validJpeg);
    const resUploadJpeg = await httpRequest({
      method: 'POST',
      path: '/api/users/me/avatar',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': mpJpeg.contentType
      },
      body: mpJpeg.body
    });
    assert(resUploadJpeg.status === 200, 'Valid JPEG upload succeeds with 200', `status=${resUploadJpeg.status}`);
    assert(typeof resUploadJpeg.body?.avatarUrl === 'string' && resUploadJpeg.body?.avatarUrl.startsWith('/api/users/avatar/AVT-'), 'Returns canonical avatarUrl starting with /api/users/avatar/AVT-');
    const avatarFilename1 = resUploadJpeg.body?.filename;
    if (avatarFilename1) cleanupFiles.push(path.resolve(__dirname, 'storage/avatars', avatarFilename1));

    // Valid PNG with magic bytes: 89 50 4E 47 0D 0A 1A 0A
    const validPng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01
    ]);
    const mpPng = createMultipartBody('avatar', 'avatar.png', 'image/png', validPng);
    const resUploadPng = await httpRequest({
      method: 'POST',
      path: '/api/users/me/avatar',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': mpPng.contentType
      },
      body: mpPng.body
    });
    assert(resUploadPng.status === 200, 'Valid PNG upload succeeds with 200', `status=${resUploadPng.status}`);
    const avatarFilename2 = resUploadPng.body?.filename;
    if (avatarFilename2) cleanupFiles.push(path.resolve(__dirname, 'storage/avatars', avatarFilename2));

    // Old avatar file cleanup verification
    if (avatarFilename1) {
      const oldAvatarPath = path.resolve(__dirname, 'storage/avatars', avatarFilename1);
      assert(!fs.existsSync(oldAvatarPath), 'Previous avatar file was cleaned up from storage');
    }

    // Valid WEBP with magic bytes: RIFF....WEBP
    const validWebp = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      0x56, 0x50, 0x38, 0x20, 0x0e, 0x00, 0x00, 0x00, 0x30, 0x01, 0x00, 0x9d
    ]);
    const mpWebp = createMultipartBody('avatar', 'avatar.webp', 'image/webp', validWebp);
    const resUploadWebp = await httpRequest({
      method: 'POST',
      path: '/api/users/me/avatar',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': mpWebp.contentType
      },
      body: mpWebp.body
    });
    assert(resUploadWebp.status === 200, 'Valid WEBP upload succeeds with 200', `status=${resUploadWebp.status}`);
    const avatarFilename3 = resUploadWebp.body?.filename;
    if (avatarFilename3) cleanupFiles.push(path.resolve(__dirname, 'storage/avatars', avatarFilename3));

    // Test Fake Image / Corrupted magic bytes
    const fakeImage = Buffer.from('<?php echo "MALICIOUS"; ?>not a real image');
    const mpFake = createMultipartBody('avatar', 'malicious.jpg', 'image/jpeg', fakeImage);
    const resUploadFake = await httpRequest({
      method: 'POST',
      path: '/api/users/me/avatar',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': mpFake.contentType
      },
      body: mpFake.body
    });
    assert(resUploadFake.status === 400, 'Fake image with invalid magic bytes rejected with 400', `status=${resUploadFake.status}`);
    assert(resUploadFake.body?.code === 'INVALID_IMAGE_FILE', 'Rejection code is INVALID_IMAGE_FILE');

    // Test Oversized File (> 2MB)
    const largeBuffer = Buffer.alloc(2.5 * 1024 * 1024, 0x41);
    const mpLarge = createMultipartBody('avatar', 'oversized.jpg', 'image/jpeg', largeBuffer);
    const resUploadLarge = await httpRequest({
      method: 'POST',
      path: '/api/users/me/avatar',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': mpLarge.contentType
      },
      body: mpLarge.body
    });
    assert(resUploadLarge.status === 400, 'File exceeding 2MB rejected with 400', `status=${resUploadLarge.status}`);
    assert(resUploadLarge.body?.code === 'FILE_TOO_LARGE', 'Rejection code is FILE_TOO_LARGE');

    console.log('\n--- TEST GROUP 5: AVATAR STREAMING & ACCESS CONTROL ---');
    // Stream with Bearer Header
    const resStreamHeader = await httpRequest({
      method: 'GET',
      path: `/api/users/avatar/${avatarFilename3}`,
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(resStreamHeader.status === 200, 'Avatar streaming with Bearer Authorization succeeds with 200', `status=${resStreamHeader.status}`);
    assert(resStreamHeader.headers['content-type'] === 'image/webp', 'Avatar Content-Type is image/webp', `content-type=${resStreamHeader.headers['content-type']}`);

    // Stream with Query Token - MUST be rejected with 401 (URL token leakage eliminated)
    const resStreamQuery = await httpRequest({
      method: 'GET',
      path: `/api/users/avatar/${avatarFilename3}?token=${tokenA}`
    });
    assert(resStreamQuery.status === 401, 'Avatar streaming with ?token=... is rejected with 401 (URL token leakage eliminated)', `status=${resStreamQuery.status}`);

    // Stream without any token (verifies no unauthorized public leak)
    const resStreamNoAuth = await httpRequest({
      method: 'GET',
      path: `/api/users/avatar/${avatarFilename3}`
    });
    assert(resStreamNoAuth.status === 401, 'Avatar streaming without token returns 401 Unauthorized', `status=${resStreamNoAuth.status}`);

    // Directory traversal attempt
    const resTraversal = await httpRequest({
      method: 'GET',
      path: '/api/users/avatar/..%2F..%2Fpackage.json',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(resTraversal.status === 400 || resTraversal.status === 403, 'Path traversal attack rejected with 400/403', `status=${resTraversal.status}`);

    // Cross-tenant avatar access rejection (User B in Tenant B requesting User A's avatar in Tenant A)
    const resCrossTenant = await httpRequest({
      method: 'GET',
      path: `/api/users/avatar/${avatarFilename3}`,
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(resCrossTenant.status === 403, 'Cross-tenant avatar access rejected with 403 Forbidden', `status=${resCrossTenant.status}`);
    assert(resCrossTenant.body?.code === 'CROSS_TENANT_ACCESS_DENIED', 'Rejection code is CROSS_TENANT_ACCESS_DENIED');

    // Multi-user reference avatar preservation
    // User B also references avatarFilename3
    await pool.query('UPDATE users SET avatar = ? WHERE id = ?', [`/api/users/avatar/${avatarFilename3}`, testUserIdB]);
    
    // Now User A uploads a brand new avatar (avatar 4)
    const validPng4 = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x02
    ]);
    const mpPng4 = createMultipartBody('avatar', 'avatar4.png', 'image/png', validPng4);
    const resUpload4 = await httpRequest({
      method: 'POST',
      path: '/api/users/me/avatar',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': mpPng4.contentType
      },
      body: mpPng4.body
    });
    assert(resUpload4.status === 200, 'User A uploads replacement avatar succeeds with 200', `status=${resUpload4.status}`);
    const avatarFilename4 = resUpload4.body?.filename;
    if (avatarFilename4) cleanupFiles.push(path.resolve(__dirname, 'storage/avatars', avatarFilename4));

    // avatarFilename3 must STILL exist on disk because User B references it
    const sharedAvatarPath = path.resolve(__dirname, 'storage/avatars', avatarFilename3);
    assert(fs.existsSync(sharedAvatarPath), 'Multi-referenced avatar file preserved on disk when User A updates avatar');

    // Token leakage audit in frontend source code (Avatar.tsx)
    const avatarComponentContent = fs.readFileSync(path.resolve(__dirname, '../src/components/common/Avatar.tsx'), 'utf8');
    assert(!avatarComponentContent.includes('?token='), 'Avatar.tsx contains ZERO occurrences of raw ?token= query parameter');
    assert(avatarComponentContent.includes('Authorization'), 'Avatar.tsx uses Authorization header for fetching avatar');
    assert(avatarComponentContent.includes('URL.createObjectURL'), 'Avatar.tsx converts avatar response to blob URL');

    console.log('\n--- TEST GROUP 6: CHANGE PASSWORD SECURITY ---');
    // Incorrect current password
    const resWrongOld = await httpRequest({
      method: 'PUT',
      path: '/api/users/me/change-password',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json'
      },
      body: {
        currentPassword: 'WrongPassword999!',
        newPassword: 'BrandNewPass123!',
        confirmPassword: 'BrandNewPass123!'
      }
    });
    assert(resWrongOld.status === 400, 'Incorrect current password rejected with 400', `status=${resWrongOld.status}`);
    assert(resWrongOld.body?.code === 'INVALID_CURRENT_PASSWORD', 'Rejection code is INVALID_CURRENT_PASSWORD');

    // Weak password - missing number & uppercase
    const resWeak = await httpRequest({
      method: 'PUT',
      path: '/api/users/me/change-password',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json'
      },
      body: {
        currentPassword: testPasswordInitial,
        newPassword: 'short',
        confirmPassword: 'short'
      }
    });
    assert(resWeak.status === 400, 'Password shorter than 8 chars rejected with 400', `status=${resWeak.status}`);
    assert(resWeak.body?.code === 'PASSWORD_TOO_SHORT', 'Rejection code is PASSWORD_TOO_SHORT');

    // Password mismatch
    const resMismatch = await httpRequest({
      method: 'PUT',
      path: '/api/users/me/change-password',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json'
      },
      body: {
        currentPassword: testPasswordInitial,
        newPassword: 'ValidNewPassword123!',
        confirmPassword: 'MismatchPassword123!'
      }
    });
    assert(resMismatch.status === 400, 'Password mismatch rejected with 400', `status=${resMismatch.status}`);
    assert(resMismatch.body?.code === 'PASSWORDS_DO_NOT_MATCH', 'Rejection code is PASSWORDS_DO_NOT_MATCH');

    // New password same as old
    const resSame = await httpRequest({
      method: 'PUT',
      path: '/api/users/me/change-password',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json'
      },
      body: {
        currentPassword: testPasswordInitial,
        newPassword: testPasswordInitial,
        confirmPassword: testPasswordInitial
      }
    });
    assert(resSame.status === 400, 'New password identical to current rejected with 400', `status=${resSame.status}`);
    assert(resSame.body?.code === 'PASSWORD_SAME_AS_OLD', 'Rejection code is PASSWORD_SAME_AS_OLD');

    // Valid change password
    const brandNewPassword = 'SuperSecretNewPass2026!';
    const resValidChange = await httpRequest({
      method: 'PUT',
      path: '/api/users/me/change-password',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json'
      },
      body: {
        currentPassword: testPasswordInitial,
        newPassword: brandNewPassword,
        confirmPassword: brandNewPassword
      }
    });
    assert(resValidChange.status === 200, 'Valid change password succeeds with 200', `status=${resValidChange.status}`);
    assert(resValidChange.body?.success === true, 'Response contains success: true');
    assert(typeof resValidChange.body?.passwordChangedAt === 'string', 'Response contains passwordChangedAt timestamp');

    // Verify DB passwordChangedAt
    const [userRowAfter] = await pool.query('SELECT passwordChangedAt FROM users WHERE id = ?', [testUserIdA]);
    assert(userRowAfter[0]?.passwordChangedAt !== null, 'Database passwordChangedAt is populated');

    // Verify login with OLD password fails
    const resLoginOld = await httpRequest({
      method: 'POST',
      path: '/api/auth/login',
      headers: { 'Content-Type': 'application/json' },
      body: {
        email: testUserEmailA,
        password: testPasswordInitial
      }
    });
    assert(resLoginOld.status === 401, 'Login with old password now fails with 401');

    // Verify login with NEW password succeeds
    const resLoginNew = await httpRequest({
      method: 'POST',
      path: '/api/auth/login',
      headers: { 'Content-Type': 'application/json' },
      body: {
        email: testUserEmailA,
        password: brandNewPassword
      }
    });
    assert(resLoginNew.status === 200, 'Login with new password succeeds with 200');
    assert(resLoginNew.body?.user?.id === testUserIdA, 'Login user id matches');
    assert(resLoginNew.body?.user?.phone === '+62 812 9999 8888', 'Login returns updated profile phone');
    assert(resLoginNew.body?.user?.avatarUrl === `/api/users/avatar/${avatarFilename4}`, 'Login returns updated avatarUrl');
    assert(resLoginNew.body?.user?.passwordChangedAt !== null, 'Login returns passwordChangedAt timestamp');

    // Verify Password Storage & Audit Logging Security (No plaintext leak)
    const [auditRows] = await pool.query(
      'SELECT description FROM audit_logs WHERE userId = ? OR entityId = ?',
      [testUserIdA, testUserIdA]
    );
    let plaintextLeakedInAudit = false;
    for (const row of auditRows) {
      const raw = JSON.stringify(row);
      if (raw.includes(brandNewPassword) || raw.includes(testPasswordInitial) || raw.includes('SuperSecretNewPass')) {
        plaintextLeakedInAudit = true;
        break;
      }
    }
    assert(!plaintextLeakedInAudit, 'Audit logs contain ZERO plaintext passwords or secrets');

    const [userSecurityRows] = await pool.query('SELECT passwordHash FROM users WHERE id = ?', [testUserIdA]);
    const hashVal = userSecurityRows[0]?.passwordHash || '';
    assert(hashVal.startsWith('$2a$') || hashVal.startsWith('$2b$'), 'User passwordHash is securely hashed with bcrypt', `hashPrefix=${hashVal.substring(0, 4)}`);

    console.log('\n--- TEST GROUP 7: PRINCIPAL ISOLATION ---');
    // User B calls GET /me/profile -> gets User B data, not User A data
    const resGetProfileB = await httpRequest({
      method: 'GET',
      path: '/api/users/me/profile',
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(resGetProfileB.body?.profile?.id === testUserIdB, 'User B profile id is strictly User B (no cross-contamination)');
    assert(resGetProfileB.body?.profile?.email === testUserEmailB, 'User B profile email is strictly User B');

    // User A cannot modify User B even if targetUserId is supplied in request body
    const resSpoof = await httpRequest({
      method: 'PUT',
      path: '/api/users/me/profile',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json'
      },
      body: {
        id: testUserIdB,
        userId: testUserIdB,
        name: 'Hacked Name'
      }
    });
    // Target B should remain untouched
    const [userBRow] = await pool.query('SELECT name FROM users WHERE id = ?', [testUserIdB]);
    assert(userBRow[0]?.name === 'Tester Beta', 'User B was not modified by User A request (principal isolation enforced)');

    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
    console.log('================================================================');

    if (failed > 0) {
      throw new Error(`${failed} tests failed!`);
    }
  } finally {
    // Cleanup
    for (const t of cleanupSessions) {
      await pool.query('DELETE FROM auth_sessions WHERE token = ?', [t]).catch(() => {});
    }
    for (const u of cleanupUsers) {
      await pool.query('DELETE FROM tenant_user_roles WHERE tenantUserId IN (SELECT id FROM tenant_users WHERE userId = ?)', [u]).catch(() => {});
      await pool.query('DELETE FROM tenant_users WHERE userId = ?', [u]).catch(() => {});
      await pool.query('DELETE FROM users WHERE id = ?', [u]).catch(() => {});
    }
    for (const tn of cleanupTenants) {
      await pool.query('DELETE FROM tenants WHERE id = ?', [tn]).catch(() => {});
    }
    for (const f of cleanupFiles) {
      if (fs.existsSync(f)) {
        try { fs.unlinkSync(f); } catch (e) {}
      }
    }
    if (server) {
      await new Promise(r => server.close(r));
    }
  }
}

runUserProfileSecurityTests()
  .then(() => {
    console.log('\nAll User Profile & Security tests completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nTests failed with error:', err);
    process.exit(1);
  });
