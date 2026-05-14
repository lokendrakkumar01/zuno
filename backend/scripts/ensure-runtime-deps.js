'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');

/**
 * Try requiring a module. Returns true if it loads cleanly.
 */
const canRequire = (modName) => {
  try {
    require(modName);
    return true;
  } catch {
    return false;
  }
};

/**
 * Attempt to reinstall one or more packages by removing and re-fetching them.
 */
const reinstall = (packages) => {
  console.warn(`[startup] Reinstalling corrupted packages: ${packages.join(', ')}`);
  try {
    execFileSync(
      'npm',
      [
        'install',
        ...packages,
        '--no-save',
        '--no-audit',
        '--no-fund',
        '--prefer-offline=false',
        '--legacy-peer-deps',
      ],
      {
        cwd: root,
        stdio: 'inherit',
        shell: process.platform === 'win32',
      }
    );
    console.log('[startup] Reinstall complete.');
  } catch (err) {
    console.error('[startup] Reinstall failed:', err.message);
    process.exit(1);
  }
};

// ── Check MongoDB ────────────────────────────────────────────────────────────
if (!canRequire('mongodb')) {
  // Delete the corrupted mongodb directory so npm can unpack a clean copy
  const fs = require('fs');
  const mongoDir = path.join(root, 'node_modules', 'mongodb');
  try {
    fs.rmSync(mongoDir, { recursive: true, force: true });
    console.log('[startup] Removed corrupted mongodb directory.');
  } catch {
    // best effort
  }

  reinstall(['mongodb@6.2.0']);

  if (!canRequire('mongodb')) {
    console.error('[startup] mongodb could not be loaded after reinstall. Aborting.');
    process.exit(1);
  }
}

// ── Check Mongoose ───────────────────────────────────────────────────────────
if (!canRequire('mongoose')) {
  reinstall(['mongoose@8.0.3']);

  if (!canRequire('mongoose')) {
    console.error('[startup] mongoose could not be loaded after reinstall. Aborting.');
    process.exit(1);
  }
}
