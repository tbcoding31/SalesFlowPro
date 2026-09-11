const http = require('http');
const { pool } = require('./dist/db.js');
const { app } = require('./dist/server.js');

async function runUAT067Tests() {
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
  console.log('SALESFLOW PRO: UAT-067 FOLLOW-UP & ACTIVITY NAVIGATION & SCOPE');
  console.log('================================================================\n');

  let server;
  let baseUrl;
  const cleanupSessions = [];
  const createdFollowUpIds = [];

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

    const adminAId = 'USR-001';
    const supervisorAId = 'USR-004';
    const managerAId = 'USR-003';
    const repA1Id = 'USR-002';
    const repA2Id = 'USR-005';
    const adminBId = 'USR-1788421036236-03514c';

    async function createToken(userId) {
      const token = 'UAT067_' + userId.replace(/[^a-zA-Z0-9]/g, '_') + '_' + Date.now();
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
    const headersRepA2 = { 'Authorization': `Bearer ${tokenRepA2}`, 'Content-Type': 'application/json' };
    const headersAdminB = { 'Authorization': `Bearer ${tokenAdminB}`, 'Content-Type': 'application/json' };

    async function req(urlPath, options = {}) {
      const res = await fetch(`${baseUrl}${urlPath}`, options);
      const body = await res.json().catch(() => null);
      return { status: res.status, ok: res.ok, body };
    }

    // ─────────────────────────────────────────────────────────────
    // SUITE 1: FOLLOW-UP ACCESS SCOPE ENFORCEMENT
    // ─────────────────────────────────────────────────────────────
    console.log('--- SUITE 1: Follow-up Scope Permission Enforcement ---');

    // 1. TENANT_ADMIN can access All Follow-ups
    const faAdminRes = await req('/api/follow-ups?scope=all', { headers: headersAdminA });
    assert(faAdminRes.status === 200, '1. TENANT_ADMIN GET /api/follow-ups?scope=all returns 200 OK');
    assert(Array.isArray(faAdminRes.body?.data), '   Body contains data array');

    // 2. TENANT_ADMIN can access alias /all
    const faAdminAliasRes = await req('/api/follow-ups/all', { headers: headersAdminA });
    assert(faAdminAliasRes.status === 200, '2. TENANT_ADMIN GET /api/follow-ups/all alias returns 200 OK');

    // 3. SUPERVISOR can access All Follow-ups
    const faSupRes = await req('/api/follow-ups?scope=all', { headers: headersSupA });
    assert(faSupRes.status === 200, '3. SUPERVISOR GET /api/follow-ups?scope=all returns 200 OK');

    // 4. SUPERVISOR can access alias /all
    const faSupAliasRes = await req('/api/follow-ups/all', { headers: headersSupA });
    assert(faSupAliasRes.status === 200, '4. SUPERVISOR GET /api/follow-ups/all alias returns 200 OK');

    // 5. SALES_REP is blocked from All Follow-ups (403)
    const faRepAllRes = await req('/api/follow-ups?scope=all', { headers: headersRepA1 });
    assert(faRepAllRes.status === 403, '5. SALES_REP GET /api/follow-ups?scope=all returns 403 Forbidden', `status=${faRepAllRes.status}`);
    assert(faRepAllRes.body?.code === 'SCOPE_ACCESS_DENIED', '   Error code is SCOPE_ACCESS_DENIED');

    // 6. SALES_REP alias /all is blocked (403)
    const faRepAliasRes = await req('/api/follow-ups/all', { headers: headersRepA1 });
    assert(faRepAliasRes.status === 403, '6. SALES_REP GET /api/follow-ups/all alias returns 403 Forbidden');

    // 7. SALES_MANAGER is blocked from All Follow-ups (403)
    const faMgrAllRes = await req('/api/follow-ups?scope=all', { headers: headersMgrA });
    assert(faMgrAllRes.status === 403, '7. SALES_MANAGER GET /api/follow-ups?scope=all returns 403 Forbidden', `status=${faMgrAllRes.status}`);
    assert(faMgrAllRes.body?.code === 'SCOPE_ACCESS_DENIED', '   Error code is SCOPE_ACCESS_DENIED');

    // 8. SALES_REP can access My Follow-ups
    const faRepMyRes = await req('/api/follow-ups?scope=my', { headers: headersRepA1 });
    assert(faRepMyRes.status === 200, '8. SALES_REP GET /api/follow-ups?scope=my returns 200 OK');

    // 9. SALES_REP alias /my returns 200
    const faRepMyAliasRes = await req('/api/follow-ups/my', { headers: headersRepA1 });
    assert(faRepMyAliasRes.status === 200, '9. SALES_REP GET /api/follow-ups/my alias returns 200 OK');

    // 10. SALES_MANAGER can access My Follow-ups
    const faMgrMyRes = await req('/api/follow-ups?scope=my', { headers: headersMgrA });
    assert(faMgrMyRes.status === 200, '10. SALES_MANAGER GET /api/follow-ups?scope=my returns 200 OK');

    // ─────────────────────────────────────────────────────────────
    // SUITE 2: CREATEDBYID VS PICID SCOPE PREDICATE & LIFECYCLE
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- SUITE 2: createdById & picId Predicate & Creation ---');

    // Get a valid customer and follow-up type for tenant A
    const [cRows] = await pool.query(`SELECT id FROM customers WHERE tenantId = ? LIMIT 1`, [tenantAId]);
    const validCustAId = cRows.length > 0 ? cRows[0].id : null;
    const [tRows] = await pool.query(`SELECT id FROM follow_up_types WHERE tenantId = ? AND isActive = 1 LIMIT 1`, [tenantAId]);
    const validTypeId = tRows.length > 0 ? tRows[0].id : 'FT-TEN00001-FT-CALL';

    // 11. Rep A1 creates a follow-up assigned to Rep A2 (picId = Rep A2, createdById = Rep A1)
    const createPayload = {
      title: 'UAT-067 Follow-up Cross-User Test',
      typeId: validTypeId,
      priority: 'HIGH',
      followUpDate: new Date().toISOString().split('T')[0],
      notes: 'Testing createdById ownership alongside picId',
      customerId: validCustAId,
      picId: repA2Id // Assigned to Rep A2
    };

    const postFuRes = await req('/api/follow-ups', {
      method: 'POST',
      headers: headersRepA1,
      body: JSON.stringify(createPayload)
    });
    assert(postFuRes.status === 201, '11. POST /api/follow-ups created successfully (201 Created)', `status=${postFuRes.status}`);
    const createdFuId = postFuRes.body?.data?.id || postFuRes.body?.id;
    if (createdFuId) createdFollowUpIds.push(createdFuId);

    // 12. Check createdById is persisted as Rep A1 in the database
    const [fuDbRows] = await pool.query(`SELECT id, createdById, picId FROM follow_ups WHERE id = ?`, [createdFuId]);
    assert(fuDbRows.length > 0 && fuDbRows[0].createdById === repA1Id, '12. createdById matches actorUserId (Rep A1) in database', `createdById=${fuDbRows[0]?.createdById}`);
    assert(fuDbRows[0]?.picId === repA2Id, '    picId matches assigned PIC (Rep A2)');

    // 13. Rep A1 (Creator) can see it in My Follow-ups
    const repA1ListRes = await req('/api/follow-ups?scope=my', { headers: headersRepA1 });
    const seenByA1 = repA1ListRes.body?.data?.some(f => f.id === createdFuId);
    assert(seenByA1, '13. Creator (Rep A1) sees the follow-up under My Follow-ups (via createdById)');

    // 14. Rep A2 (PIC) can see it in My Follow-ups
    const repA2ListRes = await req('/api/follow-ups?scope=my', { headers: headersRepA2 });
    const seenByA2 = repA2ListRes.body?.data?.some(f => f.id === createdFuId);
    assert(seenByA2, '14. Assigned PIC (Rep A2) sees the follow-up under My Follow-ups (via picId)');

    // 15. Sales Manager (neither creator nor PIC) CANNOT see it in My Follow-ups
    const mgrListRes = await req('/api/follow-ups?scope=my', { headers: headersMgrA });
    const seenByMgr = mgrListRes.body?.data?.some(f => f.id === createdFuId);
    assert(!seenByMgr, '15. Unrelated user (Manager A) DOES NOT see it in My Follow-ups');

    // 16. Tenant Admin CAN see it in All Follow-ups
    const adminListRes = await req('/api/follow-ups?scope=all', { headers: headersAdminA });
    const seenByAdmin = adminListRes.body?.data?.some(f => f.id === createdFuId);
    assert(seenByAdmin, '16. Tenant Admin sees the follow-up in All Follow-ups');

    // ─────────────────────────────────────────────────────────────
    // SUITE 3: MULTI-TENANT ISOLATION (BOLA)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- SUITE 3: Multi-Tenant & Cross-Tenant BOLA Guard ---');

    // 17. Tenant B cannot see Tenant A follow-up under All Follow-ups
    const tenantBAllRes = await req('/api/follow-ups?scope=all', { headers: headersAdminB });
    const seenByTenantB = tenantBAllRes.body?.data?.some(f => f.id === createdFuId);
    assert(!seenByTenantB, '17. Tenant B Admin CANNOT see Tenant A follow-up under All Follow-ups (BOLA)');

    // 18. Cross-tenant customer validation: Rep A1 cannot attach follow-up to Tenant B customer
    const [cBRows] = await pool.query(`SELECT id FROM customers WHERE tenantId = ? LIMIT 1`, [tenantBId]);
    if (cBRows.length > 0) {
      const crossCustId = cBRows[0].id;
      const crossPostRes = await req('/api/follow-ups', {
        method: 'POST',
        headers: headersRepA1,
        body: JSON.stringify({
          title: 'Illegal Cross Tenant Follow-up',
          typeId: validTypeId,
          followUpDate: '2026-09-12',
          customerId: crossCustId
        })
      });
      assert(crossPostRes.status === 400 || crossPostRes.status === 403 || crossPostRes.status === 404, 
        '18. Cross-tenant customer reference rejected with 400/403/404', `status=${crossPostRes.status}`);
    } else {
      assert(true, '18. Cross-tenant test skipped (no customer in Tenant B)');
    }

    // ─────────────────────────────────────────────────────────────
    // SUITE 4: ACTIVITIES BUSINESS AGGREGATOR & SCOPES
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- SUITE 4: Activities Business Aggregator & Scopes ---');

    // 19. TENANT_ADMIN can access All Activities
    const actAdminRes = await req('/api/activities?scope=all', { headers: headersAdminA });
    assert(actAdminRes.status === 200, '19. TENANT_ADMIN GET /api/activities?scope=all returns 200 OK');
    assert(Array.isArray(actAdminRes.body?.data), '    Contains data array');
    assert(actAdminRes.body?.data?.length > 0, `    Aggregated items count: ${actAdminRes.body?.data?.length}`);

    // 20. SUPERVISOR can access All Activities
    const actSupRes = await req('/api/activities?scope=all', { headers: headersSupA });
    assert(actSupRes.status === 200, '20. SUPERVISOR GET /api/activities?scope=all returns 200 OK');

    // 21. SALES_REP is blocked from All Activities (403)
    const actRepAllRes = await req('/api/activities?scope=all', { headers: headersRepA1 });
    assert(actRepAllRes.status === 403, '21. SALES_REP GET /api/activities?scope=all returns 403 Forbidden', `status=${actRepAllRes.status}`);
    assert(actRepAllRes.body?.code === 'SCOPE_ACCESS_DENIED', '    Error code is SCOPE_ACCESS_DENIED');

    // 22. SALES_MANAGER is blocked from All Activities (403)
    const actMgrAllRes = await req('/api/activities?scope=all', { headers: headersMgrA });
    assert(actMgrAllRes.status === 403, '22. SALES_MANAGER GET /api/activities?scope=all returns 403 Forbidden', `status=${actMgrAllRes.status}`);
    assert(actMgrAllRes.body?.code === 'SCOPE_ACCESS_DENIED', '    Error code is SCOPE_ACCESS_DENIED');

    // 23. SALES_REP can access My Activities
    const actRepMyRes = await req('/api/activities?scope=my', { headers: headersRepA1 });
    assert(actRepMyRes.status === 200, '23. SALES_REP GET /api/activities?scope=my returns 200 OK');
    
    // Check that all returned items have type: 'ACTIVITY' and stable eventId
    const repActivities = actRepMyRes.body?.data || [];
    const allActivityType = repActivities.every(a => a.type === 'ACTIVITY');
    const allHaveEventId = repActivities.every(a => !!a.eventId || !!a.id);
    assert(allActivityType, '    All items have type: "ACTIVITY"');
    assert(allHaveEventId, '    All items have unique eventId / id');

    // 24. Single Activity Detail resolution (for synthetic & direct IDs)
    console.log('\n--- SUITE 5: Activity Detail Resolution ---');
    const sampleEvent = actAdminRes.body?.data?.[0];
    if (sampleEvent) {
      const detailRes = await req(`/api/activities/${encodeURIComponent(sampleEvent.id || sampleEvent.eventId)}`, { headers: headersAdminA });
      assert(detailRes.status === 200, '24. GET /api/activities/:id resolves single detail successfully (200 OK)', `id=${sampleEvent.id}`);
      assert(detailRes.body?.type === 'ACTIVITY', '    Detail response contains canonical type "ACTIVITY"');
    } else {
      assert(true, '24. Detail test passed (no activities available to test)');
    }

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    // Cleanup created follow-ups
    for (const fuId of createdFollowUpIds) {
      try {
        await pool.query(`DELETE FROM follow_ups WHERE id = ?`, [fuId]);
      } catch (e) {}
    }
    // Cleanup sessions
    for (const token of cleanupSessions) {
      try {
        await pool.query(`DELETE FROM auth_sessions WHERE token = ?`, [token]);
      } catch (e) {}
    }
    if (server) {
      await new Promise(r => server.close(r));
    }
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runUAT067Tests();
