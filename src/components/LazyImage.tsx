import React, { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { getOptimizedImageUrl, generateSrcSet, getResponsiveSizes } from '../utils/imageUtils';

export interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  aspectRatio?: string;
  aspectRatioClassName?: string;
  containerClassName?: string;
  placeholderColor?: string;
  responsiveType?: 'grid_card' | 'hero' | 'thumbnail' | 'detail' | 'carousel';
  targetWidth?: number;
  priority?: boolean;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  width,
  height,
  aspectRatio,
  aspectRatioClassName = '',
  className = '',
  containerClassName = '',
  placeholderColor = 'bg-slate-100 dark:bg-slate-800/80',
  responsiveType = 'grid_card',
  targetWidth,
  priority = false,
  loading,
  decoding = 'async',
  style,
  srcSet: explicitSrcSet,
  sizes: explicitSizes,
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

  // Compute optimized single src and responsive srcset
  const optimizedSrc = getOptimizedImageUrl(src, {
    width: targetWidth || (typeof width === 'number' ? width : 600),
  });

  const computedSrcSet = explicitSrcSet || (!src.startsWith('data:') ? generateSrcSet(src) : undefined);
  const computedSizes = explicitSizes || getResponsiveSizes(responsiveType);

  const effectiveLoading = priority ? 'eager' : loading || 'lazy';
  const effectiveFetchPriority = priority ? 'high' : 'auto';

  const containerStyle: React.CSSProperties = {
    ...(aspectRatio ? { aspectRatio } : {}),
    ...style,
  };

  return (
    <div
      className={`relative overflow-hidden w-full h-full flex items-center justify-center ${aspectRatioClassName} ${containerClassName}`}
      style={containerStyle}
    >
      {/* Smooth Skeleton / Blur-up background placeholder to prevent CLS */}
      {!isLoaded && !hasError && (
        <div
          className={`absolute inset-0 z-0 animate-pulse ${placeholderColor} flex items-center justify-center`}
        >
          <div className="w-full h-full bg-slate-200/80 dark:bg-slate-800/80" />
        </div>
      )}

      {/* Fallback view on broken image error */}
      {hasError ? (
        <div
          className={`w-full h-full min-h-[60px] flex flex-col items-center justify-center p-2 text-slate-400 dark:text-slate-500 ${placeholderColor}`}
        >
          <ImageIcon className="h-6 w-6 opacity-40 mb-1" />
          <span className="text-[9px] font-mono uppercase tracking-wider opacity-60">Image Unavailable</span>
        </div>
      ) : (
        <img
          src={optimizedSrc}
          srcSet={computedSrcSet}
          sizes={computedSizes}
          alt={alt || 'Product image'}
          width={width}
          height={height}
          loading={effectiveLoading}
          decoding={decoding}
          // @ts-ignore fetchpriority is a valid modern HTML attribute
          fetchpriority={effectiveFetchPriority}
          onLoad={handleLoad}
          onError={handleError}
          className={`transition-all duration-300 ease-out object-contain object-center ${
            isLoaded
              ? 'blur-0 scale-100 opacity-100'
              : 'blur-xs scale-[1.02] opacity-0'
          } ${className}`}
          referrerPolicy="no-referrer"
          {...props}
        />
      )}
    </div>
  );
};

export default LazyImage;
