import React, { useState, useEffect, useRef } from 'react';
import {
  Star,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Upload,
  X,
  Loader2,
  Image as ImageIcon,
  PackageCheck,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAuthHeaders } from '../utils/authTokens';

interface ReviewFormViewProps {
  orderId: string;
  orderItemId: string;
  onBack: () => void;
  onReviewSubmitted?: () => void;
}

interface ItemDetails {
  id: string;
  orderId: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  orderDate?: string;
}

export default function ReviewFormView({
  orderId,
  orderItemId,
  onBack,
  onReviewSubmitted,
}: ReviewFormViewProps) {
  const { user, isAuthenticated } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [eligibilityChecked, setEligibilityChecked] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);
  const [ineligibilityReason, setIneligibilityReason] = useState('');
  const [itemDetails, setItemDetails] = useState<ItemDetails | null>(null);



  // Form fields
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Validation & Submission
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // RATING LABELS FOR ACCESSIBILITY & FEEDBACK
  const ratingLabels: Record<number, string> = {
    1: 'Terrible - Not as expected',
    2: 'Poor - Could be better',
    3: 'Average - Met basic expectations',
    4: 'Good - Very pleased with purchase',
    5: 'Excellent - Highly recommended!',
  };

  // 1. Fetch Eligibility & Item Details on Mount
  useEffect(() => {
    let isMounted = true;

    async function loadEligibility() {
      setIsLoading(true);
      setErrorMsg('');

      if (!isAuthenticated) {
        setIsLoading(false);
        return;
      }

      try {
        const queryParams = new URLSearchParams();
        if (orderId) queryParams.set('orderId', orderId);
        const url = `/api/reviews/eligibility/${encodeURIComponent(orderItemId)}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

        const res = await fetch(url, {
          headers: getAuthHeaders(),
        });
        const data = await res.json().catch(() => null);

        if (!isMounted) return;

        if (!data || !res.ok || !data.success) {
          setCanSubmit(false);
          setIneligibilityReason(data?.error || data?.message || data?.reason || `HTTP ${res.status}: Unable to verify eligibility`);
          setIsLoading(false);
          setEligibilityChecked(true);
          return;
        }

        const item = data.item;
        if (item) {
          setItemDetails({
            id: item.id,
            orderId: item.order_id || item.orderId || orderId,
            productId: item.product_id || item.productId,
            name: item.name || item.product_name || item.catalogProductName || 'Product',
            price: Number(item.price || 0),
            quantity: Number(item.quantity || 1),
            imageUrl: item.imageUrl || item.image,
          });
        }

        // Edge Case: Customer opens email link after already reviewing
        if (data.existingReview) {
          setCanSubmit(false);
          setIneligibilityReason('You have already submitted a review for this item. Reviews are final once submitted.');
        } else if (data.eligible) {
          setCanSubmit(true);
        } else {
          setCanSubmit(false);
          setIneligibilityReason(data.message || data.reason || 'This order item is not yet eligible for review.');
        }
      } catch (err: any) {
        if (!isMounted) return;
        setCanSubmit(false);
        setIneligibilityReason(err?.message || 'Unable to verify order eligibility. Please check your connection.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setEligibilityChecked(true);
        }
      }
    }

    loadEligibility();

    return () => {
      isMounted = false;
    };
  }, [orderItemId, orderId, isAuthenticated]);

  // Handle Photo Upload using /api/upload
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (uploadedImages.length >= 3) {
      setErrorMsg('You can attach a maximum of 3 photos.');
      return;
    }

    const file = files[0];
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image size cannot exceed 5MB.');
      return;
    }

    setIsUploading(true);
    setErrorMsg('');

    try {
      const base64DataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          image: base64DataUrl,
          folder: 'ropenix_reviews',
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.success && data?.url) {
        setUploadedImages((prev) => [...prev, data.url]);
      } else {
        setErrorMsg(data?.error || `Failed to upload photo (Status ${res.status}).`);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error while uploading photo.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    setUploadedImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const trimmedBody = body.trim();
    if (trimmedBody.length < 10) {
      setErrorMsg('Your review must be at least 10 characters long.');
      return;
    }

    if (trimmedBody.length > 2000) {
      setErrorMsg('Your review cannot exceed 2,000 characters.');
      return;
    }

    if (rating < 1 || rating > 5) {
      setErrorMsg('Please select a star rating between 1 and 5.');
      return;
    }

    setIsSubmitting(true);

    try {
      const endpoint = '/api/reviews';
      const payload = {
        orderItemId: itemDetails?.id || orderItemId,
        orderId: itemDetails?.orderId || orderId,
        rating,
        title: title.trim(),
        body: trimmedBody,
        mediaUrls: uploadedImages,
        images: uploadedImages,
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Failed to submit your review. Please try again.');
        setIsSubmitting(false);
        return;
      }

      setSuccessMsg('Thank you! Your verified purchase review has been published.');

      // Trigger callback to update orders list without full reload
      if (onReviewSubmitted) {
        onReviewSubmitted();
      }

      // Smooth transition back after 1.5s
      setTimeout(() => {
        onBack();
      }, 1500);
    } catch {
      setErrorMsg('An unexpected network error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Back Link */}
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-6 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to My Orders</span>
        </button>

        {/* Unauthenticated State */}
        {!isAuthenticated && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 text-center shadow-xs">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 mb-4">
              <Lock className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Sign In to Write a Review</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              To ensure all reviews are authentic verified purchases, please sign in to the account that placed Order #{orderId.slice(0, 10).toUpperCase()}.
            </p>
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  // Navigate to account login while preserving return tab/URL
                  window.dispatchEvent(
                    new CustomEvent('veloce_navigate_tab', {
                      detail: { tab: 'user' },
                    })
                  );
                }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors cursor-pointer shadow-sm"
              >
                Sign In to Your Account
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isAuthenticated && isLoading && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-xs">
            <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Verifying purchase eligibility...</p>
          </div>
        )}

        {/* Ineligible Order State */}
        {isAuthenticated && !isLoading && !canSubmit && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 text-center shadow-xs">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 mb-4">
              <AlertCircle className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Review Not Available Yet</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              {ineligibilityReason}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={onBack}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Return to Orders
              </button>
            </div>
          </div>
        )}

        {/* Review Form Main Card */}
        {isAuthenticated && !isLoading && canSubmit && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* Header: Product Snapshot & Verified Badge */}
            <div className="p-6 sm:p-7 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-850/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-16 w-16 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
                    {itemDetails?.imageUrl ? (
                      <img
                        src={itemDetails.imageUrl}
                        alt={itemDetails.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <PackageCheck className="h-8 w-8 text-indigo-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/40 mb-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Verified Purchase</span>
                    </div>
                    <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                      {itemDetails?.name}
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      Order #{orderId.slice(0, 10).toUpperCase()} • Item #{orderItemId.slice(0, 8)}
                    </p>
                  </div>
                </div>


              </div>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-6">
              {/* Star Rating Section */}
              <div className="space-y-2.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Overall Rating <span className="text-rose-500">*</span>
                </label>
                <div
                  className="flex items-center gap-2"
                  role="radiogroup"
                  aria-label="Star Rating from 1 to 5"
                >
                  {[1, 2, 3, 4, 5].map((starValue) => {
                    const active = (hoverRating || rating) >= starValue;
                    return (
                      <button
                        key={starValue}
                        type="button"
                        role="radio"
                        aria-checked={rating === starValue}
                        aria-label={`${starValue} Star${starValue > 1 ? 's' : ''}`}
                        onClick={() => setRating(starValue)}
                        onMouseEnter={() => setHoverRating(starValue)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-2 -m-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-transform active:scale-95 cursor-pointer touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                      >
                        <Star
                          className={`h-8 w-8 transition-colors ${
                            active
                              ? 'text-amber-400 fill-amber-400 drop-shadow-xs'
                              : 'text-slate-200 dark:text-slate-700'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 italic">
                  {ratingLabels[hoverRating || rating]}
                </p>
              </div>

              {/* Review Title Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label
                    htmlFor="review-title"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                  >
                    Headline / Title (Optional)
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">{title.length} / 120</span>
                </div>
                <input
                  id="review-title"
                  type="text"
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Comfortable fit, beautiful fabric and arrived fast!"
                  className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-600 transition-colors"
                />
              </div>

              {/* Review Textarea */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label
                    htmlFor="review-body"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                  >
                    Written Review <span className="text-rose-500">*</span>
                  </label>
                  <span
                    className={`text-[11px] font-mono ${
                      body.length < 10
                        ? 'text-amber-600 dark:text-amber-400'
                        : body.length > 2000
                        ? 'text-rose-600 font-bold'
                        : 'text-slate-400'
                    }`}
                  >
                    {body.length} / 2,000 characters (min 10)
                  </span>
                </div>
                <textarea
                  id="review-body"
                  rows={5}
                  minLength={10}
                  maxLength={2000}
                  required
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="What did you like or dislike? How was the fit, material quality, and real-world durability?"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-600 transition-colors leading-relaxed"
                />
              </div>

              {/* Optional Photo Attachment */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Add Photos (Optional)
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  {uploadedImages.map((imgUrl, idx) => (
                    <div
                      key={idx}
                      className="relative h-16 w-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 group shrink-0"
                    >
                      <img src={imgUrl} alt={`Attachment ${idx + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-slate-950/70 text-white flex items-center justify-center hover:bg-rose-600 transition-colors"
                        title="Remove photo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}

                  {uploadedImages.length < 3 && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        onChange={handlePhotoSelect}
                        className="hidden"
                        id="photo-upload-input"
                      />
                      <label
                        htmlFor="photo-upload-input"
                        className="h-16 w-16 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-400 flex flex-col items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer shrink-0"
                        title="Upload a photo"
                      >
                        {isUploading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
                            <Upload className="h-4 w-4" />
                            <span className="text-[10px] mt-1 font-medium">Add</span>
                          </>
                        )}
                      </label>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  Attach up to 3 real photos showing your purchase (PNG, JPG, WebP up to 5MB each).
                </p>
              </div>

              {/* Inline Error and Success States */}
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Form Buttons */}
              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onBack}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto h-11 px-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors cursor-pointer min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isUploading}
                  className="w-full sm:w-auto h-11 px-7 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Publishing...</span>
                    </>
                  ) : (
                    <span>Submit Review</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
