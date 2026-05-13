const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const requiredFiles = [
  path.join(root, 'node_modules', 'mongodb', 'lib', 'operations', 'bulk_write.js'),
  path.join(root, 'node_modules', 'mongoose', 'index.js')
];

const depsAreUsable = requiredFiles.every((file) => fs.existsSync(file));

if (!depsAreUsable) {
  console.warn('[startup] MongoDB/Mongoose install is incomplete. Repairing runtime dependencies...');
  execFileSync(
    'npm',
    ['install', 'mongoose@8.0.3', 'mongodb@6.2.0', '--no-save', '--omit=dev', '--no-audit', '--no-fund'],
    {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    }
  );
}
