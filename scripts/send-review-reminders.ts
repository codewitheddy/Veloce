/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Standalone Review Reminder Cron Script (TypeScript)
 * 
 * Run via:
 *   npx tsx scripts/send-review-reminders.ts
 * Options:
 *   --days <number>       (default: 7)
 *   --batch-size <number> (default: 25)
 *   --delay-ms <number>   (default: 1500)
 *   --dry-run             (print candidates without writing/sending)
 */

import { processReviewReminders } from '../server/services/reviewReminderService';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const daysIdx = args.indexOf('--days');
const days = daysIdx !== -1 ? parseInt(args[daysIdx + 1], 10) : undefined;
const batchIdx = args.indexOf('--batch-size');
const batchSize = batchIdx !== -1 ? parseInt(args[batchIdx + 1], 10) : undefined;
const delayIdx = args.indexOf('--delay-ms');
const delayMs = delayIdx !== -1 ? parseInt(args[delayIdx + 1], 10) : undefined;

processReviewReminders({ days, batchSize, delayMs, dryRun })
  .then((stats) => {
    console.log('[Cron Finished] Review reminders runner terminated normally.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Cron Error] Review reminders runner encountered fatal error:', err);
    process.exit(1);
  });
