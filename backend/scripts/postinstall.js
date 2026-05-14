'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');

function fix() {
  console.log('[postinstall] Checking for database driver corruption...');
  
  let needsFix = false;
  try {
    require.resolve('mongoose');
    require.resolve('mongodb');
  } catch (e) {
    console.log('[postinstall] Mongoose or MongoDB appear missing or corrupted:', e.message);
    needsFix = true;
  }

  if (needsFix) {
    console.log('[postinstall] Forcing clean reinstall of Mongoose and MongoDB...');
    const pkgs = ['mongoose@8.0.3', 'mongodb@6.2.0'];
    
    try {
      for (const pkg of ['mongoose', 'mongodb']) {
        const dir = path.join(root, 'node_modules', pkg);
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      }
      
      execSync(`npm install ${pkgs.join(' ')} --no-save --legacy-peer-deps`, { 
        stdio: 'inherit', 
        cwd: root 
      });
      console.log('[postinstall] Fix complete.');
    } catch (err) {
      console.error('[postinstall] Fix failed:', err.message);
    }
  } else {
    console.log('[postinstall] Dependencies look healthy.');
  }
}

fix();
