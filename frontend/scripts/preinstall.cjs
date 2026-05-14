'use strict';
/**
 * preinstall.cjs
 * Runs BEFORE npm install (via "preinstall" script hook).
 * Removes known-corrupted packages from the Render build cache
 * so npm install always unpacks fresh copies from the registry.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const needReinstall = [];

const PACKAGES_TO_CLEAN = ['vite'];

for (const pkg of PACKAGES_TO_CLEAN) {
  const dir = path.join(root, 'node_modules', pkg);
  if (fs.existsSync(dir)) {
    // Only remove if the install looks incomplete (chunks dir missing or empty)
    const chunksDir = path.join(dir, 'dist', 'node', 'chunks');
    const cli = path.join(dir, 'dist', 'node', 'cli.js');
    const isCorrupt = !fs.existsSync(cli) ||
      !fs.existsSync(chunksDir) ||
      (fs.readdirSync(chunksDir).filter(f => f.endsWith('.js')).length === 0);

    if (isCorrupt) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        console.log(`[preinstall] Removed corrupted ${pkg} from cache.`);
        needReinstall.push('vite@5.0.8');
        needReinstall.push('@vitejs/plugin-react@4.2.1');
      } catch (err) {
        console.warn(`[preinstall] Could not remove ${pkg}:`, err.message);
      }
    }
  }
}

if (needReinstall.length > 0) {
  const uniqueReinstall = [...new Set(needReinstall)];
  console.log(`[preinstall] Forcing reinstall of: ${uniqueReinstall.join(', ')}`);
  try {
    const { execSync } = require('child_process');
    execSync(`npm install ${uniqueReinstall.join(' ')} --no-save`, { stdio: 'inherit', cwd: root });
    console.log('[preinstall] Reinstall successful.');
  } catch (err) {
    console.error('[preinstall] Reinstall failed:', err.message);
  }
}
