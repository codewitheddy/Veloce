/**
 * cPanel Deployment Packaging Automation Script
 * 
 * Automatically builds the production frontend & server bundle, validates configurations,
 * and packages ready-to-upload ZIP archives and folders into `cpanel_deploy/`.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'cpanel_deploy');

function log(msg) {
  console.log(`\x1b[36m[cPanel Packager]\x1b[0m ${msg}`);
}

function success(msg) {
  console.log(`\x1b[32m✔ ${msg}\x1b[0m`);
}

function warn(msg) {
  console.log(`\x1b[33m⚠ ${msg}\x1b[0m`);
}

function error(msg) {
  console.error(`\x1b[31m✖ ${msg}\x1b[0m`);
}

function copyRecursive(src, dest, ignoreList = []) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      if (ignoreList.includes(entry)) continue;
      copyRecursive(path.join(src, entry), path.join(dest, entry), ignoreList);
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function zipDirectory(sourceDir, outPath) {
  if (fs.existsSync(outPath)) {
    try {
      fs.unlinkSync(outPath);
    } catch (_) {}
  }

  log(`Compressing ${path.basename(outPath)}...`);
  try {
    if (process.platform === 'win32') {
      const resolvedSrc = path.resolve(sourceDir).replace(/'/g, "''");
      const resolvedOut = path.resolve(outPath).replace(/'/g, "''");
      const cmd = `powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${resolvedSrc}', '${resolvedOut}')"`;
      execSync(cmd, { stdio: 'pipe' });
    } else {
      const cmd = `cd "${sourceDir}" && zip -r -q "${outPath}" ./* ./.htaccess 2>/dev/null || zip -r -q "${outPath}" ./*`;
      execSync(cmd, { stdio: 'pipe' });
    }
    const stat = fs.statSync(outPath);
    success(`Generated ${path.basename(outPath)} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
  } catch (err) {
    warn(`Could not create ZIP automatically (${err.message}). The uncompressed directory is available in ${sourceDir}`);
  }
}

async function run() {
  console.log('\n======================================================');
  console.log('🚀 Preparing Veloce Hub for cPanel Deployment');
  console.log('======================================================\n');

  // Step 1: Run Production Build
  log('Running production frontend build (vite build)...');
  try {
    execSync('npx vite build', { cwd: ROOT_DIR, stdio: 'inherit', shell: true });
    success('Frontend build completed successfully.');
  } catch (err) {
    error(`Frontend build failed: ${err.message}`);
    process.exit(1);
  }

  log('Building server bundle (esbuild)...');
  try {
    execSync('npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs', { cwd: ROOT_DIR, stdio: 'inherit', shell: true });
    success('Server bundle built successfully.');
  } catch (err) {
    warn(`Server bundle note: ${err.message}`);
  }

  // Step 2: Ensure cpanel_deploy directory exists and is clean
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // ---------------------------------------------------------------------------
  // Bundle 1: Node.js Full-Stack Application (Recommended for cPanel Node App)
  // ---------------------------------------------------------------------------
  log('Packaging Bundle 1: Node.js Full-Stack App...');
  const nodeDir = path.join(OUTPUT_DIR, 'node_fullstack');
  fs.mkdirSync(nodeDir, { recursive: true });

  // Copy dist
  copyRecursive(path.join(ROOT_DIR, 'dist'), path.join(nodeDir, 'dist'));
  // Copy public
  copyRecursive(path.join(ROOT_DIR, 'public'), path.join(nodeDir, 'public'));
  // Copy app.js & app.cjs
  if (fs.existsSync(path.join(ROOT_DIR, 'app.js'))) {
    fs.copyFileSync(path.join(ROOT_DIR, 'app.js'), path.join(nodeDir, 'app.js'));
  }
  if (fs.existsSync(path.join(ROOT_DIR, 'app.cjs'))) {
    fs.copyFileSync(path.join(ROOT_DIR, 'app.cjs'), path.join(nodeDir, 'app.cjs'));
  }
  // Copy package.json & package-lock.json
  if (fs.existsSync(path.join(ROOT_DIR, 'package.json'))) {
    fs.copyFileSync(path.join(ROOT_DIR, 'package.json'), path.join(nodeDir, 'package.json'));
  }
  if (fs.existsSync(path.join(ROOT_DIR, 'package-lock.json'))) {
    fs.copyFileSync(path.join(ROOT_DIR, 'package-lock.json'), path.join(nodeDir, 'package-lock.json'));
  }
  // Copy .htaccess to root of node app
  if (fs.existsSync(path.join(ROOT_DIR, 'public', '.htaccess'))) {
    fs.copyFileSync(path.join(ROOT_DIR, 'public', '.htaccess'), path.join(nodeDir, '.htaccess'));
  }
  // Copy .env.cpanel.example as .env.example
  if (fs.existsSync(path.join(ROOT_DIR, '.env.cpanel.example'))) {
    fs.copyFileSync(path.join(ROOT_DIR, '.env.cpanel.example'), path.join(nodeDir, '.env.example'));
  }
  // Copy seed sqlite database if available
  if (fs.existsSync(path.join(ROOT_DIR, 'veloce.sqlite'))) {
    fs.copyFileSync(path.join(ROOT_DIR, 'veloce.sqlite'), path.join(nodeDir, 'veloce.sqlite'));
  }

  zipDirectory(nodeDir, path.join(OUTPUT_DIR, 'veloce_node_fullstack.zip'));

  // ---------------------------------------------------------------------------
  // Bundle 2: Static SPA Frontend (For direct extraction into public_html)
  // ---------------------------------------------------------------------------
  log('Packaging Bundle 2: Static SPA Frontend...');
  const staticDir = path.join(OUTPUT_DIR, 'static_spa');
  fs.mkdirSync(staticDir, { recursive: true });

  copyRecursive(path.join(ROOT_DIR, 'dist'), staticDir);
  // Ensure .htaccess is in the static folder
  if (fs.existsSync(path.join(ROOT_DIR, 'public', '.htaccess'))) {
    fs.copyFileSync(path.join(ROOT_DIR, 'public', '.htaccess'), path.join(staticDir, '.htaccess'));
  }

  zipDirectory(staticDir, path.join(OUTPUT_DIR, 'veloce_static_spa.zip'));

  // ---------------------------------------------------------------------------
  // Bundle 3: Django Python Backend (For cPanel "Setup Python App")
  // ---------------------------------------------------------------------------
  log('Packaging Bundle 3: Django REST Framework Backend...');
  const djangoDir = path.join(OUTPUT_DIR, 'django_backend');
  fs.mkdirSync(djangoDir, { recursive: true });

  copyRecursive(path.join(ROOT_DIR, 'backend'), djangoDir, [
    '__pycache__',
    'venv',
    '.venv',
    'staticfiles',
    '.git',
  ]);

  if (fs.existsSync(path.join(ROOT_DIR, 'passenger_wsgi.py'))) {
    fs.copyFileSync(path.join(ROOT_DIR, 'passenger_wsgi.py'), path.join(djangoDir, 'passenger_wsgi.py'));
  }

  zipDirectory(djangoDir, path.join(OUTPUT_DIR, 'veloce_django_backend.zip'));

  // Copy deployment documentation into cpanel_deploy
  if (fs.existsSync(path.join(ROOT_DIR, 'CPANEL_DEPLOYMENT.md'))) {
    fs.copyFileSync(path.join(ROOT_DIR, 'CPANEL_DEPLOYMENT.md'), path.join(OUTPUT_DIR, 'DEPLOYMENT_GUIDE.md'));
  }

  console.log('\n======================================================');
  console.log('🎉 cPanel Deployment Packages Ready in cpanel_deploy/');
  console.log('======================================================\n');
  console.log('📁 Generated Archives:');
  console.log('  1. veloce_node_fullstack.zip  -> Full Node.js App (cPanel Setup Node.js App)');
  console.log('  2. veloce_static_spa.zip       -> Pure Static SPA (Drop into public_html)');
  console.log('  3. veloce_django_backend.zip   -> Django Backend (cPanel Setup Python App)');
  console.log('\n📖 Refer to CPANEL_DEPLOYMENT.md for step-by-step instructions.\n');
}

run().catch((err) => {
  error(`Packaging failed: ${err.message}`);
  process.exit(1);
});
