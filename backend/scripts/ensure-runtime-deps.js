try {
  require('mongodb');
  require('mongoose');
} catch (error) {
  console.error('[startup] MongoDB/Mongoose dependencies failed to load.');
  console.error(error.message);
  console.error('Clear the Render build cache and redeploy with a clean npm install.');
  process.exit(1);
}
