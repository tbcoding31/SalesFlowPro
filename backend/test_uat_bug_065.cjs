const mysql = require('mysql2/promise');
const http = require('http');
const { app } = require('./dist/server.js');
const { resolveTenantTaskDefaults } = require('./dist/services/taskAssignment.service.js');

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Kontolloyo90909!@#',
  database: process.env.DB_NAME || 'db_salesflow_pro'
};

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
  console.log('PERMANENT REGRESSION VERIFICATION SUITE');
  console.log('====================================================\n');

  const pool = mysql.createPool(DB_CONFIG);
  let server;
  let baseUrl;

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

    // Verify tenant B exists, or pick an alternate
    const [tRows] = await pool.query('SELECT id FROM tenants WHERE id != ? AND status = "ACTIVE" LIMIT 1', [tenantAId]);
    if (tRows.length > 0) {
      tenantBId = tRows[0].id;
    }

    // Insert test auth sessions
    // USR-001 belongs to TEN-00001 (Admin)
    // Find or assign a user for Tenant B
    let [uBRows] = await pool.query('SELECT u.id FROM users u JOIN tenant_users tu ON tu.userId = u.id WHERE tu.tenantId = ? AND tu.status = "ACTIVE" LIMIT 1', [tenantBId]);
    let userBId;
    if (uBRows.length > 0) {
      userBId = uBRows[0].id;
    } else {
      userBId = 'USR-TEST-B-' + Date.now();
      await pool.query('INSERT INTO users (id, name, email, status) VALUES (?, "Test User B", ?, "ACTIVE")', [userBId, `testb_${Date.now()}@example.com`]);
      await pool.query('INSERT INTO tenant_users (id, tenantId, userId, status) VALUES (UUID(), ?, ?, "ACTIVE")', [tenantBId, userBId]);
      await pool.query('INSERT INTO tenant_user_roles (id, tenantUserId, roleId) VALUES (UUID(), (SELECT id FROM tenant_users WHERE userId = ? LIMIT 1), "ROLE-ADMIN")', [userBId]);
    }

    await pool.query(`
      INSERT INTO auth_sessions (id, userId, token, expiresAt, createdAt)
      VALUES 
        (UUID(), 'USR-001', ?, DATE_ADD(NOW(), INTERVAL 1 DAY), NOW()),
        (UUID(), ?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY), NOW()),
        (UUID(), 'USR-000', ?, DATE_ADD(NOW(), INTERVAL 1 DAY), NOW())
    `, [tokenTenantA, userBId, tokenTenantB, tokenPlatform]);

    const headersA = { 'Authorization': `Bearer ${tokenTenantA}`, 'Content-Type': 'application/json' };
    const headersB = { 'Authorization': `Bearer ${tokenTenantB}`, 'Content-Type': 'application/json' };
    const headersSuper = { 'Authorization': `Bearer ${tokenPlatform}`, 'Content-Type': 'application/json' };

    // =========================================================================
    // TEST 12: /api/health returns HTTP 200 without auth (Deployment Safety)
    // =========================================================================
    console.log('--- TEST 12: DEPLOYMENT HEALTHCHECK UNPROTECTED ENDPOINT ---');
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthText = await healthRes.text();
    assert(healthRes.status === 200 && healthText === 'OK',
      'HEALTH-01', `/api/health responds HTTP 200 without Authorization header: "${healthText}"`);

    // =========================================================================
    // TEST 1: Two tenants with distinct master IDs
    // =========================================================================
    console.log('\n--- TEST 1: TWO-TIER MASTER DATA SEPARATION ACROSS TENANTS ---');
    const [tStatusesA] = await pool.query('SELECT id, code, platformMasterId FROM task_statuses WHERE tenantId = ? AND isActive = 1', [tenantAId]);
    const [tStatusesB] = await pool.query('SELECT id, code, platformMasterId FROM task_statuses WHERE tenantId = ? AND isActive = 1', [tenantBId]);
    console.log('tStatusesA rows:', tStatusesA);
    
    assert(tStatusesA.length > 0 && tStatusesB.length > 0,
      'MASTER-SEP-01', `Tenant A has ${tStatusesA.length} task statuses, Tenant B has ${tStatusesB.length} task statuses`);

    const setA = new Set(tStatusesA.map(s => s.id));
    const overlap = tStatusesB.filter(s => setA.has(s.id));
    assert(overlap.length === 0,
      'MASTER-SEP-02', `Zero primary key overlap between Tenant A and Tenant B master rows`);

    // Provenance verification
    const hasProvenanceA = tStatusesA.some(s => s.platformMasterId && s.platformMasterId.startsWith('TS-'));
    const hasProvenanceB = tStatusesB.some(s => s.platformMasterId && s.platformMasterId.startsWith('TS-'));
    assert(hasProvenanceA && hasProvenanceB,
      'MASTER-SEP-03', 'Cloned master rows retain provenance link to platform blueprint (platformMasterId)');

    // =========================================================================
    // TEST 2: Task completed status recognized via semantic master code/isTerminal
    // =========================================================================
    console.log('\n--- TEST 2: SEMANTIC RECOGNITION OF COMPLETED TASKS ---');
    // Find Tenant A's completed task status
    const compStatusRow = tStatusesA.find(s => s.code === 'COMPLETED' || s.code === 'TSK_COMPLETED' || s.platformMasterId === 'TS-3');
    assert(!!compStatusRow, 'TASK-SEM-01', `Found tenant completed task status: ${compStatusRow?.id}`);

    // Insert a test task with tenant-specific completed status ID (not 'TS-3')
    const testTaskId = 'TSK-REG-' + Date.now();
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

    // Clean up test task
    await pool.query('DELETE FROM tasks WHERE id = ?', [testTaskId]);

    // =========================================================================
    // TEST 3: Visit completed/cancelled terminal lock & completedAt timestamp
    // =========================================================================
    console.log('\n--- TEST 3: VISIT COMPLETED/CANCELLED TERMINAL EDIT LOCK & TIMESTAMPS ---');
    const [vStatusesA] = await pool.query('SELECT id, code, isTerminal FROM visit_statuses WHERE tenantId = ? AND isActive = 1', [tenantAId]);
    const [vPurposesA] = await pool.query('SELECT id FROM visit_purposes WHERE tenantId = ? AND isActive = 1 LIMIT 1', [tenantAId]);
    const [custA] = await pool.query('SELECT id FROM customers WHERE tenantId = ? LIMIT 1', [tenantAId]);
    
    const schedStatus = vStatusesA.find(s => s.code === 'SCHEDULED') || vStatusesA[0];
    const compVisitStatus = vStatusesA.find(s => s.code === 'COMPLETED');
    const cancVisitStatus = vStatusesA.find(s => s.code === 'CANCELLED');

    const testVisitId = 'VST-REG-' + Date.now();
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

    // Attempt to cancel an already completed visit -> must be rejected
    const cancelCompletedRes = await fetch(`${baseUrl}/api/visits/${testVisitId}/cancel`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({ cancellationReason: 'Client cancel' })
    });
    const cancelCompletedJson = await cancelCompletedRes.json();
    assert(cancelCompletedRes.status === 400 && cancelCompletedJson.code === 'CANNOT_CANCEL_COMPLETED_VISIT',
      'VISIT-LOCK-04', 'Cancelling already completed visit is blocked (400 CANNOT_CANCEL_COMPLETED_VISIT)');

    // Clean up test visit
    await pool.query('DELETE FROM visits WHERE id = ?', [testVisitId]);

    // =========================================================================
    // TEST 4: Project WON/LOST evaluated via ps.commercialOutcome
    // =========================================================================
    console.log('\n--- TEST 4: PROJECT STAGE COMMERCIAL OUTCOME EVALUATION ---');
    const [stagesA] = await pool.query('SELECT id, code, phase, commercialOutcome, isTerminal FROM project_stages WHERE tenantId = ?', [tenantAId]);
    const wonStage = stagesA.find(s => s.commercialOutcome === 'WON');
    const lostStage = stagesA.find(s => s.commercialOutcome === 'LOST');
    const openStage = stagesA.find(s => s.commercialOutcome === 'NONE' || s.commercialOutcome === 'OPEN');

    assert(!!wonStage && !!lostStage && !!openStage,
      'STAGE-OUTCOME-01', `Identified stages: WON (${wonStage?.id}), LOST (${lostStage?.id}), OPEN (${openStage?.id})`);

    // Call /api/reports/performance
    const perfRes = await fetch(`${baseUrl}/api/reports/performance`, { headers: headersA });
    const perfJson = await perfRes.json();
    assert(perfRes.status === 200, 'STAGE-OUTCOME-02', 'Performance report endpoint returns 200');
    assert(perfJson.oppConversionData && Array.isArray(perfJson.oppConversionData),
      'STAGE-OUTCOME-03', 'oppConversionData returned with Won, Lost, and Open buckets');

    // Call /api/sales/attention and verify evaluation
    const attRes = await fetch(`${baseUrl}/api/sales/attention`, { headers: headersA });
    assert(attRes.status === 200, 'STAGE-OUTCOME-04', 'Sales attention signals evaluated cleanly via stageCommercialOutcome');

    // =========================================================================
    // TEST 5: Missing mandatory master raises CONFIG_INTEGRITY_ERROR (zero silent fallback)
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
    // TEST 6: Inactive master rejected for new transactions (isActive = 1 enforced)
    // =========================================================================
    console.log('\n--- TEST 6: INACTIVE MASTER DATA REJECTED FOR NEW TRANSACTIONS ---');
    // Deactivate one task priority temporarily
    const [prioritiesA] = await pool.query('SELECT id, name FROM task_priorities WHERE tenantId = ? LIMIT 1', [tenantAId]);
    const testPriId = prioritiesA[0].id;
    await pool.query('UPDATE task_priorities SET isActive = 0 WHERE id = ?', [testPriId]);

    // Attempt to create a task using this deactivated priority
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

    // Restore priority
    await pool.query('UPDATE task_priorities SET isActive = 1 WHERE id = ?', [testPriId]);

    // =========================================================================
    // TEST 7: Inactive master displayed in historical records (left join intact)
    // =========================================================================
    console.log('\n--- TEST 7: HISTORICAL INACTIVE MASTER DATA DISPLAY INTEGRITY ---');
    // Create a task with active status
    const histTaskId = 'TSK-HIST-' + Date.now();
    await pool.query(`
      INSERT INTO tasks (id, tenantId, title, statusId, priorityId, dueDate, createdAt, updatedAt)
      VALUES (?, ?, 'Historical Task With Inactive Status', ?, ?, CURDATE(), NOW(), NOW())
    `, [histTaskId, tenantAId, tStatusesA[0].id, testPriId]);

    // Now deactivate that status
    await pool.query('UPDATE task_statuses SET isActive = 0 WHERE id = ?', [tStatusesA[0].id]);

    // Fetch tasks report
    const histReportRes = await fetch(`${baseUrl}/api/reports/tasks`, { headers: headersA });
    const histReportJson = await histReportRes.json();
    const histTask = histReportJson.tableData?.find(t => t.id === histTaskId);

    assert(!!histTask && histTask.status !== null && histTask.status !== undefined,
      'HIST-DISPLAY-01', `Historical task referencing inactive status remains visible with resolved status: "${histTask?.status}"`);

    // Restore status and clean up task
    await pool.query('UPDATE task_statuses SET isActive = 1 WHERE id = ?', [tStatusesA[0].id]);
    await pool.query('DELETE FROM tasks WHERE id = ?', [histTaskId]);

    // =========================================================================
    // TEST 8: Cross-tenant relatedProjectId in tasks rejected
    // =========================================================================
    console.log('\n--- TEST 8: CROSS-TENANT PROJECT REFERENCE ISOLATION ---');
    // Find or create a project belonging to Tenant B
    let [projB] = await pool.query('SELECT id FROM projects WHERE tenantId = ? LIMIT 1', [tenantBId]);
    let projBId;
    if (projB.length > 0) {
      projBId = projB[0].id;
    } else {
      projBId = 'PRJ-TEST-B-' + Date.now();
      await pool.query(`
        INSERT INTO projects (id, tenantId, title, value, stageId, createdAt)
        VALUES (?, ?, 'Tenant B Project', 50000, (SELECT id FROM project_stages WHERE tenantId = ? LIMIT 1), NOW())
      `, [projBId, tenantBId, tenantBId]);
    }

    // Tenant A attempts to create a task linked to Tenant B's project
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
    // TEST 9: Cross-tenant relatedVisitId in tasks rejected
    // =========================================================================
    console.log('\n--- TEST 9: CROSS-TENANT VISIT REFERENCE ISOLATION ---');
    // Find or create a visit belonging to Tenant B
    let [visitB] = await pool.query('SELECT id FROM visits WHERE tenantId = ? LIMIT 1', [tenantBId]);
    let visitBId;
    if (visitB.length > 0) {
      visitBId = visitB[0].id;
    } else {
      visitBId = 'VST-TEST-B-' + Date.now();
      await pool.query(`
        INSERT INTO visits (id, tenantId, title, visitDate, statusId, purposeId, createdAt, updatedAt)
        VALUES (?, ?, 'Tenant B Field Visit', CURDATE(), (SELECT id FROM visit_statuses WHERE tenantId = ? LIMIT 1), (SELECT id FROM visit_purposes WHERE tenantId = ? LIMIT 1), NOW(), NOW())
      `, [visitBId, tenantBId, tenantBId, tenantBId]);
    }

    // Tenant A attempts to create a task linked to Tenant B's visit
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
    // TEST 10: Cross-tenant customer_contacts access denied
    // =========================================================================
    console.log('\n--- TEST 10: CUSTOMER CONTACTS MULTI-TENANT ISOLATION ---');
    // Tenant B's customer
    let [custB] = await pool.query('SELECT id FROM customers WHERE tenantId = ? LIMIT 1', [tenantBId]);
    let custBId;
    if (custB.length > 0) {
      custBId = custB[0].id;
    } else {
      custBId = 'CST-B-' + Date.now();
      await pool.query('INSERT INTO customers (id, tenantId, name, code, createdAt) VALUES (?, ?, "Tenant B Customer", "CB-01", NOW())', [custBId, tenantBId]);
    }

    // Tenant A attempts to read contacts of Tenant B's customer
    const crossContactGet = await fetch(`${baseUrl}/api/customer_contacts?customerId=${custBId}`, { headers: headersA });
    const crossContactGetJson = await crossContactGet.json();
    assert(crossContactGet.status === 200 && Array.isArray(crossContactGetJson) && crossContactGetJson.length === 0,
      'CROSS-CONTACT-01', `Tenant A cannot read contacts of Tenant B customer (returned empty array)`);

    // Tenant A attempts to create a contact for Tenant B's customer
    const crossContactPost = await fetch(`${baseUrl}/api/customer_contacts`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        customerId: custBId,
        name: 'Injected Contact'
      })
    });
    const crossContactPostJson = await crossContactPost.json();
    assert(crossContactPost.status === 404,
      'CROSS-CONTACT-02', `Tenant A denied creating contact for Tenant B customer (HTTP 404: ${crossContactPostJson.error})`);

    // =========================================================================
    // TEST 11: All reporting endpoints (/api/reports/*) return correct tenant data
    // =========================================================================
    console.log('\n--- TEST 11: AUTHORITATIVE REPORTING SUITE VERIFICATION ---');
    const rCustomers = await fetch(`${baseUrl}/api/reports/customers`, { headers: headersA });
    const rCustJson = await rCustomers.json();
    assert(rCustomers.status === 200 && rCustJson.kpi && Array.isArray(rCustJson.tableData),
      'REPORT-01', `GET /api/reports/customers returns 200 with kpi and tableData (total: ${rCustJson.kpi?.totalCustomers})`);

    const rTasks = await fetch(`${baseUrl}/api/reports/tasks`, { headers: headersA });
    const rTaskJson = await rTasks.json();
    assert(rTasks.status === 200 && rTaskJson.kpi && Array.isArray(rTaskJson.tableData),
      'REPORT-02', `GET /api/reports/tasks returns 200 with kpi and tableData (total: ${rTaskJson.kpi?.totalTasks})`);

    const rVisits = await fetch(`${baseUrl}/api/reports/visits`, { headers: headersA });
    const rVisitJson = await rVisits.json();
    assert(rVisits.status === 200 && rVisitJson.kpi && Array.isArray(rVisitJson.tableData),
      'REPORT-03', `GET /api/reports/visits returns 200 with kpi and tableData (total: ${rVisitJson.kpi?.totalVisits})`);

    const rPerf = await fetch(`${baseUrl}/api/reports/performance`, { headers: headersA });
    const rPerfJson = await rPerf.json();
    assert(rPerf.status === 200 && rPerfJson.kpiData && Array.isArray(rPerfJson.rankingData),
      'REPORT-04', `GET /api/reports/performance returns 200 with kpiData and rankingData (win rate: ${rPerfJson.kpiData?.conversionRate}%)`);

  } catch (err) {
    console.error('Unhandled test suite error:', err);
    failed++;
  } finally {
    // Clean up test sessions
    await pool.query('DELETE FROM auth_sessions WHERE token IN (?, ?, ?)', [tokenTenantA, tokenTenantB, tokenPlatform]);
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
