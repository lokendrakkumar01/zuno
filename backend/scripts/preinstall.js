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

// These packages are known to corrupt in Render's build cache
const PACKAGES_TO_CLEAN = ['mongodb', 'mongoose'];

for (const pkg of PACKAGES_TO_CLEAN) {
  const dir = path.join(root, 'node_modules', pkg);
  if (!fs.existsSync(dir)) continue;

  // Check if mongodb is corrupted (missing internal sub-files)
  let isCorrupt = false;
  if (pkg === 'mongodb') {
    const bulkWrite = path.join(dir, 'lib', 'operations', 'bulk_write.js');
    isCorrupt = !fs.existsSync(bulkWrite);
  } else {
    // For other packages just check if lib directory exists
    const libDir = path.join(dir, 'lib');
    isCorrupt = !fs.existsSync(libDir);
  }

  if (isCorrupt) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`[preinstall] Removed corrupted ${pkg} from cache.`);
    } catch (err) {
      console.warn(`[preinstall] Could not remove ${pkg}:`, err.message);
    }
  }
}
