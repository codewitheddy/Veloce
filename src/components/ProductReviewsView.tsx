import React, { useState, useEffect } from 'react';
import {
  Star,
  CheckCircle2,
  ThumbsUp,
  Image as ImageIcon,
  ShieldCheck,
  AlertCircle,
  X,
  Upload,
  Edit2,
  Trash2,
  ArrowLeft,
  Filter,
  Sparkles,
  Lock,
  PackageCheck,
  Clock,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { Product, Review, ReviewEligibilityCheck } from '../types';
import { CurrencyType } from '../lib/currency';
import { buildAdminNewReviewEmail } from '../lib/emailNotifier';
import { EmailNotification } from './EmailToaster';

interface ProductReviewsViewProps {
  product: Product;
  userEmail?: string;
  userName?: string;
  userId?: string | number;
  currency?: CurrencyType;
  initialRating?: number;
  initialOrderId?: string;
  initialOpenForm?: boolean;
  onBack: () => void;
  onOpenAuthModal?: () => void;
  onProductUpdate?: (updatedProduct: Product) => void;
  onTriggerEmailToast?: (toast: EmailNotification) => void;
}

export default function ProductReviewsView({
  product,
  userEmail = '',
  userName = '',
  userId,
  currency = 'KSh',
  initialRating,
  initialOrderId,
  initialOpenForm,
  onBack,
  onOpenAuthModal,
  onProductUpdate,
  onTriggerEmailToast,
}: ProductReviewsViewProps) {
  // State for reviews list & summary
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<{
    average: number;
    totalCount: number;
    distribution: Record<number, number>;
  }>({
    average: product.rating || 5.0,
    totalCount: product.reviewsCount || 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  });
  const [isLoading, setIsLoading] = useState(true);

  // Filter & Sort state
  const [selectedStarFilter, setSelectedStarFilter] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'highest' | 'lowest' | 'helpful'>('recent');
  const [searchQuery, setSearchQuery] = useState('');

  // Eligibility check state
  const [eligibility, setEligibility] = useState<ReviewEligibilityCheck>({
    eligible: false,
    message: 'Checking verified purchase eligibility...',
  });
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(true);

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);

  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState(userName || '');
  const [usePrivacyName, setUsePrivacyName] = useState(true);

  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lightbox modal state
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);

  // Fetch reviews from API
  const fetchReviews = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/products/${product.id}/reviews?sort=${sortBy}${selectedStarFilter !== 'all' ? `&rating=${selectedStarFilter}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
        if (data.summary) {
          setSummary(data.summary);
          if (onProductUpdate) {
            onProductUpdate({
              ...product,
              rating: data.summary.average,
              reviewsCount: data.summary.totalCount,
              reviews: data.reviews,
            });
          }
        }
      }
    } catch (err) {
      console.warn('Could not load server reviews, falling back to embedded reviews:', err);
      setReviews(product.reviews || []);
    } finally {
      setIsLoading(false);
    }
  };

  // Check user eligibility from API
  const checkEligibility = async () => {
    setIsCheckingEligibility(true);
    try {
      const res = await fetch('/api/reviews/check-eligibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail,
          userId,
          productId: product.id,
          sku: product.sku,
        }),
      });
      if (res.ok) {
        const data: ReviewEligibilityCheck = await res.json();
        setEligibility(data);
      }
    } catch (err) {
      setEligibility({
        eligible: false,
        reason: 'NOT_PURCHASED',
        message: 'Unable to verify order history offline.',
      });
    } finally {
      setIsCheckingEligibility(false);
    }
  };

  useEffect(() => {
    fetchReviews();
    checkEligibility();
  }, [product.id, userEmail, sortBy, selectedStarFilter]);

  // Handle deep-link initial parameters from email review requests
  useEffect(() => {
    if (initialRating || initialOpenForm) {
      if (initialRating && initialRating >= 1 && initialRating <= 5) {
        setRating(initialRating);
      }
      setIsFormOpen(true);
      if (initialOrderId) {
        // Track click on review request email
        fetch('/api/review-requests/track-click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: initialOrderId, productId: product.id }),
        }).catch(() => {});
      }
    }
  }, [initialRating, initialOrderId, initialOpenForm, product.id]);

  // Handle Form Submission
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (comment.trim().length < 10) {
      setFormError('Please write at least 10 characters detailing your experience with this item.');
      return;
    }

    setIsSubmitting(true);

    // Compute display name format
    let finalDisplayName = displayName.trim() || userName || 'Verified Purchaser';
    if (usePrivacyName && finalDisplayName.includes(' ')) {
      const parts = finalDisplayName.split(' ');
      finalDisplayName = `${parts[0]} ${parts[parts.length - 1][0]}.`;
    }

    try {
      const url = isEditing && editingReviewId ? `/api/reviews/${editingReviewId}` : '/api/reviews';
      const method = isEditing && editingReviewId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail,
          userId,
          userName: userName || displayName || 'Customer',
          reviewerDisplayName: finalDisplayName,
          productId: product.id,
          orderId: eligibility.orderId,
          rating,
          title,
          comment,
          mediaUrls,
          purchasedVariant: eligibility.purchasedVariant,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || 'Failed to submit review. Server-side check did not pass.');
        setIsSubmitting(false);
        return;
      }

      setFormSuccess(isEditing ? 'Your review has been updated!' : 'Thank you! Your verified purchase review has been published.');
      setIsFormOpen(false);
      setIsEditing(false);
      setEditingReviewId(null);

      // Trigger admin email alert for new review submission
      if (onTriggerEmailToast && !isEditing) {
        const adminReviewAlert = buildAdminNewReviewEmail(product.name, finalDisplayName, rating, comment);
        onTriggerEmailToast(adminReviewAlert);
      }
      
      // Refresh list & eligibility
      fetchReviews();
      checkEligibility();
    } catch (err: any) {
      setFormError('An error occurred while publishing your review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Form
  const handleStartEdit = (rev: Review) => {
    setEditingReviewId(rev.id);
    setIsEditing(true);
    setRating(rev.rating);
    setTitle(rev.title || '');
    setComment(rev.comment);
    setMediaUrls(rev.mediaUrls || []);
    setDisplayName(rev.reviewerDisplayName || rev.userName);
    setIsFormOpen(true);
  };

  // Handle Delete Review
  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm('Are you sure you want to remove your review for this product?')) return;
    try {
      const res = await fetch(`/api/reviews/${reviewId}?userEmail=${encodeURIComponent(userEmail)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchReviews();
        checkEligibility();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Toggle Helpful Vote
  const handleToggleHelpful = async (reviewId: string) => {
    try {
      const res = await fetch(`/api/reviews/${reviewId}/helpful`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail, userId }),
      });
      if (res.ok) {
        fetchReviews();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Image Upload handler (convert file to data URL or preview URL)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    if (mediaUrls.length + files.length > 5) {
      setFormError('You can upload a maximum of 5 photos/videos per review.');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'];

    Array.from(files).forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        setFormError(`File "${file.name}" exceeds the 5MB size limit.`);
        return;
      }

      if (!allowedTypes.includes(file.type.toLowerCase())) {
        setFormError(`File "${file.name}" has an unsupported format. Please upload JPEG, PNG, WEBP, MP4, or WEBM files.`);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setMediaUrls((prev) => [...prev, reader.result as string].slice(0, 5));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Remove photo from preview
  const handleRemovePhoto = (index: number) => {
    setMediaUrls((prev) => prev.filter((_, i) => i !== index));
  };

  // Filter reviews client-side by search
  const filteredReviews = reviews.filter((rev) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      rev.comment.toLowerCase().includes(q) ||
      (rev.title && rev.title.toLowerCase().includes(q)) ||
      rev.userName.toLowerCase().includes(q) ||
      (rev.purchasedVariant && rev.purchasedVariant.toLowerCase().includes(q))
    );
  });

  // Descriptive ratings helper
  const getRatingLabel = (stars: number) => {
    switch (stars) {
      case 5: return '5 Stars • Outstanding / Elite Grade';
      case 4: return '4 Stars • High Quality & Satisfactory';
      case 3: return '3 Stars • Fair / Decent Performance';
      case 2: return '2 Stars • Underperforming / Subpar';
      case 1: return '1 Star • Flawed / Significant Defects';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Top Header / Back Button */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Product Page
          </button>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Verified Customer Reviews</span>
          </div>
        </div>

        {/* Product Brief Banner */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={product.imageUrl || (product.images && product.images[0])}
              alt={product.name}
              className="h-16 w-16 object-cover rounded-xl border border-slate-200 dark:border-slate-800 shrink-0"
            />
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                {product.category || 'General'} • SKU: {product.sku || product.id}
              </span>
              <h1 className="font-display text-lg font-bold text-slate-900 dark:text-white leading-snug">
                {product.name}
              </h1>
              <div className="flex items-center gap-2 mt-1 text-xs">
                <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                  {currency} {product.price.toLocaleString()}
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">In Stock</span>
              </div>
            </div>
          </div>
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors shrink-0 cursor-pointer"
          >
            View Product Details
          </button>
        </div>

        {/* Ratings Overview Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          
          {/* Rating Big Number */}
          <div className="md:col-span-4 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 pb-6 md:pb-0 md:pr-6">
            <div className="text-5xl font-display font-extrabold text-slate-900 dark:text-white leading-none">
              {summary.average.toFixed(1)}
            </div>
            <div className="flex items-center text-amber-500 gap-1 my-2">
              {Array.from({ length: 5 }).map((_, idx) => (
                <Star
                  key={idx}
                  className={`h-5 w-5 ${idx < Math.round(summary.average) ? 'fill-current text-amber-500' : 'text-slate-200 dark:text-slate-700'}`}
                />
              ))}
            </div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 font-mono">
              Based on {summary.totalCount} verified audit{summary.totalCount === 1 ? '' : 's'}
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              100% Verified Purchases
            </div>
          </div>

          {/* Star Rating Distribution Bars */}
          <div className="md:col-span-8 space-y-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = summary.distribution[star] || 0;
              const percent = summary.totalCount > 0 ? Math.round((count / summary.totalCount) * 100) : 0;
              const isSelected = selectedStarFilter === star;

              return (
                <button
                  key={star}
                  onClick={() => setSelectedStarFilter(isSelected ? 'all' : star)}
                  className={`w-full flex items-center gap-3 group text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 transition-colors p-1.5 rounded-lg ${
                    isSelected ? 'bg-indigo-50 dark:bg-indigo-950/50 ring-1 ring-indigo-500' : 'hover:bg-slate-50 dark:hover:bg-slate-850'
                  }`}
                >
                  <span className="font-bold w-12 text-right font-mono flex items-center justify-end gap-1">
                    {star} <Star className="h-3 w-3 fill-amber-400 text-amber-400 inline" />
                  </span>
                  <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="w-16 text-right font-mono text-[11px] text-slate-500 font-semibold">
                    {count} ({percent}%)
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Eligibility Status Banner */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          {isCheckingEligibility ? (
            <div className="flex items-center gap-3 text-xs text-slate-500 font-mono py-2">
              <div className="h-4 w-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
              Checking customer purchase verification history...
            </div>
          ) : !userEmail && !userId ? (
            /* Not logged in */
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Customer Log-in Required</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    To maintain audit authenticity, reviews are strictly limited to logged-in customers with verified completed orders.
                  </p>
                </div>
              </div>
              {onOpenAuthModal && (
                <button
                  onClick={onOpenAuthModal}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  Log In / Register
                </button>
              )}
            </div>
          ) : eligibility.eligible ? (
            /* Eligible */
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <PackageCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Verified Purchase Confirmed</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-200/60 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 font-bold">
                      Order #{eligibility.orderId}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-0.5">
                    You bought this item on {userEmail}. Share your experience with other customers!
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditingReviewId(null);
                  setTitle('');
                  setComment('');
                  setMediaUrls([]);
                  setRating(5);
                  setIsFormOpen(!isFormOpen);
                }}
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer shrink-0 flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {isFormOpen ? 'Cancel Form' : 'Write Verified Review'}
              </button>
            </div>
          ) : eligibility.reason === 'ALREADY_REVIEWED' ? (
            /* Already Reviewed */
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-200">Review Submitted</h4>
                  <p className="text-[11px] text-indigo-800 dark:text-indigo-300 mt-0.5">
                    You have already submitted a verified review for Order #{eligibility.orderId}. You can update your review at any time.
                  </p>
                </div>
              </div>
              {eligibility.existingReview && (
                <button
                  onClick={() => handleStartEdit(eligibility.existingReview!)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Edit My Review
                </button>
              )}
            </div>
          ) : eligibility.reason === 'ORDER_NOT_DELIVERED' ? (
            /* Order Not Delivered */
            <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">Order In Transit / Processing</h4>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                  {eligibility.message}
                </p>
              </div>
            </div>
          ) : (
            /* Not Purchased */
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <AlertCircle className="h-5 w-5 text-slate-400 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Purchase Verification Notice</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {eligibility.message}
                </p>
              </div>
            </div>
          )}

          {/* Review Submission Form Modal / Drawer */}
          {isFormOpen && (
            <form onSubmit={handleSubmitReview} className="mt-5 border-t border-slate-200 dark:border-slate-800 pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-600" />
                  {isEditing ? 'Edit Your Review' : 'Write Verified Purchaser Review'}
                </h3>
                <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">
                  Order #{eligibility.orderId}
                </span>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {formError}
                </div>
              )}

              {formSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {formSuccess}
                </div>
              )}

              {/* Star Rating Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
                  Overall Rating Score *
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 cursor-pointer">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 text-amber-400 focus:outline-hidden transition-transform hover:scale-110"
                      >
                        <Star
                          className={`h-7 w-7 ${
                            star <= (hoverRating || rating)
                              ? 'fill-current text-amber-500'
                              : 'text-slate-200 dark:text-slate-700'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 font-mono ml-2">
                    {getRatingLabel(hoverRating || rating)}
                  </span>
                </div>
              </div>

              {/* Title & Display Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 font-mono">
                    Review Headline (Optional)
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Flawless build quality and fast Nairobi delivery!"
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-normal focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 font-mono">
                    Reviewer Display Handle
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-normal focus:border-indigo-500 focus:outline-hidden"
                  />
                  <label className="mt-1.5 inline-flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                    <input
                      type="checkbox"
                      checked={usePrivacyName}
                      onChange={(e) => setUsePrivacyName(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Display as "{displayName.split(' ')[0]} {displayName.split(' ')[1]?.[0] || ''}." for privacy</span>
                  </label>
                </div>
              </div>

              {/* Review Body */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 font-mono">
                  Detailed Experience & Feedback *
                </label>
                <textarea
                  required
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share details regarding product quality, durability, ergonomics, packaging, or performance..."
                  className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-normal focus:border-indigo-500 focus:outline-hidden"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                  <span>Minimum 10 characters</span>
                  <span>{comment.length} / 2000</span>
                </div>
              </div>

              {/* Photo Upload Section */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
                  Customer Photos & Video Attachments (Max 5 files)
                </label>
                
                <div className="flex flex-wrap items-center gap-3">
                  {mediaUrls.map((url, idx) => (
                    <div key={idx} className="relative h-16 w-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 group">
                      <img src={url} alt={`Upload ${idx}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-slate-900/80 text-white flex items-center justify-center opacity-90 hover:bg-red-600 transition-colors text-xs"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}

                  {mediaUrls.length < 5 && (
                    <label className="h-16 w-16 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50 dark:bg-slate-850 text-slate-500 hover:text-indigo-600">
                      <Upload className="h-4 w-4" />
                      <span className="text-[9px] font-mono mt-1">Add Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      {isEditing ? 'Save Changes' : 'Publish Verified Review'}
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Reviews List Toolbar & Search */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono uppercase tracking-wider">
              Filter:
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(['all', 5, 4, 3, 2, 1] as const).map((star) => (
                <button
                  key={star}
                  onClick={() => setSelectedStarFilter(star)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 font-mono ${
                    selectedStarFilter === star
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {star === 'all' ? 'All Reviews' : `${star}★`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search review comments..."
              className="h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs w-full sm:w-48 focus:border-indigo-500 focus:outline-hidden"
            />
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium cursor-pointer focus:border-indigo-500 focus:outline-hidden shrink-0"
            >
              <option value="recent">Most Recent</option>
              <option value="highest">Highest Rating</option>
              <option value="lowest">Lowest Rating</option>
              <option value="helpful">Most Helpful</option>
            </select>
          </div>
        </div>

        {/* Reviews List Cards */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12 text-slate-400 font-mono text-xs">
              <div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading verified customer feedback...
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
              <Star className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Reviews Found</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                {selectedStarFilter !== 'all'
                  ? `No ${selectedStarFilter}-star reviews currently available for this product.`
                  : 'Be the first verified customer to write feedback for this product after receiving your order.'}
              </p>
            </div>
          ) : (
            filteredReviews.map((rev) => {
              const isOwner = userEmail && rev.userEmail && rev.userEmail.toLowerCase() === userEmail.toLowerCase();
              const hasVoted = userEmail && rev.helpfulUserIds && rev.helpfulUserIds.includes(userEmail);

              return (
                <div
                  key={rev.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-3"
                >
                  {/* Top Bar: User details & Rating */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                        {(rev.reviewerDisplayName || rev.userName).slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {rev.reviewerDisplayName || rev.userName}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            Verified Purchase
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex items-center text-amber-500">
                            {Array.from({ length: 5 }).map((_, idx) => (
                              <Star
                                key={idx}
                                className={`h-3.5 w-3.5 ${
                                  idx < Math.floor(rev.rating)
                                    ? 'fill-current text-amber-500'
                                    : 'text-slate-200 dark:text-slate-700'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">•</span>
                          <span className="text-[10px] font-mono text-slate-400">{rev.date}</span>
                          {rev.isEdited && (
                            <span className="text-[10px] font-mono italic text-slate-400">(edited)</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Owner Actions (Edit / Delete) */}
                    {isOwner && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleStartEdit(rev)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          title="Edit Review"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteReview(rev.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          title="Delete Review"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Purchased Variant Tag */}
                  {rev.purchasedVariant && (
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-850 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 inline-block">
                      Variant: <span className="font-semibold text-slate-700 dark:text-slate-300">{rev.purchasedVariant}</span>
                    </div>
                  )}

                  {/* Review Title & Body */}
                  <div>
                    {rev.title && (
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1 leading-snug">
                        {rev.title}
                      </h4>
                    )}
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                      "{rev.comment}"
                    </p>
                  </div>

                  {/* Customer Attached Photos Gallery */}
                  {rev.mediaUrls && rev.mediaUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {rev.mediaUrls.map((imgUrl, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveLightboxImage(imgUrl)}
                          className="h-16 w-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 hover:opacity-90 transition-opacity cursor-pointer focus:outline-hidden"
                        >
                          <img src={imgUrl} alt={`Customer upload ${i}`} className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Footer: Helpful Vote button */}
                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-3 mt-2 text-[11px] text-slate-500">
                    <button
                      onClick={() => handleToggleHelpful(rev.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border transition-colors cursor-pointer font-mono ${
                        hasVoted
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-300'
                          : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <ThumbsUp className={`h-3 w-3 ${hasVoted ? 'fill-current' : ''}`} />
                      <span>Helpful ({rev.helpfulVotes || 0})</span>
                    </button>

                    {rev.orderId && (
                      <span className="font-mono text-[10px] text-slate-400">
                        Audit Ref: #{rev.orderId}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Photo Lightbox Modal */}
        {activeLightboxImage && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setActiveLightboxImage(null)}
          >
            <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-black" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setActiveLightboxImage(null)}
                className="absolute top-3 right-3 h-8 w-8 rounded-full bg-slate-900/80 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              <img
                src={activeLightboxImage}
                alt="Full resolution customer attachment"
                className="max-h-[85vh] w-auto object-contain mx-auto"
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
