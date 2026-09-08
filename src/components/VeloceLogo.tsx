import React, { useState } from 'react';

export interface VeloceLogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  light?: boolean;
  customLogoUrl?: string;
}

export function VeloceLogo({
  className = '',
  iconOnly = false,
  size = 'md',
  light,
  customLogoUrl
}: VeloceLogoProps) {
  const [imgError, setImgError] = useState(false);

  // Height presets
  const imgHeightClass = {
    xs: 'h-6 max-h-6',
    sm: 'h-8 sm:h-9 max-h-9',
    md: 'h-10 sm:h-12 md:h-14 max-h-14',
    lg: 'h-16 sm:h-20 max-h-20',
    xl: 'h-24 sm:h-28 max-h-28'
  }[size];

  const iconHeightClass = {
    xs: 'h-6 w-6',
    sm: 'h-8 w-8',
    md: 'h-10 w-10 sm:h-11 sm:w-11',
    lg: 'h-16 w-16',
    xl: 'h-24 w-24'
  }[size];

  if (customLogoUrl && !imgError) {
    return (
      <div className={`flex items-center gap-2.5 select-none ${className}`}>
        <img
          src={customLogoUrl}
          alt="Ropenix Collections"
          onError={() => setImgError(true)}
          className={`${imgHeightClass} w-auto object-contain shrink-0 transition-transform duration-200 hover:scale-105`}
        />
      </div>
    );
  }

  // Icon only display
  if (iconOnly) {
    if (light === true) {
      return (
        <div className={`flex items-center justify-center select-none ${className}`}>
          <img
            src="/ropenix_icon_white.png"
            alt="Ropenix Collections Icon"
            className={`${iconHeightClass} object-contain shrink-0 transition-transform duration-200 hover:scale-105`}
          />
        </div>
      );
    }
    if (light === false) {
      return (
        <div className={`flex items-center justify-center select-none ${className}`}>
          <img
            src="/ropenix_icon.png"
            alt="Ropenix Collections Icon"
            className={`${iconHeightClass} object-contain shrink-0 transition-transform duration-200 hover:scale-105`}
          />
        </div>
      );
    }
    // Auto-theme icon
    return (
      <div className={`flex items-center justify-center select-none ${className}`}>
        <img
          src="/ropenix_icon.png"
          alt="Ropenix Collections Icon"
          className={`dark:hidden ${iconHeightClass} object-contain shrink-0 transition-transform duration-200 hover:scale-105`}
        />
        <img
          src="/ropenix_icon_white.png"
          alt="Ropenix Collections Icon"
          className={`hidden dark:block ${iconHeightClass} object-contain shrink-0 transition-transform duration-200 hover:scale-105`}
        />
      </div>
    );
  }

  // Full Brand Logo with typography:
  // If explicitly requested light version (e.g. on dark background like Footer)
  if (light === true) {
    return (
      <div className={`flex items-center gap-2 select-none ${className}`}>
        <img
          src="/ropenix_logo_dark.png"
          alt="Ropenix Collections"
          className={`${imgHeightClass} w-auto object-contain shrink-0 transition-transform duration-200 hover:scale-105`}
        />
      </div>
    );
  }

  // If explicitly requested light={false} or default auto-theme
  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      <img
        src="/ropenix_logo.png"
        alt="Ropenix Collections"
        className={`dark:hidden ${imgHeightClass} w-auto object-contain shrink-0 transition-transform duration-200 hover:scale-105`}
      />
      <img
        src="/ropenix_logo_dark.png"
        alt="Ropenix Collections"
        className={`hidden dark:block ${imgHeightClass} w-auto object-contain shrink-0 transition-transform duration-200 hover:scale-105`}
      />
    </div>
  );
}

export const RopenixLogo = VeloceLogo;
export default VeloceLogo;

