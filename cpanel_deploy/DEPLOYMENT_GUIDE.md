# 🚀 Complete cPanel Deployment Master Guide for Ropenix Collections
### Single Unified Stack: 100% TypeScript / Node.js + React 19 + MySQL

This guide details the exact step-by-step process to deploy **Ropenix Collections** (`ropenix.co.ke`) to any **cPanel** hosting environment using the **100% Unified Node.js Full-Stack Architecture** powered by Phusion Passenger.

---

## ⚡ Fast-Track: 1-Click Packaging

Generate ready-to-upload, optimized ZIP packages locally with one command:

```bash
npm run package:cpanel
```

This automated command produces clean production archives in `cpanel_deploy/`:
- 📦 **`cpanel_deploy/ropenix_node_fullstack.zip`** *(or `veloce_node_fullstack.zip`)* -> Complete Node.js Fullstack App (API + React SPA + MySQL auto-migrations + Email services).
- 📦 **`cpanel_deploy/ropenix_static_spa.zip`** *(or `veloce_static_spa.zip`)* -> Pure Static Frontend SPA (drop directly into `public_html/`).

---

## 🏗️ Production Architecture

```mermaid
graph TD
    Client[Customer / Admin Browser] --> Apache[cPanel Apache Web Server]
    Apache -->|Phusion Passenger Reverse Proxy| NodeApp[Node.js Fullstack Server (app.cjs -> dist/server.cjs)]
    NodeApp --> MySQL[(cPanel MySQL Database)]
    NodeApp --> SMTP[Zoho Mail / cPanel SMTP Gateway]
    NodeApp --> Cloudinary[Cloudinary Media CDN]
    NodeApp --> MPESA[Safaricom Lipa na M-PESA Paybill 303030]
```

---

## 🚀 Recommended Deployment: Node.js Full-Stack App (Phusion Passenger)

This is the primary deployment method where both the React frontend and the Express REST API run together seamlessly under **cPanel Setup Node.js App**.

### Step 1: Create the MySQL Database in cPanel
1. Log in to your **cPanel** dashboard.
2. Under the **Databases** section, click **MySQL Databases**:
   - **Create New Database**: e.g., `cpaneluser_ropenix` (click *Create Database*).
   - **Add New User**: e.g., `cpaneluser_ropenix_admin` with a strong password (click *Create User*).
   - **Add User To Database**: Select the user and database you just created, click **Add**, check **ALL PRIVILEGES**, and click **Make Changes**.
3. Note your database name, username, and password.

> [!TIP]
> The Ropenix server engine automatically creates, indexes, and migrates all required database tables (orders, products, users, payment submissions, categories, audit logs, and settings) upon startup.

---

### Step 2: Upload Application Files
1. In cPanel, open **File Manager**.
2. Navigate to your home directory (`/home/username/`) and create an application folder (outside of `public_html`), for example:
   ```text
   /home/YOUR_CPANEL_USER/ropenix-app
   ```
3. Upload **`cpanel_deploy/ropenix_node_fullstack.zip`** (or `veloce_node_fullstack.zip`) into that folder.
4. Right-click the zip file and click **Extract**.

---

### Step 3: Configure Node.js Application in cPanel
1. In cPanel, navigate to **Software** -> **Setup Node.js App**.
2. Click **Create Application**:
   - **Node.js version**: Choose `20.x` or `22.x` (or `18.x`).
   - **Application mode**: `Production`.
   - **Application root**: `ropenix-app` (the folder created in Step 2).
   - **Application URL**: Select your domain (e.g. `ropenix.co.ke` or `store.ropenix.co.ke`).
   - **Application startup file**: `app.cjs`
3. Click **Create** in the upper-right corner.

---

### Step 4: Configure Production Environment Variables (`.env`)
1. In cPanel **File Manager**, navigate into `/home/YOUR_CPANEL_USER/ropenix-app/`.
2. Ensure dotfiles are visible (**Settings** in top right -> check **Show Hidden Files (dotfiles)** -> click *Save*).
3. Copy `.env.example` to **`.env`** (or create a new file named `.env`).
4. Fill in your production values:

