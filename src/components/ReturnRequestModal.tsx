import React, { useState } from 'react';
import { 
  X, 
  RefreshCw, 
  CheckCircle, 
  Package, 
  ArrowRight, 
  ArrowLeft, 
  AlertCircle, 
  UploadCloud, 
  Camera, 
  Trash2, 
  ShieldCheck, 
  Info, 
  Smartphone, 
  CreditCard, 
  Coins, 
  Check
} from 'lucide-react';
import { Order, ReturnRequest, ReturnReason, ConditionReported, RefundMethod, ReturnItem } from '../types';
import { formatPrice } from '../lib/currency';

interface ReturnRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  onSubmit: (request: ReturnRequest) => void;
  policyWindowDays?: number;
}

const REASON_OPTIONS: { id: ReturnReason; label: string; description: string; freeShipping: boolean }[] = [
  { id: 'damaged_defective', label: 'Damaged / Defective on Arrival', description: 'Item arrived broken, scratched, or non-functional', freeShipping: true },
  { id: 'wrong_item', label: 'Wrong Item Received', description: 'Received a different product, color, or variant', freeShipping: true },
  { id: 'not_as_described', label: 'Item Not As Described', description: 'Product specs or design differ from website details', freeShipping: true },
  { id: 'size_fit_issue', label: 'Size / Fit Mismatch', description: 'Item size or ergonomic fit is uncomfortable', freeShipping: false },
  { id: 'changed_mind', label: 'Changed My Mind', description: 'No longer needed or preferred another model', freeShipping: false },
  { id: 'better_price', label: 'Better Price Found Elsewhere', description: 'Found a lower offer on another store', freeShipping: false },
  { id: 'other', label: 'Other Reason', description: 'Please specify details in the notes section below', freeShipping: false }
];

const CONDITION_OPTIONS: { id: ConditionReported; label: string; desc: string }[] = [
  { id: 'unopened', label: 'Unopened', desc: 'Original factory seal intact' },
  { id: 'opened_unused', label: 'Opened & Unused', desc: 'Box opened, tags attached, pristine' },
  { id: 'used', label: 'Lightly Used', desc: 'Tested brief period, original packaging available' },
  { id: 'damaged', label: 'Damaged', desc: 'Physically damaged or non-working' }
];

