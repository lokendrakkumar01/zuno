const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const viteCli = path.join(root, 'node_modules', 'vite', 'dist', 'node', 'cli.js');
const viteChunks = path.join(root, 'node_modules', 'vite', 'dist', 'node', 'chunks');

const hasUsableVite = () => {
  try {
    return fs.existsSync(viteCli)
      && fs.existsSync(viteChunks)
      && fs.readdirSync(viteChunks).some((file) => file.endsWith('.js'));
  } catch {
    return false;
  }
};

if (!hasUsableVite()) {
  console.warn('[build] Vite install is incomplete. Reinstalling Vite before build...');
  execFileSync('npm', ['install', 'vite@5.0.8', '--no-save', '--no-audit', '--no-fund'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
}
