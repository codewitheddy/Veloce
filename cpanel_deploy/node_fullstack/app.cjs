/**
 * cPanel Application Startup File (CommonJS Entrypoint)
 * 
 * This file serves as the main entry point for cPanel's Node.js (Phusion Passenger) application server.
 * It loads the bundled production server from the compiled `dist/server.cjs` file.
 */

// Guarantee production mode in cPanel environment
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

const path = require('path');
const serverPath = path.join(__dirname, 'dist', 'server.cjs');

try {
  require(serverPath);
} catch (err) {
  console.error('[cPanel Startup Error] Failed to load server from ' + serverPath + ':', err);
  process.exit(1);
}
