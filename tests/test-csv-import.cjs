/**
 * 80/20 AI DIALER - CSV IMPORT & LEAD DETECTION RUNNER
 * Spawns tsx to execute tests/test-csv-import.ts
 */

const { spawnSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const testScript = path.join(__dirname, 'test-csv-import.ts');

const res = spawnSync('npx', ['tsx', testScript], {
  cwd: projectRoot,
  shell: true,
  stdio: 'inherit',
});

process.exit(res.status || 0);
