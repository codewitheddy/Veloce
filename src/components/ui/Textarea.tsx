import React, { forwardRef } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', label, error, helperText, rows = 3, ...props }, ref) => {
    return (
      <div className="flex flex-col w-full space-y-1">
        {label && (
          <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider font-sans select-none">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          rows={rows}
          className={`w-full text-xs p-3 bg-gray-55/65 hover:bg-gray-55 border rounded-xl font-sans text-gray-850 dark:text-gray-100 transition-all placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none leading-normal ${
            error
              ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500'
              : 'border-gray-200/90 dark:border-slate-800'
          } ${className}`}
          {...props}
        />
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

Textarea.displayName = 'Textarea';

export default Textarea;
