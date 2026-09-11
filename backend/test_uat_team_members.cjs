const http = require('http');
const { pool } = require('./dist/db.js');
const { app } = require('./dist/server.js');
const { runUat067TeamsMigration } = require('./dist/migrations/migrate_uat_067_teams.js');
const { normalizeSemanticRole } = require('./dist/routes/navigation.routes.js');

async function runTeamMembersTests() {
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
  console.log('SALESFLOW PRO: UAT-067 TEAM MEMBERS CRUD & AUTHORIZATION SUITE');
  console.log('================================================================\n');

  let server;
  let baseUrl;
  const cleanupSessions = [];
  const cleanupTeams = [];
  const cleanupUsers = [];
  const cleanupRoles = [];

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

    const tenantAId = 'TEN-00001';
    const tenantBId = 'TEN-1788421036233-8a15a6';

    const adminAId = 'USR-001'; // TENANT_ADMIN
    const supervisorAId = 'USR-004'; // SUPERVISOR
    const managerAId = 'USR-003'; // SALES_MANAGER
    const repA1Id = 'USR-002'; // SALES_REP
    const repA2Id = 'USR-005'; // SALES_REP
    const adminBId = 'USR-1788421036236-03514c'; // TENANT_ADMIN Tenant B

    // Helper to create tokens
    async function createToken(userId) {
      const token = 'UAT_TEAM_' + userId.replace(/[^a-zA-Z0-9]/g, '_') + '_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      await pool.query(`
        INSERT INTO auth_sessions (id, userId, token, expiresAt, createdAt)
        VALUES (UUID(), ?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY), NOW())
      `, [userId, token]);
      cleanupSessions.push(token);
      return token;
    }

    const tokenAdminA = await createToken(adminAId);
    const tokenSupA = await createToken(supervisorAId);
    const tokenMgrA = await createToken(managerAId);
    const tokenRepA1 = await createToken(repA1Id);
    const tokenRepA2 = await createToken(repA2Id);
    const tokenAdminB = await createToken(adminBId);

    const headersAdminA = { 'Authorization': `Bearer ${tokenAdminA}`, 'Content-Type': 'application/json' };
    const headersSupA = { 'Authorization': `Bearer ${tokenSupA}`, 'Content-Type': 'application/json' };
    const headersMgrA = { 'Authorization': `Bearer ${tokenMgrA}`, 'Content-Type': 'application/json' };
    const headersRepA1 = { 'Authorization': `Bearer ${tokenRepA1}`, 'Content-Type': 'application/json' };
    const headersAdminB = { 'Authorization': `Bearer ${tokenAdminB}`, 'Content-Type': 'application/json' };

    async function request(path, options = {}) {
      const url = new URL(path, baseUrl);
      return new Promise((resolve, reject) => {
        const req = http.request(url, options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            let json = null;
            try {
              json = JSON.parse(data);
            } catch (e) {
              json = data;
            }
            resolve({ status: res.statusCode, headers: res.headers, body: json });
          });
        });
        req.on('error', reject);
        if (options.body) {
          req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
        }
        req.end();
      });
    }

    // ─────────────────────────────────────────────────────────────
    // SUITE 1: Migration Idempotency, Transaction Rollback & Actual FK Metadata
    // ─────────────────────────────────────────────────────────────
    console.log('--- 1. Testing Database Migration Idempotency & Transaction Control ---');
    // Ensure any stale duplicate test rows are cleared
    await pool.query('DELETE FROM teams WHERE name LIKE "Conflict Dup Team%" OR id LIKE "temp-dup-%"');

    // Ensure initial baseline migration is executed
    await runUat067TeamsMigration();

    // Test rerun for true idempotency
    const migReport = await runUat067TeamsMigration();
    assert(migReport.success === true, '1.1 Migration rerun succeeds idempotently', `transactionStatus=${migReport.transactionStatus}`);
    assert(migReport.transactionStatus === 'COMMITTED', '1.2 Transaction status is COMMITTED');
    assert(
      migReport.teamsTenantIndexAdded === false && migReport.uniqueTenantNameConstraintAdded === false,
      '1.3 Migration rerun does not re-add existing constraints or indexes',
      'No duplicate indexes'
    );

    // Actual Foreign Key metadata test
    console.log('\n--- 2. Testing Actual Database Foreign Key Metadata ---');
    assert(Array.isArray(migReport.foreignKeysActual), '2.1 foreignKeysActual is an array from database metadata');
    const [dbFkCheck] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
      WHERE k.TABLE_SCHEMA = DATABASE() 
        AND k.TABLE_NAME IN ('teams', 'team_members') 
        AND k.REFERENCED_TABLE_NAME IS NOT NULL
    `);
    const actualFkCountInDb = dbFkCheck[0]?.count || 0;
    assert(
      migReport.foreignKeysActual.length === actualFkCountInDb,
      '2.2 Migration reported actual FK count matches information_schema query exactly',
      `count=${actualFkCountInDb}`
    );

    // Test migration failure and rollback when duplicate team names exist
    // Drop unique index first so we can insert duplicates to test migration detection
    const [existingIdx] = await pool.query('SHOW INDEX FROM teams WHERE Key_name = "uq_teams_tenant_name"');
    if (existingIdx.length > 0) {
      await pool.query('DROP INDEX uq_teams_tenant_name ON teams');
    }

    await pool.query('DELETE FROM teams WHERE id LIKE "temp-dup-%"');
    const dupTestName = 'Conflict Dup Team ' + Date.now();
    const dupId1 = 'temp-dup-' + Date.now() + '-1';
    const dupId2 = 'temp-dup-' + Date.now() + '-2';
    await pool.query('INSERT INTO teams (id, tenantId, name) VALUES (?, ?, ?)', [dupId1, tenantAId, dupTestName]);
    await pool.query('INSERT INTO teams (id, tenantId, name) VALUES (?, ?, ?)', [dupId2, tenantAId, dupTestName]);

    const migFailReport = await runUat067TeamsMigration();
    assert(migFailReport.success === false, '3.1 Migration returns success=false when duplicates exist');
    assert(migFailReport.constraintPending === true, '3.2 Migration sets constraintPending=true');
    assert(migFailReport.transactionStatus === 'ROLLED_BACK', '3.3 Transaction status is ROLLED_BACK');
    assert(
      Array.isArray(migFailReport.duplicatesFound) && migFailReport.duplicatesFound.length > 0,
      '3.4 Migration report includes duplicate groups list',
      `groups=${migFailReport.duplicatesFound.length}`
    );

    // Clean up temporary duplicates and re-run migration to restore constraint
    await pool.query('DELETE FROM teams WHERE id IN (?, ?)', [dupId1, dupId2]);
    const migRestoreReport = await runUat067TeamsMigration();
    assert(migRestoreReport.success === true, '3.5 Migration succeeds and restores constraint after duplicates are resolved');
    assert(migRestoreReport.transactionStatus === 'COMMITTED', '3.6 Restored migration committed successfully');

    // ─────────────────────────────────────────────────────────────
    // SUITE 2: Unified Role Normalization (Prefixed & Legacy Roles)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 4. Testing Unified Role Normalization ---');
    assert(normalizeSemanticRole('ROLE_TENANT_ADMIN') === 'TENANT_ADMIN', '4.1 normalizeSemanticRole handles ROLE_TENANT_ADMIN');
    assert(normalizeSemanticRole('ROL-ADM-001') === 'TENANT_ADMIN', '4.2 normalizeSemanticRole handles ROL-ADM-*');
    assert(normalizeSemanticRole('ROLE_SUPER_ADMIN') === 'SUPER_ADMIN', '4.3 normalizeSemanticRole handles ROLE_SUPER_ADMIN');
    assert(normalizeSemanticRole('ROLE_SUPERVISOR') === 'SUPERVISOR', '4.4 normalizeSemanticRole handles ROLE_SUPERVISOR');
    assert(normalizeSemanticRole('ROL-SUP-01') === 'SUPERVISOR', '4.5 normalizeSemanticRole handles ROL-SUP-*');
    assert(normalizeSemanticRole('ROLE_SALES_MANAGER') === 'SALES_MANAGER', '4.6 normalizeSemanticRole handles ROLE_SALES_MANAGER');
    assert(normalizeSemanticRole('ROL-MGR-01') === 'SALES_MANAGER', '4.7 normalizeSemanticRole handles ROL-MGR-*');
    assert(normalizeSemanticRole('ROLE_SALES_REP') === 'SALES_REP', '4.8 normalizeSemanticRole handles ROLE_SALES_REP');
    assert(normalizeSemanticRole('ROL-REP-01') === 'SALES_REP', '4.9 normalizeSemanticRole handles ROL-REP-*');

    // Test E2E HTTP with custom role code
    const legacyRoleCode = 'ROL-ADM-LEGACY-TEST';
    const legacyRoleId = 'ROLE-LEGACY-TEST-' + Date.now();
    await pool.query(`
      INSERT INTO roles (id, tenantId, name, code, scope)
      VALUES (?, ?, 'Legacy Admin', ?, 'TENANT')
    `, [legacyRoleId, tenantAId, legacyRoleCode]);
    cleanupRoles.push(legacyRoleId);

    const legacyUserId = 'USR-LEGACY-' + Date.now();
    await pool.query(`
      INSERT INTO users (id, name, email, passwordHash, status)
      VALUES (?, 'Legacy Admin User', 'legacy_admin@test.com', 'hash', 'ACTIVE')
    `, [legacyUserId]);
    cleanupUsers.push(legacyUserId);

    const legacyTuId = 'TU-LEGACY-' + Date.now();
    await pool.query(`
      INSERT INTO tenant_users (id, tenantId, userId, status, isPrimary)
      VALUES (?, ?, ?, 'ACTIVE', 1)
    `, [legacyTuId, tenantAId, legacyUserId]);

    await pool.query(`
      INSERT INTO tenant_user_roles (id, tenantUserId, roleId)
      VALUES (UUID(), ?, ?)
    `, [legacyTuId, legacyRoleId]);

    const legacyToken = await createToken(legacyUserId);
    const headersLegacyAdmin = { 'Authorization': `Bearer ${legacyToken}`, 'Content-Type': 'application/json' };

    const legacyCreateRes = await request('/api/teams', {
      method: 'POST',
      headers: headersLegacyAdmin,
      body: {
        name: 'Legacy Admin Created Team ' + Date.now(),
        description: 'Testing prefixed role authorization'
      }
    });
    assert(legacyCreateRes.status === 201, '4.10 User with ROL-ADM-* role successfully authorized to create team (201)', `status=${legacyCreateRes.status}`);
    if (legacyCreateRes.body.teamId) cleanupTeams.push(legacyCreateRes.body.teamId);

    // ─────────────────────────────────────────────────────────────
    // SUITE 3: Create Team & Validations
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 5. Testing Create Team & Validations ---');
    const teamNameA = 'Alpha Sales Unit ' + Date.now();
    const createRes = await request('/api/teams', {
      method: 'POST',
      headers: headersAdminA,
      body: {
        name: teamNameA,
        description: 'Primary corporate sales team'
      }
    });

    assert(createRes.status === 201, '5.1 POST /api/teams returns 201 Created', `status=${createRes.status}`);
    assert(!!createRes.body.teamId, '5.2 Response contains generated teamId', `teamId=${createRes.body.teamId}`);
    const teamAId = createRes.body.teamId;
    if (teamAId) cleanupTeams.push(teamAId);

    // Verify detail
    const detailRes = await request(`/api/teams/${teamAId}`, {
      method: 'GET',
      headers: headersAdminA
    });
    assert(detailRes.status === 200, '5.3 GET /api/teams/:id returns 200', `name=${detailRes.body.name}`);
    assert(detailRes.body.name === teamNameA, '5.4 Team name matches payload', `name=${detailRes.body.name}`);
    assert(Array.isArray(detailRes.body.members) && detailRes.body.members.length === 0, '5.5 Team initially has 0 members');

    // Duplicate name test
    const dupRes = await request('/api/teams', {
      method: 'POST',
      headers: headersAdminA,
      body: {
        name: teamNameA,
        description: 'Duplicate attempt'
      }
    });
    assert(dupRes.status === 409, '5.6 Duplicate team name returns 409 Conflict', `status=${dupRes.status}`);
    assert(dupRes.body.code === 'DUPLICATE_TEAM_NAME', '5.7 Error code is DUPLICATE_TEAM_NAME');

    // Invalid leader
    const invalidLeaderRes = await request('/api/teams', {
      method: 'POST',
      headers: headersAdminA,
      body: { name: 'Beta Team ' + Date.now(), leaderId: 'NON-EXISTENT-LEADER' }
    });
    assert(invalidLeaderRes.status === 400, '5.8 Non-existent leader returns 400', `status=${invalidLeaderRes.status}`);
    assert(invalidLeaderRes.body.code === 'INVALID_LEADER', '5.9 Error code is INVALID_LEADER');

    // Cross-tenant leader
    const crossLeaderRes = await request('/api/teams', {
      method: 'POST',
      headers: headersAdminA,
      body: { name: 'Gamma Team ' + Date.now(), leaderId: 'TU-1788421036333-0b5d97' }
    });
    assert(crossLeaderRes.status === 400, '5.10 Cross-tenant leader returns 400 Bad Request', `status=${crossLeaderRes.status}`);
    assert(crossLeaderRes.body.code === 'INVALID_LEADER', '5.11 Error code is INVALID_LEADER');

    // ─────────────────────────────────────────────────────────────
    // SUITE 4: Assign & Change Leader Synchronization
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 6. Testing Assign Leader & Change Leader ---');
    const assignLeaderRes = await request(`/api/teams/${teamAId}`, {
      method: 'PUT',
      headers: headersAdminA,
      body: { leaderId: 'TU-004' }
    });
    assert(assignLeaderRes.status === 200, '6.1 PUT /api/teams/:id updates leader — status=200');

    const verifyLeaderDetail = await request(`/api/teams/${teamAId}`, {
      method: 'GET',
      headers: headersAdminA
    });
    assert(verifyLeaderDetail.body.leaderId === 'TU-004', '6.2 Team leaderId updated to TU-004');
    assert(verifyLeaderDetail.body.leaderName === 'Sales Supervisor', '6.3 Leader name joined from users table');
    assert(
      verifyLeaderDetail.body.members.some(m => m.tenantUserId === 'TU-004' && m.teamRole === 'LEADER'),
      '6.4 Leader automatically synced into team_members with teamRole=LEADER'
    );

    // Change leader to TU-001 (Admin)
    const changeLeaderRes = await request(`/api/teams/${teamAId}`, {
      method: 'PUT',
      headers: headersAdminA,
      body: { leaderId: 'TU-001' }
    });
    assert(changeLeaderRes.status === 200, '6.5 PUT /api/teams/:id changes leader to TU-001');

    const verifyChangedLeader = await request(`/api/teams/${teamAId}`, {
      method: 'GET',
      headers: headersAdminA
    });
    assert(verifyChangedLeader.body.leaderId === 'TU-001', '6.6 Team leaderId updated to TU-001');
    assert(
      verifyChangedLeader.body.members.some(m => m.tenantUserId === 'TU-001' && m.teamRole === 'LEADER'),
      '6.7 New leader synced as LEADER in team_members'
    );
    assert(
      verifyChangedLeader.body.members.some(m => m.tenantUserId === 'TU-004' && m.teamRole === 'MEMBER'),
      '6.8 Previous leader demoted to MEMBER in team_members'
    );

    // Reassign back to TU-004 (Supervisor) for subsequent tests
    await request(`/api/teams/${teamAId}`, {
      method: 'PUT',
      headers: headersAdminA,
      body: { leaderId: 'TU-004' }
    });

    // ─────────────────────────────────────────────────────────────
    // SUITE 5: Member Management & Constraints
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 7. Testing Member Management & Constraints ---');
    const addMemberRes = await request(`/api/teams/${teamAId}/members`, {
      method: 'POST',
      headers: headersAdminA,
      body: { tenantUserId: 'TU-002', role: 'MEMBER' }
    });
    assert(addMemberRes.status === 201, '7.1 POST /api/teams/:id/members adds member — status=201');

    const dupMemberRes = await request(`/api/teams/${teamAId}/members`, {
      method: 'POST',
      headers: headersAdminA,
      body: { tenantUserId: 'TU-002', role: 'MEMBER' }
    });
    assert(dupMemberRes.status === 409, '7.2 Duplicate team member returns 409 Conflict');
    assert(dupMemberRes.body.code === 'DUPLICATE_TEAM_MEMBER', '7.3 Error code is DUPLICATE_TEAM_MEMBER');

    const crossMemberRes = await request(`/api/teams/${teamAId}/members`, {
      method: 'POST',
      headers: headersAdminA,
      body: { tenantUserId: 'TU-1788421036333-0b5d97', role: 'MEMBER' }
    });
    assert(crossMemberRes.status === 400, '7.4 Cross-tenant member addition returns 400');
    assert(crossMemberRes.body.code === 'CROSS_TENANT_USER_DENIED', '7.5 Error code is CROSS_TENANT_USER_DENIED');

    // ─────────────────────────────────────────────────────────────
    // SUITE 6: Role Authorization & Boundaries
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 8. Testing Role Authorization Boundaries ---');
    const repCreateRes = await request('/api/teams', {
      method: 'POST',
      headers: headersRepA1,
      body: { name: 'Illegal Rep Team' }
    });
    assert(repCreateRes.status === 403, '8.1 SALES_REP cannot create team (403)');
    assert(repCreateRes.body.code === 'FORBIDDEN', '8.2 Error code is FORBIDDEN');

    const mgrDeleteRes = await request(`/api/teams/${teamAId}`, {
      method: 'DELETE',
      headers: headersMgrA
    });
    assert(mgrDeleteRes.status === 403, '8.3 SALES_MANAGER cannot delete team (403)');

    const repAddMemberRes = await request(`/api/teams/${teamAId}/members`, {
      method: 'POST',
      headers: headersRepA1,
      body: { tenantUserId: 'TU-005', role: 'MEMBER' }
    });
    assert(repAddMemberRes.status === 403, '8.4 SALES_REP cannot add team member (403)');

    // Supervisor Permissions: Own Team vs Outside Team
    const supAddOwnRes = await request(`/api/teams/${teamAId}/members`, {
      method: 'POST',
      headers: headersSupA,
      body: { tenantUserId: 'TU-005', role: 'MEMBER' }
    });
    assert(supAddOwnRes.status === 201, '8.5 Supervisor can add member to their own team');

    const supAssignLeaderRes = await request(`/api/teams/${teamAId}/members`, {
      method: 'POST',
      headers: headersSupA,
      body: { tenantUserId: 'TU-IMG-1', role: 'LEADER' }
    });
    assert(supAssignLeaderRes.status === 403, '8.6 Supervisor cannot assign a LEADER (403)');

    const team2Res = await request('/api/teams', {
      method: 'POST',
      headers: headersAdminA,
      body: { name: 'Delta Team ' + Date.now(), leaderId: 'TU-001' }
    });
    const team2Id = team2Res.body.teamId;
    if (team2Id) cleanupTeams.push(team2Id);

    const supAddOtherRes = await request(`/api/teams/${team2Id}/members`, {
      method: 'POST',
      headers: headersSupA,
      body: { tenantUserId: 'TU-IMG-2', role: 'MEMBER' }
    });
    assert(supAddOtherRes.status === 403, '8.7 Supervisor cannot add member to a team they do not lead (403)');

    // ─────────────────────────────────────────────────────────────
    // SUITE 7: Tenant Isolation (BOLA Guard)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 9. Testing Multi-Tenant Isolation ---');
    const tBViewTeamARes = await request(`/api/teams/${teamAId}`, {
      method: 'GET',
      headers: headersAdminB
    });
    assert(tBViewTeamARes.status === 404, '9.1 Tenant B cannot view Tenant A team (404)');

    const tBDeleteTeamARes = await request(`/api/teams/${teamAId}`, {
      method: 'DELETE',
      headers: headersAdminB
    });
    assert(tBDeleteTeamARes.status === 404, '9.2 Tenant B cannot delete Tenant A team (404)');

    // ─────────────────────────────────────────────────────────────
    // SUITE 8: Leader Removal Guard & Team Deletion
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 10. Testing Leader Removal Guard & Deletion ---');
    const removeLeaderRes = await request(`/api/teams/${teamAId}/members/TU-004`, {
      method: 'DELETE',
      headers: headersAdminA
    });
    assert(removeLeaderRes.status === 400, '10.1 Removing leader without replacement is blocked (400)');
    assert(removeLeaderRes.body.code === 'CANNOT_REMOVE_LEADER', '10.2 Error code is CANNOT_REMOVE_LEADER');

    const removeMemberRes = await request(`/api/teams/${teamAId}/members/TU-005`, {
      method: 'DELETE',
      headers: headersAdminA
    });
    assert(removeMemberRes.status === 200, '10.3 Regular member can be removed successfully (200)');

    const verifyAfterRemove = await request(`/api/teams/${teamAId}`, {
      method: 'GET',
      headers: headersAdminA
    });
    assert(!verifyAfterRemove.body.members.some(m => m.tenantUserId === 'TU-005'), '10.4 Removed member no longer in members array');

    // Deleting team with members
    const deleteBlockedRes = await request(`/api/teams/${teamAId}`, {
      method: 'DELETE',
      headers: headersAdminA
    });
    assert(deleteBlockedRes.status === 400, '10.5 Deleting team with members returns 400');
    assert(deleteBlockedRes.body.code === 'TEAM_HAS_MEMBERS', '10.6 Error code is TEAM_HAS_MEMBERS');

    // Force delete team2Id
    const deleteTeam2Res = await request(`/api/teams/${team2Id}?force=true`, {
      method: 'DELETE',
      headers: headersAdminA
    });
    assert(deleteTeam2Res.status === 200, '10.7 DELETE ?force=true deletes team and relations in transaction');

    const verifyTeam2Deleted = await request(`/api/teams/${team2Id}`, {
      method: 'GET',
      headers: headersAdminA
    });
    assert(verifyTeam2Deleted.status === 404, '10.8 Deleted team returns 404 Not Found');

    // ─────────────────────────────────────────────────────────────
    // SUITE 9: TEAM-Scoped Data Visibility Integration
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 11. Testing TEAM-Scoped Visibility Across Modules ---');
    const testFollowUpDate = '2026-09-30';
    await pool.query(`
      INSERT INTO follow_ups (id, tenantId, title, picId, createdById, followUpDate, status, notes)
      VALUES (UUID(), ?, 'Team UAT Customer', ?, ?, ?, 'PENDING', 'Team scope test note')
    `, [tenantAId, repA1Id, repA1Id, testFollowUpDate]);

    // Query follow-ups as Supervisor A with scope=team
    const supTeamFuRes = await request('/api/follow_ups?scope=team', {
      method: 'GET',
      headers: headersSupA
    });
    assert(supTeamFuRes.status === 200, '11.1 GET /api/follow_ups?scope=team returns 200 for Supervisor');
    const fuList = Array.isArray(supTeamFuRes.body) ? supTeamFuRes.body : supTeamFuRes.body.data || [];
    assert(
      fuList.some(f => f.title === 'Team UAT Customer' && f.picId === repA1Id),
      '11.2 Supervisor sees teammate (Rep A1) follow-up under TEAM scope'
    );

    // Query activities as Supervisor A with scope=all / team
    const supTeamActRes = await request('/api/activities?scope=all', {
      method: 'GET',
      headers: headersSupA
    });
    assert(supTeamActRes.status === 200, '11.3 GET /api/activities?scope=all returns 200 for Supervisor');

    // Tenant B Admin CANNOT see Tenant A follow-up
    const tBFuRes = await request('/api/follow_ups?scope=all', {
      method: 'GET',
      headers: headersAdminB
    });
    const tbList = Array.isArray(tBFuRes.body) ? tBFuRes.body : tBFuRes.body.data || [];
    assert(
      !tbList.some(f => f.title === 'Team UAT Customer'),
      '11.4 Tenant B cannot see Tenant A follow-up under any scope'
    );

    // Clean up test follow-up
    await pool.query('DELETE FROM follow_ups WHERE title = "Team UAT Customer" AND tenantId = ?', [tenantAId]);

    // Force delete teamAId
    await request(`/api/teams/${teamAId}?force=true`, {
      method: 'DELETE',
      headers: headersAdminA
    });

  } catch (err) {
    console.error('Test execution fatal error:', err);
    failed++;
  } finally {
    // Cleanup sessions
    if (cleanupSessions.length > 0) {
      await pool.query('DELETE FROM auth_sessions WHERE token IN (?)', [cleanupSessions]);
    }
    // Cleanup teams
    if (cleanupTeams.length > 0) {
      await pool.query('DELETE FROM team_members WHERE teamId IN (?)', [cleanupTeams]);
      await pool.query('DELETE FROM teams WHERE id IN (?)', [cleanupTeams]);
    }
    // Cleanup test users & roles
    if (cleanupUsers.length > 0) {
      await pool.query('DELETE FROM tenant_user_roles WHERE tenantUserId IN (SELECT id FROM tenant_users WHERE userId IN (?))', [cleanupUsers]);
      await pool.query('DELETE FROM tenant_users WHERE userId IN (?)', [cleanupUsers]);
      await pool.query('DELETE FROM users WHERE id IN (?)', [cleanupUsers]);
    }
    if (cleanupRoles.length > 0) {
      await pool.query('DELETE FROM roles WHERE id IN (?)', [cleanupRoles]);
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTeamMembersTests();
