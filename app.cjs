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

// Ensure working directory is set to this application's directory
try {
  process.chdir(__dirname);
} catch (e) {
  console.warn('[cPanel Startup] Could not chdir to __dirname:', e);
}

const path = require('path');
const fs = require('fs');
const http = require('http');

function listenPassengerSafely(serverInstance) {
  if (typeof (global.PhusionPassenger) !== 'undefined') {
    try { global.PhusionPassenger.configure({ autoInstall: false }); } catch (_) {}
    serverInstance.listen('passenger');
  } else if (process.env.PORT === 'passenger' || (process.env.PORT && isNaN(Number(process.env.PORT)))) {
    serverInstance.listen(process.env.PORT);
  } else {
    serverInstance.listen(Number(process.env.PORT) || 3000);
  }
}

const possiblePaths = [
  path.join(__dirname, 'dist', 'server.cjs'),
  path.join(__dirname, 'server.cjs'),
  path.join(process.cwd(), 'dist', 'server.cjs'),
];

let serverPath = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    serverPath = p;
    break;
  }
}

if (!serverPath) {
  console.error('[cPanel Startup Error] Could not find dist/server.cjs. Checked paths:', possiblePaths);
  const fallbackServer = http.createServer((req, res) => {
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <div style="font-family: sans-serif; padding: 40px; background: #0f172a; color: #f8fafc; min-height: 100vh;">
        <h2 style="color: #ef4444;">Veloce Hub - Production Server Bundle Not Found</h2>
        <p>Could not find <code>dist/server.cjs</code> in your application root.</p>
        <p>Please make sure you uploaded the complete <code>veloce_node_fullstack.zip</code> and extracted all files.</p>
      </div>
    `);
  });
  listenPassengerSafely(fallbackServer);
} else {
  try {
    require(serverPath);
  } catch (err) {
    console.error('[cPanel Startup Error] Failed to load server from ' + serverPath + ':', err);
    const errorServer = http.createServer((req, res) => {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <div style="font-family: sans-serif; padding: 40px; background: #0f172a; color: #f8fafc; min-height: 100vh;">
          <h2 style="color: #ef4444;">Veloce Hub - Startup Configuration Error</h2>
          <p>The Node.js server encountered an error while launching:</p>
          <pre style="background: #1e293b; padding: 16px; border-radius: 8px; color: #fca5a5; overflow-x: auto;">${err.stack || err.message || err}</pre>
          <p><strong>Next Step:</strong> In cPanel <em>Setup Node.js App</em>, click <strong>Run JS Install</strong> (or run <code>npm install --omit=dev</code> in terminal) to ensure all dependencies are installed.</p>
        </div>
      `);
    });
    listenPassengerSafely(errorServer);
  }
}


