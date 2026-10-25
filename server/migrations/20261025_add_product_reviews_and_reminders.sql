-- ============================================================================
-- Migration: Add Product Reviews System and Order Items Relational Bridge
-- Date: 2026-10-25
-- Target: MySQL 5.7+ / MySQL 8.0+ / MariaDB 10.3+ (InnoDB, utf8mb4)
-- Compatibility:
--   - Does NOT use non-universal 'IF NOT EXISTS' on ADD COLUMN / CREATE INDEX.
--   - Uses information_schema checks with PREPARE/EXECUTE for 100% portability.
--   - Matches host collation: utf8mb4_general_ci.
--   - Safe: Renames legacy reviews table to reviews_legacy_backup (never drops).
-- Note: Run without --force so any unexpected failure stops execution immediately.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Step 1: Safely rename legacy `reviews` table to `reviews_legacy_backup`
-- If `reviews` exists, it is renamed so no past data can ever be destroyed.
-- ----------------------------------------------------------------------------
SET @tbl_legacy_reviews = (
  SELECT COUNT(*) FROM information_schema.tables 
  WHERE table_schema = DATABASE() AND table_name = 'reviews'
);

SET @tbl_legacy_backup = (
  SELECT COUNT(*) FROM information_schema.tables 
  WHERE table_schema = DATABASE() AND table_name = 'reviews_legacy_backup'
);

SET @rename_legacy_cmd = IF(
  @tbl_legacy_reviews > 0 AND @tbl_legacy_backup = 0,
  'RENAME TABLE `reviews` TO `reviews_legacy_backup`',
  'DO 0'
);

PREPARE stmt_rename_legacy FROM @rename_legacy_cmd;
EXECUTE stmt_rename_legacy;
DEALLOCATE PREPARE stmt_rename_legacy;

-- ----------------------------------------------------------------------------
-- Step 2: Create `order_items` table
-- Charset: utf8mb4, Collation: utf8mb4_general_ci (matches orders/products/users)
-- Foreign Key: product_id uses ON DELETE SET NULL to preserve order history
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `order_id` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `product_id` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `price` DECIMAL(15, 2) NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `selected_variations` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_oi_order` (`order_id`),
  INDEX `idx_oi_product` (`product_id`),
  CONSTRAINT `fk_oi_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_oi_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------------------------------------------------------
-- Step 3: Create `reviews` table
-- Note: One review per order item (enforced via unique_order_item).
-- Rating: 1 to 5 checked at database level and strictly enforced in application layer.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `reviews` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `product_id` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `user_id` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `order_item_id` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `rating` TINYINT UNSIGNED NOT NULL,
  `title` VARCHAR(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `body` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `status` ENUM('published', 'hidden') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'published',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `chk_reviews_rating` CHECK (`rating` BETWEEN 1 AND 5),
  UNIQUE KEY `unique_order_item` (`order_item_id`),
  INDEX `idx_reviews_product_status` (`product_id`, `status`, `created_at`),
  INDEX `idx_reviews_user` (`user_id`),
  CONSTRAINT `fk_reviews_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reviews_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reviews_order_item` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------------------------------------------------------
-- Step 4: Add `orders.review_reminder_sent_at` column (universal check)
-- ----------------------------------------------------------------------------
SET @col_orders_reminder = (
  SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'review_reminder_sent_at'
);

SET @add_col_orders_cmd = IF(
  @col_orders_reminder = 0,
  'ALTER TABLE `orders` ADD COLUMN `review_reminder_sent_at` DATETIME NULL',
  'DO 0'
);

PREPARE stmt_orders_col FROM @add_col_orders_cmd;
EXECUTE stmt_orders_col;
DEALLOCATE PREPARE stmt_orders_col;

-- ----------------------------------------------------------------------------
-- Step 5: Add index `idx_orders_review_reminder` on `orders` (universal check)
-- ----------------------------------------------------------------------------
SET @idx_orders_reminder = (
  SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema = DATABASE() AND table_name = 'orders' AND index_name = 'idx_orders_review_reminder'
);

SET @add_idx_orders_cmd = IF(
  @idx_orders_reminder = 0,
  'CREATE INDEX `idx_orders_review_reminder` ON `orders` (`review_reminder_sent_at`)',
  'DO 0'
);

PREPARE stmt_orders_idx FROM @add_idx_orders_cmd;
EXECUTE stmt_orders_idx;
DEALLOCATE PREPARE stmt_orders_idx;

-- ----------------------------------------------------------------------------
-- Step 6: Add `users.marketing_emails_opt_out` column (universal check)
-- ----------------------------------------------------------------------------
SET @col_users_optout = (
  SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'marketing_emails_opt_out'
);

SET @add_col_users_cmd = IF(
  @col_users_optout = 0,
  'ALTER TABLE `users` ADD COLUMN `marketing_emails_opt_out` TINYINT(1) NOT NULL DEFAULT 0',
  'DO 0'
);

PREPARE stmt_users_col FROM @add_col_users_cmd;
EXECUTE stmt_users_col;
DEALLOCATE PREPARE stmt_users_col;
