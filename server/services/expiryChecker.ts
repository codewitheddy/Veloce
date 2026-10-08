/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getAllSqliteUsers, pullSyncDataSqlite } from '../../src/lib/sqlite-db';
import { sendEmail } from '../email/transporter';
import { getEmailConfig } from '../email/config';

interface ExpiryCheckResult {
  totalChecked: number;
  nearExpiryCount: number;
  newlyFlaggedCount: number;
  emailDispatched: boolean;
  nearExpiryProducts: any[];
}

const notifiedStore: Record<string, { lastNotifiedAt: string; expiryDate: string }> = {};

export async function performExpiryBackgroundCheck(isManualTrigger: boolean = false): Promise<ExpiryCheckResult> {
  console.log(`[Expiry Check] Initializing background inventory scan... (Manual: ${isManualTrigger})`);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sqliteData = await pullSyncDataSqlite();
  const products = sqliteData?.veloce_products || [];

  const newlyFlaggedProducts: any[] = [];
  const nearExpiryProductsList: any[] = [];

  for (const product of products) {
    const hasExpiry = Boolean(product.hasExpiryDate || product.has_expiry_date);
    const expiryDateStr = product.expiryDate || product.expiry_date;

    if (!hasExpiry || !expiryDateStr) continue;

    const expiry = new Date(expiryDateStr);
    if (isNaN(expiry.getTime())) continue;
    expiry.setHours(0, 0, 0, 0);

    const diffMs = expiry.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    // Check if within the 8-day expiry window
    if (daysRemaining <= 8) {
      nearExpiryProductsList.push({
        ...product,
        calculatedDaysRemaining: daysRemaining,
      });

      const existingRecord = notifiedStore[product.id];
      const alreadyNotified = existingRecord && existingRecord.expiryDate === expiryDateStr;

      if (!alreadyNotified) {
        newlyFlaggedProducts.push({
          ...product,
          calculatedDaysRemaining: daysRemaining,
        });
      }
    }
  }

  let emailDispatched = false;

  if (newlyFlaggedProducts.length > 0) {
    const adminEmailsSet = new Set<string>();

    try {
      const users = await getAllSqliteUsers();
      users.forEach((u) => {
        if ((u.is_staff || u.is_superuser) && u.email && u.email.includes('@')) {
          adminEmailsSet.add(u.email.toLowerCase().trim());
        }
      });
    } catch (_) {}

    const config = getEmailConfig();
    if (config.admin.email) {
      adminEmailsSet.add(config.admin.email.toLowerCase().trim());
    }

    const adminRecipients = Array.from(adminEmailsSet);

    if (adminRecipients.length > 0) {
      const rowsHtml = newlyFlaggedProducts
        .map((p) => {
          const daysText = p.calculatedDaysRemaining <= 0
            ? `<span style="background-color: #ffe4e6; color: #9f1239; font-weight: bold; padding: 3px 8px; border-radius: 4px; font-size: 11px;">EXPIRED (${Math.abs(p.calculatedDaysRemaining)}d ago)</span>`
            : `<span style="background-color: #fef3c7; color: #92400e; font-weight: bold; padding: 3px 8px; border-radius: 4px; font-size: 11px;">${p.calculatedDaysRemaining} days left</span>`;

          return `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 8px; font-size: 13px; color: #0f172a; font-weight: 600;">${p.name || p.title}</td>
              <td style="padding: 10px 8px; font-size: 12px; color: #64748b; font-family: monospace;">${p.sku || 'N/A'}</td>
              <td style="padding: 10px 8px; font-size: 12px; color: #0f172a; font-weight: 600;">${p.stock ?? 0} units</td>
              <td style="padding: 10px 8px; font-size: 12px; color: #475569;">${p.expiryDate || p.expiry_date}</td>
              <td style="padding: 10px 8px;">${daysText}</td>
            </tr>
          `;
        })
        .join('');

      try {
        await sendEmail({
          to: adminRecipients[0],
          subject: `⚠️ Urgent: ${newlyFlaggedProducts.length} Product(s) Nearing Expiration - Ropenix Inventory Alert`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 650px; margin: 0 auto; background: #ffffff;">
              <div style="border-bottom: 2px solid #e11d48; padding-bottom: 12px; margin-bottom: 20px;">
                <h3 style="color: #9f1239; margin: 0; font-size: 18px;">⚠️ Expiry Warning: Near-Expiry Inventory Detected</h3>
                <p style="color: #64748b; font-size: 12px; margin: 4px 0 0 0;">Automated Daily Inventory Quality Scanner</p>
              </div>
              <p style="font-size: 13px; color: #334155; line-height: 1.6;">
                The following <strong>${newlyFlaggedProducts.length} product(s)</strong> in your catalog have expired or are reaching their expiration date within the next 8 days:
              </p>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <thead>
                  <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b;">
                    <th style="padding: 8px;">Product</th>
                    <th style="padding: 8px;">SKU</th>
                    <th style="padding: 8px;">Stock</th>
                    <th style="padding: 8px;">Expiry Date</th>
                    <th style="padding: 8px;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
              <div style="background-color: #f1f5f9; padding: 12px; border-radius: 8px; font-size: 12px; color: #475569; margin-top: 20px;">
                Please review batch stock quantities, apply discounts or quarantine affected inventory units from storefront availability.
              </div>
            </div>
          `,
          text: `Urgent: ${newlyFlaggedProducts.length} product(s) nearing expiration.\n\nCheck inventory in the Ropenix admin dashboard.`,
        });
        emailDispatched = true;

        newlyFlaggedProducts.forEach((p) => {
          notifiedStore[p.id] = {
            lastNotifiedAt: new Date().toISOString(),
            expiryDate: p.expiryDate || p.expiry_date,
          };
        });
      } catch (mailErr) {
        console.warn('[Expiry Check] Email notification dispatch warning:', mailErr);
      }
    }
  }

  return {
    totalChecked: products.length,
    nearExpiryCount: nearExpiryProductsList.length,
    newlyFlaggedCount: newlyFlaggedProducts.length,
    emailDispatched,
    nearExpiryProducts: nearExpiryProductsList,
  };
}
