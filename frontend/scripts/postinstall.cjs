'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');

async function fix() {
  console.log('[postinstall] Checking for dependency corruption...');
  
  let needsFix = false;
  try {
    // Try to load vite to see if it's corrupted
    require.resolve('vite');
    require.resolve('@vitejs/plugin-react');
  } catch (e) {
    console.log('[postinstall] Vite or plugins appear missing or corrupted:', e.message);
    needsFix = true;
  }

  if (needsFix) {
    console.log('[postinstall] Forcing clean reinstall of Vite and plugins...');
    const pkgs = ['vite@5.0.8', '@vitejs/plugin-react@4.2.1', '@vitejs/plugin-basic-ssl@1.1.0'];
    
    try {
      // Delete them first to be sure
      for (const pkg of ['vite', '@vitejs/plugin-react', '@vitejs/plugin-basic-ssl']) {
        const dir = path.join(root, 'node_modules', ...pkg.split('/'));
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      }
      
      execSync(`npm install ${pkgs.join(' ')} --no-save`, { 
        stdio: 'inherit', 
        cwd: root,
        env: { ...process.env, NODE_ENV: 'development' } // Ensure devDeps can be installed if needed
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
