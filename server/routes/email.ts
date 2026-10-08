/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import emailPreferencesRouter from './emailPreferences';
import emailDiagnosticsRouter from './emailDiagnostics';

const emailRouter = Router();

emailRouter.use('/', emailPreferencesRouter);
emailRouter.use('/admin', emailDiagnosticsRouter);

export { emailPreferencesRouter, emailDiagnosticsRouter };
export default emailRouter;
