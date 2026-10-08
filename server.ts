/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Top-Level Server Entrypoint
 * Delegating directly to the modular server architecture in `server/index.ts`.
 */

import app, { startServer } from './server/index';

export { startServer, app };
export default app;
