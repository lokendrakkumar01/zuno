'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');

async function fix() {
  console.log('[postinstall] Performing deep dependency sanity check...');
  
  let needsFix = false;
  try {
    // Deep check: try to resolve internal files that often go missing in corrupted caches
    require.resolve('vite/package.json');
    require.resolve('@vitejs/plugin-react/package.json');
    
    // Also check if the binary exists
    const viteBin = path.join(root, 'node_modules', '.bin', 'vite');
    if (!fs.existsSync(viteBin)) {
      console.log('[postinstall] Vite binary is missing from .bin');
      needsFix = true;
    }
  } catch (e) {
    console.log('[postinstall] Integrity check failed:', e.message);
    needsFix = true;
  }

  if (needsFix) {
    console.log('[postinstall] Corruption detected! Cleaning and forcing reinstall...');
    const pkgs = ['vite@5.0.8', '@vitejs/plugin-react@4.2.1', '@vitejs/plugin-basic-ssl@1.1.0'];
    
    try {
      // Clean target directories
      for (const pkgName of ['vite', '@vitejs/plugin-react', '@vitejs/plugin-basic-ssl']) {
        const dir = path.join(root, 'node_modules', ...pkgName.split('/'));
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      }
      
      execSync(`npm install ${pkgs.join(' ')} --no-save --prefer-offline=false`, { 
        stdio: 'inherit', 
        cwd: root,
        env: { ...process.env, NODE_ENV: 'development' }
      });
      console.log('[postinstall] Reinstall successful.');
    } catch (err) {
      console.error('[postinstall] Reinstall failed:', err.message);
    }
  } else {
    console.log('[postinstall] All core dependencies passed integrity check.');
  }

  // Final safety: ensure the vite binary is executable (fixes "Permission denied")
  try {
    const viteBin = path.join(root, 'node_modules', '.bin', 'vite');
    if (fs.existsSync(viteBin)) {
      fs.chmodSync(viteBin, '755');
    }
  } catch (e) {
    // Ignore chmod failures on non-unix systems
  }
}

fix();
