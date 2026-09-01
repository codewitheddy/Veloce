import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ children, className = '', variant = 'default', ...props }, ref) => {
    // Styling states
    const baseStyle =
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono text-[9px] font-bold tracking-wider uppercase select-none border shadow-3xs';

    const variants = {
      default:
        'bg-indigo-50 border-indigo-150 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-900/30 dark:text-indigo-300',
      secondary:
        'bg-gray-50 border-gray-150 text-gray-700 dark:bg-slate-800/40 dark:border-slate-800 dark:text-gray-300',
      success:
        'bg-emerald-50 border-emerald-150 text-emerald-700 dark:bg-emerald-950/45 dark:border-emerald-900/30 dark:text-emerald-400',
      warning:
        'bg-amber-50 border-amber-150 text-amber-700 dark:bg-amber-950/45 dark:border-amber-900/30 dark:text-amber-400',
      danger:
        'bg-rose-50 border-rose-150 text-rose-700 dark:bg-rose-950/45 dark:border-rose-900/30 dark:text-rose-400',
      info:
        'bg-sky-50 border-sky-150 text-sky-700 dark:bg-sky-950/45 dark:border-sky-900/30 dark:text-sky-400',
      outline:
        'bg-transparent border-gray-250 text-gray-600 dark:border-slate-700 dark:text-gray-400',
    };

    return (
      <span
        ref={ref}
        className={`${baseStyle} ${variants[variant]} ${className}`}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
export default Badge;
