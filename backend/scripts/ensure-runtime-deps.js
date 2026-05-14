const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const requiredFiles = [
  path.join(root, 'node_modules', 'mongodb', 'lib', 'operations', 'bulk_write.js'),
  path.join(root, 'node_modules', 'mongoose', 'index.js')
];

const depsAreUsable = requiredFiles.every((file) => fs.existsSync(file));

if (!depsAreUsable) {
  console.error('[startup] MongoDB/Mongoose install is incomplete. Clear the Render build cache and redeploy.');
  process.exit(1);
}