```env
# Server & Security
NODE_ENV=production
PORT=passenger
APP_URL="https://ropenix.co.ke"
FRONTEND_URL="https://ropenix.co.ke"
ADMIN_URL="https://ropenix.co.ke/admin"
JWT_SECRET="your-strong-production-jwt-secret-key-2026"
RESET_TOKEN_EXPIRY_MINUTES=60

# cPanel MySQL Database Credentials
DB_HOST="127.0.0.1"
DB_PORT=3306
DB_USER="cpaneluser_ropenix_admin"
DB_PASSWORD="your_strong_mysql_password"
DB_NAME="cpaneluser_ropenix"

# Zoho Mail SMTP Gateway (or cPanel Webmail)
EMAIL_ENABLED=true
EMAIL_DEV_MODE=false
EMAIL_HOST="smtppro.zoho.com"
EMAIL_PORT=465
EMAIL_USE_SSL=true
EMAIL_USE_TLS=false
EMAIL_HOST_USER="admin@ropenix.co.ke"
EMAIL_HOST_PASSWORD="your_zoho_smtp_password"
DEFAULT_FROM_EMAIL="Ropenix Collections <admin@ropenix.co.ke>"
EMAIL_FROM="Ropenix Collections <admin@ropenix.co.ke>"
ADMIN_EMAIL="ropenixkenya@gmail.com"
REPLY_TO_EMAIL="ropenixkenya@gmail.com"

# Safaricom Lipa na M-PESA Paybill
PAYBILL_NUMBER="303030"
PAYBILL_ACCOUNT_NUMBER="2047728455"
PAYBILL_ACCOUNT_NAME="ROPENIX INVESTMENTS LTD"

# Cloudinary CDN Image Storage
CLOUDINARY_CLOUD_NAME="Ropenix"
CLOUDINARY_API_KEY="475339869159685"
CLOUDINARY_API_SECRET="your_cloudinary_api_secret"
CLOUDINARY_UPLOAD_PRESET="ropenix_products"
VITE_CLOUDINARY_CLOUD_NAME="Ropenix"
VITE_CLOUDINARY_UPLOAD_PRESET="ropenix_products"

# Admin Operational Digests & Schedules
ADMIN_DIGEST_ENABLED=true
ADMIN_DIGEST_TIMES="08:00,17:00"
ADMIN_DIGEST_RECIPIENTS="admin@ropenix.co.ke,ropenixkenya@gmail.com"
```

5. Save the file.

---

### Step 5: Install Production Dependencies & Start Server
1. In cPanel **Setup Node.js App**, open your `ropenix-app` application.
2. Click **Run JS Install** to install dependencies (`npm install --omit=dev`).
   *(Alternatively, copy the virtualenv source command shown at the top of the page into cPanel **Terminal** and run `npm install --omit=dev`).*
3. Click **Restart Application**.
4. Visit your website: `https://ropenix.co.ke` 🎉

---

## 📦 Alternative Method: Pure Static SPA Deployment

If you only wish to host static frontend assets inside `public_html/`:
1. In cPanel **File Manager**, navigate to **`public_html`**.
2. Upload **`cpanel_deploy/ropenix_static_spa.zip`**.
3. Extract directly into `public_html/`.
4. Ensure `index.html`, `assets/`, and `.htaccess` are present.

> [!NOTE]
> The included `.htaccess` file handles SPA routing (redirecting sub-routes like `/products`, `/orders`, `/admin` to `index.html` seamlessly without 404 errors), Gzip/Deflate compression, and immutable asset caching.

---

## 🔍 Troubleshooting & Diagnostics

| Issue | Likely Cause | Solution |
| :--- | :--- | :--- |
| **503 Service Unavailable** | Node dependencies not installed or Passenger worker stopped | Open **Setup Node.js App**, click **Run JS Install**, and then click **Restart Application**. |
| **500 Server Startup Error** | Missing `.env` or `dist/server.cjs` | Check `stderr.log` in your app folder. Verify `.env` exists with valid `DB_USER` and `DB_PASSWORD`. |
| **`ER_ACCESS_DENIED_ERROR`** | MySQL user credentials incorrect or privileges unassigned | In cPanel **MySQL Databases**, verify that the user is assigned to the database with **ALL PRIVILEGES**. Use `DB_HOST="127.0.0.1"`. |
| **404 on Page Refresh in SPA** | Missing `.htaccess` file | Ensure `.htaccess` is present in `public_html` or app root (turn on "Show Hidden Files" in File Manager). |
| **SMTP Delivery Timeout** | Port blocked or incorrect host | Use `EMAIL_HOST="smtppro.zoho.com"` with `EMAIL_PORT=465` and `EMAIL_USE_SSL=true`. Verify email password. |
| **Changes not visible** | Browser or CDN caching | Hard refresh your browser (`Ctrl + F5` or `Cmd + Shift + R`). The build uses cache-busting asset hashes. |
