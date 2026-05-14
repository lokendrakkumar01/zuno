'use strict';
/**
 * clean-install.js
 * Render build script: removes known-corrupt packages then runs npm install.
 * Prevents "Cannot find module" errors caused by cached partial installs.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');

const PACKAGES_TO_CLEAN = ['mongodb', 'mongoose'];

for (const pkg of PACKAGES_TO_CLEAN) {
  const dir = path.join(root, 'node_modules', pkg);
  if (fs.existsSync(dir)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`[build] Cleaned ${pkg} from node_modules.`);
    } catch (err) {
      console.warn(`[build] Could not remove ${pkg}:`, err.message);
    }
  }
}

console.log('[build] Running npm install...');
execFileSync(
  'npm',
  ['install', '--omit=dev', '--legacy-peer-deps', '--no-audit', '--no-fund', '--prefer-offline=false'],
  {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }
);

console.log('[build] Backend build complete.');
