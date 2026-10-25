-- ============================================================================
-- Migration: Add Product Reviews System and Order Items Relational Bridge
-- Date: 2026-10-25
-- Target: MySQL / MariaDB (InnoDB, utf8mb4)
-- Description:
--   1. Aborts if existing reviews table contains any user data.
--   2. Drops empty legacy reviews table and creates the structured reviews table.
--   3. Creates the order_items table for normalized order line-item references.
--   4. Extends orders table with review_reminder_sent_at.
--   5. Extends users table with marketing_emails_opt_out.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Step 0: Safeguard Check
-- Abort immediately if legacy `reviews` table exists and contains any records.
-- If rows exist, evaluating this statement fails with an explicit error.
-- ----------------------------------------------------------------------------
SET @tbl_exists = (
  SELECT COUNT(*) FROM information_schema.tables 
  WHERE table_schema = DATABASE() AND table_name = 'reviews'
);

SET @check_cmd = IF(
  @tbl_exists > 0,
  'SELECT COUNT(*) INTO @legacy_cnt FROM `reviews`',
  'SET @legacy_cnt = 0'
);

PREPARE stmt_check FROM @check_cmd;
EXECUTE stmt_check;
DEALLOCATE PREPARE stmt_check;

SET @abort_cmd = IF(
  @legacy_cnt > 0,
  'SELECT * FROM `ABORT_MIGRATION_EXISTING_REVIEWS_NOT_EMPTY`',
  'DO 0'
);

PREPARE stmt_abort FROM @abort_cmd;
EXECUTE stmt_abort;
DEALLOCATE PREPARE stmt_abort;

-- ----------------------------------------------------------------------------
-- Step 1: Drop empty legacy reviews table
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `reviews`;

-- ----------------------------------------------------------------------------
-- Step 2: Create `order_items` table
-- Note: product_id uses ON DELETE SET NULL to preserve historical order lines
-- even if catalog products are removed.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` VARCHAR(255) NOT NULL,
  `order_id` VARCHAR(255) NOT NULL,
  `product_id` VARCHAR(255) NULL,
  `name` VARCHAR(255) NOT NULL,
  `price` DECIMAL(15, 2) NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `selected_variations` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_oi_order` (`order_id`),
  INDEX `idx_oi_product` (`product_id`),
  CONSTRAINT `fk_oi_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_oi_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Step 3: Create `reviews` table
-- Note: One review per order item, with foreign keys to products, users, and order_items.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `reviews` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `product_id` VARCHAR(255) NOT NULL,
  `user_id` VARCHAR(255) NOT NULL,
  `order_item_id` VARCHAR(255) NOT NULL,
  `rating` TINYINT UNSIGNED NOT NULL,
  `title` VARCHAR(120) NOT NULL,
  `body` TEXT NOT NULL,
  `status` ENUM('published', 'hidden') NOT NULL DEFAULT 'published',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `chk_reviews_rating` CHECK (`rating` BETWEEN 1 AND 5),
  UNIQUE KEY `unique_user_order_item` (`user_id`, `order_item_id`),
  UNIQUE KEY `unique_order_item` (`order_item_id`),
  INDEX `idx_reviews_product_status` (`product_id`, `status`, `created_at`),
  CONSTRAINT `fk_reviews_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reviews_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reviews_order_item` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Step 4: Add columns and indexes to existing tables idempotently
-- ----------------------------------------------------------------------------
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `review_reminder_sent_at` DATETIME NULL;
CREATE INDEX IF NOT EXISTS `idx_orders_review_reminder` ON `orders` (`review_reminder_sent_at`);
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `marketing_emails_opt_out` TINYINT(1) NOT NULL DEFAULT 0;
