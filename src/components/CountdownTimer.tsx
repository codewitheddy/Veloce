/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  endDate: string | Date;
  onExpire?: () => void;
  className?: string;
  compact?: boolean;
}

export default function CountdownTimer({
  endDate,
  onExpire,
  className = '',
  compact = false,
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const end = new Date(endDate).getTime();
      const now = new Date().getTime();
      const difference = end - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
        if (onExpire) {
          onExpire();
        }
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, isExpired: false });
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [endDate, onExpire]);

  const pad = (num: number) => String(num).padStart(2, '0');

  if (timeLeft.isExpired) {
    return (
      <div className={`inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-[10px] font-mono font-bold text-rose-600 uppercase tracking-wider ${className}`}>
        Offer Expired
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1 text-[10px] font-mono text-rose-600 bg-rose-50 px-2 py-0.5 rounded font-bold ${className}`}>
        <Clock className="h-3 w-3 animate-pulse" />
        {timeLeft.days > 0 ? `${timeLeft.days}d ` : ''}
        {pad(timeLeft.hours)}h:{pad(timeLeft.minutes)}m:{pad(timeLeft.seconds)}s
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 bg-rose-950/90 text-rose-100 rounded-lg px-2.5 py-1 border border-rose-800/30 font-mono text-[10px] font-semibold ${className}`}>
      <Clock className="h-3 w-3 text-rose-400 animate-pulse" />
      <span className="text-rose-300">ENDS:</span>
      <div className="flex items-center gap-0.5">
        {timeLeft.days > 0 && (
          <>
            <span className="font-bold text-white">{pad(timeLeft.days)}</span>
            <span className="text-rose-400 text-[9px] mr-1">d</span>
          </>
        )}
        <span className="font-bold text-white">{pad(timeLeft.hours)}</span>
        <span className="text-rose-400 text-[9px]">h</span>
        <span className="text-rose-400 font-bold mx-0.5 animate-pulse">:</span>
        <span className="font-bold text-white">{pad(timeLeft.minutes)}</span>
        <span className="text-rose-400 text-[9px]">m</span>
        <span className="text-rose-400 font-bold mx-0.5 animate-pulse">:</span>
        <span className="font-bold text-rose-300">{pad(timeLeft.seconds)}</span>
        <span className="text-rose-400 text-[9px]">s</span>
      </div>
    </div>
  );
}
