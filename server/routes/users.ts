/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { getSqliteUserById, saveSqliteUser, getSqliteUserByEmail } from '../../src/lib/sqlite-db';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /api/users/me (Authenticated)
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const authUser = req.user!;
  const user = (await getSqliteUserById(authUser.id)) || (await getSqliteUserByEmail(authUser.email));
  if (!user) {
    return res.status(404).json({ success: false, error: 'User profile not found.' });
  }

  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    phone: user.phone || '',
    is_staff: Boolean(user.is_staff),
    is_superuser: Boolean(user.is_superuser),
    email_verified: Boolean(user.email_verified),
    role: user.is_superuser || user.is_staff ? 'admin' : 'customer',
    profile: {
      phone_number: user.phone || '',
      avatar_url: '',
    }
  });
});

// PUT /api/users/me (Authenticated)
router.put('/me', requireAuth, async (req: Request, res: Response) => {
  const authUser = req.user!;
  const user = (await getSqliteUserById(authUser.id)) || (await getSqliteUserByEmail(authUser.email));
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }

  const updatedUser = {
    ...user,
    first_name: req.body.first_name !== undefined ? req.body.first_name : user.first_name,
    last_name: req.body.last_name !== undefined ? req.body.last_name : user.last_name,
    phone: req.body.phone || req.body.phone_number || user.phone,
  };

  await saveSqliteUser(updatedUser);

  res.json({
    success: true,
    message: 'Profile updated successfully.',
    user: {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      first_name: updatedUser.first_name || '',
      last_name: updatedUser.last_name || '',
      phone: updatedUser.phone || '',
      is_staff: Boolean(updatedUser.is_staff),
      is_superuser: Boolean(updatedUser.is_superuser),
      email_verified: Boolean(updatedUser.email_verified),
      role: updatedUser.is_superuser || updatedUser.is_staff ? 'admin' : 'customer',
    }
  });
});

export default router;
