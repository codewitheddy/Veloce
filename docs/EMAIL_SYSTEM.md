# Ropenix Collections - Transactional Email & Payment Verification System

## 1. System Architecture Overview

The Ropenix Collections transactional email system is engineered for high deliverability, resilience, and dual-database compatibility (SQLite in development, PostgreSQL in production).

```
 ┌────────────────┐      ┌────────────────────────┐      ┌─────────────────────────┐
 │ Domain Events  │ ───> │ Persistent Job Queue   │ ───> │ Rate-Limited Worker     │
 │ (Order/Payment)│      │ (email_jobs table)     │      │ (Max 5/sec, Exponential │
 └────────────────┘      └────────────────────────┘      │  Backoff Retries)       │
                                                         └────────────┬────────────┘
                                                                      │
                                                                      ▼
 ┌────────────────┐      ┌────────────────────────┐      ┌─────────────────────────┐
 │ Africa/Nairobi │ ───> │ Deduplication Key      │ ───> │ Zoho Mail SMTP Server   │
 │ Scheduler      │      │ (email_logs table)     │      │ (smtppro.zoho.com:465)  │
 └────────────────┘      └────────────────────────┘      └─────────────────────────┘
```

### Core Components
- **Singleton SMTP Transporter** (`src/server/email/transporter.ts`): Configured for Zoho Mail SMTP (`smtppro.zoho.com:465`, SSL/TLS) with connection pooling and dev-mode safety redirect (`EMAIL_DEV_REDIRECT_TO`).
- **Database Persistence & Migrations** (`src/lib/sqlite-db.ts`, `src/lib/postgres-db.ts`, `src/server/email/db.ts`): Tables for `email_logs`, `email_jobs`, `payment_submissions`, `email_preferences`, and `scheduled_task_logs`.
- **Decoupled Event Bus** (`src/server/email/events.ts`): Emits domain events (`order:created`, `payment:submitted`, `payment:confirmed`, `payment:issue`, `order:shipped`, `order:delivered`, `order:cancelled`, `refund:processed`, `auth:registered`, `auth:password_reset`).
- **Persistent Queue Worker** (`src/server/email/queue.ts`): Background job polling with exponential backoff retries (`30s`, `2m`, `10m`, `30m`, `2h`, max 5 attempts) and opt-out preference filtering.
- **Africa/Nairobi Scheduler** (`src/server/email/scheduler.ts`): Nairobi-time runner for daily digests (08:00 & 17:00 EAT), payment reminders (+12h, +24h), and auto-cancellations.

---

## 2. Shared M-Pesa Paybill Workflow

Ropenix Collections operates with manual payment collection via a **single shared Paybill account**:

| Parameter | Configuration |
| :--- | :--- |
| **Business Number (Paybill)** | `303030` |
| **Account Number** | `2047728455` *(Fixed for all customers)* |
| **Account Name** | `ROPENIX INVESTMENTS LTD` |
| **Currency** | `KES` (KSh) |

### Customer Journey
1. **Order Placed**: Customer places an order and immediately receives an Order Confirmation email containing the order breakdown and the highlighted green M-Pesa Paybill instruction box.
2. **Payment Execution**: Customer pays via Safaricom M-Pesa using Business No `303030` and Account `2047728455`. The Safaricom confirmation SMS displays `ROPENIX INVESTMENTS LTD`.
3. **Payment Submission ("I've Paid")**: On the order tracking page, the customer clicks **"I've Paid (Submit M-Pesa Code)"** and inputs their 10-character transaction reference code (e.g. `SGH7A9B1C2`).
4. **Instant Acknowledgment**:
   - Customer receives a `payment_submission_received` email informing them their payment claim is under review.
   - Admin receives an urgent alert with the customer's details and M-Pesa code.
5. **Admin Verification Desk**: Admin cross-checks the code against the Safaricom Paybill statement and clicks **Approve & Send Receipt** or **Flag Payment Issue**.
6. **Official Receipt & Dispatch**:
   - Customer receives an official `payment_receipt` email with verified payment status.
   - Order enters warehouse fulfillment and packaging.

