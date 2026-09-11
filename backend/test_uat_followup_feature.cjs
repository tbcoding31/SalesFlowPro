const fs = require('fs');
const path = require('path');
const http = require('http');
const { pool } = require('./dist/db.js');
const { app } = require('./dist/server.js');
const { evaluateTenantAccess } = require('./dist/utils/scope.js');

async function runFollowupTestSuite() {
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
  console.log('UAT-066: FOLLOW-UP FEATURE & EVIDENCE VALIDATION');
  console.log('INTEGRATION TEST SUITE (TC-01 TO TC-21)');
  console.log('====================================================\n');

  let server;
  let baseUrl;

  // Cleanup tracking lists
  const cleanupFollowUps = [];
  const cleanupEvidences = [];
  const cleanupSessions = [];
  const cleanupFollowUpTypes = [];
  const cleanupTenants = [];
  const cleanupUsers = [];
  const cleanupCustomers = [];
  const cleanupProjects = [];
  const cleanupVisits = [];
  const cleanupTasks = [];
  const diskPathsToDelete = [];

  // Ephemeral test tokens
  const tokenTenantA = 'TEST_FOLLOWUP_A_' + Date.now();
  const tokenTenantB = 'TEST_FOLLOWUP_B_' + Date.now();
  const tokenPlatform = 'TEST_FOLLOWUP_SUPER_' + Date.now();

  const tenantAId = 'TEN-00001';
  let tenantBId = null;
  let userAId = null;
  let userBId = null;

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

    if (uARows.length > 0) {
      userAId = uARows[0].id;
    } else {
      userAId = 'USR-001';
    }

    // Resolve Tenant B with active primary TENANT_ADMIN user
    const [cands] = await pool.query(`
      SELECT tu.tenantId, tu.userId
      FROM tenant_users tu
      JOIN users u ON u.id = tu.userId AND u.status = 'ACTIVE'
      JOIN tenant_user_roles tur ON tur.tenantUserId = tu.id
      JOIN roles r ON r.id = tur.roleId
      JOIN tenants t ON t.id = tu.tenantId
      WHERE tu.tenantId != ? AND tu.status = 'ACTIVE' AND tu.isPrimary = 1 AND t.status = 'ACTIVE' AND r.code = 'TENANT_ADMIN'
    `, [tenantAId]);

    for (const c of cands) {
      const acc = await evaluateTenantAccess(pool, c.tenantId);
      if (acc.allowed) {
        tenantBId = c.tenantId;
        userBId = c.userId;
        break;
      }
    }

    if (!userBId) {
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

    // Auth sessions
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

    // Setup Fixtures for Tenant A: Customer, Project, Visit, Task, Type
    const custAId = `CUST-TEST-${Date.now()}`;
    cleanupCustomers.push(custAId);
    await pool.query(`
      INSERT INTO customers (id, tenantId, code, name, createdAt)
      VALUES (?, ?, 'CUST-A', 'Acme Corp Test A', NOW())
    `, [custAId, tenantAId]);

    const projAId = `PRJ-TEST-${Date.now()}`;
    cleanupProjects.push(projAId);
    await pool.query(`
      INSERT INTO projects (id, tenantId, customerId, title, createdAt)
      VALUES (?, ?, ?, 'Project Alpha Test', NOW())
    `, [projAId, tenantAId, custAId]);

    const visitAId = `VST-TEST-${Date.now()}`;
    cleanupVisits.push(visitAId);
    await pool.query(`
      INSERT INTO visits (id, tenantId, customerId, title, visitDate, createdAt)
      VALUES (?, ?, ?, 'Visit Alpha Test', CURDATE(), NOW())
    `, [visitAId, tenantAId, custAId]);

    const taskAId = `TSK-TEST-${Date.now()}`;
    cleanupTasks.push(taskAId);
    await pool.query(`
      INSERT INTO tasks (id, tenantId, title, dueDate, createdAt)
      VALUES (?, ?, 'Task Alpha Test', CURDATE(), NOW())
    `, [taskAId, tenantAId]);

    // Get Tenant A's active follow_up_types
    const [typesA] = await pool.query('SELECT id, name, code FROM follow_up_types WHERE tenantId = ? AND isActive = 1', [tenantAId]);
    assert(typesA.length > 0, 'SETUP-01', `Tenant A has ${typesA.length} follow_up_types available`);
    const defaultTypeA = typesA[0];

    // Get Tenant B's active follow_up_types
    const [typesB] = await pool.query('SELECT id, name, code FROM follow_up_types WHERE tenantId = ? AND isActive = 1', [tenantBId]);
    assert(typesB.length > 0, 'SETUP-02', `Tenant B has ${typesB.length} follow_up_types available`);
    const defaultTypeB = typesB[0];

    // Setup Fixture for Tenant B: Customer
    const custBId = `CUST-TEST-B-${Date.now()}`;
    cleanupCustomers.push(custBId);
    await pool.query(`
      INSERT INTO customers (id, tenantId, code, name, createdAt)
      VALUES (?, ?, 'CUST-B', 'Beta Corp Test B', NOW())
    `, [custBId, tenantBId]);

    // =========================================================================
    // TC-01: List Follow-ups with scoping
    // =========================================================================
    console.log('\n--- TC-01: List Follow-ups with scoping ---');
    const listResA = await fetch(`${baseUrl}/api/follow-ups`, { headers: headersA });
    const listDataA = await listResA.json();
    const rowsA = Array.isArray(listDataA) ? listDataA : listDataA.data;
    assert(listResA.status === 200 && Array.isArray(rowsA), 'TC-01.1', `Tenant A lists follow-ups (count: ${rowsA.length})`);

    const listResB = await fetch(`${baseUrl}/api/follow-ups`, { headers: headersB });
    const listDataB = await listResB.json();
    const rowsB = Array.isArray(listDataB) ? listDataB : listDataB.data;
    assert(listResB.status === 200 && Array.isArray(rowsB), 'TC-01.2', `Tenant B lists follow-ups (count: ${rowsB.length})`);

    // =========================================================================
    // TC-02: Filter tests (customerId, status, dates)
    // =========================================================================
    console.log('\n--- TC-02: Follow-up filters ---');
    const filterRes = await fetch(`${baseUrl}/api/follow-ups?customerId=${custAId}&status=OPEN`, { headers: headersA });
    const filterData = await filterRes.json();
    const filterRows = Array.isArray(filterData) ? filterData : filterData.data;
    assert(filterRes.status === 200 && filterRows.length === 0, 'TC-02.1', 'Empty filter result for new customer matches expectation');

    // =========================================================================
    // TC-03: Create Follow-up with mandatory fields
    // =========================================================================
    console.log('\n--- TC-03: Create Follow-up with mandatory fields ---');
    const todayStr = new Date().toISOString().split('T')[0];
    const createRes = await fetch(`${baseUrl}/api/follow-ups`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        customerId: custAId,
        typeId: defaultTypeA.id,
        followUpDate: todayStr,
        title: 'Initial Contract Follow-up',
        notes: 'Review pending contract clauses'
      })
    });
    const createData = await createRes.json();
    assert(createRes.status === 201 && createData.data && createData.data.id, 'TC-03.1', `Follow-up created successfully: ${createData.data?.id}`);
    const followUp1Id = createData.data?.id;
    if (followUp1Id) cleanupFollowUps.push(followUp1Id);

    // =========================================================================
    // TC-04: Create Follow-up validation failures (400)
    // =========================================================================
    console.log('\n--- TC-04: Create Follow-up validation failures ---');
    // Missing customerId
    const valFail1 = await fetch(`${baseUrl}/api/follow-ups`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        typeId: defaultTypeA.id,
        followUpDate: '2026-10-01'
      })
    });
    assert(valFail1.status === 400, 'TC-04.1', 'Validation failure for missing customerId rejected with 400');

    // Missing typeId
    const valFail2 = await fetch(`${baseUrl}/api/follow-ups`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        customerId: custAId,
        followUpDate: '2026-10-01'
      })
    });
    assert(valFail2.status === 400, 'TC-04.2', 'Validation failure for missing typeId rejected with 400');

    // Missing followUpDate
    const valFail3 = await fetch(`${baseUrl}/api/follow-ups`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        customerId: custAId,
        typeId: defaultTypeA.id
      })
    });
    assert(valFail3.status === 400, 'TC-04.3', 'Validation failure for missing followUpDate rejected with 400');

    // =========================================================================
    // TC-05: Context relation validation (Project, Visit, Task links)
    // =========================================================================
    console.log('\n--- TC-05: Context relation validation ---');
    const createCtxRes = await fetch(`${baseUrl}/api/follow-ups`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        customerId: custAId,
        typeId: defaultTypeA.id,
        followUpDate: todayStr,
        relatedProjectId: projAId,
        relatedVisitId: visitAId,
        relatedTaskId: taskAId,
        title: 'Multi-context Follow-up',
        notes: 'Linked to Project, Visit, and Task'
      })
    });
    const createCtxData = await createCtxRes.json();
    assert(createCtxRes.status === 201 && createCtxData.data?.sourceType === 'VISIT', 'TC-05.1', `Context relations saved (sourceType derived: ${createCtxData.data?.sourceType})`);
    const followUpCtxId = createCtxData.data?.id;
    if (followUpCtxId) cleanupFollowUps.push(followUpCtxId);

    // =========================================================================
    // TC-06: Cross-tenant creation guard
    // =========================================================================
    console.log('\n--- TC-06: Cross-tenant creation guard ---');
    const crossTenantCreate = await fetch(`${baseUrl}/api/follow-ups`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        customerId: custBId, // Foreign customer belonging to Tenant B!
        typeId: defaultTypeA.id,
        followUpDate: '2026-10-01'
      })
    });
    assert(crossTenantCreate.status === 404, 'TC-06.1', 'Cross-tenant customer creation rejected with 404');

    // =========================================================================
    // TC-07: Get Follow-up detail with joined fields and evidence array
    // =========================================================================
    console.log('\n--- TC-07: Get Follow-up detail ---');
    const detailRes = await fetch(`${baseUrl}/api/follow-ups/${followUp1Id}`, { headers: headersA });
    const detailData = await detailRes.json();
    assert(detailRes.status === 200 && detailData.customerName === 'Acme Corp Test A' && Array.isArray(detailData.evidences),
      'TC-07.1', 'Detail returned with customerName join and empty evidences array');

    // =========================================================================
    // TC-08: Update Follow-up
    // =========================================================================
    console.log('\n--- TC-08: Update Follow-up ---');
    const updateRes = await fetch(`${baseUrl}/api/follow-ups/${followUp1Id}`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({
        notes: 'Updated notes from test',
        priority: 'HIGH'
      })
    });
    const updateData = await updateRes.json();
    assert(updateRes.status === 200 && updateData.success === true, 'TC-08.1', 'Follow-up fields updated successfully');

    // Verify detail reflects update
    const detailAfterUpdate = await (await fetch(`${baseUrl}/api/follow-ups/${followUp1Id}`, { headers: headersA })).json();
    assert(detailAfterUpdate.priority === 'HIGH' && detailAfterUpdate.notes === 'Updated notes from test',
      'TC-08.2', 'Verified detail has updated priority and notes');

    // =========================================================================
    // TC-09: Complete Follow-up WITHOUT evidence rejected with 422
    // =========================================================================
    console.log('\n--- TC-09: Complete Follow-up WITHOUT evidence rejected ---');
    const completeNoEvRes = await fetch(`${baseUrl}/api/follow-ups/${followUp1Id}/complete`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({ outcome: 'Trying to complete without evidence' })
    });
    const completeNoEvData = await completeNoEvRes.json();
    assert(completeNoEvRes.status === 422 && completeNoEvData.code === 'FOLLOW_UP_EVIDENCE_REQUIRED',
      'TC-09.1', `Rejected with 422 FOLLOW_UP_EVIDENCE_REQUIRED: ${completeNoEvData.error}`);

    // =========================================================================
    // TC-10: Evidence upload: invalid magic bytes rejected with 400
    // =========================================================================
    console.log('\n--- TC-10: Evidence upload magic bytes validation ---');
    const fakeBuffer = Buffer.from('FAKE_TEXT_DATA_NOT_IMAGE');
    const fakeBlob = new Blob([fakeBuffer], { type: 'image/png' });
    const fakeForm = new FormData();
    fakeForm.append('file', fakeBlob, 'fake.png');

    const fakeUploadRes = await fetch(`${baseUrl}/api/follow-ups/${followUp1Id}/evidences`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenTenantA}` },
      body: fakeForm
    });
    const fakeUploadData = await fakeUploadRes.json();
    assert(fakeUploadRes.status === 400 && fakeUploadData.code === 'INVALID_IMAGE_FILE',
      'TC-10.1', `Fake image rejected by magic byte inspection: ${fakeUploadData.error}`);

    // =========================================================================
    // TC-11: Evidence upload: valid image accepted and saved to disk
    // =========================================================================
    console.log('\n--- TC-11: Evidence upload with valid image ---');
    // Minimal valid PNG header: 89 50 4E 47 0D 0A 1A 0A
    const validPngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82
    ]);
    const validBlob = new Blob([validPngBuffer], { type: 'image/png' });
    const validForm = new FormData();
    validForm.append('file', validBlob, 'valid_evidence.png');

    const validUploadRes = await fetch(`${baseUrl}/api/follow-ups/${followUp1Id}/evidences`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenTenantA}` },
      body: validForm
    });
    const validUploadData = await validUploadRes.json();
    assert(validUploadRes.status === 201 && validUploadData.data && validUploadData.data.id,
      'TC-11.1', `Valid PNG evidence uploaded: ${validUploadData.data?.id}`);
    const evidence1Id = validUploadData.data?.id;
    if (evidence1Id) cleanupEvidences.push(evidence1Id);

    // Verify isolated disk path exists
    const expectedDiskPath = path.resolve(__dirname, 'storage', 'tenants', tenantAId, 'follow-ups', followUp1Id, validUploadData.data?.storedFileName || '');
    const diskExists = fs.existsSync(expectedDiskPath);
    diskPathsToDelete.push(path.resolve(__dirname, 'storage', 'tenants', tenantAId, 'follow-ups', followUp1Id));
    assert(diskExists, 'TC-11.2', `File physically stored at isolated tenant path: ${expectedDiskPath}`);

    // =========================================================================
    // TC-12: Evidence preview streams image with correct Content-Type
    // =========================================================================
    console.log('\n--- TC-12: Evidence preview stream ---');
    const previewRes = await fetch(`${baseUrl}/api/follow-ups/${followUp1Id}/evidences/${evidence1Id}/preview`, {
      headers: { 'Authorization': `Bearer ${tokenTenantA}` }
    });
    const previewType = previewRes.headers.get('content-type');
    const previewBuf = await previewRes.arrayBuffer();
    assert(previewRes.status === 200 && previewType === 'image/png' && previewBuf.byteLength > 0,
      'TC-12.1', `Preview stream returned HTTP 200 with Content-Type: ${previewType} (${previewBuf.byteLength} bytes)`);

    // =========================================================================
    // TC-13: Evidence list returns uploaded records
    // =========================================================================
    console.log('\n--- TC-13: Evidence list ---');
    const evListRes = await fetch(`${baseUrl}/api/follow-ups/${followUp1Id}/evidences`, { headers: headersA });
    const evListData = await evListRes.json();
    const evItems = Array.isArray(evListData) ? evListData : (evListData.data || []);
    assert(evListRes.status === 200 && evItems.length === 1 && evItems[0].id === evidence1Id,
      'TC-13.1', 'Evidence list returns 1 active evidence record');

    // =========================================================================
    // TC-14: Complete Follow-up WITH evidence succeeds
    // =========================================================================
    console.log('\n--- TC-14: Complete Follow-up WITH evidence ---');
    const completeWithEvRes = await fetch(`${baseUrl}/api/follow-ups/${followUp1Id}/complete`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        outcome: 'Client agreed to terms in meeting',
        actualDate: todayStr
      })
    });
    const completeWithEvData = await completeWithEvRes.json();
    assert(completeWithEvRes.status === 200 && completeWithEvData.data?.status === 'COMPLETED' && completeWithEvData.data?.completedById === userAId,
      'TC-14.1', `Follow-up completed successfully (status: ${completeWithEvData.data?.status}, completedBy: ${completeWithEvData.data?.completedById})`);

    // =========================================================================
    // TC-15: Attempt to modify/complete already completed follow-up rejected
    // =========================================================================
    console.log('\n--- TC-15: Terminal status protection ---');
    const updateCompRes = await fetch(`${baseUrl}/api/follow-ups/${followUp1Id}`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({ title: 'New Title on Closed Follow-up' })
    });
    assert(updateCompRes.status === 400, 'TC-15.1', 'PUT on COMPLETED follow-up rejected with 400');

    const reCompRes = await fetch(`${baseUrl}/api/follow-ups/${followUp1Id}/complete`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({ outcome: 'Trying to complete again' })
    });
    assert(reCompRes.status === 400, 'TC-15.2', 'Complete on already COMPLETED follow-up rejected with 400');

    // =========================================================================
    // TC-16: Delete evidence on completed follow-up rejected when only 1 evidence remains
    // =========================================================================
    console.log('\n--- TC-16: Evidence deletion guard on COMPLETED follow-up ---');
    const delEvRes = await fetch(`${baseUrl}/api/follow-ups/${followUp1Id}/evidences/${evidence1Id}`, {
      method: 'DELETE',
      headers: headersA
    });
    const delEvData = await delEvRes.json();
    assert(delEvRes.status === 400 && delEvData.code === 'CANNOT_DELETE_LAST_EVIDENCE_FOR_COMPLETED',
      'TC-16.1', `Reject deletion of sole evidence on COMPLETED follow-up: ${delEvData.error}`);

    // =========================================================================
    // TC-17 & 18: Cancellation logic
    // =========================================================================
    console.log('\n--- TC-17 & TC-18: Cancellation validation and success ---');
    // Create new follow-up for cancellation test
    const cancelTargetRes = await fetch(`${baseUrl}/api/follow-ups`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        customerId: custAId,
        typeId: defaultTypeA.id,
        followUpDate: '2026-10-05',
        title: 'To Be Cancelled'
      })
    });
    const cancelTargetData = await cancelTargetRes.json();
    const cancelTargetId = cancelTargetData.data?.id;
    cleanupFollowUps.push(cancelTargetId);

    // TC-17: Cancel without reason -> 400
    const cancelNoReasonRes = await fetch(`${baseUrl}/api/follow-ups/${cancelTargetId}/cancel`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({})
    });
    assert(cancelNoReasonRes.status === 400, 'TC-17.1', 'Cancellation without reason rejected with 400');

    // TC-18: Cancel with reason -> 200 CANCELLED
    const cancelWithReasonRes = await fetch(`${baseUrl}/api/follow-ups/${cancelTargetId}/cancel`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({ cancellationReason: 'Client postponed budget review' })
    });
    const cancelWithReasonData = await cancelWithReasonRes.json();
    assert(cancelWithReasonRes.status === 200 && cancelWithReasonData.data?.status === 'CANCELLED',
      'TC-18.1', `Cancelled successfully with reason (status: ${cancelWithReasonData.data?.status})`);

    // =========================================================================
    // TC-19: Cross-tenant isolation (Tenant B cannot access Tenant A's follow-up)
    // =========================================================================
    console.log('\n--- TC-19: Cross-tenant isolation guard ---');
    const crossGetRes = await fetch(`${baseUrl}/api/follow-ups/${followUp1Id}`, { headers: headersB });
    assert(crossGetRes.status === 404, 'TC-19.1', 'Tenant B cannot view Tenant A follow-up detail (HTTP 404)');

    const crossCompleteRes = await fetch(`${baseUrl}/api/follow-ups/${followUp1Id}/complete`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({ outcome: 'Hacking attempt' })
    });
    assert(crossCompleteRes.status === 404, 'TC-19.2', 'Tenant B cannot complete Tenant A follow-up (HTTP 404)');

    const crossCancelRes = await fetch(`${baseUrl}/api/follow-ups/${followUp1Id}/cancel`, {
      method: 'POST',
      headers: headersB,
      body: JSON.stringify({ cancellationReason: 'Hacking attempt' })
    });
    assert(crossCancelRes.status === 404, 'TC-19.3', 'Tenant B cannot cancel Tenant A follow-up (HTTP 404)');

    const crossEvPreview = await fetch(`${baseUrl}/api/follow-ups/${followUp1Id}/evidences/${evidence1Id}/preview`, {
      headers: { 'Authorization': `Bearer ${tokenTenantB}` }
    });
    assert(crossEvPreview.status === 404, 'TC-19.4', 'Tenant B cannot preview Tenant A evidence image (HTTP 404)');

    // =========================================================================
    // TC-20: Master Data: Super Admin platform type & Tenant Admin custom type
    // =========================================================================
    console.log('\n--- TC-20: Master Data: Platform & Tenant Custom Follow-up Types ---');
    // Super Admin creates a platform template type
    const platId = 'FT-PLAT-TEST-' + Date.now();
    const platCode = 'CUSTOM_PLAT_' + Date.now();
    const platCreateRes = await fetch(`${baseUrl}/api/master-data/platform/follow_up_types`, {
      method: 'POST',
      headers: headersSuper,
      body: JSON.stringify({
        id: platId,
        code: platCode,
        name: 'Platform Custom Template',
        icon: 'verified',
        color: '#10B981',
        description: 'Global template created by Super Admin'
      })
    });
    const platCreateData = await platCreateRes.json();
    const createdPlatId = platCreateData.id || platCreateData.data?.id;
    assert(platCreateRes.status === 201 && createdPlatId,
      'TC-20.1', `Super Admin created platform template type: ${createdPlatId}`);
    const platTypeId = createdPlatId || platId;
    if (platTypeId) cleanupFollowUpTypes.push(platTypeId);

    // Tenant Admin creates a custom follow-up type
    const tntId = 'FT-TNT-TEST-' + Date.now();
    const tntCode = 'TNT_CUSTOM_' + Date.now();
    const tntCreateRes = await fetch(`${baseUrl}/api/master-data/tenant/follow_up_types`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        id: tntId,
        code: tntCode,
        name: 'Tenant Custom Type',
        icon: 'star',
        color: '#F59E0B',
        description: 'Created specifically for Tenant A'
      })
    });
    const tntCreateData = await tntCreateRes.json();
    const createdTntId = tntCreateData.id || tntCreateData.data?.id;
    assert(tntCreateRes.status === 201 && createdTntId,
      'TC-20.2', `Tenant Admin created custom tenant type: ${createdTntId}`);
    const tntTypeId = createdTntId || tntId;
    if (tntTypeId) cleanupFollowUpTypes.push(tntTypeId);

    // Verify Tenant Admin can update their custom type
    const tntUpdateRes = await fetch(`${baseUrl}/api/master-data/tenant/follow_up_types/${tntTypeId}`, {
      method: 'PUT',
      headers: headersA,
      body: JSON.stringify({
        name: 'Tenant Custom Type (Updated)',
        color: '#EC4899'
      })
    });
    const tntUpdateData = await tntUpdateRes.json();
    assert(tntUpdateRes.status === 200,
      'TC-20.3', 'Tenant Admin successfully updated custom type');

    // =========================================================================
    // TC-21: Master Data Reset: reconcile platform templates while preserving custom types
    // =========================================================================
    console.log('\n--- TC-21: Master Data Reconcile Reset ---');
    const resetRes = await fetch(`${baseUrl}/api/master-data/tenant/follow_up_types/reset`, {
      method: 'POST',
      headers: headersA
    });
    const resetData = await resetRes.json();
    assert(resetRes.status === 200 && resetData.success === true, 'TC-21.1', 'Master data reset executed successfully');

    // Check that the custom type is still present and active
    const [tntCheck] = await pool.query('SELECT * FROM follow_up_types WHERE id = ?', [tntTypeId]);
    assert(tntCheck.length > 0 && tntCheck[0].isActive === 1,
      'TC-21.2', 'Custom tenant type was preserved after reconcile reset');

    // Check that the new platform type was snapshotted to Tenant A
    const [platSnapshot] = await pool.query('SELECT * FROM follow_up_types WHERE tenantId = ? AND platformMasterId = ?', [tenantAId, platTypeId]);
    assert(platSnapshot.length > 0,
      'TC-21.3', 'New platform template was successfully reconciled/snapshotted to Tenant A');
    if (platSnapshot.length > 0) cleanupFollowUpTypes.push(platSnapshot[0].id);

  } catch (err) {
    console.error('\n[FATAL ERROR IN TEST SUITE]:', err);
    failed++;
  } finally {
    console.log('\n--- Cleaning up ephemeral test artifacts ---');
    try {
      if (cleanupEvidences.length > 0) {
        await pool.query('DELETE FROM follow_up_evidences WHERE id IN (?)', [cleanupEvidences]);
      }
      if (cleanupFollowUps.length > 0) {
        await pool.query('DELETE FROM follow_up_evidences WHERE followUpId IN (?)', [cleanupFollowUps]);
        await pool.query('DELETE FROM follow_ups WHERE id IN (?)', [cleanupFollowUps]);
      }
      if (cleanupFollowUpTypes.length > 0) {
        await pool.query('DELETE FROM follow_up_types WHERE id IN (?)', [cleanupFollowUpTypes]);
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
      if (cleanupSessions.length > 0) {
        await pool.query('DELETE FROM auth_sessions WHERE token IN (?)', [cleanupSessions]);
      }
      if (cleanupUsers.length > 0) {
        await pool.query('DELETE FROM tenant_users WHERE userId IN (?)', [cleanupUsers]);
        await pool.query('DELETE FROM users WHERE id IN (?)', [cleanupUsers]);
      }
      if (cleanupTenants.length > 0) {
        await pool.query('DELETE FROM tenants WHERE id IN (?)', [cleanupTenants]);
      }

      // Clean test files from disk
      for (const p of diskPathsToDelete) {
        if (fs.existsSync(p)) {
          fs.rmSync(p, { recursive: true, force: true });
        }
      }
    } catch (cleanErr) {
      console.error('Cleanup warning:', cleanErr);
    }

    if (server) {
      server.close();
    }
  }

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  try {
    await pool.end();
  } catch (e) {}

  process.exit(failed > 0 ? 1 : 0);
}

runFollowupTestSuite().catch((e) => {
  console.error('Fatal unhandled rejection:', e);
  process.exit(1);
});
