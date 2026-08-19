import mysql from 'mysql2/promise';
import { env } from './env';

async function seedProduction() {
  const pool = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });

  const tenantId = 'TEN-00001'; // TechNova Corp
  const systemTenant = 'SYSTEM'; // For Super Admin stuff if needed
  const salesRepId = 'USR-IMG-3'; // Michael Rodriguez
  const salesRepId2 = 'USR-IMG-4'; // Dewi Lestari

  try {
    // 1. Customers
    console.log('Seeding Customers...');
    for (let i = 1; i <= 20; i++) {
      const custId = `CUST-PROD-00${i}`;
      const picId = i % 2 === 0 ? salesRepId2 : salesRepId;
      await pool.query(
        `INSERT IGNORE INTO customers (id, tenantId, code, name, typeId, statusId, industry, website, phone, email, notes, picId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [custId, tenantId, `C0${i}`, `PT Maju Jaya ${i}`, 'B2B', 'ACTIVE', 'Technology', 'www.majujaya.co.id', '021-5550100', `contact@majujaya${i}.co.id`, 'Prospective client', picId]
      );
    }

    // 2. Visits
    console.log('Seeding Visits...');
    for (let i = 1; i <= 30; i++) {
      const visitId = `VISIT-PROD-00${i}`;
      const custId = `CUST-PROD-00${(i % 20) + 1}`;
      const picId = i % 2 === 0 ? salesRepId2 : salesRepId;
      const statusId = i > 25 ? 'SCHEDULED' : 'COMPLETED';
      await pool.query(
        `INSERT IGNORE INTO visits (id, tenantId, title, customerId, purposeId, statusId, visitDate, startTime, endTime, location, result, nextAction, picId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [visitId, tenantId, `Quarterly Review ${i}`, custId, 'MEETING', statusId, new Date().toISOString().split('T')[0], '10:00:00', '11:00:00', 'Client Office', 'Good engagement', 'Follow up quote', picId]
      );
    }

    // 3. Activities
    console.log('Seeding Activities...');
    for (let i = 1; i <= 25; i++) {
      const actId = `ACT-PROD-00${i}`;
      const custId = `CUST-PROD-00${(i % 20) + 1}`;
      const picId = i % 2 === 0 ? salesRepId2 : salesRepId;
      await pool.query(
        `INSERT IGNORE INTO activities (id, tenantId, customerId, userId, typeId, subject, description, occurredAt, entityType, entityId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [actId, tenantId, custId, picId, 'CALL', `Follow up Call ${i}`, 'Discussed recent proposal', new Date().toISOString().slice(0, 19).replace('T', ' '), 'Customer', custId]
      );
    }

    // 4. Tasks
    console.log('Seeding Tasks...');
    for (let i = 1; i <= 15; i++) {
      const taskId = `TASK-PROD-00${i}`;
      const custId = `CUST-PROD-00${(i % 20) + 1}`;
      const picId = i % 2 === 0 ? salesRepId2 : salesRepId;
      const statusId = i % 3 === 0 ? 'COMPLETED' : 'PENDING';
      await pool.query(
        `INSERT IGNORE INTO tasks (id, tenantId, title, description, customerId, priorityId, statusId, taskType, dueDate, picId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [taskId, tenantId, `Send Quotation ${i}`, 'Draft and send standard quotation.', custId, 'HIGH', statusId, 'ADMIN', new Date().toISOString().split('T')[0], picId]
      );
    }

    // 5. Sales Targets (For Dashboard Metrics)
    console.log('Seeding Sales Targets...');
    const period = '2026-Q3';
    await pool.query(
      `INSERT IGNORE INTO sales_targets (id, tenantId, userId, period, targetAmount, actualAmount, targetRevenue, achievedRevenue, targetVisits, actualVisits, targetDeals, actualDeals) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['TARGET-PROD-1', tenantId, salesRepId, period, 100000000, 75000000, 100000000, 75000000, 50, 42, 10, 8]
    );
    await pool.query(
      `INSERT IGNORE INTO sales_targets (id, tenantId, userId, period, targetAmount, actualAmount, targetRevenue, achievedRevenue, targetVisits, actualVisits, targetDeals, actualDeals) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['TARGET-PROD-2', tenantId, salesRepId2, period, 100000000, 45000000, 100000000, 45000000, 50, 20, 10, 4]
    );

    console.log('Production data seeded successfully.');
  } catch (err) {
    console.error('Error seeding data:', err);
  } finally {
    await pool.end();
  }
}

seedProduction();