### Critical Safety Rules
- **Code Uniqueness**: The `mpesa_receipt_code` column has a strict `UNIQUE` constraint preventing duplicate claims across orders.
- **Auto-Cancel Immunity**: Any order with a `pending_verification` payment submission is **strictly excluded** from auto-cancellation, even if it exceeds the standard reservation window.

---

## 3. Scheduled Automations (Africa/Nairobi Timezone)

| Task | Schedule | Trigger & Logic |
| :--- | :--- | :--- |
| **Morning Payment Digest** | 08:00 EAT Daily | Summarizes all unverified payment claims and pending orders to `admin@ropenix.co.ke`. Dedupe key: `admin_digest_morning_YYYY-MM-DD`. |
| **Evening Payment Digest** | 17:00 EAT Daily | End-of-day operational summary of cleared and pending orders. Dedupe key: `admin_digest_evening_YYYY-MM-DD`. |
| **Payment Reminder 1** | +12 Hours Unpaid | Friendly reminder with Paybill box. Skipped if customer already submitted payment claim. |
| **Payment Reminder 2** | +24 Hours Unpaid | Final urgency notice before reservation timeout. |
| **Auto-Cancellation** | +48 Hours Unpaid | Cancels unpaid orders past deadline. **Strictly skips** orders with a pending payment claim. |

---

## 4. DNS Configuration for Zoho Mail (Deliverability Guide)

To ensure all transactional emails land in the customer's primary inbox and pass DMARC/DKIM/SPF checks:

### 1. SPF Record (TXT)
Add or update the TXT record on `ropenix.co.ke`:
```text
Host: @
Type: TXT
Value: v=spf1 include:zoho.com ~all
```

### 2. DKIM Record (TXT)
Generate your selector in Zoho Mail Admin Console (`zoho._domainkey`):
```text
Host: zoho._domainkey.ropenix.co.ke
Type: TXT
Value: v=DKIM1; k=rsa; p=YOUR_ZOHO_PUBLIC_KEY_HERE
```

### 3. DMARC Policy (TXT)
```text
Host: _dmarc.ropenix.co.ke
Type: TXT
Value: v=DMARC1; p=quarantine; rua=mailto:admin@ropenix.co.ke; pct=100
```

### 4. MX Records (Inbound Routing)
```text
Priority 10: mx.zoho.com
Priority 20: mx2.zoho.com
Priority 50: mx3.zoho.com
```

---

## 5. API Reference

### Payment Submissions
- `POST /api/payments/claim` - Customer submits M-Pesa transaction code & phone.
- `GET /api/payments/order/:orderId` - Fetches payment submissions for an order.
- `GET /api/payments/admin/pending` - Admin list of unverified payment claims.
- `POST /api/payments/admin/verify` - Admin approves, rejects, or flags partial payment (`action: 'approve' | 'reject' | 'partial'`).
- `POST /api/payments/admin/orders/:id/resend-paybill` - Admin triggers resending of Paybill instructions.

### Email Preferences & Unsubscribe
- `GET /api/email/preferences?email=...` - Fetches user preferences.
- `POST /api/email/preferences` - Updates opt-in preferences for marketing / review requests.
- `GET /api/email/unsubscribe?email=...` - One-click unsubscribe handler.

### Diagnostics & Monitoring
- `GET /api/admin/email/stats` - Live queue backlog, sent counts, and recent email logs.
- `POST /api/admin/email/test` - Dispatches an immediate test email to verify Zoho SMTP connectivity.

---

## 6. Go-Live & Verification Checklist

- [x] Singleton Zoho SMTP Transporter tested with `admin@ropenix.co.ke` on `smtppro.zoho.com:465`.
- [x] Dual-database schema migrations applied to SQLite and PostgreSQL.
- [x] Responsive table-based email templates created with inline CSS and plain-text fallbacks.
- [x] Background queue worker initialized with exponential backoff retries.
- [x] Domain event listeners registered for all customer and order lifecycles.
- [x] Customer "I've Paid" modal integrated into order tracking.
- [x] Admin "M-Pesa Verification Desk" integrated into order management.
- [x] Automated test suite passing in CI (`tests/email_system.test.mjs`).
- [x] Africa/Nairobi timezone scheduled jobs active for 08:00 & 17:00 EAT digests and payment reminders.
