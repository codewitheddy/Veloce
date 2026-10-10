import React from 'react';

/**
 * Shared Typographic Components for Ropenix Collections
 * Ensures 100% typographic consistency across every view, heading, body copy, and metadata tag.
 */

export interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  className?: string;
}

// 1. Headings (Space Grotesk, tightened leading and tracking)
export const H1 = React.forwardRef<HTMLHeadingElement, TypographyProps>(({ children, className = '', ...props }, ref) => (
  <h1
    ref={ref}
    className={`font-display font-bold text-2xl sm:text-3xl md:text-4xl text-slate-900 dark:text-white tracking-tight leading-tight ${className}`}
    {...props}
  >
    {children}
  </h1>
));
H1.displayName = 'H1';

export const H2 = React.forwardRef<HTMLHeadingElement, TypographyProps>(({ children, className = '', ...props }, ref) => (
  <h2
    ref={ref}
    className={`font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white tracking-tight leading-snug ${className}`}
    {...props}
  >
    {children}
  </h2>
));
H2.displayName = 'H2';

export const H3 = React.forwardRef<HTMLHeadingElement, TypographyProps>(({ children, className = '', ...props }, ref) => (
  <h3
    ref={ref}
    className={`font-display font-semibold text-lg sm:text-xl text-slate-900 dark:text-white tracking-tight leading-snug ${className}`}
    {...props}
  >
    {children}
  </h3>
));
H3.displayName = 'H3';

export const H4 = React.forwardRef<HTMLHeadingElement, TypographyProps>(({ children, className = '', ...props }, ref) => (
  <h4
    ref={ref}
    className={`font-display font-semibold text-base sm:text-lg text-slate-900 dark:text-white tracking-tight leading-snug ${className}`}
    {...props}
  >
    {children}
  </h4>
));
H4.displayName = 'H4';

export const H5 = React.forwardRef<HTMLHeadingElement, TypographyProps>(({ children, className = '', ...props }, ref) => (
  <h5
    ref={ref}
    className={`font-display font-semibold text-sm sm:text-base text-slate-900 dark:text-white tracking-tight leading-normal ${className}`}
    {...props}
  >
    {children}
  </h5>
));
H5.displayName = 'H5';

export const H6 = React.forwardRef<HTMLHeadingElement, TypographyProps>(({ children, className = '', ...props }, ref) => (
  <h6
    ref={ref}
    className={`font-display font-semibold text-xs sm:text-sm text-slate-900 dark:text-white tracking-normal leading-normal ${className}`}
    {...props}
  >
    {children}
  </h6>
));
H6.displayName = 'H6';

// 2. Body Text & Paragraphs (Inter font)
export interface ParagraphProps extends TypographyProps {
  size?: 'sm' | 'base' | 'lg';
  muted?: boolean;
}

export const Paragraph = React.forwardRef<HTMLParagraphElement, ParagraphProps>(
  ({ children, size = 'base', muted = false, className = '', ...props }, ref) => {
    const sizeClasses = {
      sm: 'text-xs leading-relaxed',
      base: 'text-sm leading-relaxed',
      lg: 'text-base leading-relaxed',
    };

    const colorClass = muted
      ? 'text-slate-500 dark:text-slate-400'
      : 'text-slate-700 dark:text-slate-200';

    return (
      <p
        ref={ref}
        className={`font-sans font-normal max-w-prose ${sizeClasses[size]} ${colorClass} ${className}`}
        {...props}
      >
        {children}
      </p>
    );
  }
);
Paragraph.displayName = 'Paragraph';

// 3. Section Kicker / Eyebrow Tagline (JetBrains Mono uppercase tracking)
export const SectionEyebrow = React.forwardRef<HTMLSpanElement, TypographyProps>(
  ({ children, className = '', ...props }, ref) => (
    <span
      ref={ref}
      className={`font-mono text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 select-none block mb-1.5 ${className}`}
      {...props}
    >
      {children}
    </span>
  )
);
SectionEyebrow.displayName = 'SectionEyebrow';

// 4. Form Labels & Input Subtitles
export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const FormLabel = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ children, required = false, className = '', ...props }, ref) => (
    <label
      ref={ref}
      className={`block font-sans text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 select-none ${className}`}
      {...props}
    >
      {children}
      {required && <span className="text-rose-500 ml-1 font-bold">*</span>}
    </label>
  )
);
FormLabel.displayName = 'FormLabel';

// 5. Monospace Meta / Caption / SKU Code
export const MonoCaption = React.forwardRef<HTMLSpanElement, TypographyProps>(
  ({ children, className = '', ...props }, ref) => (
    <span
      ref={ref}
      className={`font-mono text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider ${className}`}
      {...props}
    >
      {children}
    </span>
  )
);
MonoCaption.displayName = 'MonoCaption';

// 6. Formatted Price Display
export interface PriceDisplayProps extends React.HTMLAttributes<HTMLSpanElement> {
  priceFormatted: string;
  originalPriceFormatted?: string;
  isOnSale?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  priceFormatted,
  originalPriceFormatted,
  isOnSale = false,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm font-bold',
    lg: 'text-lg font-bold sm:text-xl',
  };

  return (
    <div className={`inline-flex items-baseline gap-2 font-sans tracking-tight ${className}`}>
      {isOnSale && originalPriceFormatted && (
        <span className="text-xs text-slate-400 line-through font-normal">
          {originalPriceFormatted}
        </span>
      )}
      <span className={`text-slate-950 dark:text-white font-bold ${sizeClasses[size]}`}>
        {priceFormatted}
      </span>
    </div>
  );
};
