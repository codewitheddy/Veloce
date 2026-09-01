import React from 'react';

interface VeloceLogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  light?: boolean;
}

export default function VeloceLogo({ className = '', iconOnly = false, size = 'md', light = false }: VeloceLogoProps) {
  // Dimensions based on size preset
  const iconSize = {
    sm: 'h-6 w-6',
    md: 'h-9 w-9',
    lg: 'h-16 w-16'
  }[size];

  const textClass = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-2xl'
  }[size];

  const subtextClass = {
    sm: 'text-[7px]',
    md: 'text-[9px]',
    lg: 'text-xs'
  }[size];

  // Under the Hood: Hand-crafted high-fidelity SVG geometry recreating the precise
  // double-ribbon tilted corner fold mark from Veloce brand design.
  const logoMarkSvg = (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={`${iconSize} shrink-0 transition-transform duration-300 hover:scale-105`}
    >
      {/* Outer fold path */}
      <path 
        d="M 38 15 L 12 63 L 64 44 M 64 44 L 54 30 L 32 38 L 48 15 Z" 
        fill="currentColor"
        className="text-indigo-600"
      />
      {/* Inner folding accent to give that premium geometric depth */}
      <path 
        d="M 12 63 L 32 38 L 42 45 M 42 45 L 34 51 L 28 53 L 12 63" 
        fill="currentColor"
        className="text-indigo-500 opacity-90"
      />
    </svg>
  );

  if (iconOnly) {
    return logoMarkSvg;
  }

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {logoMarkSvg}
      <div className="flex flex-col justify-start leading-none">
        <span className={`font-display font-black uppercase tracking-wide ${light ? 'text-white' : 'text-gray-900 dark:text-white'} ${textClass} leading-none`}>
          Veloce
        </span>
        <span className={`font-display font-bold uppercase tracking-widest ${light ? 'text-indigo-200' : 'text-indigo-900 dark:text-indigo-300'} ${subtextClass} mt-0.5 ml-0.5 opacity-90`}>
          Collective
        </span>
      </div>
    </div>
  );
}
