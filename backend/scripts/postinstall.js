'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');

function fix() {
  console.log('[postinstall] Performing deep database driver sanity check...');
  
  let needsFix = false;
  try {
    require.resolve('mongoose/package.json');
    require.resolve('mongodb/package.json');
    
    // Deep check for the specific file that was missing in the logs
    const bulkWritePath = path.join(root, 'node_modules', 'mongodb', 'lib', 'operations', 'bulk_write.js');
    if (!fs.existsSync(bulkWritePath)) {
      console.log('[postinstall] CRITICAL FILE MISSING: mongodb/lib/operations/bulk_write.js');
      needsFix = true;
    }
  } catch (e) {
    console.log('[postinstall] Integrity check failed:', e.message);
    needsFix = true;
  }

  if (needsFix) {
    console.log('[postinstall] Corruption detected! Cleaning and forcing reinstall...');
    const pkgs = ['mongoose@8.0.3', 'mongodb@6.2.0'];
    
    try {
      for (const pkgName of ['mongoose', 'mongodb']) {
        const dir = path.join(root, 'node_modules', pkgName);
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      }
      
      execSync(`npm install ${pkgs.join(' ')} --no-save --legacy-peer-deps --prefer-offline=false`, { 
        stdio: 'inherit', 
        cwd: root 
      });
      console.log('[postinstall] Reinstall successful.');
    } catch (err) {
      console.error('[postinstall] Reinstall failed:', err.message);
    }
  } else {
    console.log('[postinstall] Database drivers passed integrity check.');
  }
}

fix();
