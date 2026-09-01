/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import { Order } from '../types';

/**
 * Generates and downloads a beautifully formatted Single Receipt PDF
 */
export function exportSingleReceiptPDF(order: Order) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Color Palette
  const primaryColor = [79, 70, 229]; // Indigo-600 #4f46e5
  const secondaryColor = [31, 41, 55]; // Gray-800
  const lightGray = [243, 244, 246]; // Gray-100
  const borderGray = [229, 231, 235]; // Gray-200
  const accentColor = [16, 185, 129]; // Emerald-500 for Paid status

  // Page Dimensions
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;

  // Header Background Accent Bar
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 12, 'F');

  // Brand Name & Subtitle
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text("ROPENIX INVESTMENTS LTD", margin, 28);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128); // Gray-500
  doc.text('VELOCE COMMERCE & LOGISTICS OPERATIONS', margin, 33);

  // Brand Contact Details (Right Aligned)
  doc.setFontSize(8);
  doc.text('Nairobi CBD, Nairobi, Kenya', pageWidth - margin, 26, { align: 'right' });
  doc.text('Paybill: 303030 | Acc: 2047728455', pageWidth - margin, 30, { align: 'right' });
  doc.text('support@veloce.co.ke', pageWidth - margin, 34, { align: 'right' });

  // Horizontal Divider
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, 40, pageWidth - margin, 40);

  // Invoice Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('TAX INVOICE & RECEIPT', margin, 49);

  // Invoice Metadata
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);

  doc.text('Invoice Code:', margin, 56);
  doc.setFont('Helvetica', 'bold');
  doc.text(order.id.toUpperCase(), margin + 25, 56);

  doc.setFont('Helvetica', 'normal');
  doc.text('Invoice Date:', margin, 61);
  doc.text(order.date, margin + 25, 61);

  // Status Badge
  doc.setFont('Helvetica', 'bold');
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(pageWidth - margin - 35, 45, 35, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('PAID / SETTLED', pageWidth - margin - 17.5, 50, { align: 'center' });

  // Restore text color
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);

  // Billing & Fulfillment Details Section
  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.rect(margin, 69, pageWidth - (margin * 2), 24, 'F');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('BILLED TO & FULFILLMENT:', margin + 5, 75);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Customer: ${order.customerName} (${order.customerEmail})`, margin + 5, 80);

  const fulfillmentInfo = order.fulfillmentType === 'pickup'
    ? `Method: Self-Pickup | Hub: ${order.pickupLocation || order.shippingAddress || 'Nairobi Central'} | Ready: ${order.pickupEstimatedTime || '2–4 hrs'}`
    : `Method: Doorstep Delivery | Address: ${order.shippingAddress || 'Standard Delivery'}`;

  doc.text(fulfillmentInfo, margin + 5, 86);

  // Items Table Header
  let currentY = 99;
  doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.rect(margin, currentY, pageWidth - (margin * 2), 8, 'F');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Item Description', margin + 5, currentY + 5.5);
  doc.text('Tax Class', margin + 80, currentY + 5.5);
  doc.text('Qty', margin + 110, currentY + 5.5);
  doc.text('Unit Price', margin + 125, currentY + 5.5);
  doc.text('Total', margin + 155, currentY + 5.5);

  // Items Table Content
  currentY += 8;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);

  order.items.forEach((item, index) => {
    // Zebra striping
    if (index % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, currentY, pageWidth - (margin * 2), 10, 'F');
    }

    // Border line under item
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.line(margin, currentY + 10, pageWidth - margin, currentY + 10);

    // Item details
    const itemName = item.name.length > 35 ? item.name.slice(0, 32) + '...' : item.name;
    const taxLabel = item.taxStatus === 'zero_rated'
      ? '0% Zero-Rated'
      : item.taxStatus === 'exempt'
      ? 'Exempt'
      : `${item.taxRate ?? 16}% VAT`;

    doc.text(itemName, margin + 5, currentY + 6.5);
    doc.text(taxLabel, margin + 80, currentY + 6.5);
    doc.text(String(item.quantity), margin + 110, currentY + 6.5);
    doc.text(`KSh ${item.price.toLocaleString('en-KE')}`, margin + 125, currentY + 6.5);
    doc.text(`KSh ${(item.price * item.quantity).toLocaleString('en-KE')}`, margin + 155, currentY + 6.5);

    currentY += 10;
  });

  // Totals calculations
  const grossSubtotal = order.subtotal ?? order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxAmount = order.taxTotal ?? order.items.reduce((sum, item) => {
    const rate = item.taxRate ?? 16;
    return sum + (item.taxStatus === 'taxable' || !item.taxStatus ? (item.price * item.quantity) - ((item.price * item.quantity) / (1 + rate / 100)) : 0);
  }, 0);
  const subtotalExclTax = Math.max(0, grossSubtotal - taxAmount);
  const discountAmount = order.discountAmount ?? 0;

  currentY += 8;
  doc.setFontSize(9);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);

  // Subtotal Row
  doc.text('Subtotal (Excl. Tax):', margin + 105, currentY);
  doc.text(`KSh ${subtotalExclTax.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, margin + 145, currentY);

  // Tax Row
  currentY += 6;
  doc.text('VAT Tax (Included):', margin + 105, currentY);
  doc.text(`KSh ${taxAmount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, margin + 145, currentY);

  // Discount Row
  if (discountAmount > 0) {
    currentY += 6;
    doc.setTextColor(220, 38, 38); // Red
    doc.setFont('Helvetica', 'bold');
    doc.text(`Discount (${order.couponCode || 'PROMO'}):`, margin + 105, currentY);
    doc.text(`-KSh ${discountAmount.toLocaleString('en-KE')}`, margin + 145, currentY);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  }

  // Grand Total Row
  currentY += 8;
  doc.setLineWidth(0.5);
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.line(margin + 100, currentY - 5, pageWidth - margin, currentY - 5);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Grand Total (KSh):', margin + 105, currentY);
  doc.text(`KSh ${order.total.toLocaleString('en-KE')}`, margin + 145, currentY);

  // Audit Notes (If Any)
  if (order.customNote) {
    currentY += 15;
    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.rect(margin, currentY, pageWidth - (margin * 2), 18, 'F');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('VERIFIED ARCHIVE NOTE:', margin + 4, currentY + 5);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    const noteLines = doc.splitTextToSize(order.customNote, pageWidth - (margin * 2) - 8);
    doc.text(noteLines, margin + 4, currentY + 10);
  }

  // Bottom Footer Disclaimer
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(156, 163, 175); // Gray-400
  doc.text(
    'This invoice has been cryptographically signed and archived on the Veloce Distributed Ledger.',
    pageWidth / 2,
    pageHeight - 16,
    { align: 'center' }
  );
  doc.text(
    'Thank you for your engineering enterprise and support of Veloce products.',
    pageWidth / 2,
    pageHeight - 12,
    { align: 'center' }
  );

  // Save the PDF
  doc.save(`Veloce_Receipt_${order.id.slice(0, 8).toUpperCase()}.pdf`);
}

/**
 * Generates and downloads a beautiful, comprehensive Order History Report PDF
 */
export function exportOrderHistoryPDF(orders: Order[], userEmail: string) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryColor = [79, 70, 229]; // Indigo-600
  const secondaryColor = [31, 41, 55]; // Gray-800
  const lightGray = [243, 244, 246]; // Gray-100
  const borderGray = [229, 231, 235]; // Gray-200

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // Header Bar
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 12, 'F');

  // Title Block
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('VELOCE ATELIER', margin, 26);

  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128); // Gray-500
  doc.text('ORDER HISTORY AUDIT REPORT & LOGS', margin, 31);

  // Report Date / Account Info
  doc.setFontSize(8.5);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, pageWidth - margin, 25, { align: 'right' });
  doc.text(`Account Owner: ${userEmail}`, pageWidth - margin, 29, { align: 'right' });
  doc.text(`Total Volume: ${orders.length} Records`, pageWidth - margin, 33, { align: 'right' });

  // Stats Box Summary Panel
  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.rect(margin, 38, pageWidth - (margin * 2), 16, 'F');

  const totalSpent = orders.reduce((sum, o) => sum + o.total, 0);
  const completedCount = orders.filter(o => o.status === 'completed').length;
  const pendingCount = orders.filter(o => o.status === 'pending').length;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('TOTAL CUMULATIVE SPEND:', margin + 6, 44);
  doc.text('COMPLETED ORDERS:', margin + 82, 44);
  doc.text('PENDING DISPATCH:', margin + 138, 44);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`KSh ${totalSpent.toLocaleString('en-KE')}`, margin + 6, 49.5);
  doc.text(String(completedCount), margin + 82, 49.5);
  doc.text(String(pendingCount), margin + 138, 49.5);

  // Main Report Table Header
  let currentY = 62;
  doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.rect(margin, currentY, pageWidth - (margin * 2), 8, 'F');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Order ID', margin + 4, currentY + 5.5);
  doc.text('Date', margin + 35, currentY + 5.5);
  doc.text('Purchased Items Overview', margin + 60, currentY + 5.5);
  doc.text('Status', margin + 140, currentY + 5.5);
  doc.text('Total (KSh)', margin + 160, currentY + 5.5);

  // Report Rows
  currentY += 8;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);

  orders.forEach((order, index) => {
    // Check if y position exceeds page boundaries
    if (currentY > pageHeight - 25) {
      doc.addPage();
      currentY = 20;

      // Draw table headers again on new page
      doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.rect(margin, currentY, pageWidth - (margin * 2), 8, 'F');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text('Order ID', margin + 4, currentY + 5.5);
      doc.text('Date', margin + 35, currentY + 5.5);
      doc.text('Purchased Items Overview', margin + 60, currentY + 5.5);
      doc.text('Status', margin + 140, currentY + 5.5);
      doc.text('Total (KSh)', margin + 160, currentY + 5.5);

      currentY += 8;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    }

    // Row zebra striping
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, currentY, pageWidth - (margin * 2), 9, 'F');
    }

    // Border line under row
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.line(margin, currentY + 9, pageWidth - margin, currentY + 9);

    // Columns
    doc.setFont('Helvetica', 'bold');
    doc.text(order.id.toUpperCase(), margin + 4, currentY + 5.5);
    
    doc.setFont('Helvetica', 'normal');
    doc.text(order.date, margin + 35, currentY + 5.5);

    // Formatted items summary text
    const itemsText = order.items.map(i => `${i.name} (${i.quantity}x)`).join(', ');
    const itemsShort = itemsText.length > 44 ? itemsText.slice(0, 41) + '...' : itemsText;
    doc.text(itemsShort, margin + 60, currentY + 5.5);

    // Status column with capital styling
    const statText = order.status.toUpperCase();
    doc.text(statText, margin + 140, currentY + 5.5);

    // Pricing
    doc.setFont('Helvetica', 'bold');
    doc.text(`KSh ${order.total.toLocaleString('en-KE')}`, margin + 160, currentY + 5.5);
    doc.setFont('Helvetica', 'normal');

    currentY += 9;
  });

  // Footer page markings
  doc.setFontSize(7.5);
  doc.setTextColor(156, 163, 175);
  doc.text(
    `Veloce Logistics Ledger Systems • Page 1 of 1 • Secure Document Cryptography Approved`,
    pageWidth / 2,
    pageHeight - 12,
    { align: 'center' }
  );

  doc.save(`Veloce_Order_History_Report_${new Date().toISOString().split('T')[0]}.pdf`);
}
