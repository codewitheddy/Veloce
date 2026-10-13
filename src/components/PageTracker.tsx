import React from 'react';
import { usePageTracking } from '../hooks/usePageTracking';

interface PageTrackerProps {
  currentTab: string;
  selectedProductId?: string | number | null;
}

/**
 * GA4 Page View Tracker Component
 * Mount once at root to track SPA route transitions without duplicate events.
 */
export default function PageTracker({ currentTab, selectedProductId }: PageTrackerProps) {
  usePageTracking(currentTab, selectedProductId);
  return null;
}
