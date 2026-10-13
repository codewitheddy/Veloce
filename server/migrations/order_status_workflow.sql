-- ============================================================================
-- Order Status Workflow Migration for MySQL
-- E-commerce Payment Lifecycles (M-Pesa Prepaid vs. Cash on Delivery)
-- Includes strict transition history, transactional refund claims, and restocking
-- ============================================================================

-- 1. Order Status History Table (Audit log for every status transition)
CREATE TABLE IF NOT EXISTS order_status_history (
  id VARCHAR(255) PRIMARY KEY,
  order_id VARCHAR(255) NOT NULL,
  from_status VARCHAR(50) NOT NULL,
  to_status VARCHAR(50) NOT NULL,
  changed_by VARCHAR(255) NOT NULL,
  note TEXT NULL,
  metadata LONGTEXT NULL,
  created_at VARCHAR(100) NOT NULL,
  timestamp VARCHAR(100) NOT NULL,
  INDEX idx_osh_order (order_id),
  INDEX idx_osh_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Refund Claims Table (Automated upon paid order cancellation)
CREATE TABLE IF NOT EXISTS refund_claims (
  id VARCHAR(255) PRIMARY KEY,
  order_id VARCHAR(255) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  reason TEXT NOT NULL,
  payment_reference VARCHAR(255) NULL,
  status VARCHAR(50) DEFAULT 'refund_requested', -- refund_requested, refund_approved, refund_paid, refund_rejected
  customer_name VARCHAR(255) NULL,
  customer_email VARCHAR(255) NULL,
  customer_phone VARCHAR(100) NULL,
  refund_payment_reference VARCHAR(255) NULL,     -- M-Pesa B2C / reversal reference when refund is paid
  approved_by VARCHAR(255) NULL,
  approved_at VARCHAR(100) NULL,
  refunded_by VARCHAR(255) NULL,
  refunded_at VARCHAR(100) NULL,
  rejected_by VARCHAR(255) NULL,
  rejected_at VARCHAR(100) NULL,
  rejection_reason TEXT NULL,
  created_at VARCHAR(100) NOT NULL,
  updated_at VARCHAR(100) NOT NULL,
  INDEX idx_rc_order (order_id),
  INDEX idx_rc_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Extend Orders Table with Cancellation & Payment Collection Metadata
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(255) NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at VARCHAR(100) NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_collected_by VARCHAR(255) NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_collected_at VARCHAR(100) NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_confirmed_by VARCHAR(255) NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_confirmed_at VARCHAR(100) NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(15, 2) NULL;
