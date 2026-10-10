/**
 * cPanel Application Startup File (CommonJS Entrypoint)
 * 
 * This file serves as the main entry point for cPanel's "Setup Node.js App"
 * powered by Phusion Passenger (CloudLinux / cPanel Node.js Selector).
 * 
 * It automatically initializes environment variables, locates and boots
 * the production server bundle from `dist/server.cjs`, and binds to Phusion Passenger.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');

// 1. Guarantee production mode in cPanel environment
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

// 2. Ensure current working directory is anchored to the application root
try {
  process.chdir(__dirname);
} catch (e) {
  console.warn('[cPanel Startup] Notice: Could not chdir to __dirname:', e);
}

// 3. Early .env variable bootstrap (Loads database credentials, JWT secret, ports, etc.)
(function loadEnvironmentVariables() {
  const envPath = path.join(__dirname, '.env');
  
  // Attempt to load using dotenv if available
  try {
    const dotenv = require('dotenv');
    dotenv.config({ path: envPath });
  } catch (_) {
    // Robust fallback .env parser if dotenv is not yet installed in node_modules
    try {
      if (fs.existsSync(envPath)) {
        const raw = fs.readFileSync(envPath, 'utf8');
        const lines = raw.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (key && !process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      }
    } catch (parseErr) {
      console.warn('[cPanel Startup] .env parse notice:', parseErr);
    }
  }
})();

// 4. Global process error diagnostics for cPanel / Passenger error log visibility
process.on('uncaughtException', (err) => {
  console.error('[cPanel Process Error - uncaughtException]:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[cPanel Process Error - unhandledRejection]:', reason);
});

// 5. Universal Phusion Passenger & Port Listener Helper
function listenPassengerSafely(serverOrApp) {
  const isExpressApp = typeof serverOrApp === 'function' && typeof serverOrApp.listen === 'function';
  const serverInstance = isExpressApp ? serverOrApp : http.createServer(serverOrApp);

  if (typeof (global.PhusionPassenger) !== 'undefined') {
    try {
      global.PhusionPassenger.configure({ autoInstall: false });
    } catch (_) {}
    return serverInstance.listen('passenger', () => {
      console.log('[cPanel Startup] Server successfully bound to Phusion Passenger socket.');
    });
  } else if (process.env.PORT === 'passenger' || (process.env.PORT && isNaN(Number(process.env.PORT)))) {
    return serverInstance.listen(process.env.PORT, () => {
      console.log(`[cPanel Startup] Server listening on socket/port: ${process.env.PORT}`);
    });
  } else {
    const port = Number(process.env.PORT) || 3000;
    return serverInstance.listen(port, () => {
      console.log(`[cPanel Startup] Server running locally on http://localhost:${port}`);
    });
  }
}

// 6. Locate the compiled production server bundle
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

// 7. Boot the server or display helpful in-browser diagnostics
if (!serverPath) {
  console.error('[cPanel Startup Error] Could not find dist/server.cjs. Checked paths:', possiblePaths);
  const fallbackServer = http.createServer((req, res) => {
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Ropenix Collections - Server Bundle Missing</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #020617; color: #f8fafc; margin: 0; padding: 40px 20px; display: flex; justify-content: center; }
          .card { max-width: 650px; background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 32px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
          h2 { color: #f87171; margin-top: 0; font-size: 22px; }
          p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
          code { background: #1e293b; color: #38bdf8; padding: 3px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; }
          ol { color: #cbd5e1; font-size: 14px; line-height: 1.8; padding-left: 20px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>⚠️ Production Server Bundle Missing</h2>
          <p>The Node.js server cannot locate <code>dist/server.cjs</code> in your application root (<code>${__dirname}</code>).</p>
          <p><strong>Recommended Resolution Steps:</strong></p>
          <ol>
            <li>Run <code>npm run build</code> or <code>npm run package:cpanel</code> locally.</li>
            <li>Upload and extract <code>cpanel_deploy/ropenix_node_fullstack.zip</code> into your cPanel application root folder.</li>
            <li>In cPanel <em>Setup Node.js App</em>, click <strong>Restart</strong>.</li>
          </ol>
        </div>
      </body>
      </html>
    `);
  });
  listenPassengerSafely(fallbackServer);
} else {
  try {
    console.log(`[cPanel Startup] Loading server module from: ${serverPath}`);
    const serverModule = require(serverPath);
    
    // If startServer function is exported, invoke it to start listening and background jobs
    if (typeof serverModule.startServer === 'function') {
      const startResult = serverModule.startServer();
      if (startResult && typeof startResult.catch === 'function') {
        startResult.catch((asyncErr) => {
          console.error('[cPanel Startup Async Error]:', asyncErr);
        });
      }
    } else if (serverModule && (serverModule.default || serverModule.app || typeof serverModule === 'function')) {
      const appInstance = serverModule.default || serverModule.app || serverModule;
      listenPassengerSafely(appInstance);
    }
  } catch (err) {
    console.error(`[cPanel Startup Error] Failed to load server from ${serverPath}:`, err);
    const errorServer = http.createServer((req, res) => {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Ropenix Collections - Startup Configuration Error</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #020617; color: #f8fafc; margin: 0; padding: 40px 20px; display: flex; justify-content: center; }
            .card { max-width: 750px; width: 100%; background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 32px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
            h2 { color: #f87171; margin-top: 0; font-size: 22px; }
            p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
            pre { background: #1e293b; border: 1px solid #334155; padding: 16px; border-radius: 8px; color: #fca5a5; overflow-x: auto; font-size: 12px; line-height: 1.5; font-family: monospace; }
            code { background: #1e293b; color: #38bdf8; padding: 3px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; }
            ol { color: #cbd5e1; font-size: 14px; line-height: 1.8; padding-left: 20px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>⚠️ Node.js Server Startup Error</h2>
            <p>The application encountered an error while initializing on cPanel:</p>
            <pre>${escapeHtml(err.stack || err.message || String(err))}</pre>
            <p><strong>Troubleshooting Guide:</strong></p>
            <ol>
              <li>In cPanel <strong>Setup Node.js App</strong>, click <strong>Run JS Install</strong> (or run <code>npm install --omit=dev</code> in terminal) to ensure all dependencies are present.</li>
              <li>Verify your <code>.env</code> database credentials (<code>DB_HOST</code>, <code>DB_USER</code>, <code>DB_PASSWORD</code>, <code>DB_NAME</code>).</li>
              <li>After updating settings, click <strong>Restart</strong> in cPanel <strong>Setup Node.js App</strong>.</li>
            </ol>
          </div>
        </body>
        </html>
      `);
    });
    listenPassengerSafely(errorServer);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
