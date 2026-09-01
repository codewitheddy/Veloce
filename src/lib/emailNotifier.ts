import { emailService } from '../services/api';
import { Order, Product, ReturnRequest } from '../types';
import { EmailNotification } from '../components/EmailToaster';
import { isReviewRequestOptedOut } from './reviewRequestScheduler';

const ADMIN_EMAIL = 'ropenixkenya@gmail.com';

export function createEmailId(): string {
  return 'email-' + Math.random().toString(36).substring(2, 9);
}

export function getCurrentTimestamp(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function dispatchRealEmail(to: string, subject: string, bodyText: string, category: string, isPromotional = false) {
  const cleanTo = (to || '').trim();
  if (!cleanTo || !cleanTo.includes('@') || cleanTo.includes('example.com')) return;

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
        .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .header { background: #0f172a; padding: 24px; text-align: center; border-bottom: 3px solid #4f46e5; }
        .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 1px; }
        .header p { color: #94a3b8; margin: 4px 0 0 0; font-size: 12px; text-transform: uppercase; font-weight: 600; }
        .body { padding: 32px 28px; line-height: 1.65; font-size: 14px; color: #334155; white-space: pre-wrap; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #f1f5f9; font-size: 11px; color: #64748b; }
        .footer a { color: #4f46e5; text-decoration: none; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>VELOCE MARKETPLACE</h1>
          <p>${category}</p>
        </div>
        <div class="body">${bodyText}</div>
        <div class="footer">
          <p style="margin:0 0 6px 0;"><strong>Veloce Hub Kenya</strong> • Powered by Ropenix Investments Limited</p>
          <p style="margin:0;">Support: <a href="mailto:support@marid.co.ke">support@marid.co.ke</a> | Hotline: +254 700 000 000</p>
        </div>
      </div>
    </body>
    </html>
  `;

  emailService.sendEmail({
    to: cleanTo,
    subject,
    text: bodyText,
    html: htmlBody,
    category,
    isPromotional,
  }).then((res) => {
    console.log(`[Email Dispatch Success] Transmitted "${subject}" to ${cleanTo}`, res);
  }).catch((err) => {
    console.warn(`[Email Dispatch Error] Failed sending "${subject}" to ${cleanTo}:`, err);
  });
}

// ==========================================
// CUSTOMER-FACING EMAIL TRIGGERS
// ==========================================

// 1. Order Confirmation (right after checkout)
export function buildOrderConfirmationEmail(order: Order): EmailNotification {
  const orderIdUpper = order.id.slice(0, 8).toUpperCase();
  const customer = order.customerName || 'Customer';
  const customerEmail = order.customerEmail || 'customer@example.com';
  const itemsList = order.items.map(i => `• ${i.name} (x${i.quantity}) - KSh ${i.price.toLocaleString('en-KE')}`).join('\n');
  
  const subject = `🛒 Order Confirmation: VL-${orderIdUpper}`;
  const body = `Hi ${customer},\n\nThank you for shopping with Veloce Hub! Your order VL-${orderIdUpper} has been successfully placed on ${order.date}.\n\nItems Ordered:\n${itemsList}\n\nTotal Paid: KSh ${order.total.toLocaleString('en-KE')}\nPayment Method: ${order.paymentMethod || 'Credit Card / M-Pesa'}\nShipping Address: ${order.shippingAddress || 'Default Address'}\n\nWe will notify you as soon as your package enters fulfillment.\n\nWarm regards,\nThe Veloce Hub Team`;

  dispatchRealEmail(customerEmail, subject, body, 'Order Confirmation');

  return {
    id: createEmailId(),
    orderId: order.id,
    customerName: customer,
    customerEmail,
    subject,
    body,
    status: 'pending',
    timestamp: getCurrentTimestamp(),
    recipientType: 'customer',
    category: 'Order Confirmation'
  };
}

// 2. Payment Received / Failed
export function buildPaymentNotificationEmail(order: Order, isSuccess: boolean, reason?: string): EmailNotification {
  const orderIdUpper = order.id.slice(0, 8).toUpperCase();
  const customer = order.customerName || 'Customer';
  const customerEmail = order.customerEmail || 'customer@example.com';
  
  let subject = '';
  let body = '';
  
  if (isSuccess) {
    subject = `💳 Payment Received for Order VL-${orderIdUpper}`;
    body = `Hi ${customer},\n\nWe have received your payment of KSh ${order.total.toLocaleString('en-KE')} for Order VL-${orderIdUpper} via ${order.paymentMethod || 'M-Pesa/Card'}.\n\nYour transaction has been verified and your order is moving into warehouse sorting.\n\nThank you for choosing Veloce Hub!`;
  } else {
    subject = `⚠️ Payment Failed for Order VL-${orderIdUpper}`;
    body = `Hi ${customer},\n\nWe were unable to process payment for your order VL-${orderIdUpper}.\n\nReason: ${reason || 'Transaction declined or session timed out.'}\n\nPlease revisit your checkout portal or contact support to select an alternate payment method.\n\nBest regards,\nThe Veloce Billing Desk`;
  }

  dispatchRealEmail(customerEmail, subject, body, isSuccess ? 'Payment Received' : 'Payment Failed');

  return {
    id: createEmailId(),
    orderId: order.id,
    customerName: customer,
    customerEmail,
    subject,
    body,
    status: isSuccess ? 'completed' : 'cancelled',
    timestamp: getCurrentTimestamp(),
    recipientType: 'customer',
    category: isSuccess ? 'Payment Received' : 'Payment Failed'
  };
}

// 3. Shipping Confirmation with Tracking
export function buildShippingConfirmationEmail(order: Order, trackingNumber?: string, carrier = 'Veloce Logistics / Fargo Courier'): EmailNotification {
  const orderIdUpper = order.id.slice(0, 8).toUpperCase();
  const customer = order.customerName || 'Customer';
  const customerEmail = order.customerEmail || 'customer@example.com';
  const tracking = trackingNumber || `VL-TRACK-${Math.floor(100000 + Math.random() * 900000)}`;

  const subject = `🚚 Shipping Confirmation: Order VL-${orderIdUpper} is En Route!`;
  const body = `Hi ${customer},\n\nGreat news! Order VL-${orderIdUpper} has been packaged and handed over to our courier partner (${carrier}).\n\nTracking Number: ${tracking}\nEstimated Delivery Window: 1-2 Business Days\nDestination: ${order.shippingAddress || 'Nairobi, Kenya'}\n\nYou can track your shipment status anytime inside your Veloce Account Portal.\n\nWarm regards,\nThe Veloce Shipping Team`;

  dispatchRealEmail(customerEmail, subject, body, 'Shipping Confirmation');

  return {
    id: createEmailId(),
    orderId: order.id,
    customerName: customer,
    customerEmail,
    subject,
    body,
    status: 'shipped',
    timestamp: getCurrentTimestamp(),
    recipientType: 'customer',
    category: 'Shipping Notice'
  };
}

// 4. Delivery Confirmation
export function buildDeliveryConfirmationEmail(order: Order): EmailNotification {
  const orderIdUpper = order.id.slice(0, 8).toUpperCase();
  const customer = order.customerName || 'Customer';
  const customerEmail = order.customerEmail || 'customer@example.com';

  const subject = `🎉 Order VL-${orderIdUpper} DELIVERED!`;
  const body = `Hi ${customer},\n\nYour order VL-${orderIdUpper} has been marked as DELIVERED by our dispatch driver.\n\nWe hope you love your new products!\n\n⭐ Help Us Improve: Please take 60 seconds to submit a product review in your account dashboard to share your feedback with the Veloce community.\n\nThank you for shopping with Veloce Hub!`;

  dispatchRealEmail(customerEmail, subject, body, 'Delivery Confirmation');

  return {
    id: createEmailId(),
    orderId: order.id,
    customerName: customer,
    customerEmail,
    subject,
    body,
    status: 'delivered',
    timestamp: getCurrentTimestamp(),
    recipientType: 'customer',
    category: 'Delivery Notice'
  };
}

// 5. Refund / Cancellation Notice
export function buildRefundCancellationNoticeEmail(customerName: string, customerEmail: string, orderId: string, status: string, note?: string): EmailNotification {
  const orderIdUpper = orderId.slice(0, 8).toUpperCase();

  const subject = `ℹ️ Refund / Cancellation Notice: Order VL-${orderIdUpper}`;
  const body = `Hi ${customerName},\n\nThis notice is regarding Order VL-${orderIdUpper}.\n\nStatus Update: ${status.toUpperCase()}\n${note ? `Details / Reason: "${note}"\n` : ''}\nIf a refund was authorized, funds will be returned to your original payment account within 3-5 business days.\n\nIf you have any questions, please reply to this email or reach our support team.\n\nBest regards,\nVeloce Customer Support`;

  dispatchRealEmail(customerEmail, subject, body, 'Refund / Cancellation');

  return {
    id: createEmailId(),
    orderId,
    customerName,
    customerEmail,
    subject,
    body,
    status: 'cancelled',
    timestamp: getCurrentTimestamp(),
    recipientType: 'customer',
    category: 'Refund / Cancel'
  };
}

// 6. Password Reset & Account Verification
export function buildPasswordResetEmail(customerEmail: string, code: string): EmailNotification {
  const subject = `🔐 Password Reset Authorization Code - Veloce`;
  const body = `Hi there,\n\nWe received a request to reset the password for your Veloce account (${customerEmail}).\n\nYour Verification Code: ${code}\n\nThis code expires in 15 minutes. If you did not initiate this request, you can safely disregard this message.\n\nStay secure,\nThe Veloce Security Desk`;

  dispatchRealEmail(customerEmail, subject, body, 'Password Reset');

  return {
    id: createEmailId(),
    orderId: 'auth-reset',
    customerName: 'Account Owner',
    customerEmail,
    subject,
    body,
    status: 'processing',
    timestamp: getCurrentTimestamp(),
    recipientType: 'customer',
    category: 'Password Reset'
  };
}

export function buildAccountVerificationEmail(customerName: string, customerEmail: string): EmailNotification {
  const subject = `✨ Welcome to Veloce - Account Verified`;
  const body = `Hi ${customerName},\n\nWelcome to Veloce Hub! Your account (${customerEmail}) has been successfully created and verified.\n\nYou now have full access to fast checkout, wishlist sync, order tracking, and exclusive discounts.\n\nHappy shopping!\nThe Veloce Team`;

  dispatchRealEmail(customerEmail, subject, body, 'Account Verified');

  return {
    id: createEmailId(),
    orderId: 'auth-verify',
    customerName,
    customerEmail,
    subject,
    body,
    status: 'completed',
    timestamp: getCurrentTimestamp(),
    recipientType: 'customer',
    category: 'Account Verification'
  };
}

// 7. Abandoned Cart Reminder
export function buildAbandonedCartEmail(customerName: string, customerEmail: string, itemsCount: number, cartTotal: number): EmailNotification {
  const subject = `🛒 You left ${itemsCount} item${itemsCount > 1 ? 's' : ''} in your Veloce cart!`;
  const body = `Hi ${customerName},\n\nWe noticed you left some amazing items in your shopping cart valued at KSh ${cartTotal.toLocaleString('en-KE')}.\n\nItems in high demand sell out quickly! Revisit your cart now to complete your checkout and claim fast delivery.\n\nBest regards,\nThe Veloce Merchandising Team`;

  dispatchRealEmail(customerEmail, subject, body, 'Abandoned Cart', true);

  return {
    id: createEmailId(),
    orderId: 'cart-reminder',
    customerName,
    customerEmail,
    subject,
    body,
    status: 'pending',
    timestamp: getCurrentTimestamp(),
    recipientType: 'customer',
    category: 'Abandoned Cart'
  };
}

// 8. Review Request (post-delivery)
export function buildReviewRequestEmail(customerName: string, customerEmail: string, orderId: string, productName?: string): EmailNotification {
  const orderIdUpper = orderId.slice(0, 8).toUpperCase();
  const subject = `⭐ How was your purchase? Leave a review for Order VL-${orderIdUpper}`;
  const body = `Hi ${customerName},\n\nThank you for your recent purchase from Veloce Hub (${productName ? `Item: ${productName}` : `Order VL-${orderIdUpper}`}).\n\nYour opinion matters! Please take a quick moment to rate your items and leave feedback. Your reviews help other buyers make informed choices and earn you loyalty points.\n\nBest regards,\nThe Veloce Quality Team`;

  dispatchRealEmail(customerEmail, subject, body, 'Review Request');

  return {
    id: createEmailId(),
    orderId,
    customerName,
    customerEmail,
    subject,
    body,
    status: 'completed',
    timestamp: getCurrentTimestamp(),
    recipientType: 'customer',
    category: 'Review Request'
  };
}


// ==========================================
// OWNER / ADMIN-FACING EMAIL TRIGGERS
// ==========================================

// 1. New Order Placed (Admin Notification for Fulfillment)
export function buildAdminNewOrderEmail(order: Order): EmailNotification {
  const orderIdUpper = order.id.slice(0, 8).toUpperCase();
  const customer = order.customerName || 'Customer';
  const customerEmail = order.customerEmail || 'customer@example.com';
  const totalStr = `KSh ${order.total.toLocaleString('en-KE')}`;
  
  const subject = `🔔 [ADMIN ALERT] New Order VL-${orderIdUpper} Placed (${totalStr})`;
  const body = `ATTENTION ADMIN / FULFILLMENT TEAM:\n\nA new sale has been placed on Veloce Hub and requires fulfillment.\n\nOrder ID: VL-${orderIdUpper}\nCustomer: ${customer} (${customerEmail})\nTotal Amount: ${totalStr}\nPayment Method: ${order.paymentMethod || 'M-Pesa / Card'}\nShipping Address: ${order.shippingAddress || 'N/A'}\nItems Count: ${order.items.length}\n\nPlease access the Admin Dashboard -> Orders Management to review details and begin picking & packing.`;

  dispatchRealEmail(ADMIN_EMAIL, subject, body, 'Admin: New Order');

  return {
    id: createEmailId(),
    orderId: order.id,
    customerName: 'Admin Fulfillment Team',
    customerEmail: ADMIN_EMAIL,
    subject,
    body,
    status: 'pending',
    timestamp: getCurrentTimestamp(),
    recipientType: 'admin',
    category: 'New Order Alert'
  };
}

// 2. Low Stock / Out-of-Stock Alert
export function buildAdminLowStockEmail(product: Product, currentStock: number, threshold: number): EmailNotification {
  const isZero = currentStock <= 0;
  const subject = `⚠️ [ADMIN ALERT] ${isZero ? 'OUT OF STOCK' : 'Low Stock Warning'} for [${product.sku || 'SKU'}] ${product.name}`;
  const body = `INVENTORY ALERT:\n\nProduct: ${product.name}\nSKU: ${product.sku || 'N/A'}\nCategory: ${product.category}\n\nCurrent Stock: ${currentStock} units\nReorder Threshold: ${threshold} units\nStatus: ${isZero ? 'CRITICAL - OUT OF STOCK' : 'BELOW SAFETY LIMIT'}\n\nPlease issue a purchase order or restock this item in the Admin Inventory Panel immediately to avoid missed sales.`;

  dispatchRealEmail(ADMIN_EMAIL, subject, body, 'Admin: Low Stock');

  return {
    id: createEmailId(),
    orderId: `low-stock-${product.id}`,
    customerName: 'Inventory Controller',
    customerEmail: ADMIN_EMAIL,
    subject,
    body,
    status: 'low-stock',
    timestamp: getCurrentTimestamp(),
    recipientType: 'admin',
    category: 'Low Stock Alert'
  };
}

// 3. Failed Payment or Fraud-Flag Alert
export function buildAdminPaymentFraudAlertEmail(orderId: string, customerName: string, amount: number, reason: string): EmailNotification {
  const orderIdUpper = orderId.slice(0, 8).toUpperCase();
  const subject = `🚨 [ADMIN ALERT] Payment Failed / Security Flag on Order VL-${orderIdUpper}`;
  const body = `SECURITY & BILLING NOTICE:\n\nA payment failure or potential risk flag occurred on Order VL-${orderIdUpper}.\n\nCustomer: ${customerName}\nAttempted Amount: KSh ${amount.toLocaleString('en-KE')}\nReason / Flag: ${reason}\n\nPlease check the financial logs and hold shipment until payment verification is completed.`;

  dispatchRealEmail(ADMIN_EMAIL, subject, body, 'Admin: Payment Risk');

  return {
    id: createEmailId(),
    orderId,
    customerName: 'Fraud & Risk Team',
    customerEmail: ADMIN_EMAIL,
    subject,
    body,
    status: 'cancelled',
    timestamp: getCurrentTimestamp(),
    recipientType: 'admin',
    category: 'Payment Risk Alert'
  };
}

// 4. New Custom Service Request (Workspace / Custom Clothing inquiry)
export function buildAdminCustomServiceRequestEmail(customerName: string, customerEmail: string, requestType: string, details: string): EmailNotification {
  const subject = `📩 [ADMIN ALERT] New Custom Service Request: ${requestType} from ${customerName}`;
  const body = `NEW INQUIRY SUBMITTED:\n\nType: ${requestType}\nFrom: ${customerName} (${customerEmail})\n\nMessage / Requirements:\n"${details}"\n\nPlease log into the Admin Portal -> Customer Inquiries / Custom Requests to review specs and reply to the client.`;

  dispatchRealEmail(ADMIN_EMAIL, subject, body, 'Admin: Custom Request');

  return {
    id: createEmailId(),
    orderId: 'custom-req-' + Date.now().toString().slice(-4),
    customerName: 'Commercial Services Desk',
    customerEmail: ADMIN_EMAIL,
    subject,
    body,
    status: 'processing',
    timestamp: getCurrentTimestamp(),
    recipientType: 'admin',
    category: 'Custom Service Alert'
  };
}

// 5. New Review Submitted (for Moderation)
export function buildAdminNewReviewEmail(productName: string, reviewerName: string, rating: number, comment: string): EmailNotification {
  const subject = `⭐ [ADMIN ALERT] New Review Submitted for ${productName} (${rating}/5 Stars)`;
  const body = `MODERATION NOTICE:\n\nA new customer review has been submitted on Veloce Hub.\n\nProduct: ${productName}\nReviewer: ${reviewerName}\nRating: ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} (${rating}/5)\n\nComment:\n"${comment}"\n\nPlease review this entry in the Product Reviews admin panel if approval or moderation is required.`;

  dispatchRealEmail(ADMIN_EMAIL, subject, body, 'Admin: New Review');

  return {
    id: createEmailId(),
    orderId: 'review-mod-' + Date.now().toString().slice(-4),
    customerName: 'Review Moderation Desk',
    customerEmail: ADMIN_EMAIL,
    subject,
    body,
    status: 'completed',
    timestamp: getCurrentTimestamp(),
    recipientType: 'admin',
    category: 'New Review Alert'
  };
}

// 6. Refund / Cancellation Request Needing Action
export function buildAdminReturnRequestAlertEmail(returnRequest: ReturnRequest): EmailNotification {
  const claimType = returnRequest.type === 'refund' ? 'Refund' : 'Exchange';
  const subject = `⚠️ [ADMIN ALERT] Action Required: New Return/Refund Request #${returnRequest.id}`;
  const body = `CUSTOMER SERVICE ACTION REQUIRED:\n\nA customer has initiated a ${claimType.toUpperCase()} request requiring admin authorization.\n\nRequest ID: #${returnRequest.id}\nOrder Reference: ${returnRequest.orderId}\nCustomer: ${returnRequest.customerName} (${returnRequest.customerEmail})\nReason: ${returnRequest.reason}\nNotes: ${returnRequest.userNotes || 'None'}\n\nPlease open the Admin Dashboard -> Returns & Refunds panel to approve, reject, or request further inspection.`;

  dispatchRealEmail(ADMIN_EMAIL, subject, body, 'Admin: Return Request');

  return {
    id: createEmailId(),
    orderId: returnRequest.orderId,
    customerName: 'Returns & Compliance Team',
    customerEmail: ADMIN_EMAIL,
    subject,
    body,
    status: 'pending-cancellation',
    timestamp: getCurrentTimestamp(),
    recipientType: 'admin',
    category: 'Return Action Needed'
  };
}

// 7. Post-Delivery Review Request Email (Delayed Automation per Order)
export function buildPostDeliveryReviewRequestEmail(order: Order, delayDays: number = 3): EmailNotification {
  const orderIdUpper = order.id.slice(0, 8).toUpperCase();
  const customer = order.customerName || 'Valued Customer';
  const customerEmail = order.customerEmail || 'customer@example.com';
  
  const productItemsList = order.items.map(item => {
    const starLinks = [1, 2, 3, 4, 5].map(star => 
      `[ ${'★'.repeat(star)}${'☆'.repeat(5 - star)} Rate ${star}/5 ]`
    ).join(' ');
    
    return `📦 ${item.name} (${item.quantity > 1 ? `x${item.quantity}` : '1 unit'})
Quick Rating Links:
${starLinks}
Direct Review Link: #review-deep-link?productId=${encodeURIComponent(item.productId)}&orderId=${encodeURIComponent(order.id)}`;
  }).join('\n\n');

  const subject = `⭐ How are your items from Order #${orderIdUpper}? Share a quick rating!`;
  const body = `Hi ${customer},

It's been ${delayDays} day${delayDays === 1 ? '' : 's'} since your order #${orderIdUpper} was delivered! We hope your items are elevating your daily experience.

Could you take 30 seconds to rate your purchase? Your honest feedback helps fellow shoppers in Kenya make confident choices.

YOUR ORDERED ITEMS:
----------------------------------------
${productItemsList}
----------------------------------------

Clicking any rating above will open the verified review form with your rating pre-filled!

Don't want review request emails? Unsubscribe here: #unsubscribe-review-requests?email=${encodeURIComponent(customerEmail)}

Warm regards,
The Veloce Customer Experience Team`;

  if (!isReviewRequestOptedOut(customerEmail)) {
    dispatchRealEmail(customerEmail, subject, body, 'Post-Delivery Review Request', true);
  } else {
    console.log(`[Email Notifier] Skipped sending review request email to ${customerEmail}: Customer opted out in local preferences.`);
  }

  return {
    id: createEmailId(),
    orderId: order.id,
    customerName: customer,
    customerEmail,
    subject,
    body,
    status: 'completed',
    timestamp: getCurrentTimestamp(),
    recipientType: 'customer',
    category: 'Review Request'
  };
}
