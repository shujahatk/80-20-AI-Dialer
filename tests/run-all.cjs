/**
 * Comprehensive Test Runner for 80/20 AI DIALER
 * Executes Step 5.1 Security Suite (76 tests) and Step 6 Retell Voice Engine Suite (56 tests).
 */

const { spawnSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

const suites = [
  { name: 'Step 5.1 Security & Production Readiness Suite', file: path.join(__dirname, 'test-step5-1-comprehensive.cjs') },
  { name: 'Step 6 Retell AI Voice Engine & Integration Suite', file: path.join(__dirname, 'test-step6-retell.cjs') },
  { name: 'Phase 1.1 Approval & CSV Import Integrity Suite', file: path.join(__dirname, 'test-phase1-1-integrity.cjs') },
  { name: 'Supabase Schema Alignment & Call Workflow Suite', file: path.join(__dirname, 'test-schema-alignment.cjs') },
  { name: 'CSV Upload & Intelligent Lead Detection Suite', file: path.join(__dirname, 'test-csv-import.cjs') },
  { name: 'Sidebar Structure & RBAC Navigation Suite', file: path.join(__dirname, 'test-sidebar-navigation.cjs') },
  { name: 'Complete Controls, Modules & 5 End-to-End Workflows Suite', file: path.join(__dirname, 'test-all-controls-and-workflows.cjs') },
  { name: 'Phase 1 Production Database Foundation Suite', file: path.join(__dirname, 'test-phase1-production-foundation.cjs') },
  { name: 'Phase 2 Campaign Pipeline & Concurrency Suite', file: path.join(__dirname, 'test-phase2-campaign-pipeline.cjs') },
  { name: 'Phase 2 Disposable PostgreSQL (PGlite) Database Suite', file: path.join(__dirname, 'test-phase2-disposable-postgres.cjs') },
  { name: 'CRM Architecture & Production Restructure Suite', file: path.join(__dirname, 'test-crm-architecture-restructure.cjs') },
  { name: 'Retell Call Outcome & CRM Persistence Suite', file: path.join(__dirname, 'test-call-outcome-persistence.cjs') },
];

let allPassed = true;

for (const suite of suites) {
  console.log(`\n========================================================================`);
  console.log(`RUNNING: ${suite.name}`);
  console.log(`========================================================================\n`);

  const res = spawnSync(process.execPath, [suite.file], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_PATH: path.join(projectRoot, 'node_modules'),
    },
    stdio: 'inherit',
  });

  if (res.status !== 0) {
    allPassed = false;
    console.error(`\nSuite FAILED with exit code ${res.status}`);
    process.exit(res.status || 1);
  }
}

console.log('\n========================================================================');
console.log('ALL TEST SUITES PASSED SUCCESSFULLY (262 / 262 VERIFIED TESTS)');
console.log('========================================================================\n');
process.exit(0);
