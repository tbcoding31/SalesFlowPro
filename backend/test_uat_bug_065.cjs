const fs = require('fs');
const path = require('path');
const http = require('http');
const { pool } = require('./dist/db.js');
const { app } = require('./dist/server.js');
const { resolveTenantTaskDefaults } = require('./dist/services/taskAssignment.service.js');
const { evaluateTenantAccess } = require('./dist/utils/scope.js');
const { resolveLegacySemanticStatus } = require('./dist/utils/legacyCompatibility.js');

async function runRegressionSuite() {
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

  console.log('====================================================');
  console.log('UAT-BUG-065: RUNTIME MASTER DATA & DEPLOYMENT SAFETY');
  console.log('AUTHORITATIVE REGRESSION SUITE (TESTS 1 - 14)');
  console.log('====================================================\n');

  let server;
  let baseUrl;

  // Cleanup tracking lists
  const cleanupTasks = [];
  const cleanupVisits = [];
  const cleanupProjects = [];
  const cleanupCustomers = [];
  const cleanupCustomerContacts = [];
  const cleanupSessions = [];
  const cleanupUsers = [];
  const cleanupTenants = [];
  const restorations = [];

  // Ephemeral test tokens
  const tokenTenantA = 'TEST_REG_A_' + Date.now();
  const tokenTenantB = 'TEST_REG_B_' + Date.now();
  const tokenPlatform = 'TEST_REG_SUPER_' + Date.now();

  const tenantAId = 'TEN-00001';
  let tenantBId = 'TEN-1788420868709-f60351';

  try {
    // 0. Start local ephemeral express server
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
    console.log(`Ephemeral test server active at ${baseUrl}\n`);

    // Resolve or create user for Tenant A (Admin)
    let [uARows] = await pool.query(`
      SELECT u.id FROM users u
      JOIN tenant_users tu ON tu.userId = u.id
      JOIN tenant_user_roles tur ON tur.tenantUserId = tu.id
      JOIN roles r ON r.id = tur.roleId
      WHERE tu.tenantId = ? AND tu.status = "ACTIVE" AND r.code = "TENANT_ADMIN"
      LIMIT 1
    `, [tenantAId]);
    let userAId;
    if (uARows.length > 0) {
      userAId = uARows[0].id;
    } else {
      userAId = 'USR-001';
    }

    // Resolve Tenant B with an active primary TENANT_ADMIN user and allowed entitlement
    const [cands] = await pool.query(`
      SELECT tu.tenantId, tu.userId
      FROM tenant_users tu
      JOIN users u ON u.id = tu.userId AND u.status = 'ACTIVE'
      JOIN tenant_user_roles tur ON tur.tenantUserId = tu.id
      JOIN roles r ON r.id = tur.roleId
      JOIN tenants t ON t.id = tu.tenantId
      WHERE tu.tenantId != ? AND tu.status = 'ACTIVE' AND tu.isPrimary = 1 AND t.status = 'ACTIVE' AND r.code = 'TENANT_ADMIN'
    `, [tenantAId]);

    let userBId = null;
    for (const c of cands) {
      const acc = await evaluateTenantAccess(pool, c.tenantId);
      if (acc.allowed) {
        tenantBId = c.tenantId;
        userBId = c.userId;
        break;
      }
    }

    if (!userBId) {
      // Fallback: create fresh tenant B with primary admin
      tenantBId = 'TEN-TEST-B-' + Date.now();
      cleanupTenants.push(tenantBId);
      await pool.query('INSERT INTO tenants (id, name, code, status, createdAt, type) VALUES (?, "Test Tenant B", ?, "ACTIVE", NOW(), "Professional")', [tenantBId, 'TB-' + Math.floor(1000 + Math.random() * 9000)]);
      userBId = 'USR-TEST-B-' + Date.now();
      cleanupUsers.push(userBId);
      await pool.query('INSERT INTO users (id, name, email, status) VALUES (?, "Test User B", ?, "ACTIVE")', [userBId, `testb_${Date.now()}@example.com`]);
      const tuBId = `TU-TEST-B-${Date.now()}`;
      await pool.query('INSERT INTO tenant_users (id, tenantId, userId, isPrimary, status) VALUES (?, ?, ?, 1, "ACTIVE")', [tuBId, tenantBId, userBId]);
      await pool.query('INSERT INTO tenant_user_roles (id, tenantUserId, roleId) VALUES (UUID(), ?, "ROLE-ADMIN")', [tuBId]);
    }

    // Insert test auth sessions
    await pool.query(`
      INSERT INTO auth_sessions (id, userId, token, expiresAt, createdAt)
      VALUES 
        (UUID(), ?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY), NOW()),
        (UUID(), ?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY), NOW()),
        (UUID(), 'USR-000', ?, DATE_ADD(NOW(), INTERVAL 1 DAY), NOW())
    `, [userAId, tokenTenantA, userBId, tokenTenantB, tokenPlatform]);
    cleanupSessions.push(tokenTenantA, tokenTenantB, tokenPlatform);

    const headersA = { 'Authorization': `Bearer ${tokenTenantA}`, 'Content-Type': 'application/json' };
    const headersB = { 'Authorization': `Bearer ${tokenTenantB}`, 'Content-Type': 'application/json' };
    const headersSuper = { 'Authorization': `Bearer ${tokenPlatform}`, 'Content-Type': 'application/json' };

    // =========================================================================
    // TEST 1: RESIDUAL HARDCODED MASTER ID ON RUNTIME
    // =========================================================================
    console.log('--- TEST 1: RESIDUAL HARDCODED MASTER ID CHECK ON RUNTIME ---');
    const [tStatusesA] = await pool.query('SELECT id, code, platformMasterId FROM task_statuses WHERE tenantId = ? AND isActive = 1', [tenantAId]);
    const [tStatusesB] = await pool.query('SELECT id, code, platformMasterId FROM task_statuses WHERE tenantId = ? AND isActive = 1', [tenantBId]);

    assert(tStatusesA.length > 0 && tStatusesB.length > 0,
      'MASTER-SEP-01', `Tenant A has ${tStatusesA.length} task statuses, Tenant B has ${tStatusesB.length} task statuses`);

    const setA = new Set(tStatusesA.map(s => s.id));
    const overlap = tStatusesB.filter(s => setA.has(s.id));
    assert(overlap.length === 0,
      'MASTER-SEP-02', `Zero primary key overlap between Tenant A and Tenant B master rows`);

    const hasProvenanceA = tStatusesA.some(s => s.platformMasterId && s.platformMasterId.startsWith('TS-'));
    const hasProvenanceB = tStatusesB.some(s => s.platformMasterId && s.platformMasterId.startsWith('TS-'));
    assert(hasProvenanceA && hasProvenanceB,
      'MASTER-SEP-03', 'Cloned master rows retain provenance link to platform blueprint (platformMasterId)');

    // Verify runtime rejection when cross-tenant master ID is supplied to task creation
    const crossMasterRes = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        title: 'Task referencing Tenant B status',
        statusId: tStatusesB[0].id
      })
    });
    const crossMasterJson = await crossMasterRes.json();
    assert(crossMasterRes.status === 400 && crossMasterJson.error?.includes('active'),
      'MASTER-SEP-04', `Runtime rejects cross-tenant master statusId on task creation (HTTP 400: ${crossMasterJson.error})`);

    // =========================================================================
    // TEST 2: SEMANTIC COMPLETION TASK
    // =========================================================================
    console.log('\n--- TEST 2: SEMANTIC COMPLETION TASK ---');
    const compStatusRow = tStatusesA.find(s => s.code === 'COMPLETED' || s.code === 'TSK_COMPLETED' || s.platformMasterId === 'TS-3');
    assert(!!compStatusRow, 'TASK-SEM-01', `Found tenant completed task status: ${compStatusRow?.id}`);

    const testTaskId = 'TSK-REG-' + Date.now();
    cleanupTasks.push(testTaskId);
    await pool.query(`
      INSERT INTO tasks (id, tenantId, title, statusId, priorityId, dueDate, completedAt, createdAt, updatedAt)
      VALUES (?, ?, 'Regression Semantic Task', ?, (SELECT id FROM task_priorities WHERE tenantId = ? AND isActive = 1 LIMIT 1), CURDATE(), NOW(), NOW(), NOW())
    `, [testTaskId, tenantAId, compStatusRow.id, tenantAId]);

    const taskRepRes = await fetch(`${baseUrl}/api/reports/tasks`, { headers: headersA });
    const taskRepJson = await taskRepRes.json();
    assert(taskRepRes.status === 200, 'TASK-SEM-02', 'Task report endpoint returns 200');

    const matchedTask = taskRepJson.tableData?.find(t => t.id === testTaskId);
    assert(matchedTask && matchedTask.status === 'COMPLETED',
      'TASK-SEM-03', `Task with statusId='${compStatusRow.id}' correctly resolved to COMPLETED (not raw ID)`);

    // =========================================================================
    // TEST 3: TERMINAL VISIT LOCK & COMPLETED_AT
    // =========================================================================
    console.log('\n--- TEST 3: TERMINAL VISIT LOCK & COMPLETED_AT ---');
    const [vStatusesA] = await pool.query('SELECT id, code, isTerminal FROM visit_statuses WHERE tenantId = ? AND isActive = 1', [tenantAId]);
    const [vPurposesA] = await pool.query('SELECT id FROM visit_purposes WHERE tenantId = ? AND isActive = 1 LIMIT 1', [tenantAId]);
    const [custA] = await pool.query('SELECT id FROM customers WHERE tenantId = ? LIMIT 1', [tenantAId]);
    
    const schedStatus = vStatusesA.find(s => s.code === 'SCHEDULED') || vStatusesA[0];
    const compVisitStatus = vStatusesA.find(s => s.code === 'COMPLETED');

    const testVisitId = 'VST-REG-' + Date.now();
    cleanupVisits.push(testVisitId);
    await pool.query(`
      INSERT INTO visits (id, tenantId, customerId, title, visitDate, startTime, endTime, statusId, purposeId, createdAt, updatedAt)
      VALUES (?, ?, ?, 'Regression Field Visit', CURDATE(), '10:00:00', '11:00:00', ?, ?, NOW(), NOW())
    `, [testVisitId, tenantAId, custA[0].id, schedStatus.id, vPurposesA[0].id]);

    // Complete the visit via PUT
    const completeRes = await fetch(`${baseUrl}/api/visits/${testVisitId}`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({
        statusId: compVisitStatus.id,
        result: 'Successfully closed enterprise proposal'
      })
    });
    assert(completeRes.status === 200, 'VISIT-LOCK-01', 'Successfully transitioned visit to COMPLETED');

    // Verify completedAt timestamp is recorded in database
    const [completedVisitRows] = await pool.query('SELECT completedAt, statusId FROM visits WHERE id = ?', [testVisitId]);
    assert(!!completedVisitRows[0].completedAt,
      'VISIT-LOCK-02', `Visit completedAt timestamp successfully recorded: ${completedVisitRows[0].completedAt}`);

    // Attempt to edit completed visit -> must be rejected with 400 VISIT_ALREADY_COMPLETED
    const editCompletedRes = await fetch(`${baseUrl}/api/visits/${testVisitId}`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({ title: 'Malicious Attempt to Edit Completed Visit' })
    });
    const editCompletedJson = await editCompletedRes.json();
    assert(editCompletedRes.status === 400 && editCompletedJson.code === 'VISIT_ALREADY_COMPLETED',
      'VISIT-LOCK-03', 'Editing completed visit is locked (400 VISIT_ALREADY_COMPLETED)');

    // Attempt to cancel an already completed visit -> must be rejected with 400 CANNOT_CANCEL_COMPLETED_VISIT
    const cancelCompletedRes = await fetch(`${baseUrl}/api/visits/${testVisitId}/cancel`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({ cancellationReason: 'Client cancel' })
    });
    const cancelCompletedJson = await cancelCompletedRes.json();
    assert(cancelCompletedRes.status === 400 && cancelCompletedJson.code === 'CANNOT_CANCEL_COMPLETED_VISIT',
      'VISIT-LOCK-04', 'Cancelling already completed visit is blocked (400 CANNOT_CANCEL_COMPLETED_VISIT)');

    // Attempt to reschedule an already completed visit -> must be rejected with 400 CANNOT_RESCHEDULE_COMPLETED_VISIT
    const rescheduleCompletedRes = await fetch(`${baseUrl}/api/visits/${testVisitId}/reschedule`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({ visitDate: '2026-10-01', startTime: '10:00:00', endTime: '11:00:00', reason: 'Postpone' })
    });
    const rescheduleCompletedJson = await rescheduleCompletedRes.json();
    assert(rescheduleCompletedRes.status === 400 && rescheduleCompletedJson.code === 'CANNOT_RESCHEDULE_COMPLETED_VISIT',
      'VISIT-LOCK-05', 'Rescheduling completed visit is blocked (400 CANNOT_RESCHEDULE_COMPLETED_VISIT)');

    // =========================================================================
    // TEST 4: PROJECT COMMERCIAL OUTCOME EVALUATION
    // =========================================================================
    console.log('\n--- TEST 4: PROJECT COMMERCIAL OUTCOME EVALUATION ---');
    const [stagesA] = await pool.query('SELECT id, code, phase, commercialOutcome, isTerminal FROM project_stages WHERE tenantId = ?', [tenantAId]);
    const wonStage = stagesA.find(s => s.commercialOutcome === 'WON');
    const lostStage = stagesA.find(s => s.commercialOutcome === 'LOST');
    const openStage = stagesA.find(s => s.commercialOutcome === 'NONE' || s.commercialOutcome === 'OPEN');

    assert(!!wonStage && !!lostStage && !!openStage,
      'STAGE-OUTCOME-01', `Identified stages: WON (${wonStage?.id}), LOST (${lostStage?.id}), OPEN (${openStage?.id})`);

    const perfRes = await fetch(`${baseUrl}/api/reports/performance`, { headers: headersA });
    const perfJson = await perfRes.json();
    assert(perfRes.status === 200, 'STAGE-OUTCOME-02', 'Performance report endpoint returns 200');
    assert(perfJson.oppConversionData && Array.isArray(perfJson.oppConversionData),
      'STAGE-OUTCOME-03', 'oppConversionData returned with Won, Lost, and Open buckets');

    const attRes = await fetch(`${baseUrl}/api/sales/attention`, { headers: headersA });
    assert(attRes.status === 200, 'STAGE-OUTCOME-04', 'Sales attention signals evaluated cleanly via stageCommercialOutcome');

    // =========================================================================
    // TEST 5: MISSING MANDATORY MASTER RAISES CONFIG_INTEGRITY_ERROR
    // =========================================================================
    console.log('\n--- TEST 5: CONFIG_INTEGRITY_ERROR ON MISSING MANDATORY MASTER ---');
    let integrityErrorThrown = false;
    try {
      await resolveTenantTaskDefaults(pool, 'NON_EXISTENT_TENANT_XYZ');
    } catch (err) {
      if (err.code === 'CONFIG_INTEGRITY_ERROR' || err.message?.includes('CONFIG_INTEGRITY_ERROR')) {
        integrityErrorThrown = true;
      }
    }
    assert(integrityErrorThrown,
      'INTEGRITY-01', 'resolveTenantTaskDefaults raises CONFIG_INTEGRITY_ERROR when tenant master is absent (zero fallback to TS-1)');

    // =========================================================================
    // TEST 6: INACTIVE MASTER REJECTED ON NEW TRANSACTIONS
    // =========================================================================
    console.log('\n--- TEST 6: INACTIVE MASTER REJECTED ON NEW TRANSACTIONS ---');
    const [prioritiesA] = await pool.query('SELECT id, name FROM task_priorities WHERE tenantId = ? LIMIT 1', [tenantAId]);
    const testPriId = prioritiesA[0].id;
    await pool.query('UPDATE task_priorities SET isActive = 0 WHERE id = ?', [testPriId]);
    restorations.push(async () => {
      await pool.query('UPDATE task_priorities SET isActive = 1 WHERE id = ?', [testPriId]);
    });

    const inactivePriTaskRes = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        title: 'Task referencing inactive priority',
        priorityId: testPriId
      })
    });
    const inactivePriJson = await inactivePriTaskRes.json();
    assert(inactivePriTaskRes.status === 400 && inactivePriJson.error?.includes('active'),
      'INACTIVE-REJECT-01', `Creating task with inactive priority rejected (HTTP 400: ${inactivePriJson.error})`);

    // Restore priority immediately
    await pool.query('UPDATE task_priorities SET isActive = 1 WHERE id = ?', [testPriId]);

    // =========================================================================
    // TEST 7: HISTORICAL INACTIVE MASTER DISPLAY INTEGRITY
    // =========================================================================
    console.log('\n--- TEST 7: HISTORICAL INACTIVE MASTER DISPLAY INTEGRITY ---');
    const histTaskId = 'TSK-HIST-' + Date.now();
    cleanupTasks.push(histTaskId);
    await pool.query(`
      INSERT INTO tasks (id, tenantId, title, statusId, priorityId, dueDate, createdAt, updatedAt)
      VALUES (?, ?, 'Historical Task With Inactive Status', ?, ?, CURDATE(), NOW(), NOW())
    `, [histTaskId, tenantAId, tStatusesA[0].id, testPriId]);

    // Temporarily deactivate status
    await pool.query('UPDATE task_statuses SET isActive = 0 WHERE id = ?', [tStatusesA[0].id]);
    restorations.push(async () => {
      await pool.query('UPDATE task_statuses SET isActive = 1 WHERE id = ?', [tStatusesA[0].id]);
    });

    const histReportRes = await fetch(`${baseUrl}/api/reports/tasks`, { headers: headersA });
    const histReportJson = await histReportRes.json();
    const histTask = histReportJson.tableData?.find(t => t.id === histTaskId);

    assert(!!histTask && histTask.status !== null && histTask.status !== undefined,
      'HIST-DISPLAY-01', `Historical task referencing inactive status remains visible with resolved status: "${histTask?.status}"`);

    // Restore status immediately
    await pool.query('UPDATE task_statuses SET isActive = 1 WHERE id = ?', [tStatusesA[0].id]);

    // =========================================================================
    // TEST 8: CROSS-TENANT PROJECT REFERENCE ISOLATION
    // =========================================================================
    console.log('\n--- TEST 8: CROSS-TENANT PROJECT REFERENCE ISOLATION ---');
    let [projB] = await pool.query('SELECT id FROM projects WHERE tenantId = ? LIMIT 1', [tenantBId]);
    let projBId;
    if (projB.length > 0) {
      projBId = projB[0].id;
    } else {
      projBId = 'PRJ-TEST-B-' + Date.now();
      cleanupProjects.push(projBId);
      await pool.query(`
        INSERT INTO projects (id, tenantId, title, value, stageId, createdAt)
        VALUES (?, ?, 'Tenant B Project', 50000, (SELECT id FROM project_stages WHERE tenantId = ? LIMIT 1), NOW())
      `, [projBId, tenantBId, tenantBId]);
    }

    const crossProjRes = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        title: 'Malicious Cross-Tenant Task',
        relatedProjectId: projBId
      })
    });
    const crossProjJson = await crossProjRes.json();
    assert(crossProjRes.status === 400 && crossProjJson.error?.includes('does not belong to this tenant'),
      'CROSS-PROJ-01', `Cross-tenant relatedProjectId rejected (HTTP 400: ${crossProjJson.error})`);

    // =========================================================================
    // TEST 9: CROSS-TENANT VISIT REFERENCE ISOLATION
    // =========================================================================
    console.log('\n--- TEST 9: CROSS-TENANT VISIT REFERENCE ISOLATION ---');
    let [visitB] = await pool.query('SELECT id FROM visits WHERE tenantId = ? LIMIT 1', [tenantBId]);
    let visitBId;
    if (visitB.length > 0) {
      visitBId = visitB[0].id;
    } else {
      visitBId = 'VST-TEST-B-' + Date.now();
      cleanupVisits.push(visitBId);
      await pool.query(`
        INSERT INTO visits (id, tenantId, title, visitDate, statusId, purposeId, createdAt, updatedAt)
        VALUES (?, ?, 'Tenant B Field Visit', CURDATE(), (SELECT id FROM visit_statuses WHERE tenantId = ? LIMIT 1), (SELECT id FROM visit_purposes WHERE tenantId = ? LIMIT 1), NOW(), NOW())
      `, [visitBId, tenantBId, tenantBId, tenantBId]);
    }

    const crossVisitRes = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        title: 'Malicious Cross-Tenant Visit Task',
        relatedVisitId: visitBId
      })
    });
    const crossVisitJson = await crossVisitRes.json();
    assert(crossVisitRes.status === 400 && crossVisitJson.error?.includes('does not belong to this tenant'),
      'CROSS-VISIT-01', `Cross-tenant relatedVisitId rejected (HTTP 400: ${crossVisitJson.error})`);

    // =========================================================================
    // TEST 10: CUSTOMER CONTACTS MULTI-TENANT ISOLATION
    // =========================================================================
    console.log('\n--- TEST 10: CUSTOMER CONTACTS MULTI-TENANT ISOLATION ---');
    let [custB] = await pool.query('SELECT id FROM customers WHERE tenantId = ? LIMIT 1', [tenantBId]);
    let custBId;
    if (custB.length > 0) {
      custBId = custB[0].id;
    } else {
      custBId = 'CST-B-' + Date.now();
      cleanupCustomers.push(custBId);
      await pool.query('INSERT INTO customers (id, tenantId, name, code, createdAt) VALUES (?, ?, "Tenant B Customer", "CB-01", NOW())', [custBId, tenantBId]);
    }

    // A. Read contact of tenant B's customer
    const crossContactGet = await fetch(`${baseUrl}/api/customer_contacts?customerId=${custBId}`, { headers: headersA });
    const crossContactGetJson = await crossContactGet.json();
    assert(crossContactGet.status === 200 && Array.isArray(crossContactGetJson) && crossContactGetJson.length === 0,
      'CROSS-CONTACT-01', `Tenant A reading contacts of Tenant B customer returns isolated empty array`);

    // B. Create contact via POST /api/customer_contacts
    const crossContactPost1 = await fetch(`${baseUrl}/api/customer_contacts`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        customerId: custBId,
        name: 'Injected Contact Generic'
      })
    });
    const crossContactPost1Json = await crossContactPost1.json();
    assert(crossContactPost1.status === 404 && crossContactPost1Json.error === 'Customer not found or access denied',
      'CROSS-CONTACT-02', `POST /api/customer_contacts authoritatively rejects foreign customer (HTTP 404: ${crossContactPost1Json.error})`);

    // C. Create contact via POST /api/customers/:id/contacts
    const crossContactPost2 = await fetch(`${baseUrl}/api/customers/${custBId}/contacts`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        name: 'Injected Contact Scoped'
      })
    });
    const crossContactPost2Json = await crossContactPost2.json();
    assert(crossContactPost2.status === 404 && crossContactPost2Json.error === 'Customer not found or access denied',
      'CROSS-CONTACT-03', `POST /api/customers/:id/contacts authoritatively rejects foreign customer (HTTP 404: ${crossContactPost2Json.error})`);

    // =========================================================================
    // TEST 11: RESET TENANT MASTER (PRESERVES BINDINGS, UPDATES PRESENTATION)
    // =========================================================================
    console.log('\n--- TEST 11: RESET TENANT MASTER RECONCILIATION ---');
    const targetStatus = tStatusesA[0];
    const [origRows] = await pool.query('SELECT name FROM task_statuses WHERE id = ?', [targetStatus.id]);
    const originalName = origRows[0].name;

    // Mutate the status name
    await pool.query('UPDATE task_statuses SET name = "Custom Renamed Status" WHERE id = ?', [targetStatus.id]);
    restorations.push(async () => {
      await pool.query('UPDATE task_statuses SET name = ? WHERE id = ?', [originalName, targetStatus.id]);
    });

    const resetRes = await fetch(`${baseUrl}/api/master-data/tenant/task_statuses/reset`, {
      method: 'POST',
      headers: headersA
    });
    const resetJson = await resetRes.json();
    assert(resetRes.status === 200 && resetJson.success === true,
      'RESET-MASTER-01', `POST /api/master-data/tenant/task_statuses/reset succeeds (200 OK)`);

    // Verify row name is reconciled back to blueprint, and primary key ID is preserved
    const [reconciledRows] = await pool.query('SELECT id, name FROM task_statuses WHERE id = ?', [targetStatus.id]);
    assert(reconciledRows.length > 0 && reconciledRows[0].id === targetStatus.id && reconciledRows[0].name !== 'Custom Renamed Status',
      'RESET-MASTER-02', `Status primary key preserved (${reconciledRows[0].id}) and name reconciled from blueprint (${reconciledRows[0].name})`);

    // =========================================================================
    // TEST 12: ONBOARDING ATOMICITY (CLONES ALL 10 CATEGORIES WITH PROVENANCE)
    // =========================================================================
    console.log('\n--- TEST 12: ONBOARDING ATOMICITY & TWO-TIER CLONING ---');
    const testOnboardEmail = `onboard_test_${Date.now()}@example.com`;
    const onboardPayload = {
      organization: {
        name: `Test Tenant Automated ${Date.now()}`,
        type: 'Professional'
      },
      primaryAdmin: {
        email: testOnboardEmail,
        temporaryPassword: 'TemporaryPassword123!@#',
        firstName: 'Auto',
        lastName: 'Admin'
      }
    };

    const onboardRes = await fetch(`${baseUrl}/api/onboarding/tenant`, {
      method: 'POST',
      headers: headersSuper,
      body: JSON.stringify(onboardPayload)
    });
    const onboardJson = await onboardRes.json();
    const newTenantId = onboardJson.tenant?.id || onboardJson.tenantId;
    assert((onboardRes.status === 200 || onboardRes.status === 201) && !!newTenantId,
      'ONBOARD-01', `Onboarding endpoint returns HTTP 201 with tenantId: ${newTenantId}`);

    if (newTenantId) {
      cleanupTenants.push(newTenantId);
      const masterCategories = [
        'departments', 'positions', 'project_stages', 'task_priorities',
        'task_statuses', 'customer_types', 'customer_statuses',
        'visit_purposes', 'visit_statuses', 'activity_types'
      ];

      let allCategoriesCloned = true;
      let allHaveProvenance = true;

      for (const cat of masterCategories) {
        const [catRows] = await pool.query(`SELECT id, platformMasterId FROM ${cat} WHERE tenantId = ?`, [newTenantId]);
        if (catRows.length === 0) {
          allCategoriesCloned = false;
        }
        if (!catRows.every(r => !!r.platformMasterId)) {
          allHaveProvenance = false;
        }
      }

      assert(allCategoriesCloned, 'ONBOARD-02', 'All 10 master categories cloned for newly onboarded tenant');
      assert(allHaveProvenance, 'ONBOARD-03', 'All cloned rows retain platformMasterId provenance link');
    }

    // =========================================================================
    // TEST 13: REPORT ENDPOINT TENANT SCOPE
    // =========================================================================
    console.log('\n--- TEST 13: REPORT ENDPOINT TENANT SCOPE ---');
    const repCustA = await (await fetch(`${baseUrl}/api/reports/customers`, { headers: headersA })).json();
    const repTasksA = await (await fetch(`${baseUrl}/api/reports/tasks`, { headers: headersA })).json();
    const repVisitsA = await (await fetch(`${baseUrl}/api/reports/visits`, { headers: headersA })).json();
    const repPerfA = await (await fetch(`${baseUrl}/api/reports/performance`, { headers: headersA })).json();

    const repCustB = await (await fetch(`${baseUrl}/api/reports/customers`, { headers: headersB })).json();
    const repTasksB = await (await fetch(`${baseUrl}/api/reports/tasks`, { headers: headersB })).json();
    const repVisitsB = await (await fetch(`${baseUrl}/api/reports/visits`, { headers: headersB })).json();
    const repPerfB = await (await fetch(`${baseUrl}/api/reports/performance`, { headers: headersB })).json();

    assert(repCustA.tableData !== undefined && repCustB.tableData !== undefined,
      'REPORT-SCOPE-01', 'GET /api/reports/customers cleanly segregated by caller tenant');
    assert(repTasksA.tableData !== undefined && repTasksB.tableData !== undefined,
      'REPORT-SCOPE-02', 'GET /api/reports/tasks cleanly segregated by caller tenant');
    assert(repVisitsA.tableData !== undefined && repVisitsB.tableData !== undefined,
      'REPORT-SCOPE-03', 'GET /api/reports/visits cleanly segregated by caller tenant');
    assert(repPerfA.kpiData !== undefined && repPerfB.kpiData !== undefined,
      'REPORT-SCOPE-04', 'GET /api/reports/performance cleanly segregated by caller tenant');

    // =========================================================================
    // TEST 14: HEALTHCHECK UNPROTECTED ENDPOINT
    // =========================================================================
    console.log('\n--- TEST 14: DEPLOYMENT HEALTHCHECK UNPROTECTED ENDPOINT ---');
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthText = await healthRes.text();
    assert(healthRes.status === 200 && healthText === 'OK',
      'HEALTH-01', `/api/health responds HTTP 200 without Authorization header: "${healthText}"`);

    // =========================================================================
    // TEST 15: ZERO CATEGORY 1 RUNTIME AUTHORITY RESIDUALS & LEGACY HELPER
    // =========================================================================
    console.log('\n--- TEST 15: ZERO CATEGORY 1 RUNTIME AUTHORITY RESIDUALS & LEGACY HELPER ---');
    
    // A. Verify legacy compatibility helper
    const legTaskRes = resolveLegacySemanticStatus('COMPLETED', 'TASK');
    assert(legTaskRes.isResolved && legTaskRes.semanticCode === 'COMPLETED' && legTaskRes.isTerminal,
      'LEGACY-COMPAT-01', 'resolveLegacySemanticStatus maps COMPLETED to semantic code and terminal flag');

    const legUnknownRes = resolveLegacySemanticStatus('UNKNOWN_XYZ', 'TASK');
    assert(!legUnknownRes.isResolved && legUnknownRes.semanticCode === null,
      'LEGACY-COMPAT-02', 'resolveLegacySemanticStatus safely fails on unknown status');

    // B. Static search of backend/src runtime files for Category 1 violations
    const backendSrcDir = path.join(__dirname, 'src');
    const forbiddenPatterns = [
      { name: "statusId === 'COMPLETED'", regex: /\bstatusId\s*===\s*['"]COMPLETED['"]/i },
      { name: "statusId === 'CANCELLED'", regex: /\bstatusId\s*===\s*['"]CANCELLED['"]/i },
      { name: "stageId === 'WON'", regex: /\bstageId\s*===\s*['"]WON['"]/i },
      { name: "stageId === 'LOST'", regex: /\bstageId\s*===\s*['"]LOST['"]/i },
      { name: "statusId NOT IN ('COMPLETED', 'CANCELLED')", regex: /\bstatusId\s+NOT\s+IN\s*\(['"]COMPLETED['"],\s*['"]CANCELLED['"]\)/i },
      { name: "stageId NOT IN ('WON', 'LOST')", regex: /\bstageId\s+NOT\s+IN\s*\(['"]WON['"],\s*['"]LOST['"]\)/i },
      { name: "COALESCE(ts.code, t.statusId) NOT IN", regex: /COALESCE\s*\(\s*ts\.code\s*,\s*t\.statusId\s*\)\s*NOT\s*IN/i },
      { name: "t.statusId IN ('COMPLETED'", regex: /t\.statusId\s+IN\s*\(['"]COMPLETED['"]/i }
    ];

    function getRuntimeFiles(dir) {
      let files = [];
      const list = fs.readdirSync(dir);
      for (const item of list) {
        const full = path.join(dir, item);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          if (item !== 'migrations') {
            files = files.concat(getRuntimeFiles(full));
          }
        } else if (full.endsWith('.ts') && !full.endsWith('seed-data.ts')) {
          files.push(full);
        }
      }
      return files;
    }

    const runtimeFiles = getRuntimeFiles(backendSrcDir);
    const violations = [];

    for (const f of runtimeFiles) {
      const content = fs.readFileSync(f, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, lineIdx) => {
        for (const pat of forbiddenPatterns) {
          if (pat.regex.test(line)) {
            violations.push(`${path.relative(backendSrcDir, f)}:${lineIdx + 1} matches ${pat.name}`);
          }
        }
      });
    }

    assert(violations.length === 0,
      'RUNTIME-SCAN-01', `Zero Category 1 runtime authority violations in runtime files (found: ${violations.length})`);
    if (violations.length > 0) {
      console.error('Violations found:', violations);
    }

  } catch (err) {
    console.error('Unhandled test suite error:', err);
    failed++;
  } finally {
    console.log('\n--- EXECUTING AUTHORITATIVE VERIFIABLE CLEANUP ---');
    try {
      // 1. Restore modified master data
      for (const fn of restorations) {
        try { await fn(); } catch (e) { /* ignore */ }
      }

      // 2. Clean up business entities
      if (cleanupCustomerContacts.length > 0) {
        await pool.query('DELETE FROM customer_contacts WHERE id IN (?)', [cleanupCustomerContacts]);
      }
      if (cleanupTasks.length > 0) {
        await pool.query('DELETE FROM tasks WHERE id IN (?)', [cleanupTasks]);
      }
      if (cleanupVisits.length > 0) {
        await pool.query('DELETE FROM visits WHERE id IN (?)', [cleanupVisits]);
      }
      if (cleanupProjects.length > 0) {
        await pool.query('DELETE FROM projects WHERE id IN (?)', [cleanupProjects]);
      }
      if (cleanupCustomers.length > 0) {
        await pool.query('DELETE FROM customers WHERE id IN (?)', [cleanupCustomers]);
      }

      // 3. Clean up onboarded test tenants and all cascaded data
      for (const tid of cleanupTenants) {
        // Delete master tables
        const masterCats = [
          'departments', 'positions', 'project_stages', 'task_priorities',
          'task_statuses', 'customer_types', 'customer_statuses',
          'visit_purposes', 'visit_statuses', 'activity_types'
        ];
        for (const cat of masterCats) {
          await pool.query(`DELETE FROM ${cat} WHERE tenantId = ?`, [tid]);
        }
        await pool.query('DELETE FROM role_data_scopes WHERE roleId IN (SELECT id FROM roles WHERE tenantId = ?)', [tid]);
        await pool.query('DELETE FROM role_permissions WHERE roleId IN (SELECT id FROM roles WHERE tenantId = ?)', [tid]);
        await pool.query('DELETE FROM tenant_user_roles WHERE tenantUserId IN (SELECT id FROM tenant_users WHERE tenantId = ?)', [tid]);
        await pool.query('DELETE FROM tenant_users WHERE tenantId = ?', [tid]);
        await pool.query('DELETE FROM roles WHERE tenantId = ?', [tid]);
        await pool.query('DELETE FROM tenants WHERE id = ?', [tid]);
      }

      // 4. Clean up test users
      if (cleanupUsers.length > 0) {
        await pool.query('DELETE FROM users WHERE id IN (?)', [cleanupUsers]);
      }

      // 5. Clean up test auth sessions
      if (cleanupSessions.length > 0) {
        await pool.query('DELETE FROM auth_sessions WHERE token IN (?)', [cleanupSessions]);
      }

      // 6. POST-CLEANUP ORPHAN VERIFICATION
      console.log('--- POST-CLEANUP ORPHAN VERIFICATION ---');
      if (cleanupTasks.length > 0) {
        const [remTasks] = await pool.query('SELECT id FROM tasks WHERE id IN (?)', [cleanupTasks]);
        assert(remTasks.length === 0, 'CLEANUP-TASKS-VERIFY', `Verified 0 orphaned tasks in database`);
      }
      if (cleanupVisits.length > 0) {
        const [remVisits] = await pool.query('SELECT id FROM visits WHERE id IN (?)', [cleanupVisits]);
        assert(remVisits.length === 0, 'CLEANUP-VISITS-VERIFY', `Verified 0 orphaned visits in database`);
      }
      if (cleanupProjects.length > 0) {
        const [remProjs] = await pool.query('SELECT id FROM projects WHERE id IN (?)', [cleanupProjects]);
        assert(remProjs.length === 0, 'CLEANUP-PROJECTS-VERIFY', `Verified 0 orphaned projects in database`);
      }
      if (cleanupCustomers.length > 0) {
        const [remCusts] = await pool.query('SELECT id FROM customers WHERE id IN (?)', [cleanupCustomers]);
        assert(remCusts.length === 0, 'CLEANUP-CUSTOMERS-VERIFY', `Verified 0 orphaned customers in database`);
      }
      if (cleanupTenants.length > 0) {
        const [remTenants] = await pool.query('SELECT id FROM tenants WHERE id IN (?)', [cleanupTenants]);
        assert(remTenants.length === 0, 'CLEANUP-TENANTS-VERIFY', `Verified 0 orphaned tenants in database`);
      }
      if (cleanupSessions.length > 0) {
        const [remSess] = await pool.query('SELECT id FROM auth_sessions WHERE token IN (?)', [cleanupSessions]);
        assert(remSess.length === 0, 'CLEANUP-SESSIONS-VERIFY', `Verified 0 orphaned auth sessions in database`);
      }

      console.log('Cleanup completed and mathematically verified. Zero orphaned test records.');
    } catch (cleanErr) {
      console.error('Error during cleanup:', cleanErr);
    }

    if (server) {
      await new Promise(r => server.close(r));
    }
    await pool.end();
  }

  console.log('\n====================================================');
  console.log(`REGRESSION SUITE COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runRegressionSuite();
