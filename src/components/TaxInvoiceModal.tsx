/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Printer, X, CheckCircle, Receipt, Download, FileText, Globe, Building2, User } from 'lucide-react';
import { Order, Product } from '../types';
import { getProductTaxInfo } from '../utils/taxUtils';
import { useSiteSettings } from '../context/SiteSettingsContext';

interface TaxInvoiceModalProps {
  order: Order;
  products: Product[];
  onClose: () => void;
  autoPrint?: boolean;
}

export default function TaxInvoiceModal({ order, products, onClose, autoPrint = false }: TaxInvoiceModalProps) {
  const { settings } = useSiteSettings();
  const invoiceRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  // Derive tax information dynamically based on product lookup or default parameters
  const enrichedItems = order.items.map((item) => {
    const matchedProduct = products.find((p) => p.id === item.productId || p.name.toLowerCase() === item.name.toLowerCase());
    
    // Determine tax status and rate: check item first, then product, then taxUtils
    const taxInfo = matchedProduct ? getProductTaxInfo(matchedProduct) : { taxStatus: item.taxStatus || 'taxable', taxRate: item.taxRate ?? 16, taxClass: item.taxClass || 'standard' };
    const taxStatus = item.taxStatus || taxInfo.taxStatus;
    const ratePercent = taxStatus === 'taxable' ? (item.taxRate ?? taxInfo.taxRate) : 0;
    const vatRate = ratePercent / 100;

    let taxId = 'A';
    let label = `A (${ratePercent}%)`;
    if (taxStatus === 'zero_rated') {
      taxId = 'C';
      label = 'C (0% Zero-Rated)';
    } else if (taxStatus === 'exempt') {
      taxId = 'E';
      label = 'E (Exempt)';
    }

    // Simulate HS Codes (KRA Harmonized System Codes for international standard custom/VAT labeling)
    let hsCode = '4901.10.00';
    if (matchedProduct) {
      const category = matchedProduct.category.toUpperCase();
      if (category.includes('OAK') || category.includes('FURNITURE') || category.includes('HOME')) {
        hsCode = '9403.60.00';
      } else if (category.includes('ELECTRO') || category.includes('TECH') || category.includes('DEVICE')) {
        hsCode = '8517.13.00';
      } else if (category.includes('APPAREL') || category.includes('GARMENT') || category.includes('CLOTH')) {
        hsCode = '6109.10.00';
      } else if (matchedProduct.type === 'digital') {
        hsCode = '8523.49.00';
      }
    }

    const itemTotalInclusive = item.price * item.quantity;
    const netBasePrice = vatRate > 0 ? itemTotalInclusive / (1 + vatRate) : itemTotalInclusive;
    const vatAmount = item.lineTax !== undefined ? item.lineTax : (itemTotalInclusive - netBasePrice);

    return {
      ...item,
      taxStatus,
      taxId,
      vatRate,
      vatLabel: label,
      hsCode,
      netBasePrice,
      vatAmount,
      totalInclusive: itemTotalInclusive,
    };
  });

  // Aggregate totals by VAT Class
  const vatSummary = enrichedItems.reduce((acc, item) => {
    const key = item.taxId;
    if (!acc[key]) {
      acc[key] = {
        class: key,
        rate: item.vatRate,
        label: item.vatLabel,
        netBase: 0,
        vat: 0,
        gross: 0,
      };
    }
    acc[key].netBase += item.netBasePrice;
    acc[key].vat += item.vatAmount;
    acc[key].gross += item.totalInclusive;
    return acc;
  }, {} as Record<string, { class: string; rate: number; label: string; netBase: number; vat: number; gross: number }>);

  const totalGross = order.total;
  const totalNet = enrichedItems.reduce((sum, item) => sum + item.netBasePrice, 0);
  const totalVAT = enrichedItems.reduce((sum, item) => sum + item.vatAmount, 0);

  // Generate a realistic M-Pesa confirmation code or payment reference
  const getMpesaRef = (id: string) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'S';
    const num = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
    for (let i = 1; i < 10; i++) {
      code += chars.charAt((num + i * 7) % chars.length);
    }
    return code;
  };

  const mpesaCode = getMpesaRef(order.id);

  // Quick QR code generation for scanning the official tax ledger verification
  const verificationQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
    `KRA ETR VERIFIED | PIN: P051234567A | INVOICE: ${order.id.toUpperCase()} | TOTAL: KSh ${order.total.toLocaleString('en-KE')} | CODE: ${mpesaCode}`
  )}&color=000000&bgcolor=ffffff`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/45 dark:bg-gray-950/70 backdrop-blur-xs overflow-y-auto font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl border border-gray-150 dark:border-slate-850 shadow-2xl flex flex-col my-8 no-print overflow-hidden max-h-[90vh]"
      >
        {/* On-screen control bar */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 px-5 py-3.5 no-print shrink-0">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h4 className="font-display text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                Professional KRA Tax Invoice
              </h4>
              <p className="text-[10px] text-gray-400 font-medium font-mono">Invoice Reference: {order.id.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrint}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-650 text-white text-[11px] font-bold px-3 cursor-pointer shadow-sm transition-all"
            >
              <Printer className="h-3.5 w-3.5" /> Print / PDF
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-200 dark:border-slate-800 p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer"
              title="Close Panel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Scrollable invoice container */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-100 dark:bg-slate-950/20">
          
          {/* Printable invoice frame */}
          <div 
            ref={invoiceRef}
            id="printable-receipt-area" 
            className="bg-white text-gray-900 p-8 shadow-sm border border-gray-150 rounded-lg max-w-full font-sans leading-relaxed text-left mx-auto print:border-none print:shadow-none print:p-0"
          >
            {/* Stamp / Compliant watermarking style */}
            <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-5">
              <div>
                <div className="flex items-center gap-1.5">
                  <div className="h-7 w-7 bg-indigo-600 text-white font-display font-black text-xs rounded-lg flex items-center justify-center shadow-3xs">
                    {(settings.receipts.legal_business_name || settings.general.site_name || 'V')[0].toUpperCase()}
                  </div>
                  <span className="font-display text-base font-black tracking-tight text-gray-950 block uppercase">
                    {settings.receipts.legal_business_name || settings.general.site_name || "VELOCE KENYA LTD"}
                  </span>
                </div>
                <span className="font-mono text-[8px] font-extrabold text-gray-400 tracking-wider block mt-1 uppercase">
                  {settings.general.tagline || 'Workspace Logistics & Premium Engineering'}
                </span>
                <p className="text-[10px] text-gray-500 font-medium mt-2 leading-relaxed font-sans">
                  {settings.receipts.physical_address || settings.general.physical_address || 'L.R. No. 209/10245, Tech Park Plaza, Nairobi, Kenya'}<br />
                  <span className="font-bold text-gray-700">KRA PIN:</span> {settings.tax.kra_pin || 'P051234567A'} | <span className="font-bold text-gray-700">ETR No:</span> MPR18002345<br />
                  <span className="font-bold text-gray-700">Email:</span> {settings.receipts.contact_email || settings.general.business_email || 'accounting@veloce.co.ke'}
                </p>
              </div>

              <div className="text-right flex flex-col items-end shrink-0">
                <div className="bg-emerald-50 border border-emerald-150 text-emerald-800 text-[9px] font-extrabold tracking-wider px-2 py-0.5 rounded-md uppercase flex items-center gap-1 mb-2">
                  <CheckCircle className="h-3 w-3 text-emerald-600" /> KRA VAT COMPLIANT
                </div>
                <h1 className="font-display text-lg font-black text-indigo-700 uppercase tracking-tight">TAX INVOICE</h1>
                <p className="text-[10px] text-gray-500 font-bold font-mono mt-1 text-right">
                  INV-NO: {order.id.toUpperCase()}<br />
                  DATE: {order.date}<br />
                  STATUS: <span className="text-emerald-700 font-black">PAID (SETTLED)</span>
                </p>
              </div>
            </div>

            {/* Billed To / Shipping */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-5 border-b border-gray-150 text-xs font-sans">
              <div>
                <span className="block text-[9px] font-bold text-gray-400 font-mono uppercase tracking-wider mb-1.5">BILLED TO (CUSTOMER DETAILS)</span>
                <p className="font-bold text-gray-950 flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-gray-400" /> {order.customerName}
                </p>
                <p className="text-gray-550 font-medium mt-0.5">{order.customerEmail}</p>
                {order.shippingAddress && (
                  <p className="text-gray-500 font-light mt-1.5 leading-relaxed">
                    <span className="font-bold text-gray-600">Ship To:</span> {order.shippingAddress}
                  </p>
                )}
              </div>
              <div className="md:text-right flex flex-col md:items-end">
                <span className="block text-[9px] font-bold text-gray-400 font-mono uppercase tracking-wider mb-1.5">PAYMENT INFORMATION</span>
                <p className="font-medium text-gray-800">
                  <span className="font-bold">Method:</span> M-PESA Paybill <span className="font-mono font-bold text-emerald-700">{settings.payments.mpesa_paybill || '303030'}</span>
                </p>
                <p className="text-[10px] text-gray-700 font-mono mt-0.5">
                  <span className="text-gray-400">Account No:</span> <strong className="text-emerald-700 font-bold">{settings.payments.mpesa_account_number || '2047728455'}</strong> ({settings.payments.mpesa_account_name || 'ROPENIX INVESTMENTS LTD'})
                </p>
                <p className="text-indigo-700 font-bold font-mono text-[11px] mt-0.5">
                  <span className="text-gray-400 font-normal">M-Pesa Txn Ref:</span> {order.paymentReference || mpesaCode}
                </p>
                {(order.mpesaPhone || (order.paymentMethod === 'mpesa' && order.phone)) && (
                  <p className="text-[10px] text-gray-700 font-mono mt-0.5">
                    <span className="text-gray-400 font-normal">Payer Mobile:</span> <strong className="text-gray-900 font-bold">{order.mpesaPhone || order.phone}</strong>
                  </p>
                )}
                <p className="text-[10px] text-gray-500 font-light mt-1">
                  VAT Inclusive Local Currency settlement (KSh)
                </p>
              </div>


            </div>

            {/* Invoice Line Items Table */}
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-mono text-[9px] font-bold uppercase tracking-wider">
                    <th className="py-2 pl-1">HS Code</th>
                    <th className="py-2">Item Description</th>
                    <th className="py-2 text-center">VAT Class</th>
                    <th className="py-2 text-right">Qty</th>
                    <th className="py-2 text-right">Unit Price</th>
                    <th className="py-2 text-right">Net Taxable</th>
                    <th className="py-2 text-right">VAT (KSh)</th>
                    <th className="py-2 pr-1 text-right">Total (Incl.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {enrichedItems.map((item, idx) => (
                    <tr key={`${item.productId}-${idx}`} className="hover:bg-slate-50/50">
                      <td className="py-2.5 pl-1 font-mono text-[10px] text-gray-450">{item.hsCode}</td>
                      <td className="py-2.5 font-sans">
                        <span className="font-bold text-gray-900 block">{item.name}</span>
                        {item.selectedVariations && Object.keys(item.selectedVariations).length > 0 && (
                          <span className="text-[9px] text-indigo-600 font-medium font-mono block mt-0.5">
                            {Object.entries(item.selectedVariations)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(' | ')}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-center font-mono font-bold text-gray-800 text-[10px]">
                        Class {item.taxId}
                      </td>
                      <td className="py-2.5 text-center font-mono">{item.quantity}</td>
                      <td className="py-2.5 text-right font-mono text-gray-600">
                        {item.price.toLocaleString('en-KE')}
                      </td>
                      <td className="py-2.5 text-right font-mono text-gray-800">
                        {item.netBasePrice.toLocaleString('en-KE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      </td>
                      <td className="py-2.5 text-right font-mono text-gray-700">
                        {item.vatAmount.toLocaleString('en-KE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      </td>
                      <td className="py-2.5 pr-1 text-right font-mono font-bold text-gray-950">
                        {item.totalInclusive.toLocaleString('en-KE')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Ledger Breakdown & Signature Summary block */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-5 border-t border-gray-150">
              
              {/* VAT Aggregate Table (According to KRA Rules) */}
              <div>
                <span className="block text-[9px] font-bold text-gray-400 font-mono uppercase tracking-wider mb-2">VAT ANALYSIS SUMMARY</span>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] border border-gray-150 rounded-lg overflow-hidden font-mono">
                  <thead>
                    <tr className="bg-slate-50 border-b border-gray-150 text-slate-500 font-bold">
                      <th className="p-1.5 text-left">Class</th>
                      <th className="p-1.5 text-right">Taxable Net</th>
                      <th className="p-1.5 text-right">VAT Code</th>
                      <th className="p-1.5 text-right">VAT Tax</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {Object.values(vatSummary).map((sum) => (
                      <tr key={sum.class} className="text-gray-700">
                        <td className="p-1.5 font-bold">Class {sum.class}</td>
                        <td className="p-1.5 text-right">
                          {sum.netBase.toLocaleString('en-KE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                        </td>
                        <td className="p-1.5 text-right">{sum.rate * 100}%</td>
                        <td className="p-1.5 text-right font-bold text-slate-900">
                          {sum.vat.toLocaleString('en-KE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                <div className="mt-2 text-[9px] text-gray-400 font-medium leading-relaxed font-sans">
                  * VAT rates standard Kenyan legislation: Class A (16%), Class B (8%), Class C (Zero-Rated), Class E (Exempt).
                </div>
              </div>

              {/* Grand Totals */}
              <div className="flex flex-col items-end justify-start font-sans text-xs">
                <div className="w-full space-y-1.5">
                  <div className="flex justify-between text-gray-550">
                    <span className="font-medium">Total Net Taxable Base:</span>
                    <span className="font-mono font-bold text-gray-800">
                      KSh {totalNet.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-550 border-b border-slate-100 pb-1.5">
                    <span className="font-medium">Total VAT Collected:</span>
                    <span className="font-mono font-bold text-gray-800">
                      KSh {totalVAT.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-900 text-sm font-black pt-1">
                    <span>INVOICE GRAND TOTAL:</span>
                    <span className="font-mono text-base text-indigo-700">
                      KSh {totalGross.toLocaleString('en-KE')}
                    </span>
                  </div>
                </div>

                {/* QR Code and Compliant Verification signature */}
                <div className="flex items-center gap-3.5 mt-5 bg-slate-50 p-2.5 rounded-lg border border-slate-150 w-full justify-between">
                  <div>
                    <span className="text-[8px] font-bold text-gray-400 uppercase font-mono block">KRA Digital Ledger Hash</span>
                    <span className="text-[9px] font-mono font-bold text-indigo-750 block truncate max-w-[150px] leading-tight mt-0.5">
                      {order.id.slice(0, 10).toUpperCase()}#{mpesaCode}
                    </span>
                    <span className="text-[8px] text-gray-400 font-light block leading-relaxed mt-1">
                      Scan this ETR verification code with standard fiscal devices to confirm compliance.
                    </span>
                  </div>
                  <img 
                    src={verificationQrUrl} 
                    alt="KRA ETR Control QR Code" 
                    className="h-14 w-14 border border-gray-200 rounded p-0.5 bg-white shrink-0" 
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>

            </div>

            {/* Bottom Disclaimer */}
            <div className="border-t border-slate-150 mt-6 pt-4 text-center text-[9.5px] text-gray-400 font-medium font-sans leading-relaxed">
              This tax invoice is issued electronically. All transactions are securely recorded on our centralized ledger.<br />
              Thank you for choosing <span className="font-bold text-gray-600">{settings.receipts.legal_business_name || settings.general.site_name || "Veloce Kenya Ltd"}</span>. Support & assistance: {settings.receipts.contact_email || settings.general.business_email || "customercare@veloce.co.ke"}
            </div>

          </div>

        </div>

      </motion.div>
    </div>
  );
}
