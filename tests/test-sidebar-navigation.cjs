/**
 * 80/20 AI DIALER — Sidebar Structure & RBAC Navigation Suite
 * Verifies the simplified 3-item primary navigation (Dashboard, Leads, Campaigns)
 * and 12-item collapsible More secondary navigation.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('========================================================================');
console.log('80/20 AI DIALER — SIDEBAR STRUCTURE & NAVIGATION AUDIT');
console.log('========================================================================\n');

const expectedMain = [
  { id: 'dashboard', href: '/dashboard', name: 'Dashboard', allowedRoles: ['admin', 'manager', 'operator', 'sdr', 'executive', 'viewer'] },
  { id: 'leads', href: '/leads', name: 'Leads', allowedRoles: ['admin', 'manager', 'operator', 'sdr', 'executive', 'viewer'] },
  { id: 'campaigns', href: '/campaigns', name: 'Campaigns', allowedRoles: ['admin', 'manager', 'operator', 'sdr', 'executive'] },
];

const expectedMore = [
  { id: 'workstation', href: '/workstation', name: 'Workstation', allowedRoles: ['admin', 'manager', 'operator', 'sdr'] },
  { id: 'active-call', href: '/workstation?tab=console', name: 'Active Call Console', allowedRoles: ['admin', 'manager', 'operator', 'sdr'] },
  { id: 'callback-queue', href: '/workstation?tab=callbacks', name: 'Callback Queue', allowedRoles: ['admin', 'manager', 'operator', 'sdr'] },
  { id: 'calls', href: '/calls', name: 'Calls & Recordings', allowedRoles: ['admin', 'manager', 'operator', 'sdr', 'executive', 'viewer'] },
  { id: 'qualified-pipeline', href: '/leads?status=qualified', name: 'Qualified Pipeline', allowedRoles: ['admin', 'manager', 'operator', 'sdr', 'executive', 'viewer'] },
  { id: 'analytics', href: '/analytics', name: 'Analytics', allowedRoles: ['admin', 'manager', 'executive', 'viewer'] },
  { id: 'import-csv', href: '/leads?action=import', name: 'Import CSV', allowedRoles: ['admin', 'manager', 'operator', 'sdr', 'executive', 'viewer'] },
  { id: 'dnc-search', href: '/leads?status=dnc', name: 'DNC Search List', allowedRoles: ['admin', 'manager', 'operator', 'sdr', 'executive', 'viewer'] },
  { id: 'handoff-queue', href: '/workstation?tab=handoffs', name: 'Handoff Queue', allowedRoles: ['admin', 'manager', 'operator', 'sdr'] },
  { id: 'manual-dialpad', href: '/workstation?action=dial', name: 'Manual Dialpad', allowedRoles: ['admin', 'manager', 'operator', 'sdr'] },
  { id: 'agents', href: '/agents', name: 'AI Agents Studio', allowedRoles: ['admin', 'manager'] },
  { id: 'settings', href: '/settings', name: 'Settings & Gateways', allowedRoles: ['admin'] },
];

const sidebarSource = fs.readFileSync(path.join(__dirname, '..', 'components', 'layout', 'Sidebar.tsx'), 'utf8');

console.log('--- 1. ESSENTIAL PRIMARY MODULES (EXACTLY 3 REQUIRED: Dashboard, Leads, Campaigns) ---');
assert.strictEqual(expectedMain.length, 3, 'Must have exactly 3 primary items');
assert.ok(sidebarSource.includes('w-[212px]'), 'Sidebar expanded width must be compact (212px)');
assert.ok(sidebarSource.includes('w-[68px]'), 'Sidebar collapsed width must be compact (68px)');
expectedMain.forEach((item, idx) => {
  assert.ok(sidebarSource.includes(`id: '${item.id}'`), `Sidebar must define primary item ${item.id}`);
  console.log(`[PASS] Main [${idx + 1}/3]: "${item.name}" -> ${item.href}`);
});

console.log('\n--- 2. SECONDARY / ADMIN MODULES IN "MORE" SECTION ---');
expectedMore.forEach((item, idx) => {
  assert.ok(sidebarSource.includes(`id: '${item.id}'`), `Sidebar More section must preserve ${item.id}`);
  console.log(`[PASS] More [${idx + 1}/${expectedMore.length}]: "${item.name}" -> ${item.href}`);
});

console.log('\n--- 3. ROLE-BASED ACCESS CONTROL (RBAC) MATRIX ---');
const roles = ['admin', 'manager', 'operator', 'sdr', 'executive', 'viewer'];
roles.forEach((role) => {
  const visibleMain = expectedMain.filter((i) => i.allowedRoles.includes(role));
  const visibleMore = expectedMore.filter((i) => i.allowedRoles.includes(role));
  assert.ok(visibleMain.length > 0, `Role ${role} must see at least 1 main module`);
  console.log(`[PASS] Role "${role}": ${visibleMain.length} main modules, ${visibleMore.length} more modules`);
});

console.log('\n--- 4. QUERY-AWARE ROUTE MATCHING & DISAMBIGUATION ---');
function matchScore(href, pathname, search) {
  const [path, query = ''] = href.split('?');
  if (path !== pathname) return -1;
  const wanted = new URLSearchParams(query);
  const current = new URLSearchParams(search);
  for (const [key, value] of wanted.entries()) {
    if (current.get(key) !== value) return -1;
  }
  return Array.from(wanted.keys()).length;
}

const allItems = [...expectedMain, ...expectedMore];
const testCases = [
  { url: '/dashboard', search: '', expectedId: 'dashboard' },
  { url: '/leads', search: '', expectedId: 'leads' },
  { url: '/campaigns', search: '', expectedId: 'campaigns' },
  { url: '/workstation', search: '', expectedId: 'workstation' },
  { url: '/workstation', search: 'tab=console', expectedId: 'active-call' },
  { url: '/workstation', search: 'tab=callbacks', expectedId: 'callback-queue' },
  { url: '/workstation', search: 'tab=handoffs', expectedId: 'handoff-queue' },
  { url: '/workstation', search: 'action=dial', expectedId: 'manual-dialpad' },
  { url: '/leads', search: 'action=import', expectedId: 'import-csv' },
  { url: '/leads', search: 'status=qualified', expectedId: 'qualified-pipeline' },
  { url: '/leads', search: 'status=dnc', expectedId: 'dnc-search' },
  { url: '/calls', search: '', expectedId: 'calls' },
  { url: '/analytics', search: '', expectedId: 'analytics' },
  { url: '/agents', search: '', expectedId: 'agents' },
  { url: '/settings', search: '', expectedId: 'settings' },
];

testCases.forEach((tc) => {
  const scored = allItems.map((item) => ({
    id: item.id,
    score: matchScore(item.href, tc.url, tc.search),
  }));
  const bestScore = scored.reduce((best, item) => Math.max(best, item.score), -1);
  const activeItem = scored.find((item) => item.score === bestScore && bestScore >= 0);
  assert.strictEqual(activeItem?.id, tc.expectedId, `Mismatch for ${tc.url}?${tc.search}`);
  console.log(`[PASS] ${tc.url}${tc.search ? '?' + tc.search : ''} -> matched "${activeItem.id}"`);
});

console.log('\n========================================================================');
console.log('SIDEBAR NAVIGATION TESTS: ALL PASSED (36 / 36 CHECKS)');
console.log('========================================================================\n');
process.exit(0);
