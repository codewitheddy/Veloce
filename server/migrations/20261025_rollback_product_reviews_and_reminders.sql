-- ============================================================================
-- Rollback Migration: Revert Product Reviews & Order Items Changes
-- Date: 2026-10-25
-- Target: MySQL 5.7+ / MySQL 8.0+ / MariaDB 10.3+ (InnoDB, utf8mb4)
-- ============================================================================
-- ⚠️ WARNING: 
-- Running this rollback script PERMANENTLY DELETES any new customer reviews 
-- and review reminder timestamps created after the migration was applied!
-- Existing orders, receipts, items JSON, and legacy reviews backup remain safe.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Step 1: Drop new reviews and order_items relational tables
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `reviews`;
DROP TABLE IF EXISTS `order_items`;

-- ----------------------------------------------------------------------------
-- Step 2: Restore legacy `reviews` table from `reviews_legacy_backup` if present
-- ----------------------------------------------------------------------------
SET @tbl_legacy_backup = (
  SELECT COUNT(*) FROM information_schema.tables 
  WHERE table_schema = DATABASE() AND table_name = 'reviews_legacy_backup'
);

SET @restore_legacy_cmd = IF(
  @tbl_legacy_backup > 0,
  'RENAME TABLE `reviews_legacy_backup` TO `reviews`',
  'DO 0'
);

PREPARE stmt_restore_legacy FROM @restore_legacy_cmd;
EXECUTE stmt_restore_legacy;
DEALLOCATE PREPARE stmt_restore_legacy;

-- ----------------------------------------------------------------------------
-- Step 3: Remove `idx_orders_review_reminder` index if it exists
-- ----------------------------------------------------------------------------
SET @idx_orders_reminder = (
  SELECT COUNT(*) FROM information_schema.statistics 
  WHERE table_schema = DATABASE() AND table_name = 'orders' AND index_name = 'idx_orders_review_reminder'
);

SET @drop_idx_orders_cmd = IF(
  @idx_orders_reminder > 0,
  'ALTER TABLE `orders` DROP INDEX `idx_orders_review_reminder`',
  'DO 0'
);

PREPARE stmt_orders_drop_idx FROM @drop_idx_orders_cmd;
EXECUTE stmt_orders_drop_idx;
DEALLOCATE PREPARE stmt_orders_drop_idx;

-- ----------------------------------------------------------------------------
-- Step 4: Remove `review_reminder_sent_at` column from `orders` if it exists
-- ----------------------------------------------------------------------------
SET @col_orders_reminder = (
  SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'review_reminder_sent_at'
);

SET @drop_col_orders_cmd = IF(
  @col_orders_reminder > 0,
  'ALTER TABLE `orders` DROP COLUMN `review_reminder_sent_at`',
  'DO 0'
);

PREPARE stmt_orders_drop_col FROM @drop_col_orders_cmd;
EXECUTE stmt_orders_drop_col;
DEALLOCATE PREPARE stmt_orders_drop_col;

-- ----------------------------------------------------------------------------
-- Step 5: Remove `marketing_emails_opt_out` column from `users` if it exists
-- ----------------------------------------------------------------------------
SET @col_users_optout = (
  SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'marketing_emails_opt_out'
);

SET @drop_col_users_cmd = IF(
  @col_users_optout > 0,
  'ALTER TABLE `users` DROP COLUMN `marketing_emails_opt_out`',
  'DO 0'
);

PREPARE stmt_users_drop_col FROM @drop_col_users_cmd;
EXECUTE stmt_users_drop_col;
DEALLOCATE PREPARE stmt_users_drop_col;
