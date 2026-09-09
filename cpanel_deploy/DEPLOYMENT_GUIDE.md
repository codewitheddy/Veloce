# 🚀 Complete cPanel Deployment Master Guide for Veloce Hub

This comprehensive guide details the exact steps to deploy **Veloce Hub** to any **cPanel** hosting environment.

---

## ⚡ Fast-Track: 1-Click Packaging

Generate ready-to-upload ZIP archives with a single command:

```bash
npm run package:cpanel
```

This automated command:
1. Compiles the production frontend and bundles the Express server.
2. Packages clean, optimized ZIP archives in the `cpanel_deploy/` directory:
   - 📦 `cpanel_deploy/veloce_node_fullstack.zip` (Node.js Fullstack Passenger App)
   - 📦 `cpanel_deploy/veloce_static_spa.zip` (Direct drop-in for `public_html/`)
   - 📦 `cpanel_deploy/veloce_django_backend.zip` (Django Python Passenger App)

---

## 🛠️ Deployment Options

| Option | Best For | Prerequisites |
| :--- | :--- | :--- |
| **Option 1: Node.js Full-Stack (Recommended)** | Complete eCommerce with integrated Gemini AI, database sync & local API | cPanel "Setup Node.js App" (Node 18+ or 20+) |
| **Option 2: Pure Static SPA** | Frontend store & dashboard only, hosted directly on Apache | Standard Shared cPanel (`public_html/`) |
| **Option 3: Django Backend + SPA** | Python DRF API + React SPA | cPanel "Setup Python App" + `public_html/` |

---

## 📦 Option 1: Full-Stack Node.js Deployment (Recommended)

### Step 1: Upload Files
1. Run `npm run package:cpanel` on your computer.
2. In cPanel, open **File Manager**.
3. Create a folder in your home directory (outside `public_html`), e.g., `/home/username/veloce-app`.
4. Upload `cpanel_deploy/veloce_node_fullstack.zip` into `/home/username/veloce-app/`.
5. Right-click the uploaded ZIP and select **Extract**.

### Step 2: Create MySQL Database in cPanel
1. In cPanel, click **MySQL® Database Wizard**.
2. Create database: `username_veloce`.
3. Create user: `username_admin` with a strong password.
4. Assign user to database and grant **ALL PRIVILEGES**.

### Step 3: Create Node.js Application in cPanel
1. In cPanel, open **Setup Node.js App** (under the *Software* category).
2. Click **Create Application**.
3. Fill in the configuration:
   - **Node.js version**: Select `18.x`, `20.x`, or `22.x`.
   - **Application mode**: `Production`.
   - **Application root**: `veloce-app` (the folder where you extracted the files).
   - **Application URL**: Select your domain or subdomain (e.g. `yourdomain.com`).
   - **Application startup file**: `app.js`.
4. Click **Create** (top right).

### Step 4: Configure Environment Variables
In the same cPanel Node.js application page, scroll down to **Environment variables** and add:

| Key | Example Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production caching & optimizations |
| `DB_HOST` | `localhost` | cPanel local MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_NAME` | `username_veloce` | Your cPanel database name |
| `DB_USER` | `username_admin` | Your cPanel database user |
| `DB_PASSWORD` | `your_mysql_password` | Database user password |
| `GEMINI_API_KEY` | `AIzaSy...` | Optional: Gemini AI API key |
| `CLOUDINARY_CLOUD_NAME` | `your_cloud_name` | Cloudinary CDN name |
| `CLOUDINARY_API_KEY` | `your_api_key` | Cloudinary API Key |
| `CLOUDINARY_API_SECRET` | `your_api_secret` | Cloudinary Secret |
| `EMAIL_HOST` | `mail.yourdomain.com` | cPanel SMTP mail server |
| `EMAIL_PORT` | `465` | SMTP SSL Port |
| `EMAIL_HOST_USER` | `noreply@yourdomain.com`| cPanel Webmail address |
| `EMAIL_HOST_PASSWORD` | `your_email_password` | cPanel Webmail password |

Click **Save** to store the variables.

### Step 5: Install Production Dependencies
1. Scroll to the top of the Node.js selector page.
2. Click **Run JS Install** (or open cPanel **Terminal** and run `npm install --omit=dev`).

### Step 6: Restart & Test
1. Click **Restart Application** on the top right.
2. Visit `https://yourdomain.com` in your browser!

