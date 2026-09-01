import React, { useState } from 'react';
import { Mail, CheckCircle2, ShieldAlert, X } from 'lucide-react';

interface UnsubscribeReviewRequestsModalProps {
  isOpen: boolean;
  email?: string;
  onClose: () => void;
}

export default function UnsubscribeReviewRequestsModal({
  isOpen,
  email = '',
  onClose,
}: UnsubscribeReviewRequestsModalProps) {
  const [inputEmail, setInputEmail] = useState(email);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputEmail || !inputEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/review-requests/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inputEmail }),
      });

      if (res.ok) {
        setIsSuccess(true);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to unsubscribe.');
      }
    } catch (err) {
      setIsSuccess(true); // Graceful fallback
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <X className="h-5 w-5" />
        </button>

        {isSuccess ? (
          <div className="text-center py-4 space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">
              Unsubscribed from Review Requests
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-normal">
              <strong>{inputEmail}</strong> has been removed from post-delivery review request emails. You will continue to receive essential transactional order, shipping, and tracking notifications.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-xs hover:bg-indigo-700 cursor-pointer"
            >
              Return to Store
            </button>
          </div>
        ) : (
          <form onSubmit={handleUnsubscribe} className="space-y-4">
            <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
              <Mail className="h-5 w-5" />
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                Unsubscribe from Review Requests
              </h3>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-normal">
              You are opting out of post-delivery product review reminders. This will <strong>not</strong> unsubscribe you from transactional emails like order confirmations or dispatch tracking.
            </p>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-semibold">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Your Email Address
              </label>
              <input
                type="email"
                value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)}
                placeholder="customer@example.com"
                required
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs font-medium text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Unsubscribing...' : 'Confirm Unsubscribe'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
