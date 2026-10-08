/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error('[Unhandled Server Error]:', err);

  const statusCode = typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600
    ? err.statusCode
    : 500;

  const response: { success: boolean; error: string; code?: string } = {
    success: false,
    error: err.expose || process.env.NODE_ENV !== 'production'
      ? (err.message || 'Internal server error.')
      : 'An unexpected internal server error occurred.',
    code: err.code || 'INTERNAL_ERROR',
  };

  res.status(statusCode).json(response);
}
