import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, helperText, leftElement, rightElement, type = 'text', ...props }, ref) => {
    return (
      <div className="flex flex-col w-full space-y-1">
        {label && (
          <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider font-sans select-none">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftElement && (
            <div className="absolute left-3.5 flex items-center justify-center text-gray-400 pointer-events-none">
              {leftElement}
            </div>
          )}
          <input
            ref={ref}
            type={type}
            className={`w-full text-xs p-3 bg-gray-55/65 hover:bg-gray-55 border rounded-xl font-sans text-gray-850 dark:text-gray-100 transition-all placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
              leftElement ? 'pl-9' : ''
            } ${rightElement ? 'pr-9' : ''} ${
              error
                ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500'
                : 'border-gray-200/90 dark:border-slate-800'
            } ${className}`}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3.5 flex items-center justify-center text-gray-400">
              {rightElement}
            </div>
          )}
        </div>
        {error && (
          <p className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 font-sans mt-0.5">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-sans mt-0.5 leading-normal">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
