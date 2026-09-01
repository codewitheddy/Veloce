import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, X, Link as LinkIcon, RotateCcw } from 'lucide-react';

interface ProductImageUploadProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  defaultPlaceholder?: string;
  productContext?: {
    name: string;
    category: string;
    description: string;
  };
}

export default function ProductImageUpload({
  value,
  onChange,
  label = 'Product Image',
  defaultPlaceholder,
  productContext
}: ProductImageUploadProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse if it is a base64 or a web URL
  const isBase64 = value.startsWith('data:image/');

  const handleFile = (file: File) => {
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, SVG, GIF, WebP)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('This file is larger than 10MB. Please upload a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const src = reader.result;

        // If SVG or tiny icon, use directly
        if (file.type.includes('svg') || file.size < 30 * 1024) {
          onChange(src);
          return;
        }

        // Compress and downscale with Canvas to avoid QuotaExceeded issues
        const img = new Image();
        img.onload = () => {
          try {
            const maxDim = 900;
            let width = img.naturalWidth || img.width;
            let height = img.naturalHeight || img.height;

            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
              onChange(compressedDataUrl);
              return;
            }
          } catch {
            // Fallback if canvas fails
          }
          onChange(src);
        };
        img.onerror = () => {
          onChange(src);
        };
        img.src = src;
      }
    };
    reader.onerror = () => {
      setError('Something went wrong reading your file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const [urlInput, setUrlInput] = useState(isBase64 ? '' : value);

  // Sync internal urlInput when value prop changes externally
  React.useEffect(() => {
    setUrlInput(isBase64 ? '' : value);
  }, [value, isBase64]);

  const handleApplyUrl = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
    }
  };

  const clearImage = () => {
    onChange('');
    setUrlInput('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRestorePlaceholder = () => {
    if (defaultPlaceholder) {
      onChange(defaultPlaceholder);
      setUrlInput(defaultPlaceholder);
    }
  };

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          {label}
        </label>
        {defaultPlaceholder && value !== defaultPlaceholder && (
          <button
            type="button"
            onClick={handleRestorePlaceholder}
            className="inline-flex items-center gap-1 text-[9px] font-medium text-indigo-650 dark:text-indigo-400 hover:underline cursor-pointer"
            title="Restore initial photo placeholder"
          >
            <RotateCcw className="h-2.5 w-2.5" /> Use Placeholders
          </button>
        )}
      </div>

      {/* Main Drag-and-Drop and Preview Container */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition-all min-h-[140px] ${
          isDragActive
            ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/25 scale-[0.99]'
            : 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 hover:bg-gray-50 dark:hover:bg-gray-900/50'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
          id={`product-image-uploader-${label.replace(/\s+/g, '-').toLowerCase()}`}
        />

        {value ? (
          <div className="flex flex-col items-center gap-3 w-full animate-in fade-in duration-200">
            {/* Image Preview Container */}
            <div className="relative group max-w-xs rounded border border-gray-150 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-950">
              <img
                src={value}
                alt="Product preview"
                className="max-h-24 w-auto object-contain mx-auto mix-blend-normal"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  setError('The image link is invalid, broken, or blocked by CORS policies.');
                }}
              />
              <button
                type="button"
                onClick={clearImage}
                className="absolute top-1 right-1 rounded-full bg-red-650 hover:bg-red-750 text-white p-1 shadow-md transition-all opacity-90 hover:scale-105 cursor-pointer"
                title="Discard picture"
              >
                <X className="h-3 w-3" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                {isBase64 ? '✓ Locally uploaded document active' : '✓ Web photo address linked'}
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] font-bold text-indigo-650 dark:text-indigo-400 hover:text-indigo-850 dark:hover:text-indigo-305 underline cursor-pointer"
              >
                Upload a different picture
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-2">
            <div className="mb-2 rounded-full bg-white dark:bg-gray-950 p-2.5 text-gray-400 shadow-5xs border border-gray-150 dark:border-gray-850">
              <Upload className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <p className="text-[11px] text-gray-700 dark:text-gray-300 font-medium">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-indigo-650 dark:text-indigo-400 hover:underline font-bold focus:outline-none cursor-pointer"
              >
                Select a file
              </button>{' '}
              or drag & drop
            </p>
            <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-1 font-sans">
              PNG, JPG, SVG, GIF up to 2.5MB
            </p>
          </div>
        )}
      </div>

      {/* Manual Input for Direct Links */}
      <div className="flex flex-col gap-1 mt-1">
        <div className="flex items-center gap-1.5 text-[9px] text-gray-400 dark:text-gray-500 font-mono font-bold uppercase tracking-wider px-0.5">
          <LinkIcon className="h-3 w-3" /> Or web direct address URL
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onBlur={() => {
              if (urlInput.trim() && urlInput.trim() !== value) {
                onChange(urlInput.trim());
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleApplyUrl();
              }
            }}
            placeholder={isBase64 ? 'Using local uploaded image file...' : 'Enter https:// images.unsplash.com or web url...'}
            className="h-8 flex-1 rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 text-xs text-gray-700 dark:text-gray-300 font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder-gray-300 dark:placeholder-gray-700"
          />
          {urlInput.trim() !== value && (
            <button
              type="button"
              onClick={handleApplyUrl}
              className="h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold transition-all cursor-pointer shadow-3xs"
            >
              Apply
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-[10px] font-bold text-red-650 dark:text-red-400 mt-1 animate-pulse leading-tight">
          {error}
        </p>
      )}
    </div>
  );
}
