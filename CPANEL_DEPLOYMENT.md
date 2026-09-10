# 🚀 Complete cPanel Deployment Master Guide for Veloce Hub

This guide details the exact steps to deploy **Veloce Hub** (React Frontend + Django Backend + PostgreSQL) to any **cPanel** hosting environment.

---

## ⚡ Fast-Track: 1-Click Packaging

Generate ready-to-upload ZIP archives with a single command:

```bash
npm run package:cpanel
```

This automated command packages clean, optimized ZIP archives in `cpanel_deploy/`:
- 📦 **`cpanel_deploy/veloce_static_spa.zip`** -> React Frontend for `public_html/`
- 📦 **`cpanel_deploy/veloce_django_backend.zip`** -> Django REST Framework Python Backend for cPanel Python App
- 📦 **`cpanel_deploy/veloce_node_fullstack.zip`** -> Node.js Fullstack Alternative (Optional)

---

## 🏗️ Architecture: React Frontend + Django Backend + PostgreSQL

```mermaid
graph TD
    Client[Customer / User Browser] --> Apache[cPanel Web Server / HTTPS]
    Apache -->|Main Domain / ropenix.co.ke| ReactSPA[React 19 SPA in public_html]
    Apache -->|API / api.ropenix.co.ke or /api/| DjangoAPI[Django REST Framework Passenger App]
    DjangoAPI --> Postgres[(cPanel PostgreSQL / Remote PostgreSQL)]
```

---

## 🚀 Step-by-Step Deployment: Django Backend + React Frontend

### Part A: Deploy the Django Backend (Python App)

#### 1. Upload Backend Archive
1. In cPanel, open **File Manager**.
2. Create a folder in your home directory (outside `public_html`), for example: `/home/username/veloce-backend`.
3. Upload **`cpanel_deploy/veloce_django_backend.zip`** into that folder and click **Extract**.

#### 2. Create PostgreSQL Database in cPanel
1. In cPanel, open **PostgreSQL Database Wizard** (or **PostgreSQL Databases**).
2. Create a database: `username_veloce`.
3. Create a database user: `username_admin` with a strong password.
4. Assign the user to the database and grant **ALL PRIVILEGES**.

#### 3. Create Python Application in cPanel
1. In cPanel, navigate to **Setup Python App** (under *Software*).
2. Click **Create Application**:
   - **Python version**: Select `3.10`, `3.11`, or `3.12`.
   - **Application root**: `veloce-backend` (the folder where backend was extracted).
   - **Application URL**: Select your subdomain (e.g. `api.ropenix.co.ke`) or `ropenix.co.ke/api`.
   - **Application startup file**: `passenger_wsgi.py`.
   - **Application Entry point**: `application`.
3. Click **Create** (top right).

#### 4. Install Dependencies & Migrate Database
1. Copy the virtual environment activation command displayed at the top of the cPanel Python App screen:
   ```bash
   source /home/username/virtualenv/veloce-backend/3.11/bin/activate && cd /home/username/veloce-backend
   ```
2. Open cPanel **Terminal** (or connect via SSH), paste the command, and press Enter.
3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create the `.env` file:
   ```bash
   nano .env
   ```
   Add your environment configuration:
   ```env
   DJANGO_SECRET_KEY="your-production-secret-key"
   DJANGO_DEBUG=False
   ALLOWED_HOSTS="ropenix.co.ke,www.ropenix.co.ke,api.ropenix.co.ke,localhost"
   CSRF_TRUSTED_ORIGINS="https://ropenix.co.ke,https://www.ropenix.co.ke,https://api.ropenix.co.ke"
   
   # PostgreSQL Database Configuration
   POSTGRES_DB="username_veloce"
   POSTGRES_USER="username_admin"
   POSTGRES_PASSWORD="your_postgres_password"
   POSTGRES_HOST="localhost"
   POSTGRES_PORT=5432
   
   # Or full connection URL:
   # DATABASE_URL="postgresql://username_admin:your_postgres_password@localhost:5432/username_veloce"
   ```
   *(Save with `Ctrl+O`, `Enter`, then exit with `Ctrl+X`)*.

5. Run migrations, seed initial data, and collect static files:
   ```bash
   python manage.py migrate
   python manage.py seed_db
   python manage.py collectstatic --noinput
   ```

6. In cPanel **Setup Python App**, click **Restart Application**.

---

### Part B: Deploy the React Frontend (SPA)

#### 1. Upload React SPA
1. In cPanel **File Manager**, navigate to **`public_html`** (or your primary web root).
2. Upload **`cpanel_deploy/veloce_static_spa.zip`**.
3. Right-click and select **Extract** directly in `public_html`.
4. Verify that `index.html`, `assets/`, and `.htaccess` are in `public_html`.

> [!NOTE]
> The included `.htaccess` file handles SPA routing (redirecting page refreshes like `/products`, `/orders`, `/dashboard` to `index.html` seamlessly without 404 errors) and enables Gzip compression and browser caching.

---

## 🔍 Troubleshooting & Diagnostics

### 1. Checking Django Startup Errors on cPanel
Our `passenger_wsgi.py` includes automatic error logging. If the Python app fails to start:
1. Open cPanel **File Manager** and go to `/home/username/veloce-backend/`.
2. Open **`passenger_wsgi_error.log`** to see the full Python exception traceback.

### 2. Common Fixes

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **503 Service Unavailable** | Python packages not installed or syntax error | Run `pip install -r requirements.txt` inside the active virtual environment |
| **403 Forbidden (CSRF Failed)** | `CSRF_TRUSTED_ORIGINS` missing domain | Ensure `CSRF_TRUSTED_ORIGINS="https://ropenix.co.ke,https://api.ropenix.co.ke"` is in `.env` |
| **PostgreSQL Connection Refused** | PostgreSQL service or wrong port/host | Verify database credentials in `.env` and ensure database user is granted privileges |
| **404 on Frontend Page Refresh** | `.htaccess` missing or hidden | In cPanel File Manager Settings, enable "Show Hidden Files (dotfiles)" and ensure `.htaccess` is in `public_html` |
