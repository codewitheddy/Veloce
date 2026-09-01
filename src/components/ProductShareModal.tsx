/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Copy, Check, Twitter, Facebook, Linkedin, Mail, Link, Share2, QrCode, Download, Sparkles } from 'lucide-react';
import { Product } from '../types';
import QRCode from 'qrcode';

interface ProductShareModalProps {
  product: Product;
  onClose: () => void;
}

export default function ProductShareModal({ product, onClose }: ProductShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'links' | 'qr'>('links');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [generatingQr, setGeneratingQr] = useState<boolean>(false);
  const [qrColor, setQrColor] = useState<string>('#1e1b4b');
  const [includeLogo, setIncludeLogo] = useState<boolean>(true);
  const [exportFormat, setExportFormat] = useState<'PNG' | 'JPEG' | 'SVG'>('PNG');
  
  // Create a clean shareable URL
  const shareUrl = `${window.location.origin}${window.location.pathname}?product=${product.id}`;

  const colorOptions = [
    { name: 'Indigo Veloce', hex: '#1e1b4b' },
    { name: 'Obsidian Black', hex: '#0f172a' },
    { name: 'Emerald Forest', hex: '#064e3b' },
    { name: 'Ruby Wine', hex: '#4c0519' },
    { name: 'Royal Amber', hex: '#78350f' },
  ];

  useEffect(() => {
    if (activeTab === 'qr') {
      setGeneratingQr(true);
      
      if (exportFormat === 'SVG') {
        QRCode.toString(shareUrl, {
          type: 'svg',
          margin: 2,
          color: {
            dark: qrColor,
            light: '#ffffff'
          },
          errorCorrectionLevel: 'H'
        })
        .then(svgString => {
          let finalSvg = svgString;
          if (includeLogo) {
            const viewBoxMatch = svgString.match(/viewBox="0 0 (\d+) (\d+)"/);
            if (viewBoxMatch) {
              const size = parseInt(viewBoxMatch[1]);
              const badgeSize = size * 0.175;
              const x = (size - badgeSize) / 2;
              const y = (size - badgeSize) / 2;
              const scale = size / 320;

              const logoGroup = `
  <g transform="translate(${x.toFixed(4)}, ${y.toFixed(4)}) scale(${scale.toFixed(6)})">
    <rect x="0" y="0" width="56" height="56" rx="12" ry="12" fill="#ffffff" stroke="#f1f5f9" stroke-width="1.5" />
    <path d="M18 18h6l4 18h-6z" fill="${qrColor}" />
    <path d="M38 18h-6l-4 18h6z" fill="${qrColor}" />
    <path d="M28 15l3 3l-3 3l-3-3z" fill="#6366f1" />
  </g>`;
              finalSvg = svgString.replace('</svg>', `${logoGroup}</svg>`);
            }
          }
          const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(finalSvg)}`;
          setQrCodeUrl(dataUrl);
          setGeneratingQr(false);
        })
        .catch(err => {
          console.error('QR SVG generation failed', err);
          setGeneratingQr(false);
        });
      } else {
        const canvas = document.createElement('canvas');
        
        QRCode.toCanvas(canvas, shareUrl, {
          width: 320,
          margin: 2,
          color: {
            dark: qrColor,
            light: '#ffffff'
          },
          errorCorrectionLevel: 'H'
        })
        .then(() => {
          if (includeLogo) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              const badgeSize = 56;
              const x = (canvas.width - badgeSize) / 2;
              const y = (canvas.height - badgeSize) / 2;
              
              // Background Badge Card
              ctx.fillStyle = '#ffffff';
              ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
              ctx.shadowBlur = 6;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 2;
              
              const radius = 12;
              ctx.beginPath();
              ctx.moveTo(x + radius, y);
              ctx.lineTo(x + badgeSize - radius, y);
              ctx.quadraticCurveTo(x + badgeSize, y, x + badgeSize, y + radius);
              ctx.lineTo(x + badgeSize, y + badgeSize - radius);
              ctx.quadraticCurveTo(x + badgeSize, y + badgeSize, x + badgeSize - radius, y + badgeSize);
              ctx.lineTo(x + radius, y + badgeSize);
              ctx.quadraticCurveTo(x, y + badgeSize, x, y + badgeSize - radius);
              ctx.lineTo(x, y + radius);
              ctx.quadraticCurveTo(x, y, x + radius, y);
              ctx.closePath();
              ctx.fill();
              
              ctx.shadowColor = 'transparent';
              ctx.shadowBlur = 0;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 0;

              // Subtle border to blend nicely with high contrast QR patterns
              ctx.strokeStyle = '#f1f5f9';
              ctx.lineWidth = 1.5;
              ctx.stroke();

              // Stylized high-fidelity minimalist brand 'V' crest matching chosen color
              ctx.fillStyle = qrColor;
              ctx.beginPath();
              ctx.moveTo(x + 18, y + 18);
              ctx.lineTo(x + 24, y + 18);
              ctx.lineTo(x + 28, y + 36);
              ctx.lineTo(x + 22, y + 36);
              ctx.closePath();
              ctx.fill();
              
              ctx.beginPath();
              ctx.moveTo(x + 38, y + 18);
              ctx.lineTo(x + 32, y + 18);
              ctx.lineTo(x + 28, y + 36);
              ctx.lineTo(x + 34, y + 36);
              ctx.closePath();
              ctx.fill();

              // Indigo spark highlighting the top vertex intersection
              ctx.beginPath();
              ctx.moveTo(x + 28, y + 15);
              ctx.lineTo(x + 31, y + 18);
              ctx.lineTo(x + 28, y + 21);
              ctx.lineTo(x + 25, y + 18);
              ctx.closePath();
              ctx.fillStyle = '#6366f1';
              ctx.fill();
            }
          }
          
          const mimeType = exportFormat === 'JPEG' ? 'image/jpeg' : 'image/png';
          const dataUrl = canvas.toDataURL(mimeType, exportFormat === 'JPEG' ? 0.95 : undefined);
          setQrCodeUrl(dataUrl);
          setGeneratingQr(false);
        })
        .catch(err => {
          console.error('QR code generation failed', err);
          setGeneratingQr(false);
        });
      }
    }
  }, [activeTab, shareUrl, qrColor, includeLogo, exportFormat]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadQR = () => {
    if (!qrCodeUrl) return;
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    const ext = exportFormat.toLowerCase();
    link.download = `${product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-qr.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const socialLinks = [
    {
      name: 'Twitter',
      icon: Twitter,
      color: 'bg-[#1DA1F2] hover:bg-[#1a91da] text-white',
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out this incredible workspace item: ${product.name} — ${product.description.substring(0, 100)}...`)}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'Facebook',
      icon: Facebook,
      color: 'bg-[#1877F2] hover:bg-[#166fe5] text-white',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'LinkedIn',
      icon: Linkedin,
      color: 'bg-[#0A66C2] hover:bg-[#0959aa] text-white',
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'Email',
      icon: Mail,
      color: 'bg-gray-700 hover:bg-gray-800 text-white',
      url: `mailto:?subject=${encodeURIComponent(`Aesthetic Workspace Objects: ${product.name}`)}&body=${encodeURIComponent(`Hi!\n\nI thought you'd love to see this exquisite workspace design artifact on Veloce:\n\n${product.name}\n${product.description}\n\nView details: ${shareUrl}`)}`,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/40 backdrop-blur-xs">
      {/* Backdrop tap closure */}
      <div className="absolute inset-0" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-gray-150 bg-white p-6 shadow-2xl z-10 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-50 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Share2 className="h-4.5 w-4.5 text-indigo-600" />
            <h3 className="font-display text-sm font-semibold text-gray-900">Share Workspace Object</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Product Share Modal"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Product Card Preview inside Modal */}
        <div className="rounded-lg border border-indigo-50/50 bg-slate-50 p-3 mb-4 flex items-start gap-4">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-16 h-16 object-cover rounded-md border border-gray-100 bg-white shadow-3xs flex-shrink-0"
            referrerPolicy="no-referrer"
          />
          <div className="flex-1 min-w-0">
            <span className="text-[9px] font-bold tracking-wider text-indigo-600 uppercase font-mono bg-indigo-50 px-1.5 py-0.5 rounded">
              {product.category}
            </span>
            <h4 className="font-display font-semibold text-xs text-gray-900 mt-1.5 truncate">
              {product.name}
            </h4>
            <p className="text-[10.5px] text-gray-500 font-extralight mt-0.5 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-gray-100 mb-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab('links')}
            className={`flex-1 pb-2.5 text-center border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'links'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Share Links</span>
          </button>
          <button
            onClick={() => setActiveTab('qr')}
            className={`flex-1 pb-2.5 text-center border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'qr'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <QrCode className="h-3.5 w-3.5" />
            <span>Mobile QR Code</span>
          </button>
        </div>

        {/* Tab Panels */}
        <div className="min-h-[190px] flex flex-col justify-between">
          <AnimatePresence mode="wait">
            {activeTab === 'links' ? (
              <motion.div
                key="links"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                {/* Copy Link Section */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono">
                    Direct Shareable URL
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        readOnly
                        value={shareUrl}
                        className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-8 pr-3 text-xs font-light text-gray-500 font-mono truncate focus:outline-hidden"
                      />
                      <Link className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                    </div>
                    <button
                      onClick={handleCopyLink}
                      className={`h-9 px-4 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold shadow-2xs transition-all cursor-pointer shrink-0 ${
                        copied
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Social channels section */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono block mb-2.5">
                    Share to Social Channels
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {socialLinks.map((social) => {
                      const Icon = social.icon;
                      return (
                        <a
                          key={social.name}
                          href={social.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center justify-center gap-2 h-9 rounded-lg text-xs font-semibold transition-all shadow-3xs cursor-pointer ${social.color}`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span>{social.name}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="qr"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col items-center justify-center text-center space-y-4"
              >
                {/* QR Code Container */}
                <div className="relative p-2.5 bg-white border border-gray-150 rounded-xl shadow-xs flex items-center justify-center w-40 h-40 group">
                  {generatingQr ? (
                    <div className="flex flex-col items-center gap-2 text-indigo-600">
                      <div className="h-6 w-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                      <span className="text-[10px] font-mono">Generating QR...</span>
                    </div>
                  ) : qrCodeUrl ? (
                    <>
                      {/* Cool subtle scanner laser line effect */}
                      <div 
                        className="absolute left-0 right-0 h-0.5 shadow-xs top-0 animate-bounce pointer-events-none" 
                        style={{ 
                          animationDuration: '3s',
                          backgroundColor: qrColor,
                          boxShadow: `0 1px 4px ${qrColor}`
                        }} 
                      />
                      <img
                        src={qrCodeUrl}
                        alt="Product QR Code"
                        className="w-full h-full object-contain select-none"
                      />
                    </>
                  ) : (
                    <span className="text-xs text-rose-500 font-mono">Failed to load QR code.</span>
                  )}
                </div>

                {/* QR Customization Panel */}
                <div className="bg-slate-50 border border-gray-150/70 rounded-xl p-3 w-full space-y-3 text-left">
                  <div>
                    <span className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider font-mono">
                      QR Code Foreground Color
                    </span>
                    <div className="flex items-center gap-2.5 mt-1.5">
                      {colorOptions.map((opt) => (
                        <button
                          key={opt.hex}
                          type="button"
                          onClick={() => setQrColor(opt.hex)}
                          title={opt.name}
                          className={`h-5 w-5 rounded-full border transition-all cursor-pointer ${
                            qrColor === opt.hex
                              ? 'scale-120 ring-2 ring-indigo-500/25 shadow-xs border-white'
                              : 'border-transparent hover:scale-105'
                          }`}
                          style={{ 
                            backgroundColor: opt.hex,
                            boxShadow: qrColor === opt.hex ? `0 0 0 1.5px ${opt.hex}` : 'none'
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-150/60">
                    <div className="flex flex-col">
                      <span className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider font-mono">
                        Subtle Brand Emblem
                      </span>
                      <span className="text-[9px] text-gray-450 font-extralight mt-0.5">
                        Overlay center geometric 'V' monogram
                      </span>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => setIncludeLogo(!includeLogo)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        includeLogo ? 'bg-indigo-650' : 'bg-gray-250'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                          includeLogo ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-150/60">
                    <div className="flex flex-col">
                      <span className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider font-mono">
                        Export Format
                      </span>
                      <span className="text-[9px] text-gray-450 font-extralight mt-0.5">
                        Choose PNG, JPEG, or SVG vectors
                      </span>
                    </div>

                    <div className="flex bg-gray-200/60 rounded-lg p-0.5 gap-0.5 shrink-0">
                      {(['PNG', 'JPEG', 'SVG'] as const).map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => setExportFormat(fmt)}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider transition-all cursor-pointer ${
                            exportFormat === fmt
                              ? 'bg-white text-gray-900 shadow-3xs'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          {fmt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1 max-w-xs">
                  <p className="text-xs font-bold text-gray-800 flex items-center justify-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> Scan with mobile device
                  </p>
                  <p className="text-[10px] text-gray-500 font-extralight leading-relaxed">
                    Point your smartphone camera at this custom-styled QR code to instantly view this workspace product on your mobile device.
                  </p>
                </div>

                {qrCodeUrl && (
                  <button
                    onClick={handleDownloadQR}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold px-4 shadow-2xs transition-all cursor-pointer w-full"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download Custom QR Code</span>
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
