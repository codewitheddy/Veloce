import React, { forwardRef } from 'react';
import { motion } from 'motion/react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'brand';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    // Base styles
    const baseStyle =
      'inline-flex items-center justify-center font-sans font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer active:scale-[0.98]';

    // Size variants
    const sizes = {
      xs: 'px-2 py-1 text-[10px] rounded-md gap-1',
      sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
      md: 'px-4 py-2 text-xs rounded-xl gap-2',
      lg: 'px-5 py-2.5 text-sm rounded-xl gap-2.5',
    };

    // Color/Visual variants
    const variants = {
      primary:
        'bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-500 hover:shadow-sm dark:bg-indigo-600 dark:hover:bg-indigo-700',
      secondary:
        'bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 dark:text-gray-200 dark:border-gray-700',
      outline:
        'bg-transparent hover:bg-indigo-50/50 text-indigo-700 border border-indigo-250 dark:text-indigo-400 dark:border-indigo-900/60 dark:hover:bg-indigo-950/20',
      ghost:
        'bg-transparent hover:bg-gray-100 text-gray-700 dark:text-gray-300 dark:hover:bg-gray-800/60 border border-transparent',
      danger:
        'bg-rose-600 hover:bg-rose-700 text-white border border-rose-550 hover:shadow-sm dark:bg-rose-650 dark:hover:bg-rose-750',
      success:
        'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-550 hover:shadow-sm dark:bg-emerald-650 dark:hover:bg-emerald-750',
      brand:
        'bg-brand-primary hover:bg-indigo-650 text-white border border-indigo-500 hover:shadow-sm',
    };

    const isBtnDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isBtnDisabled}
        className={`${baseStyle} ${sizes[size]} ${variants[variant]} ${className}`}
        {...props}
      >
        {isLoading && (
          <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
        )}
        {!isLoading && leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
        <span className="truncate">{children}</span>
        {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
