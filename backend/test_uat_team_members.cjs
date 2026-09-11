const http = require('http');
const { pool } = require('./dist/db.js');
const { app } = require('./dist/server.js');
const { runUat067TeamsMigration } = require('./dist/migrations/migrate_uat_067_teams.js');

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
  console.log('SALESFLOW PRO: UAT-067 TEAM MEMBERS CRUD & TEAM AUTHORIZATION');
  console.log('================================================================\n');

  let server;
  let baseUrl;
  const cleanupSessions = [];
  const cleanupTeams = [];

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
      const token = 'UAT_TEAM_' + userId.replace(/[^a-zA-Z0-9]/g, '_') + '_' + Date.now();
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
    // TEST 1: Migration Rerun Without Duplication
    // ─────────────────────────────────────────────────────────────
    console.log('--- 1. Testing Database Migration Idempotency ---');
    const migReport = await runUat067TeamsMigration();
    assert(
      migReport.success === true,
      'Migration rerun succeeds idempotently',
      `teamsTenantIndexAdded=${migReport.teamsTenantIndexAdded}`
    );
    assert(
      migReport.teamsTenantIndexAdded === false && migReport.uniqueTenantNameConstraintAdded === false,
      'Migration rerun does not re-add existing constraints or indexes',
      'No duplication'
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 2: Create Team (Admin)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 2. Testing Create Team ---');
    const teamNameA = 'Alpha Sales Unit ' + Date.now();
    const createRes = await request('/api/teams', {
      method: 'POST',
      headers: headersAdminA,
      body: {
        name: teamNameA,
        description: 'Primary corporate sales team'
      }
    });

    assert(createRes.status === 201, 'POST /api/teams returns 201 Created', `status=${createRes.status}`);
    assert(!!createRes.body.teamId, 'Response contains generated teamId', `teamId=${createRes.body.teamId}`);
    const teamAId = createRes.body.teamId;
    if (teamAId) cleanupTeams.push(teamAId);

    // Verify team exists via GET /api/teams/:id
    const detailRes = await request(`/api/teams/${teamAId}`, {
      method: 'GET',
      headers: headersAdminA
    });
    assert(detailRes.status === 200, 'GET /api/teams/:id returns 200', `name=${detailRes.body.name}`);
    assert(detailRes.body.name === teamNameA, 'Team name matches payload', `name=${detailRes.body.name}`);
    assert(Array.isArray(detailRes.body.members) && detailRes.body.members.length === 0, 'Team initially has 0 members');

    // ─────────────────────────────────────────────────────────────
    // TEST 3: Duplicate Team Name Rejection
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 3. Testing Duplicate Team Name in Same Tenant ---');
    const dupRes = await request('/api/teams', {
      method: 'POST',
      headers: headersAdminA,
      body: {
        name: teamNameA, // duplicate
        description: 'Duplicate team attempt'
      }
    });
    assert(dupRes.status === 409, 'Duplicate team name returns 409 Conflict', `status=${dupRes.status}`);
    assert(dupRes.body.code === 'DUPLICATE_TEAM_NAME', 'Error code is DUPLICATE_TEAM_NAME', `code=${dupRes.body.code}`);

    // ─────────────────────────────────────────────────────────────
    // TEST 4: Invalid Leader & Cross-Tenant Leader Validation
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 4. Testing Leader Validation on Create/Update ---');
    const invalidLeaderRes = await request('/api/teams', {
      method: 'POST',
      headers: headersAdminA,
      body: {
        name: 'Beta Team ' + Date.now(),
        leaderId: 'NON-EXISTENT-LEADER-ID'
      }
    });
    assert(invalidLeaderRes.status === 400, 'Non-existent leader returns 400', `status=${invalidLeaderRes.status}`);
    assert(invalidLeaderRes.body.code === 'INVALID_LEADER', 'Error code is INVALID_LEADER', `code=${invalidLeaderRes.body.code}`);

    // Cross-tenant leader (User from Tenant B assigned to Tenant A team)
    const crossLeaderRes = await request('/api/teams', {
      method: 'POST',
      headers: headersAdminA,
      body: {
        name: 'Gamma Team ' + Date.now(),
        leaderId: 'TU-1788421036333-0b5d97' // Tenant B user
      }
    });
    assert(crossLeaderRes.status === 400, 'Cross-tenant leader returns 400 Bad Request', `status=${crossLeaderRes.status}`);
    assert(crossLeaderRes.body.code === 'INVALID_LEADER', 'Error code is INVALID_LEADER', `code=${crossLeaderRes.body.code}`);

    // ─────────────────────────────────────────────────────────────
    // TEST 5: Assign Leader & Change Leader
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 5. Testing Assign Leader & Change Leader ---');
    // Assign USR-004 (TU-004) as leader
    const assignLeaderRes = await request(`/api/teams/${teamAId}`, {
      method: 'PUT',
      headers: headersAdminA,
      body: {
        leaderId: 'TU-004'
      }
    });
    assert(assignLeaderRes.status === 200, 'PUT /api/teams/:id updates leader', `status=${assignLeaderRes.status}`);

    const verifyLeaderDetail = await request(`/api/teams/${teamAId}`, {
      method: 'GET',
      headers: headersAdminA
    });
    assert(verifyLeaderDetail.body.leaderId === 'TU-004', 'Team leaderId updated to TU-004');
    assert(verifyLeaderDetail.body.leaderName === 'Sales Supervisor', 'Leader name is joined from users table');
    assert(
      verifyLeaderDetail.body.members.some(m => m.tenantUserId === 'TU-004' && m.teamRole === 'LEADER'),
      'Leader automatically synced into team_members with teamRole=LEADER'
    );

    // Change leader to Admin (TU-001)
    const changeLeaderRes = await request(`/api/teams/${teamAId}`, {
      method: 'PUT',
      headers: headersAdminA,
      body: {
        leaderId: 'TU-001'
      }
    });
    assert(changeLeaderRes.status === 200, 'PUT /api/teams/:id changes leader to TU-001', `status=${changeLeaderRes.status}`);

    const verifyChangedLeader = await request(`/api/teams/${teamAId}`, {
      method: 'GET',
      headers: headersAdminA
    });
    assert(verifyChangedLeader.body.leaderId === 'TU-001', 'Team leaderId updated to TU-001');
    assert(
      verifyChangedLeader.body.members.some(m => m.tenantUserId === 'TU-001' && m.teamRole === 'LEADER'),
      'New leader synced as LEADER in team_members'
    );
    assert(
      verifyChangedLeader.body.members.some(m => m.tenantUserId === 'TU-004' && m.teamRole === 'MEMBER'),
      'Previous leader demoted to MEMBER in team_members'
    );

    // Change back leader to TU-004 (Supervisor) for supervisor tests
    await request(`/api/teams/${teamAId}`, {
      method: 'PUT',
      headers: headersAdminA,
      body: { leaderId: 'TU-004' }
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 6: Add Member & Duplicate Member Rejection
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 6. Testing Add Member & Duplicate Member ---');
    // Add Sales Rep 1 (TU-002) as MEMBER
    const addMemberRes = await request(`/api/teams/${teamAId}/members`, {
      method: 'POST',
      headers: headersAdminA,
      body: {
        tenantUserId: 'TU-002',
        role: 'MEMBER'
      }
    });
    assert(addMemberRes.status === 201, 'POST /api/teams/:id/members adds member', `status=${addMemberRes.status}`);

    // Try adding the exact same member again
    const dupMemberRes = await request(`/api/teams/${teamAId}/members`, {
      method: 'POST',
      headers: headersAdminA,
      body: {
        tenantUserId: 'TU-002',
        role: 'MEMBER'
      }
    });
    assert(dupMemberRes.status === 409, 'Duplicate team member returns 409 Conflict', `status=${dupMemberRes.status}`);
    assert(dupMemberRes.body.code === 'DUPLICATE_TEAM_MEMBER', 'Error code is DUPLICATE_TEAM_MEMBER');

    // ─────────────────────────────────────────────────────────────
    // TEST 7: Cross-Tenant Member Addition Denied
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 7. Testing Cross-Tenant Member Addition Denied ---');
    const crossMemberRes = await request(`/api/teams/${teamAId}/members`, {
      method: 'POST',
      headers: headersAdminA,
      body: {
        tenantUserId: 'TU-1788421036333-0b5d97', // Tenant B user
        role: 'MEMBER'
      }
    });
    assert(crossMemberRes.status === 400, 'Cross-tenant member addition returns 400', `status=${crossMemberRes.status}`);
    assert(crossMemberRes.body.code === 'CROSS_TENANT_USER_DENIED', 'Error code is CROSS_TENANT_USER_DENIED');

    // ─────────────────────────────────────────────────────────────
    // TEST 8: Role Authorization (SALES_REP / SALES_MANAGER Denied)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 8. Testing Role Authorization Guards ---');
    // SALES_REP cannot create team
    const repCreateRes = await request('/api/teams', {
      method: 'POST',
      headers: headersRepA1,
      body: { name: 'Illegal Rep Team' }
    });
    assert(repCreateRes.status === 403, 'SALES_REP cannot create team (403)', `status=${repCreateRes.status}`);
    assert(repCreateRes.body.code === 'FORBIDDEN', 'Error code is FORBIDDEN');

    // SALES_MANAGER cannot delete team
    const mgrDeleteRes = await request(`/api/teams/${teamAId}`, {
      method: 'DELETE',
      headers: headersMgrA
    });
    assert(mgrDeleteRes.status === 403, 'SALES_MANAGER cannot delete team (403)', `status=${mgrDeleteRes.status}`);

    // SALES_REP cannot add member
    const repAddMemberRes = await request(`/api/teams/${teamAId}/members`, {
      method: 'POST',
      headers: headersRepA1,
      body: { tenantUserId: 'TU-005', role: 'MEMBER' }
    });
    assert(repAddMemberRes.status === 403, 'SALES_REP cannot add team member (403)', `status=${repAddMemberRes.status}`);

    // ─────────────────────────────────────────────────────────────
    // TEST 9: Supervisor Permissions: Own Team vs Outside Team
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 9. Testing Supervisor Own Team vs Outside Team Permissions ---');
    // Supervisor A (TU-004) is leader of teamAId.
    // They CAN add TU-005 to teamAId as MEMBER
    const supAddOwnRes = await request(`/api/teams/${teamAId}/members`, {
      method: 'POST',
      headers: headersSupA,
      body: { tenantUserId: 'TU-005', role: 'MEMBER' }
    });
    assert(supAddOwnRes.status === 201, 'Supervisor can add member to their own team', `status=${supAddOwnRes.status}`);

    // Supervisor CANNOT assign someone as LEADER
    const supAssignLeaderRes = await request(`/api/teams/${teamAId}/members`, {
      method: 'POST',
      headers: headersSupA,
      body: { tenantUserId: 'TU-IMG-1', role: 'LEADER' }
    });
    assert(supAssignLeaderRes.status === 403, 'Supervisor cannot assign a LEADER (403)', `status=${supAssignLeaderRes.status}`);

    // Create Team 2 where Supervisor A is NOT leader
    const team2Res = await request('/api/teams', {
      method: 'POST',
      headers: headersAdminA,
      body: { name: 'Delta Team ' + Date.now(), leaderId: 'TU-001' }
    });
    const team2Id = team2Res.body.teamId;
    if (team2Id) cleanupTeams.push(team2Id);

    // Supervisor A CANNOT add member to Team 2
    const supAddOtherRes = await request(`/api/teams/${team2Id}/members`, {
      method: 'POST',
      headers: headersSupA,
      body: { tenantUserId: 'TU-IMG-2', role: 'MEMBER' }
    });
    assert(supAddOtherRes.status === 403, 'Supervisor cannot add member to a team they do not lead (403)', `status=${supAddOtherRes.status}`);

    // ─────────────────────────────────────────────────────────────
    // TEST 10: Tenant Isolation (Cross-Tenant Access Denied)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 10. Testing Tenant Isolation ---');
    // Tenant B Admin tries to view Team A
    const tBViewTeamARes = await request(`/api/teams/${teamAId}`, {
      method: 'GET',
      headers: headersAdminB
    });
    assert(tBViewTeamARes.status === 404, 'Tenant B cannot view Tenant A team (returns 404)', `status=${tBViewTeamARes.status}`);

    // Tenant B Admin tries to delete Team A
    const tBDeleteTeamARes = await request(`/api/teams/${teamAId}`, {
      method: 'DELETE',
      headers: headersAdminB
    });
    assert(tBDeleteTeamARes.status === 404, 'Tenant B cannot delete Tenant A team (returns 404)', `status=${tBDeleteTeamARes.status}`);

    // ─────────────────────────────────────────────────────────────
    // TEST 11: Remove Member & Leader Removal Protection
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 11. Testing Remove Member & Leader Removal Rules ---');
    // Try to remove leader without allowLeaderRemoval
    const removeLeaderRes = await request(`/api/teams/${teamAId}/members/TU-004`, {
      method: 'DELETE',
      headers: headersAdminA
    });
    assert(removeLeaderRes.status === 400, 'Removing leader without replacement is blocked (400)', `status=${removeLeaderRes.status}`);
    assert(removeLeaderRes.body.code === 'CANNOT_REMOVE_LEADER', 'Error code is CANNOT_REMOVE_LEADER');

    // Remove regular member TU-005
    const removeMemberRes = await request(`/api/teams/${teamAId}/members/TU-005`, {
      method: 'DELETE',
      headers: headersAdminA
    });
    assert(removeMemberRes.status === 200, 'Regular member can be removed successfully', `status=${removeMemberRes.status}`);

    const verifyAfterRemove = await request(`/api/teams/${teamAId}`, {
      method: 'GET',
      headers: headersAdminA
    });
    assert(
      !verifyAfterRemove.body.members.some(m => m.tenantUserId === 'TU-005'),
      'TU-005 is no longer in team members list'
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 12: Delete Team (Has Members vs Force / Empty)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 12. Testing Delete Team ---');
    // teamAId currently still has members (TU-004 leader, TU-002, TU-001)
    const deleteBlockedRes = await request(`/api/teams/${teamAId}`, {
      method: 'DELETE',
      headers: headersAdminA
    });
    assert(deleteBlockedRes.status === 400, 'Deleting team with members returns 400', `status=${deleteBlockedRes.status}`);
    assert(deleteBlockedRes.body.code === 'TEAM_HAS_MEMBERS', 'Error code is TEAM_HAS_MEMBERS');

    // Force delete team2Id
    const deleteTeam2Res = await request(`/api/teams/${team2Id}?force=true`, {
      method: 'DELETE',
      headers: headersAdminA
    });
    assert(deleteTeam2Res.status === 200, 'DELETE /api/teams/:id?force=true deletes team and relations in transaction');

    const verifyTeam2Deleted = await request(`/api/teams/${team2Id}`, {
      method: 'GET',
      headers: headersAdminA
    });
    assert(verifyTeam2Deleted.status === 404, 'Deleted team returns 404');

    // ─────────────────────────────────────────────────────────────
    // TEST 13: TEAM-Scoped Visibility Across Modules
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 13. Testing TEAM-Scoped Visibility Integration Across Modules ---');
    // Supervisor A (USR-004) and Rep A1 (USR-002) are in teamAId.
    // Let's create an activity and follow-up owned by Rep A1 (USR-002).
    const testFollowUpDate = '2026-09-30';
    const [fuInsert] = await pool.query(`
      INSERT INTO follow_ups (id, tenantId, title, picId, createdById, followUpDate, status, notes)
      VALUES (UUID(), ?, 'Team UAT Customer', ?, ?, ?, 'PENDING', 'Team scope test note')
    `, [tenantAId, repA1Id, repA1Id, testFollowUpDate]);

    // Query follow-ups as Supervisor A with scope=team
    const supTeamFuRes = await request('/api/follow_ups?scope=team', {
      method: 'GET',
      headers: headersSupA
    });
    assert(supTeamFuRes.status === 200, 'GET /api/follow_ups?scope=team returns 200 for Supervisor');
    const fuList = Array.isArray(supTeamFuRes.body) ? supTeamFuRes.body : supTeamFuRes.body.data || [];
    assert(
      fuList.some(f => f.title === 'Team UAT Customer' && f.picId === repA1Id),
      'Supervisor sees teammate (Rep A1) follow-up under TEAM scope'
    );

    // Query activities as Supervisor A with scope=team
    const supTeamActRes = await request('/api/sales/activities?scope=team', {
      method: 'GET',
      headers: headersSupA
    });
    assert(
      supTeamActRes.status === 200 || supTeamActRes.status === 404,
      'Supervisor team activities query handled cleanly',
      `status=${supTeamActRes.status}`
    );

    // Query follow-ups as Tenant B Admin -> should NOT see Team UAT Customer
    const tBFuRes = await request('/api/follow_ups?scope=all', {
      method: 'GET',
      headers: headersAdminB
    });
    const tbList = Array.isArray(tBFuRes.body) ? tBFuRes.body : tBFuRes.body.data || [];
    assert(
      !tbList.some(f => f.title === 'Team UAT Customer'),
      'Tenant B cannot see Tenant A follow-up under any scope'
    );

    // Clean up test follow-up
    await pool.query('DELETE FROM follow_ups WHERE title = "Team UAT Customer" AND tenantId = ?', [tenantAId]);

    // Clean up teamAId with force
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
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTeamMembersTests();