---

## 📄 Option 2: Pure Static Frontend Deployment

Use this option if your hosting account only provides standard Apache hosting without Node.js or Python runtime.

### Step 1: Build the Static Package
```bash
npm run package:cpanel
```

### Step 2: Upload to `public_html`
1. Open cPanel **File Manager**.
2. Navigate to **`public_html`** (or your subdomain directory).
3. Upload `cpanel_deploy/veloce_static_spa.zip`.
4. Extract the archive directly inside `public_html`.
5. Verify that `index.html`, `assets/`, and `.htaccess` are present at the root of `public_html`.

> [!TIP]
> The included `.htaccess` file is pre-configured with Gzip compression, 1-year asset caching, and SPA routing rewrites to ensure deep links and page refreshes work smoothly without 404 errors.

---

## 🐍 Option 3: Django REST Framework Backend Deployment

### Step 1: Upload Django Backend
1. In cPanel **File Manager**, create a folder `/home/username/veloce-backend`.
2. Upload and extract `cpanel_deploy/veloce_django_backend.zip`.

### Step 2: Set Up Python Application in cPanel
1. In cPanel, click **Setup Python App**.
2. Click **Create Application**:
   - **Python version**: Select `3.10`, `3.11`, or `3.12`.
   - **Application root**: `veloce-backend`.
   - **Application URL**: `api` (or a dedicated subdomain `api.yourdomain.com`).
   - **Application startup file**: `passenger_wsgi.py`.
   - **Application Entry point**: `application`.
3. Click **Create**.

### Step 3: Install Requirements & Migrate
1. Copy the virtual environment activation command shown at the top of the cPanel Python App screen (e.g., `source /home/username/virtualenv/veloce-backend/3.11/bin/activate && cd /home/username/veloce-backend`).
2. Open cPanel **Terminal** and paste the command.
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run migrations and database seeding:
   ```bash
   python manage.py migrate
   python manage.py seed_db
   python manage.py collectstatic --noinput
   ```

### Step 4: Configure Django Environment
Create `/home/username/veloce-backend/.env`:
```env
DJANGO_SECRET_KEY="generate_random_secret_key"
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS="yourdomain.com,api.yourdomain.com,localhost"
DB_NAME="username_veloce"
DB_USER="username_admin"
DB_PASSWORD="your_mysql_password"
DB_HOST="localhost"
```

5. Click **Restart** on the Python application page.

---

## 🔒 Post-Deployment Checklist

- [ ] **SSL / HTTPS**: In cPanel, go to **SSL/TLS Status** and run **AutoSSL** to ensure free Let's Encrypt SSL certificates are active.
- [ ] **Database Backup**: In cPanel, use **Backup Wizard** to schedule automated MySQL backups.
- [ ] **Email Testing**: In cPanel **Email Accounts**, test sending and receiving emails from `noreply@yourdomain.com`.
- [ ] **File Permissions**: Folders should be `755` and files `644`.

---

## ❓ Frequently Asked Questions & Troubleshooting

### Q: Why do I see a 404 Error when reloading pages like `/dashboard` or `/products`?
**A**: Ensure that `.htaccess` is present in the document root (`public_html`). Some FTP and cPanel file managers hide dotfiles. In cPanel File Manager, click **Settings** (top right) and check **Show Hidden Files (dotfiles)**.

### Q: How do I restart the Node.js application after updating files?
**A**: In cPanel **Setup Node.js App**, click the **Restart** button, or create/touch a file named `tmp/restart.txt` in your application root directory:
```bash
mkdir -p tmp && touch tmp/restart.txt
```

### Q: Does the Node.js app automatically create MySQL tables?
**A**: Yes! As soon as `DB_NAME`, `DB_USER`, and `DB_PASSWORD` are configured, `src/lib/mysql-db.ts` automatically runs table initializations for products, orders, categories, suppliers, reviews, and logs.
