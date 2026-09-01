import React, { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

export interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  placeholderColor?: string;
  aspectRatioClassName?: string;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className = '',
  containerClassName = '',
  placeholderColor = 'bg-gray-100 dark:bg-gray-800',
  aspectRatioClassName = '',
  style,
  onLoad,
  onError,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoaded(true);
    if (onLoad) onLoad(e);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setHasError(true);
    if (onError) onError(e);
  };

  return (
    <div
      className={`relative overflow-hidden ${aspectRatioClassName} ${containerClassName}`}
    >
      {/* Skeleton / Blur-up background placeholder */}
      {!isLoaded && !hasError && (
        <div
          className={`absolute inset-0 z-0 animate-pulse ${placeholderColor} flex items-center justify-center`}
        >
          <div className="w-full h-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
        </div>
      )}

      {/* Fallback view on error */}
      {hasError ? (
        <div className={`w-full h-full min-h-[60px] flex flex-col items-center justify-center p-2 text-gray-400 dark:text-gray-600 ${placeholderColor}`}>
          <ImageIcon className="h-6 w-6 opacity-40 mb-1" />
          <span className="text-[9px] font-mono uppercase tracking-wider opacity-60">Image Unavailable</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={`transition-all duration-500 ease-out ${
            isLoaded
              ? 'blur-0 scale-100 opacity-100'
              : 'blur-md scale-105 opacity-0'
          } ${className}`}
          style={style}
          referrerPolicy="no-referrer"
          {...props}
        />
      )}
    </div>
  );
};

export default LazyImage;
