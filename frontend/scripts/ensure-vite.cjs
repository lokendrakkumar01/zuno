'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const viteDir = path.join(root, 'node_modules', 'vite');
const viteCli = path.join(viteDir, 'dist', 'node', 'cli.js');
const viteChunks = path.join(viteDir, 'dist', 'node', 'chunks');

const hasUsableVite = () => {
  try {
    if (!fs.existsSync(viteCli)) return false;
    if (!fs.existsSync(viteChunks)) return false;
    const chunks = fs.readdirSync(viteChunks).filter((f) => f.endsWith('.js'));
    if (chunks.length === 0) return false;
    // Quick sanity-check: the cli.js must be non-empty
    const stat = fs.statSync(viteCli);
    return stat.size > 100;
  } catch {
    return false;
  }
};

if (!hasUsableVite()) {
  console.warn('[build] Vite install is incomplete or corrupted. Cleaning and reinstalling...');

  // Remove the broken vite directory entirely so npm can do a fresh unpack
  try {
    fs.rmSync(viteDir, { recursive: true, force: true });
    console.log('[build] Removed corrupted vite directory.');
  } catch (rmErr) {
    console.warn('[build] Could not remove vite directory:', rmErr.message);
  }

  // Re-install vite at the pinned version
  execFileSync(
    'npm',
    ['install', 'vite@5.0.8', '--no-save', '--no-audit', '--no-fund', '--prefer-offline=false'],
    {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    }
  );

  // Verify the install succeeded
  if (!hasUsableVite()) {
    console.error('[build] Vite reinstall failed. Build cannot continue.');
    process.exit(1);
  }

  console.log('[build] Vite reinstalled successfully.');
}
