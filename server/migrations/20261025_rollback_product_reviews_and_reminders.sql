-- ============================================================================
-- Rollback: Revert Product Reviews System and Order Items Relational Bridge
-- Date: 2026-10-25
-- Target: MySQL / MariaDB (InnoDB, utf8mb4)
-- Description:
--   1. Drops reviews table.
--   2. Drops order_items table.
--   3. Recreates the legacy reviews table structure.
--   4. Removes review_reminder_sent_at from orders table.
--   5. Removes marketing_emails_opt_out from users table.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Step 1: Drop foreign-key dependent tables
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `reviews`;
DROP TABLE IF EXISTS `order_items`;

-- ----------------------------------------------------------------------------
-- Step 2: Recreate legacy reviews table structure
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `reviews` (
  `id` VARCHAR(255) PRIMARY KEY,
  `productId` VARCHAR(255) NOT NULL,
  `userName` VARCHAR(255) NOT NULL,
  `userEmail` VARCHAR(255) NULL,
  `rating` INT NOT NULL,
  `comment` TEXT NOT NULL,
  `verified` TINYINT(1) DEFAULT 1,
  `status` VARCHAR(50) DEFAULT 'approved',
  `helpfulCount` INT DEFAULT 0,
  `date` VARCHAR(100) NOT NULL,
  `reply` TEXT NULL,
  `created_at` VARCHAR(100) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Step 3: Remove added columns and indexes from existing tables
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS `idx_orders_review_reminder` ON `orders`;
ALTER TABLE `orders` DROP COLUMN IF EXISTS `review_reminder_sent_at`;
ALTER TABLE `users` DROP COLUMN IF EXISTS `marketing_emails_opt_out`;
