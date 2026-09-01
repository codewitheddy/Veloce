import { useState, useEffect, useCallback } from 'react';
import { isCurrentHappyHour } from '../services/deliveryEngine';

export interface HappyHourTimeRemaining {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  formatted: string;
}

export interface HappyHourStatus {
  isActive: boolean;
  discountPercentage: number;
  timeRemaining: HappyHourTimeRemaining;
  statusPeriod: 'active' | 'upcoming' | 'ended';
  nextHappyHourFormatted: string;
  title: string;
  description: string;
  startTimeText: string;
  endTimeText: string;
}

/**
 * Custom React hook to track real-time Happy Hour status and countdown timer.
 * Default Happy Hour Window: 14:00 (2:00 PM) - 16:00 (4:00 PM) daily.
 */
export function useHappyHourStatus(
  customStartHour = 14,
  customEndHour = 16,
  discountPercentage = 50
): HappyHourStatus {
  const calculateStatus = useCallback((): HappyHourStatus => {
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentSeconds = now.getSeconds();

    const startToday = new Date(now);
    startToday.setHours(customStartHour, 0, 0, 0);

    const endToday = new Date(now);
    endToday.setHours(customEndHour, 0, 0, 0);

    let isActive = false;
    let statusPeriod: 'active' | 'upcoming' | 'ended' = 'upcoming';
    let targetDate = startToday;

    if (now >= startToday && now < endToday) {
      isActive = true;
      statusPeriod = 'active';
      targetDate = endToday;
    } else if (now >= endToday) {
      statusPeriod = 'ended';
      // Next happy hour is tomorrow at startHour
      const startTomorrow = new Date(now);
      startTomorrow.setDate(startTomorrow.getDate() + 1);
      startTomorrow.setHours(customStartHour, 0, 0, 0);
      targetDate = startTomorrow;
    } else {
      statusPeriod = 'upcoming';
      targetDate = startToday;
    }

    const diffMs = Math.max(0, targetDate.getTime() - now.getTime());
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n: number) => String(n).padStart(2, '0');
    const formatted = hours > 0
      ? `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`
      : `${pad(minutes)}m ${pad(seconds)}s`;

    const startTimeText = `${customStartHour > 12 ? customStartHour - 12 : customStartHour}:00 ${customStartHour >= 12 ? 'PM' : 'AM'}`;
    const endTimeText = `${customEndHour > 12 ? customEndHour - 12 : customEndHour}:00 ${customEndHour >= 12 ? 'PM' : 'AM'}`;

    let title = `${discountPercentage}% OFF Delivery Happy Hour!`;
    let description = `Enjoy ${discountPercentage}% off express and standard delivery fees on all orders!`;

    if (statusPeriod === 'upcoming') {
      title = `Happy Hour Starts Soon (${startTimeText})`;
      description = `Get ready for ${discountPercentage}% OFF delivery starting at ${startTimeText}!`;
    } else if (statusPeriod === 'ended') {
      title = `Next Happy Hour Tomorrow at ${startTimeText}`;
      description = `Missed today's Happy Hour? Catch ${discountPercentage}% OFF delivery again tomorrow!`;
    }

    return {
      isActive,
      discountPercentage,
      timeRemaining: {
        hours,
        minutes,
        seconds,
        totalSeconds,
        formatted,
      },
      statusPeriod,
      nextHappyHourFormatted: `${startTimeText} - ${endTimeText}`,
      title,
      description,
      startTimeText,
      endTimeText,
    };
  }, [customStartHour, customEndHour, discountPercentage]);

  const [status, setStatus] = useState<HappyHourStatus>(calculateStatus);

  useEffect(() => {
    // Initial evaluation
    setStatus(calculateStatus());

    // Tick every second
    const interval = setInterval(() => {
      setStatus(calculateStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, [calculateStatus]);

  return status;
}

export default useHappyHourStatus;
