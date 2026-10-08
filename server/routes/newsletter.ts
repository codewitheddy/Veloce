/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sendEmail } from '../email/transporter';
import { getEmailConfig } from '../email/config';
import { requireAdmin } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimit';

const router = Router();

let newsletterSubscribersStore: Array<{
  id: string;
  email: string;
  source: string;
  status: 'active' | 'unsubscribed';
  subscribed_at: string;
  preferences?: {
    new_arrivals: boolean;
    promotions: boolean;
    exclusive_events: boolean;
  };
}> = [
  {
    id: 'sub-seed-1',
    email: 'concierge.client@example.com',
    source: 'storefront_footer',
    status: 'active',
    subscribed_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    preferences: {
      new_arrivals: true,
      promotions: true,
      exclusive_events: true,
    }
  }
];

const newsletterRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many newsletter subscription attempts. Please try again later.'
});

const contactRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many inquiries sent from your network. Please wait a bit before sending another message.'
});

// 1. Subscribe to Newsletter (Public)
router.post('/subscribe', newsletterRateLimiter, (req: Request, res: Response) => {
  try {
    const { email, source, preferences } = req.body || {};
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ success: false, error: 'A valid email address is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = newsletterSubscribersStore.find(s => s.email === normalizedEmail);

    if (existing) {
      if (existing.status === 'unsubscribed') {
        existing.status = 'active';
        existing.subscribed_at = new Date().toISOString();
        return res.json({ success: true, message: 'Welcome back! Your newsletter subscription has been reactivated.' });
      }
      return res.json({ success: true, message: 'You are already subscribed to the Ropenix newsletter!' });
    }

    const newSub = {
      id: `sub-${Date.now()}`,
      email: normalizedEmail,
      source: source || 'storefront_modal',
      status: 'active' as const,
      subscribed_at: new Date().toISOString(),
      preferences: preferences || {
        new_arrivals: true,
        promotions: true,
        exclusive_events: true,
      }
    };

    newsletterSubscribersStore.unshift(newSub);
    res.status(201).json({ success: true, message: 'Thank you for subscribing to Ropenix Collections.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to process newsletter subscription.';
    res.status(500).json({ success: false, error: message });
  }
});

// 2. Admin Newsletter Subscribers List (Admin Only)
router.get('/subscribers', requireAdmin, (_req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      count: newsletterSubscribersStore.length,
      activeCount: newsletterSubscribersStore.filter(s => s.status === 'active').length,
      subscribers: newsletterSubscribersStore
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve subscriber roster.';
    res.status(500).json({ success: false, error: message });
  }
});

// 3. Contact Form & Inquiries Endpoint (Public)
export const handleContactForm = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, subject, message } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, error: 'Name, email, and message are required.' });
    }

    try {
      const config = getEmailConfig();
      await sendEmail({
        to: config.admin.email,
        replyTo: email,
        subject: `[Contact Form] ${subject || 'General Inquiry'} from ${name}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px; margin: 0 auto; background: #ffffff;">
            <div style="border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 20px;">
              <h3 style="color: #0f172a; margin: 0; font-size: 18px;">📩 New Customer Inquiry</h3>
              <p style="color: #64748b; font-size: 12px; margin: 4px 0 0 0;">Received via Storefront Contact Form</p>
            </div>
            <table style="width: 100%; font-size: 13px; border-collapse: collapse; margin-bottom: 20px;">
              <tr><td style="padding: 6px 0; color: #64748b; width: 30%;"><strong>Sender Name:</strong></td><td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${name}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748b;"><strong>Email:</strong></td><td style="padding: 6px 0; color: #0f172a;"><a href="mailto:${email}" style="color: #4f46e5;">${email}</a></td></tr>
              <tr><td style="padding: 6px 0; color: #64748b;"><strong>Phone:</strong></td><td style="padding: 6px 0; color: #0f172a;">${phone || 'N/A'}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748b;"><strong>Subject:</strong></td><td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${subject || 'General Inquiry'}</td></tr>
            </table>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <strong style="color: #475569; font-size: 12px; text-transform: uppercase; display: block; margin-bottom: 6px;">Message Content:</strong>
              <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #1e293b; white-space: pre-wrap;">${message}</p>
            </div>
          </div>
        `,
        text: `Contact Name: ${name}\nEmail: ${email}\nPhone: ${phone || 'N/A'}\nSubject: ${subject || 'General Inquiry'}\n\nMessage:\n${message}`,
      });
    } catch (mailErr: unknown) {
      const mailMsg = mailErr instanceof Error ? mailErr.message : String(mailErr);
      console.warn('[Contact Desk] SMTP notification skipped:', mailMsg);
    }

    res.json({
      success: true,
      message: 'Thank you for reaching out! Our team has received your message and will respond promptly.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to process contact message.';
    res.status(500).json({ success: false, error: message });
  }
};

export default router;