export default function ReturnRequestModal({
  isOpen,
  onClose,
  order,
  onSubmit,
  policyWindowDays = 7
}: ReturnRequestModalProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1: Items Selection
  const [selectedItems, setSelectedItems] = useState<
    Record<string, { selected: boolean; quantity: number; condition: ConditionReported; itemReason: ReturnReason }>
  >(() => {
    const initial: Record<string, { selected: boolean; quantity: number; condition: ConditionReported; itemReason: ReturnReason }> = {};
    order.items.forEach((item, index) => {
      initial[`${item.productId}-${index}`] = {
        selected: true,
        quantity: item.quantity,
        condition: 'opened_unused',
        itemReason: 'size_fit_issue'
      };
    });
    return initial;
  });

  // Step 2: Global Reason & Notes
  const [primaryReason, setPrimaryReason] = useState<ReturnReason>('size_fit_issue');
  const [customerNotes, setCustomerNotes] = useState('');
  const [conditionReported, setConditionReported] = useState<ConditionReported>('opened_unused');

  // Step 3: Photo Evidence
  const [evidenceImages, setEvidenceImages] = useState<string[]>([
    'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=400&q=80'
  ]);

  // Step 4: Resolution & Refund Method
  const [resolutionType, setResolutionType] = useState<'refund' | 'exchange' | 'store_credit'>('refund');
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('mpesa');
  const [mpesaPhone, setMpesaPhone] = useState((order as any).customerPhone || (order as any).phone || '0712345678');
  const [exchangeVariant, setExchangeVariant] = useState('');

  // Step 5: Submission & Feedback
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  // Eligibility Check (Calculated based on order date and category)
  const orderDateObj = new Date(order.date || Date.now());
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - orderDateObj.getTime()) / (1000 * 3600 * 24));
  const isWithinWindow = diffDays <= policyWindowDays;

  const handleToggleItem = (key: string) => {
    setSelectedItems((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        selected: !prev[key].selected
      }
    }));
  };

  const handleQtyChange = (key: string, maxQty: number, val: number) => {
    const cleanVal = Math.max(1, Math.min(maxQty, val));
    setSelectedItems((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        quantity: cleanVal
      }
    }));
  };

  const handleAddSampleImage = (url: string) => {
    if (evidenceImages.length >= 4) return;
    setEvidenceImages([...evidenceImages, url]);
  };

  const handleRemoveImage = (index: number) => {
    setEvidenceImages(evidenceImages.filter((_, i) => i !== index));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          setEvidenceImages((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Selected items calculation
  const selectedItemsList = order.items.filter((item, index) => {
    const state = selectedItems[`${item.productId}-${index}`];
    return state && state.selected;
  });

  const totalRefundValue = selectedItemsList.reduce((sum, item, index) => {
    const state = selectedItems[`${item.productId}-${index}`];
    return sum + item.price * (state ? state.quantity : 1);
  }, 0);

  const selectedReasonObj = REASON_OPTIONS.find((r) => r.id === primaryReason) || REASON_OPTIONS[0];
  const isFreeReturnShipping = selectedReasonObj.freeShipping;
  const returnShippingCost = isFreeReturnShipping ? 0 : 250; // KSh 250 return fee if mind changed
  const netEstimatedRefund = Math.max(0, totalRefundValue - returnShippingCost);

  // Validation logic per step
  const handleNextStep = () => {
    setErrorMsg('');
    if (currentStep === 1) {
      if (selectedItemsList.length === 0) {
        setErrorMsg('Please select at least one item to return.');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (primaryReason === 'other' && !customerNotes.trim()) {
        setErrorMsg('Please enter detailed comments explaining your reason.');
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (['damaged_defective', 'wrong_item'].includes(primaryReason) && evidenceImages.length === 0) {
        setErrorMsg('Photo evidence is required for damaged or wrong item return requests.');
        return;
      }
      setCurrentStep(4);
    } else if (currentStep === 4) {
      if (resolutionType === 'refund' && refundMethod === 'mpesa' && !mpesaPhone.trim()) {
        setErrorMsg('Please enter a valid M-Pesa phone number for payout.');
        return;
      }
      if (resolutionType === 'exchange' && !exchangeVariant.trim()) {
        setErrorMsg('Please enter your requested size/color/variant for exchange.');
        return;
      }
      setCurrentStep(5);
    }
  };

  const handleSubmitFinal = () => {
    const itemsToReturn: ReturnItem[] = selectedItemsList.map((item, index) => {
      const state = selectedItems[`${item.productId}-${index}`];
      return {
        id: `ret-item-${Date.now()}-${index}`,
        orderItemId: `item-${index}`,
        productId: item.productId,
        name: item.name,
        quantity: state.quantity,
        price: item.price,
        selectedVariations: item.selectedVariations,
        reason: primaryReason,
        reasonDetail: customerNotes,
        conditionReported: conditionReported,
        evidenceImages: evidenceImages,
        inspectionOutcome: 'pending',
        refundLineAmount: item.price * state.quantity
      };
    });

    const newRequest: ReturnRequest = {
      id: `RET-${Math.floor(10000 + Math.random() * 90000)}`,
      orderId: order.id,
      customerEmail: order.customerEmail || 'customer@ropenix.co.ke',
      customerName: order.customerName || 'Valued Customer',
      customerPhone: mpesaPhone || (order as any).customerPhone || (order as any).phone || '0712345678',
      items: itemsToReturn,
      type: resolutionType === 'exchange' ? 'exchange' : resolutionType === 'store_credit' ? 'store_credit' : 'refund',
      resolutionType: resolutionType === 'exchange' ? 'replacement' : resolutionType === 'store_credit' ? 'store_credit' : 'refund',
      refundMethod: resolutionType === 'refund' ? refundMethod : 'store_credit',
      reason: primaryReason,
      reasonDetails: customerNotes,
      customerNotes: customerNotes,
      exchangeVariant: resolutionType === 'exchange' ? exchangeVariant : undefined,
      status: 'pending_review',
      dateSubmitted: new Date().toISOString().replace('T', ' ').slice(0, 16),
      requestedAt: new Date().toISOString(),
      refundAmount: netEstimatedRefund,
      trackingNumber: `RET-KE-${Math.floor(100000 + Math.random() * 900000)}`,
      evidenceImages: evidenceImages,
      mpesaPhoneNumber: mpesaPhone,
      statusHistory: [
        {
          id: `hist-init-${Date.now()}`,
          returnRequestId: `RET-INIT`,
          fromStatus: 'pending_review',
          toStatus: 'pending_review',
          changedBy: order.customerName || 'Customer',
          note: 'Return request submitted by customer via Web App.',
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16)
        }
      ]
    };

    onSubmit(newRequest);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      onClose();
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs no-print animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-950 border border-gray-150 dark:border-gray-850 rounded-2xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-2 rounded-xl border border-transparent hover:border-gray-200 dark:hover:border-gray-800 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-6 border-b border-gray-100 dark:border-gray-850 pb-4">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-mono text-[10px] font-bold rounded-md border border-indigo-200/50 dark:border-indigo-900/50">
              KENYA E-COMMERCE RETURN SPEC
            </span>
            {isWithinWindow ? (
              <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 font-mono text-[10px] font-semibold rounded-md flex items-center gap-1">
                <Check className="h-3 w-3" /> Eligible ({policyWindowDays - diffDays}d remaining)
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 font-mono text-[10px] font-semibold rounded-md">
                Window Extended (Admin Override)
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 font-display mt-1.5">
            <RefreshCw className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /> Return & Exchange Portal
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-light mt-0.5">
            Order Ref: <span className="font-mono font-bold text-gray-800 dark:text-gray-200">{order.id}</span> • Delivered on {order.date}
          </p>
        </div>

        {/* Stepper Header */}
        {!showSuccess && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
              <span className={currentStep >= 1 ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''}>1. Items</span>
              <span className={currentStep >= 2 ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''}>2. Reason</span>
              <span className={currentStep >= 3 ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''}>3. Photos</span>
              <span className={currentStep >= 4 ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''}>4. Resolution</span>
              <span className={currentStep >= 5 ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''}>5. Review</span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-850 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300 rounded-full"
                style={{ width: `${(currentStep / 5) * 100}%` }}
              />
            </div>
          </div>
        )}

        {showSuccess ? (
          <div className="py-12 text-center flex flex-col items-center justify-center gap-3 animate-fade-in">
            <CheckCircle className="h-16 w-16 text-emerald-500 animate-bounce" />
            <div>
              <h4 className="text-base font-bold text-gray-900 dark:text-white">Return Request Submitted</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-light mt-1 max-w-sm mx-auto">
                Ticket logged under status <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">PENDING_REVIEW</span>.
                You will receive real-time SMS & Email status notifications as our inspection team reviews your request.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* STEP 1: SELECT ITEMS */}
            {currentStep === 1 && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase font-mono tracking-wide mb-1">
                    Select Eligible Items & Quantities to Return
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Check the items you wish to send back. Non-returnable categories (e.g., custom products, opened software) are flagged below.
                  </p>
                </div>

                <div className="space-y-2.5 max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-xl p-3 bg-gray-50/50 dark:bg-gray-900/30">
                  {order.items.map((item, index) => {
                    const key = `${item.productId}-${index}`;
                    const state = selectedItems[key] || {
                      selected: false,
                      quantity: item.quantity,
                      condition: 'opened_unused',
                      itemReason: 'size_fit_issue'
                    };
                    const isCategoryExcluded = item.name.toLowerCase().includes('underwear') || item.name.toLowerCase().includes('perishable');

                    return (
                      <div
                        key={key}
                        onClick={() => !isCategoryExcluded && handleToggleItem(key)}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                          isCategoryExcluded
                            ? 'opacity-60 bg-gray-100 dark:bg-gray-900 border-gray-200 cursor-not-allowed'
                            : state.selected
                            ? 'border-indigo-500/70 bg-indigo-50/30 dark:bg-indigo-950/30 dark:border-indigo-800'
                            : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            disabled={isCategoryExcluded}
                            checked={state.selected}
                            onChange={() => {}}
                            className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 border-gray-300 cursor-pointer"
                          />
                          <div>
                            <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{item.name}</p>
                            <p className="text-[10px] text-gray-500 font-mono">
                              Unit Price: {formatPrice(item.price)}
                            </p>
                            {isCategoryExcluded && (
                              <p className="text-[10px] text-rose-500 font-medium">
                                Ineligible: Hygiene / Category exclusion policy
                              </p>
                            )}
                          </div>
                        </div>

                        {state.selected && !isCategoryExcluded && (
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[10px] text-gray-400 font-mono">Return Qty:</span>
                            <input
                              type="number"
                              min="1"
                              max={item.quantity}
                              value={state.quantity}
                              onChange={(e) => handleQtyChange(key, item.quantity, parseInt(e.target.value) || 1)}
                              className="w-14 text-center py-1 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg font-mono font-bold text-gray-900 dark:text-white"
                            />
                            <span className="text-[10px] text-gray-400">/ {item.quantity}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl flex items-start gap-2 text-xs text-indigo-800 dark:text-indigo-300">
                  <Info className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Kenyan Consumer Return Protection:</span> 7-day hassle-free return window. Free pick-up or store drop-off available across Nairobi & major urban nodes.
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: REASON & CONDITION */}
            {currentStep === 2 && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase font-mono tracking-wide mb-1">
                    Structured Return Reason & Condition
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Structuring reasons powers product QA & prevents catalog discrepancies.
                  </p>
                </div>

                {/* Primary Structured Reason Grid */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Primary Reason for Return
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {REASON_OPTIONS.map((opt) => (
                      <div
                        key={opt.id}
                        onClick={() => setPrimaryReason(opt.id)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          primaryReason === opt.id
                            ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/40 dark:border-indigo-800'
                            : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 bg-white dark:bg-gray-900'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-gray-900 dark:text-white">{opt.label}</p>
                          {opt.freeShipping && (
                            <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold">
                              FREE SHIP
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{opt.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Condition Reported */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Current Item Condition
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {CONDITION_OPTIONS.map((cond) => (
                      <button
                        type="button"
                        key={cond.id}
                        onClick={() => setConditionReported(cond.id)}
                        className={`p-2.5 text-left rounded-xl border transition-all cursor-pointer ${
                          conditionReported === cond.id
                            ? 'border-indigo-600 bg-indigo-600 text-white font-bold'
                            : 'border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900'
                        }`}
                      >
                        <p className="text-xs font-semibold">{cond.label}</p>
                        <p className={`text-[9px] mt-0.5 ${conditionReported === cond.id ? 'text-indigo-100' : 'text-gray-400'}`}>
                          {cond.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Detailed Customer Comments */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Detailed Explanation / Comments {primaryReason === 'other' && <span className="text-rose-500">*</span>}
                  </label>
                  <textarea
                    rows={3}
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder="Provide specific details (e.g., 'Ordered size 42, package arrived with size 40 label...')"
                    className="w-full text-xs p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* STEP 3: PHOTO EVIDENCE UPLOAD */}
            {currentStep === 3 && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase font-mono tracking-wide mb-1">
                    Upload Photo Evidence
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Attach photos of the item, tags, and defect/shipping label to expedite admin approval.
                  </p>
                </div>

                {/* Drag and Drop Zone */}
                <div className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl p-6 text-center bg-gray-50/50 dark:bg-gray-900/30 hover:border-indigo-400 transition-colors">
                  <UploadCloud className="h-8 w-8 text-indigo-500 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Drag & Drop Evidence Images</p>
                  <p className="text-[10px] text-gray-400 mt-1">Supports PNG, JPG, WEBP up to 10MB</p>
                  
                  <label className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer transition-all shadow-3xs">
                    <Camera className="h-3.5 w-3.5" /> Browse Files
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>

                {/* Quick Preset Samples for Testing */}
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase font-mono mb-2">Or Quick Add Test Attachments:</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddSampleImage('https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80')}
                      className="px-2.5 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-[10px] font-medium text-gray-700 dark:text-gray-300 hover:border-indigo-500 cursor-pointer"
                    >
                      + Box Tag Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddSampleImage('https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80')}
                      className="px-2.5 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-[10px] font-medium text-gray-700 dark:text-gray-300 hover:border-indigo-500 cursor-pointer"
                    >
                      + Serial Label Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddSampleImage('https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80')}
                      className="px-2.5 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-[10px] font-medium text-gray-700 dark:text-gray-300 hover:border-indigo-500 cursor-pointer"
                    >
                      + Defect Zoom Photo
                    </button>
                  </div>
                </div>

                {/* Evidence Thumbnails List */}
                {evidenceImages.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-2">
                      Attached Evidence ({evidenceImages.length}/4)
                    </label>
                    <div className="grid grid-cols-4 gap-3">
                      {evidenceImages.map((img, idx) => (
                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 group bg-slate-100">
                          <img src={img} alt={`Evidence ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-md opacity-90 hover:opacity-100 transition-opacity cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: RESOLUTION & REFUND METHOD */}
            {currentStep === 4 && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase font-mono tracking-wide mb-1">
                    Select Resolution & Payout Preference
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Choose whether you prefer a cash refund, store credit voucher (+5% bonus), or direct product exchange.
                  </p>
                </div>

                {/* Resolution Options */}
                <div className="grid grid-cols-3 gap-3">
                  <div
                    onClick={() => setResolutionType('refund')}
                    className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
                      resolutionType === 'refund'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/50 dark:border-indigo-800'
                        : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 bg-white dark:bg-gray-900'
                    }`}
                  >
                    <CreditCard className="h-5 w-5 text-indigo-600 mx-auto mb-1" />
                    <p className="text-xs font-bold text-gray-900 dark:text-white">Monetary Refund</p>
                    <p className="text-[9px] text-gray-400 mt-0.5">M-Pesa B2C or Card</p>
                  </div>

                  <div
                    onClick={() => setResolutionType('store_credit')}
                    className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
                      resolutionType === 'store_credit'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/50 dark:border-indigo-800'
                        : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 bg-white dark:bg-gray-900'
                    }`}
                  >
                    <Coins className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                    <p className="text-xs font-bold text-gray-900 dark:text-white">Store Credit</p>
                    <p className="text-[9px] text-emerald-600 font-bold mt-0.5">+5% Bonus Credit</p>
                  </div>

                  <div
                    onClick={() => setResolutionType('exchange')}
                    className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
                      resolutionType === 'exchange'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/50 dark:border-indigo-800'
                        : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 bg-white dark:bg-gray-900'
                    }`}
                  >
                    <RefreshCw className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                    <p className="text-xs font-bold text-gray-900 dark:text-white">Product Exchange</p>
                    <p className="text-[9px] text-gray-400 mt-0.5">Replace with size/color</p>
                  </div>
                </div>

                {/* Refund Method Selection if Monetary Refund */}
                {resolutionType === 'refund' && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl space-y-3">
                    <label className="block text-xs font-bold text-gray-900 dark:text-white font-mono uppercase">
                      Select Refund Channel
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRefundMethod('mpesa')}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 cursor-pointer transition-all ${
                          refundMethod === 'mpesa'
                            ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 font-bold text-emerald-800 dark:text-emerald-300'
                            : 'border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-950'
                        }`}
                      >
                        <Smartphone className="h-4 w-4 text-emerald-600" />
                        <div>
                          <p className="text-xs font-semibold">M-Pesa B2C Instant</p>
                          <p className="text-[9px] text-gray-400">Payout directly to phone</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRefundMethod('original_payment')}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 cursor-pointer transition-all ${
                          refundMethod === 'original_payment'
                            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 font-bold text-indigo-800 dark:text-indigo-300'
                            : 'border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-950'
                        }`}
                      >
                        <CreditCard className="h-4 w-4 text-indigo-600" />
                        <div>
                          <p className="text-xs font-semibold">Original Card Gateway</p>
                          <p className="text-[9px] text-gray-400">Reverses original charge</p>
                        </div>
                      </button>
                    </div>

                    {refundMethod === 'mpesa' && (
                      <div className="pt-2">
                        <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                          M-Pesa Phone Number for Payout
                        </label>
                        <input
                          type="text"
                          value={mpesaPhone}
                          onChange={(e) => setMpesaPhone(e.target.value)}
                          placeholder="e.g. 0712345678 or 254712345678"
                          className="w-full text-xs px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-white font-mono"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Exchange specifications */}
                {resolutionType === 'exchange' && (
                  <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 rounded-2xl space-y-2">
                    <label className="block text-xs font-bold text-purple-900 dark:text-purple-300 font-mono uppercase">
                      Specify Replacement Item Details
                    </label>
                    <input
                      type="text"
                      value={exchangeVariant}
                      onChange={(e) => setExchangeVariant(e.target.value)}
                      placeholder="e.g. Replace with size Large (42) in Matte Black finish"
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-gray-950 border border-purple-200 dark:border-purple-800 rounded-xl text-gray-900 dark:text-white"
                    />
                  </div>
                )}
              </div>
            )}

            {/* STEP 5: REVIEW & SUBMIT */}
            {currentStep === 5 && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase font-mono tracking-wide mb-1">
                    Review Return Ticket Details
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Confirm all information before sending ticket to the merchant operations desk.
                  </p>
                </div>

                <div className="border border-gray-200 dark:border-gray-800 rounded-2xl p-4 bg-gray-50/50 dark:bg-gray-900/30 space-y-3">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-gray-200 dark:border-gray-800">
                    <span className="text-gray-500">Order Reference:</span>
                    <span className="font-mono font-bold text-gray-900 dark:text-white">{order.id}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs pb-2 border-b border-gray-200 dark:border-gray-800">
                    <span className="text-gray-500">Return Reason:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{selectedReasonObj.label}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs pb-2 border-b border-gray-200 dark:border-gray-800">
                    <span className="text-gray-500">Item Condition:</span>
                    <span className="font-semibold text-gray-900 dark:text-white uppercase">{conditionReported}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs pb-2 border-b border-gray-200 dark:border-gray-800">
                    <span className="text-gray-500">Return Items Count:</span>
                    <span className="font-bold text-gray-900 dark:text-white">{selectedItemsList.length} SKU(s)</span>
                  </div>

                  <div className="flex items-center justify-between text-xs pb-2 border-b border-gray-200 dark:border-gray-800">
                    <span className="text-gray-500">Return Shipping Fee:</span>
                    <span className={`font-bold font-mono ${isFreeReturnShipping ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {isFreeReturnShipping ? 'FREE (Defect / Wrong Item)' : 'KSh 250 (Deducted from refund)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm pt-1">
                    <span className="font-bold text-gray-900 dark:text-white">Estimated Refund Payout:</span>
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-base">
                      {formatPrice(netEstimatedRefund)}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                  <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Next Steps After Submission:</span> Once approved, courier pick-up will be scheduled or you will receive a drop-off tracking voucher code.
                  </div>
                </div>
              </div>
            )}

            {/* STEP NAVIGATION BUTTONS */}
            <div className="flex items-center justify-between border-t border-gray-150 dark:border-gray-850 pt-4 mt-6">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-900 transition-all cursor-pointer"
                >
                  Cancel
                </button>
              )}

              {currentStep < 5 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md cursor-pointer transition-all hover:scale-102 flex items-center gap-1.5"
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmitFinal}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer transition-all hover:scale-102 flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" /> Submit Return Request
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
