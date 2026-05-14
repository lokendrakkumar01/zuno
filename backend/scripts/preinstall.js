'use strict';
/**
 * preinstall.js
 * Runs BEFORE npm install (via "preinstall" script hook).
 * Removes known-corrupted packages from the Render build cache
 * so npm install always unpacks fresh copies from the registry.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const needReinstall = [];

// These packages are known to corrupt in Render's build cache
const PACKAGES_TO_CLEAN = ['mongodb', 'mongoose'];

for (const pkg of PACKAGES_TO_CLEAN) {
  const dir = path.join(root, 'node_modules', pkg);
  if (!fs.existsSync(dir)) continue;

  // Unconditionally remove these problem packages to force a clean unpack
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`[preinstall] Unconditionally removed ${pkg} from cache to prevent corruption.`);
    needReinstall.push(pkg === 'mongodb' ? 'mongodb@6.2.0' : 'mongoose@8.0.3');
  } catch (err) {
    console.warn(`[preinstall] Could not remove ${pkg}:`, err.message);
  }
}

if (needReinstall.length > 0) {
  console.log(`[preinstall] Forcing reinstall of: ${needReinstall.join(', ')}`);
  try {
    const { execSync } = require('child_process');
    execSync(`npm install ${needReinstall.join(' ')} --no-save --legacy-peer-deps`, { stdio: 'inherit', cwd: root });
    console.log('[preinstall] Reinstall successful.');
  } catch (err) {
    console.error('[preinstall] Reinstall failed:', err.message);
  }
}
