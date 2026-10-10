/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Compatibility Bridge: PostgreSQL -> MySQL Migration
 * All PostgreSQL operations are now transparently backed by the unified MySQL database.
 */

import { getDbPool, getDbStatus, initializeDatabaseSchema } from './mysql-db';

export function isPostgresConfigured(): boolean {
  return false;
}

export function getPostgresPool(): any {
  return null;
}

export async function initPostgresTables(): Promise<void> {
  // Managed by MySQL engine
}

export async function getPostgresDbStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  dbEngine: string;
  message: string;
  tables?: Record<string, number>;
}> {
  const status = await getDbStatus();
  return {
    configured: status.configured,
    connected: status.connected,
    dbEngine: 'MySQL',
    message: status.message,
    tables: status.stats,
  };
}

export * from './mysql-db';
