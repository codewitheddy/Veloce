# 🚀 Complete cPanel Deployment Master Guide for Veloce Hub
### Single Unified Stack: 100% TypeScript / JavaScript (Node.js + React 19)

This guide details the exact steps to deploy **Veloce Hub** to any **cPanel** hosting environment using the **100% Unified Node.js Full-Stack Architecture**.

---

## ⚡ Fast-Track: 1-Click Packaging

Generate ready-to-upload ZIP archives with a single command:

```bash
npm run package:cpanel
```

This automated command packages clean, optimized ZIP archives in `cpanel_deploy/`:
- 📦 **`cpanel_deploy/veloce_node_fullstack.zip`** -> Full Node.js App (API + React SPA + SQLite/MySQL/Postgres)
- 📦 **`cpanel_deploy/veloce_static_spa.zip`** -> Pure Static SPA (Drop directly into `public_html/`)

---

## 🏗️ Architecture: Pure Node.js Full-Stack

```mermaid
graph TD
    Client[Customer / User Browser] --> Apache[cPanel Web Server / Phusion Passenger]
    Apache -->|All Traffic / API & Frontend| NodeServer[Node.js Express Server (server.cjs via app.cjs)]
    NodeServer --> LocalDB[(SQLite veloce.sqlite / MySQL / PostgreSQL)]
    NodeServer --> SMTPEmail[cPanel SMTP Email Gateway]
    NodeServer --> CloudinaryCDN[Cloudinary Media CDN]
```

---

## 🚀 Deployment Method 1: Node.js Full-Stack App (Recommended)

This method runs both the React frontend and the Express API server under **cPanel Setup Node.js App** (Phusion Passenger).

### 1. Upload Fullstack Archive
1. In cPanel, open **File Manager**.
2. Create a folder in your home directory (outside `public_html`), for example: `/home/username/veloce-app`.
3. Upload **`cpanel_deploy/veloce_node_fullstack.zip`** into that folder and click **Extract**.

### 2. Create Node.js Application in cPanel
1. In cPanel, navigate to **Setup Node.js App** (under *Software*).
2. Click **Create Application**:
   - **Node.js version**: Select `18.x`, `20.x`, or `22.x`.
   - **Application mode**: `Production`.
   - **Application root**: `veloce-app` (the folder where fullstack was extracted).
   - **Application URL**: Select your domain (e.g. `ropenix.co.ke` or `store.ropenix.co.ke`).
   - **Application startup file**: `app.cjs`
3. Click **Create** (top right).

### 3. Install Dependencies & Configure Environment
1. In the Node.js application screen, click **Run JS Install** (or copy the virtualenv command into cPanel Terminal and run `npm install --omit=dev`).
2. Create your `.env` file in `/home/username/veloce-app/.env`:
   ```env
   NODE_ENV=production
   PORT=passenger
   
   # Store & Security
   JWT_SECRET="your-strong-production-jwt-secret-key-2026"
   ADMIN_EMAIL="admin@ropenix.co.ke"
   
   # Optional Cloudinary Media Storage
   CLOUDINARY_CLOUD_NAME="your_cloud_name"
   CLOUDINARY_API_KEY="your_api_key"
   CLOUDINARY_API_SECRET="your_api_secret"
   
   # Optional cPanel SMTP Email Gateway
   EMAIL_HOST="mail.ropenix.co.ke"
   EMAIL_PORT=465
   EMAIL_HOST_USER="noreply@ropenix.co.ke"
   EMAIL_HOST_PASSWORD="your_email_password"
   EMAIL_USE_SSL=true
   
   # Optional PostgreSQL / MySQL (Defaults to local SQLite veloce.sqlite automatically)
   # POSTGRES_HOST=localhost
   # POSTGRES_PORT=5432
   # POSTGRES_DB=username_veloce
   # POSTGRES_USER=username_admin
   # POSTGRES_PASSWORD=your_password
   ```
3. In cPanel **Setup Node.js App**, click **Restart Application**.

---

## 🚀 Deployment Method 2: Pure Static SPA Frontend

If you only want to deploy the static frontend assets into `public_html/`:

1. In cPanel **File Manager**, navigate to **`public_html`**.
2. Upload **`cpanel_deploy/veloce_static_spa.zip`**.
3. Right-click and select **Extract** directly in `public_html`.
4. Verify that `index.html`, `assets/`, and `.htaccess` are present.

> [!NOTE]
> The included `.htaccess` file handles SPA routing (redirecting page refreshes like `/products`, `/orders`, `/dashboard` to `index.html` seamlessly without 404 errors) and enables Gzip compression and browser caching.

---

## 🔍 Troubleshooting & Diagnostics

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **503 Service Unavailable** | Node dependencies not installed | In cPanel *Setup Node.js App*, click **Run JS Install** or run `npm install --omit=dev` |
| **500 Startup Error** | Missing `dist/server.cjs` bundle | Ensure you ran `npm run package:cpanel` before uploading `veloce_node_fullstack.zip` |
| **404 on Frontend Page Refresh** | `.htaccess` missing or hidden | In cPanel File Manager Settings, enable "Show Hidden Files (dotfiles)" and verify `.htaccess` exists in app root |
| **SMTP Delivery Fails** | Incorrect mail credentials | Test your SMTP settings directly using the built-in diagnostic tool at `/admin` -> Site Settings -> Email Gateway |
