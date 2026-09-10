# Django REST Framework Backend

This directory contains the full Django REST Framework (DRF) backend for the Veloce eCommerce application. It is updated with all current production features including Shipping & Delivery, Orders, Products, Payments, and Security.

## 🚀 Quick Setup & Execution

### 1. Create and Activate Virtual Environment
```bash
cd backend
python -m venv venv
# On Linux/macOS:
source venv/bin/activate
# On Windows:
venv\Scripts\activate
```

### 2. Install Required Packages
```bash
pip install -r requirements.txt
```

### 3. Run Database Migrations & Seed Data
```bash
python manage.py makemigrations
python manage.py migrate
python manage.py seed_db
```

### 4. Create Admin Superuser (Optional)
```bash
python manage.py createsuperuser
```

### 5. Start Django Development Server
```bash
python manage.py runserver 8000
```
The API server will run at `http://127.0.0.1:8000/api/`.

---

## 📡 Key API Endpoints & Coverage

| Domain | Endpoint | Method | Description |
| :--- | :--- | :--- | :--- |
| **Auth & Users** | `/api/auth/register/` | `POST` | Register a new user account |
| | `/api/auth/token/` | `POST` | Obtain JWT Access and Refresh tokens |
| | `/api/auth/token/refresh/` | `POST` | Refresh access token using valid refresh token |
| | `/api/auth/password-reset/` | `POST` | Request 6-digit password reset verification OTP |
| | `/api/users/me/` | `GET`, `PUT` | Get or update current user profile |
| **Products** | `/api/products/` | `GET`, `POST` | List all products or create a new product |
| | `/api/products/<id>/` | `GET`, `PUT`, `DELETE` | Retrieve, update, or delete a product |
| | `/api/products/bulk_action/` | `POST` | Batch operations (`archive`, `delete`, `update_status`) |
| **Shipping & Delivery** | `/api/shipping/zones/` | `GET`, `POST`, `PUT`, `DELETE` | Manage distance zones, base fees, and regions |
| | `/api/shipping/happy-hours/` | `GET`, `POST`, `PUT`, `DELETE` | Manage Happy Hour discount schedules |
| **Orders & Logistics** | `/api/orders/` | `GET`, `POST` | Create orders and view order history |
| | `/api/orders/track/<order_id>` | `GET` | Retrieve real-time Fargo/G4S courier tracking checkpoints |
| **Payments & Security** | `/api/payments/validate` | `POST` | Validate M-Pesa, Card, or COD transactions |
| | `/api/sensitive/verify-promo` | `POST` | Server-side promo/coupon verification |
| | `/api/sensitive/authorize-refund` | `POST` | Authorize returns and generate RMA codes |
| **Email Service** | `/api/email/config` | `GET` | Retrieve cPanel SMTP configuration status |
| | `/api/email/send` | `POST` | Dispatch HTML/text emails via SMTP |

---

## 📦 Product Bulk Action Example Payload

Send a `POST` request to `/api/products/bulk_action/`:

```json
{
  "product_ids": ["prod-001", "prod-002", "prod-003"],
  "action": "update_status",
  "status": "Archived"
}
```

---

## 🚚 Shipping Calculation Example Payload

Send a `POST` request to `/api/shipping/calculate-fee/`:

```json
{
  "orderSubtotal": 3500,
  "distanceKm": 7.5,
  "isExpress": false,
  "isHappyHour": true,
  "freeDeliveryThreshold": 5000
}
```

---

## 🔗 Connecting with React SPA Frontend

In your root `.env` or React application environment:
```env
VITE_API_BASE_URL="http://127.0.0.1:8000/api"
```
