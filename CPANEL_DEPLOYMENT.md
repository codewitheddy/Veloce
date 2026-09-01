# 🚀 cPanel Deployment Guide for Veloce Hub

This guide provides clear, step-by-step instructions to deploy **Veloce Hub** to your **cPanel** hosting environment. This project is optimized for both full-stack Node.js Express integration and high-performance static frontend hosting.

---

## 🛠️ Option 1: Full-Stack Node.js Deployment (Recommended)
Use this option to enable both the **React Frontend** and the **Gemini AI Copy/Image Backend API**.

### 1. Build the Application
Before uploading, build the production-ready assets:
```bash
npm run build
```
This compiles the React frontend to `dist/` and bundles the Express server to `dist/server.cjs`.

### 2. Package Your Files
Compress the following files and folders into a ZIP archive:
- `dist/` (contains compiled frontend and `server.cjs`)
- `public/` (contains static assets and `.htaccess`)
- `app.js` (cPanel Passenger startup hook)
- `package.json` (defines dependencies)
- `package-lock.json`

*(Note: **DO NOT** include `node_modules`, `.git`, or raw `src/` files in the ZIP archive to keep the upload lightweight.)*

### 3. Upload to cPanel
1. Log into your **cPanel**.
2. Open **File Manager** and navigate to your application root directory (e.g., `/home/username/veloce-app` or a folder outside `public_html`).
3. Upload and extract your ZIP file there.

### 4. Set Up Node.js Application in cPanel
1. In cPanel, search for **Setup Node.js App** (under the **Software** section).
2. Click **Create Application**.
3. Configure the application details:
   - **Node.js version**: Choose **v18+** or **v20+** (recommended).
   - **Application Mode**: **Production**.
   - **Application root**: Enter the folder path where you uploaded your files (e.g., `veloce-app`).
   - **Application URL**: Select your domain/subdomain.
   - **Application startup file**: Enter `app.js`.
4. Click **Create**.

### 5. Set Environment Variables
In the same cPanel Node.js Application page, scroll down to **Environment variables** and add:
- `NODE_ENV` = `production`
- `GEMINI_API_KEY` = `your_actual_gemini_api_key`

Click **Save** to apply.

### 6. Install Dependencies
Scroll to the top of the cPanel Node.js Selector page and click **Run JS Install** (or run `npm install --production` via the cPanel Terminal).

### 7. Start/Restart the Application
Click **Restart** on the top right. Your website is now fully live on your cPanel domain!

---

## 📄 Option 2: Static-Only Frontend Deployment
If you only need the frontend dashboard & store interface, and your hosting plan does not support Node.js processes, you can deploy it as a purely static SPA.

### 1. Build the Static Files
Run:
```bash
npm run build
```
This builds your frontend static assets into the `dist/` directory.

### 2. Upload to `public_html`
1. Open cPanel **File Manager**.
2. Open the **`public_html`** folder (or your subdomain's root directory).
3. Upload the *contents* of the **`dist/`** directory directly into `public_html`.
4. Ensure the `.htaccess` file (which Vite copied into `dist/`) is uploaded as well. This `.htaccess` is pre-configured to prevent Apache 404 errors when deep-linking or reloading tabs on single-page applications.

---

## 🧼 Code Cleanliness & Best Practices
- **No Stale Code**: Alternative implementations like Django/Python (`/backend`) have been deleted to save space and remove confusion.
- **Port Compatibility**: The backend now automatically respects `process.env.PORT` provided dynamically by cPanel's Passenger service.
- **Static Assets**: All public static files reside in `/public` and are correctly served without routing interference.
- **Config Files**: All configurations have been organized cleanly.
