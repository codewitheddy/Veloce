/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  Scissors,
  Ruler,
  Upload,
  Link as LinkIcon,
  Sparkles,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Shirt,
  HelpCircle,
  X,
  Plus,
  Trash2,
  FileText,
  Video,
  Image as ImageIcon,
  MapPin,
  DollarSign,
  Info,
  ArrowRight,
  ShieldCheck,
  Check,
  ShoppingBag,
  Layers
} from 'lucide-react';
import { CustomClothingRequest, FileAttachment } from '../types';

interface ServicesPanelProps {
  products?: any[];
  onAddToCart?: (product: any, quantity: number, vars: Record<string, string>) => void;
  setCurrentTab?: (tab: string) => void;
}

export default function ServicesPanel({ setCurrentTab }: ServicesPanelProps) {
  // Form Field States
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [garmentType, setGarmentType] = useState('Evening Gown');
  const [otherGarmentType, setOtherGarmentType] = useState('');
  
  // File Uploads
  const [materialSamples, setMaterialSamples] = useState<FileAttachment[]>([]);
  const [designImages, setDesignImages] = useState<FileAttachment[]>([]);
  const [designVideos, setDesignVideos] = useState<FileAttachment[]>([]);
  const [designLinks, setDesignLinks] = useState<string[]>(['']);
  
  // Measurements
  const [measurementUnit, setMeasurementUnit] = useState<'cm' | 'inches'>('cm');
  const [bust, setBust] = useState<string>('');
  const [waist, setWaist] = useState<string>('');
  const [hips, setHips] = useState<string>('');
  const [shoulderWidth, setShoulderWidth] = useState<string>('');
  const [sleeveLength, setSleeveLength] = useState<string>('');
  const [inseam, setInseam] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [measurementNotes, setMeasurementNotes] = useState('');

  // Timeline & Budget & Notes
  const [preferredDeadline, setPreferredDeadline] = useState('');
  const [budgetRange, setBudgetRange] = useState('KSh 25,000 - 50,000');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('Courier Home Delivery');

  // Interactive UI & Validation States
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const [uploadingProgress, setUploadingProgress] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<CustomClothingRequest | null>(null);
  const [showMeasurementGuide, setShowMeasurementGuide] = useState(false);

  // File Input References
  const materialInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Handle Garment Type Selection
  const garmentOptions = [
    'Dress',
    'Suit & Blazer',
    'Traditional / Cultural Wear',
    'Evening Gown',
    'Casual Wear',
    'Outerwear & Jacket',
    'Shirts & Blouses',
    'Trousers & Skirts',
    'Other'
  ];

  // Validate File Size & Type
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

  // Process File to Data URL
  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle Material Sample Uploads (up to 3)
  const handleMaterialUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setFileErrors((prev) => ({ ...prev, material: '' }));
    
    if (materialSamples.length + files.length > 3) {
      setFileErrors((prev) => ({ ...prev, material: 'You can upload a maximum of 3 material sample images.' }));
      return;
    }

    setUploadingProgress(25);
    const newAttachments: FileAttachment[] = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        setFileErrors((prev) => ({
          ...prev,
          material: `File "${file.name}" exceeds the maximum limit of 5MB (${(file.size / 1024 / 1024).toFixed(1)}MB). Please choose a smaller file.`
        }));
        setUploadingProgress(null);
        return;
      }

      if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
        setFileErrors((prev) => ({
          ...prev,
          material: `File "${file.name}" is not a valid image format. Please upload JPG, PNG, or WEBP images.`
        }));
        setUploadingProgress(null);
        return;
      }

      try {
        const dataUrl = await readFileAsDataUrl(file);
        newAttachments.push({
          name: file.name,
          size: file.size,
          type: file.type,
          url: dataUrl
        });
      } catch (err) {
        setFileErrors((prev) => ({ ...prev, material: `Failed to process image "${file.name}".` }));
      }
    }

    setUploadingProgress(100);
    setTimeout(() => setUploadingProgress(null), 400);
    setMaterialSamples((prev) => [...prev, ...newAttachments]);
    if (materialInputRef.current) materialInputRef.current.value = '';
  };

  // Handle Design Inspiration Image Uploads (up to 5)
  const handleDesignImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setFileErrors((prev) => ({ ...prev, designImages: '' }));

    if (designImages.length + files.length > 5) {
      setFileErrors((prev) => ({ ...prev, designImages: 'You can upload up to 5 design inspiration images.' }));
      return;
    }

    setUploadingProgress(30);
    const newAttachments: FileAttachment[] = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        setFileErrors((prev) => ({
          ...prev,
          designImages: `File "${file.name}" exceeds 5MB (${(file.size / 1024 / 1024).toFixed(1)}MB). Please compress the image or provide a link instead.`
        }));
        setUploadingProgress(null);
        return;
      }

      if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
        setFileErrors((prev) => ({
          ...prev,
          designImages: `File "${file.name}" is an invalid image format. Allowed: JPG, PNG, WEBP.`
        }));
        setUploadingProgress(null);
        return;
      }

      try {
        const dataUrl = await readFileAsDataUrl(file);
        newAttachments.push({
          name: file.name,
          size: file.size,
          type: file.type,
          url: dataUrl
        });
      } catch (err) {
        setFileErrors((prev) => ({ ...prev, designImages: `Error processing image "${file.name}".` }));
      }
    }

    setUploadingProgress(100);
    setTimeout(() => setUploadingProgress(null), 400);
    setDesignImages((prev) => [...prev, ...newAttachments]);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  // Handle Video Upload (max 5MB, prompt link if exceeds)
  const handleDesignVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const file = files[0];
    setFileErrors((prev) => ({ ...prev, designVideo: '' }));

    if (file.size > MAX_FILE_SIZE) {
      setFileErrors((prev) => ({
        ...prev,
        designVideo: `⚠️ Video "${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)}MB, which exceeds the 5MB upload limit. Please upload your video to Pinterest, Instagram, TikTok, YouTube or Google Drive and paste the video link below.`
      }));
      if (videoInputRef.current) videoInputRef.current.value = '';
      return;
    }

    if (!ALLOWED_VIDEO_TYPES.includes(file.type.toLowerCase())) {
      setFileErrors((prev) => ({
        ...prev,
        designVideo: `Video "${file.name}" format (${file.type}) is not supported. Please upload MP4, MOV, or WEBM.`
      }));
      return;
    }

    setUploadingProgress(40);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setDesignVideos([
        {
          name: file.name,
          size: file.size,
          type: file.type,
          url: dataUrl
        }
      ]);
      setUploadingProgress(100);
      setTimeout(() => setUploadingProgress(null), 400);
    } catch (err) {
      setFileErrors((prev) => ({ ...prev, designVideo: 'Failed to upload video.' }));
      setUploadingProgress(null);
    }

    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  // Dynamic Design Links Management
  const handleLinkChange = (index: number, value: string) => {
    const updated = [...designLinks];
    updated[index] = value;
    setDesignLinks(updated);
  };

  const handleAddLinkInput = () => {
    if (designLinks.length < 5) {
      setDesignLinks([...designLinks, '']);
    }
  };

  const handleRemoveLinkInput = (index: number) => {
    if (designLinks.length > 1) {
      const updated = designLinks.filter((_, i) => i !== index);
      setDesignLinks(updated);
    } else {
      setDesignLinks(['']);
    }
  };

  // Rush Order Calculation Notice
  const isRushOrder = React.useMemo(() => {
    if (!preferredDeadline) return false;
    const deadline = new Date(preferredDeadline).getTime();
    const now = new Date().getTime();
    const diffDays = (deadline - now) / (1000 * 3600 * 24);
    return diffDays > 0 && diffDays <= 7;
  }, [preferredDeadline]);

  // Form Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!fullName.trim()) newErrors.fullName = 'Full Name is required.';
    
    if (!email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required.';
    } else if (phone.trim().length < 6) {
      newErrors.phone = 'Please enter a valid phone number.';
    }

    if (garmentType === 'Other' && !otherGarmentType.trim()) {
      newErrors.otherGarmentType = 'Please specify the custom garment type.';
    }

    // Measurement Validations
    if (!bust || isNaN(Number(bust)) || Number(bust) <= 0) newErrors.bust = 'Valid Bust/Chest measurement required.';
    if (!waist || isNaN(Number(waist)) || Number(waist) <= 0) newErrors.waist = 'Valid Waist measurement required.';
    if (!hips || isNaN(Number(hips)) || Number(hips) <= 0) newErrors.hips = 'Valid Hips measurement required.';
    if (!shoulderWidth || isNaN(Number(shoulderWidth)) || Number(shoulderWidth) <= 0) newErrors.shoulderWidth = 'Valid Shoulder Width required.';
    if (!sleeveLength || isNaN(Number(sleeveLength)) || Number(sleeveLength) <= 0) newErrors.sleeveLength = 'Valid Sleeve Length required.';
    if (!inseam || isNaN(Number(inseam)) || Number(inseam) <= 0) newErrors.inseam = 'Valid Inseam Length required.';
    if (!height || isNaN(Number(height)) || Number(height) <= 0) newErrors.height = 'Valid Height measurement required.';

    if (!preferredDeadline) {
      newErrors.preferredDeadline = 'Please select your preferred completion date.';
    } else {
      const selectedDate = new Date(preferredDeadline).getTime();
      const today = new Date().setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        newErrors.preferredDeadline = 'Completion deadline must be a future date.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      const firstErrorField = document.querySelector('.input-error-field');
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setIsSubmitting(true);

    const payload = {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      garmentType,
      otherGarmentType: garmentType === 'Other' ? otherGarmentType.trim() : '',
      materialSamples,
      designImages,
      designVideos,
      designLinks: designLinks.map((l) => l.trim()).filter(Boolean),
      measurements: {
        unit: measurementUnit,
        bust: Number(bust),
        waist: Number(waist),
        hips: Number(hips),
        shoulderWidth: Number(shoulderWidth),
        sleeveLength: Number(sleeveLength),
        inseam: Number(inseam),
        height: Number(height),
        customNotes: measurementNotes.trim()
      },
      preferredDeadline,
      budgetRange,
      additionalNotes: additionalNotes.trim(),
      deliveryLocation
    };

    try {
      const response = await fetch('/api/services/custom-clothing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSubmissionSuccess(data.request);
      } else {
        setErrors({ form: data.error || 'Failed to submit request. Please try again.' });
      }
    } catch (err: any) {
      setErrors({ form: 'Network connection failed. Please check your internet and try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset Form for New Request
  const handleResetForm = () => {
    setSubmissionSuccess(null);
    setFullName('');
    setEmail('');
    setPhone('');
    setGarmentType('Evening Gown');
    setOtherGarmentType('');
    setMaterialSamples([]);
    setDesignImages([]);
    setDesignVideos([]);
    setDesignLinks(['']);
    setBust('');
    setWaist('');
    setHips('');
    setShoulderWidth('');
    setSleeveLength('');
    setInseam('');
    setHeight('');
    setMeasurementNotes('');
    setPreferredDeadline('');
    setBudgetRange('KSh 25,000 - 50,000');
    setAdditionalNotes('');
    setErrors({});
    setFileErrors({});
  };

  // If successfully submitted, show clean Confirmation View
  if (submissionSuccess) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 font-sans">
        <div className="rounded-2xl border border-gray-100 bg-white p-8 md:p-12 shadow-xl shadow-gray-200/50 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-10 w-10" />
          </div>

          <span className="mt-4 block font-mono text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
            REQUEST REFERENCE NO: {submissionSuccess.referenceNo}
          </span>
          <h2 className="mt-2 font-display text-2xl md:text-3xl font-bold text-gray-900">
            Custom Clothing Request Received!
          </h2>
          <p className="mt-3 text-sm text-gray-600 max-w-xl mx-auto leading-relaxed">
            Thank you, <strong className="text-gray-900">{submissionSuccess.fullName}</strong>. Our lead designer and master tailors have received your bespoke specifications and design references.
          </p>

          <div className="mt-8 rounded-xl bg-gray-50 border border-gray-150 p-6 text-left max-w-2xl mx-auto">
            <h3 className="font-display text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 pb-2 border-b border-gray-200">
              Order Summary Overview
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-400 font-mono text-[10px] uppercase block">Garment Type</span>
                <span className="font-semibold text-gray-900">
                  {submissionSuccess.garmentType === 'Other' ? submissionSuccess.otherGarmentType : submissionSuccess.garmentType}
                </span>
              </div>
              <div>
                <span className="text-gray-400 font-mono text-[10px] uppercase block">Target Completion Date</span>
                <span className="font-semibold text-emerald-700">{submissionSuccess.preferredDeadline}</span>
              </div>
              <div>
                <span className="text-gray-400 font-mono text-[10px] uppercase block">Client Email</span>
                <span className="font-medium text-gray-800">{submissionSuccess.email}</span>
              </div>
              <div>
                <span className="text-gray-400 font-mono text-[10px] uppercase block">Phone / WhatsApp</span>
                <span className="font-medium text-gray-800">{submissionSuccess.phone}</span>
              </div>
              <div>
                <span className="text-gray-400 font-mono text-[10px] uppercase block">Fitting / Delivery</span>
                <span className="font-medium text-gray-800">{submissionSuccess.deliveryLocation}</span>
              </div>
              <div>
                <span className="text-gray-400 font-mono text-[10px] uppercase block">Budget Scope</span>
                <span className="font-medium text-gray-800">{submissionSuccess.budgetRange}</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-200 flex items-center gap-2 text-[11px] text-gray-500">
              <Clock className="h-4 w-4 text-indigo-600 shrink-0" />
              <span>Our master tailor will review your measurements and reach out via email within <strong>1–2 business days</strong> with a custom quote.</span>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={handleResetForm}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-6 font-display text-xs font-bold text-white transition-all hover:bg-indigo-700 hover:scale-102 cursor-pointer shadow-md shadow-indigo-500/10"
            >
              <Scissors className="h-4 w-4" /> Submit Another Custom Request
            </button>
            {setCurrentTab && (
              <button
                onClick={() => setCurrentTab('store')}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-6 font-display text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 cursor-pointer"
              >
                Return to Store Catalog
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const featuredCategories = [
    {
      id: 'evening-gowns',
      name: 'Evening Gowns',
      garmentType: 'Evening Gown',
      desc: 'Bespoke formalwear & gowns',
      icon: <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
    },
    {
      id: 'suits-blazers',
      name: 'Suits & Blazers',
      garmentType: 'Suit & Blazer',
      desc: 'Tailored executive suits',
      icon: <Scissors className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
    },
    {
      id: 'traditional-wear',
      name: 'Traditional & Cultural',
      garmentType: 'Traditional / Cultural Wear',
      desc: 'Authentic ceremonial attire',
      icon: <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
    },
    {
      id: 'outerwear-jackets',
      name: 'Outerwear & Jackets',
      garmentType: 'Outerwear & Jacket',
      desc: 'Custom coats & jackets',
      icon: <Layers className="h-5 w-5 text-blue-600 dark:text-blue-400" />
    },
    {
      id: 'casual-shirts',
      name: 'Casual & Shirts',
      garmentType: 'Shirts & Blouses',
      desc: 'Bespoke shirts & tops',
      icon: <Shirt className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
    }
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 font-sans">
      {/* 1. Shop By Categories & Custom Apparel Header */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/60 px-3 py-1 font-mono text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-widest mb-2">
              <Scissors className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" /> Bespoke Apparel Categories
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Shop By Categories
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              Choose a custom apparel category below to customize your measurements, or explore our complete ready-to-wear store catalog.
            </p>
          </div>

          {setCurrentTab && (
            <button
              onClick={() => setCurrentTab('store')}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-slate-100 px-4 font-display text-xs font-bold text-white dark:text-slate-900 transition-all hover:bg-indigo-600 dark:hover:bg-indigo-400 dark:hover:text-white shrink-0 cursor-pointer shadow-xs"
            >
              <ShoppingBag className="h-4 w-4" /> Shop All <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* 5 Categories Grid + Quick Select */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {featuredCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setGarmentType(cat.garmentType);
                const formElem = document.querySelector('form');
                if (formElem) formElem.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`group flex flex-col items-center justify-center text-center p-4 rounded-xl border transition-all cursor-pointer ${
                garmentType === cat.garmentType
                  ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold shadow-xs'
                  : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
              }`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-slate-700 border border-slate-200/80 dark:border-slate-600 mb-2.5 group-hover:scale-110 transition-transform">
                {cat.icon}
              </div>
              <span className="text-xs font-semibold leading-tight">{cat.name}</span>
              <span className="mt-1 text-[10px] text-slate-400 dark:text-slate-500 font-normal leading-tight">{cat.desc}</span>
            </button>
          ))}
        </div>

        {/* Bottom Bar with direct Shop All link */}
        {setCurrentTab && (
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Master Tailor Guarantee & Custom Sizing
            </span>
            <button
              type="button"
              onClick={() => setCurrentTab('store')}
              className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline cursor-pointer"
            >
              Browse all store items <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Global Error Banner */}
      {errors.form && (
        <div className="mt-6 rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Form Submission Error</span>
            <p className="mt-0.5 leading-relaxed">{errors.form}</p>
          </div>
        </div>
      )}

      {/* 2. Main Request Form */}
      <form onSubmit={handleSubmit} className="mt-8 space-y-8">
        
        {/* Section A: Contact Details */}
        <div className="rounded-xl border border-gray-150 bg-white p-6 md:p-8 shadow-xs">
          <div className="flex items-center gap-2.5 border-b border-gray-100 pb-4 mb-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 font-bold text-xs">
              1
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-gray-900">Contact Information</h3>
              <p className="text-xs text-gray-500 font-light">So our tailoring team can reach out with your custom quote.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }));
                }}
                placeholder="e.g. Sarah Jenkins"
                className={`h-10 w-full rounded-lg border bg-white px-3.5 text-xs text-gray-900 focus:outline-none transition-colors ${
                  errors.fullName ? 'border-rose-400 bg-rose-50/20 input-error-field' : 'border-gray-250 focus:border-indigo-600'
                }`}
              />
              {errors.fullName && <p className="mt-1 text-[11px] text-rose-500">{errors.fullName}</p>}
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                }}
                placeholder="e.g. sarah@example.com"
                className={`h-10 w-full rounded-lg border bg-white px-3.5 text-xs text-gray-900 focus:outline-none transition-colors ${
                  errors.email ? 'border-rose-400 bg-rose-50/20 input-error-field' : 'border-gray-250 focus:border-indigo-600'
                }`}
              />
              {errors.email && <p className="mt-1 text-[11px] text-rose-500">{errors.email}</p>}
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Phone / WhatsApp <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
                }}
                placeholder="e.g. +254 712 345 678"
                className={`h-10 w-full rounded-lg border bg-white px-3.5 text-xs text-gray-900 focus:outline-none transition-colors ${
                  errors.phone ? 'border-rose-400 bg-rose-50/20 input-error-field' : 'border-gray-250 focus:border-indigo-600'
                }`}
              />
              {errors.phone && <p className="mt-1 text-[11px] text-rose-500">{errors.phone}</p>}
            </div>
          </div>
        </div>

        {/* Section B: Garment & Timeline Specifications */}
        <div className="rounded-xl border border-gray-150 bg-white p-6 md:p-8 shadow-xs">
          <div className="flex items-center gap-2.5 border-b border-gray-100 pb-4 mb-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 font-bold text-xs">
              2
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-gray-900">Garment & Project Scope</h3>
              <p className="text-xs text-gray-500 font-light">Select the garment style, timeline, and delivery preference.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Garment Type Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Garment Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={garmentType}
                onChange={(e) => setGarmentType(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-250 bg-white px-3 text-xs text-gray-900 focus:border-indigo-600 focus:outline-none"
              >
                {garmentOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>

              {garmentType === 'Other' && (
                <div className="mt-3">
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    Specify Custom Garment <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={otherGarmentType}
                    onChange={(e) => setOtherGarmentType(e.target.value)}
                    placeholder="e.g. Custom Embroidered Kimono / Trench Coat"
                    className={`h-9 w-full rounded-lg border bg-white px-3 text-xs text-gray-900 focus:outline-none ${
                      errors.otherGarmentType ? 'border-rose-400 bg-rose-50/20 input-error-field' : 'border-gray-250 focus:border-indigo-600'
                    }`}
                  />
                  {errors.otherGarmentType && <p className="mt-1 text-[11px] text-rose-500">{errors.otherGarmentType}</p>}
                </div>
              )}
            </div>

            {/* Preferred Timeline / Deadline */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Preferred Completion Deadline <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={preferredDeadline}
                onChange={(e) => {
                  setPreferredDeadline(e.target.value);
                  if (errors.preferredDeadline) setErrors((prev) => ({ ...prev, preferredDeadline: '' }));
                }}
                className={`h-10 w-full rounded-lg border bg-white px-3 text-xs text-gray-900 focus:outline-none ${
                  errors.preferredDeadline ? 'border-rose-400 bg-rose-50/20 input-error-field' : 'border-gray-250 focus:border-indigo-600'
                }`}
              />
              {errors.preferredDeadline && <p className="mt-1 text-[11px] text-rose-500">{errors.preferredDeadline}</p>}

              {/* Rush Order Warning Banner */}
              {isRushOrder && (
                <div className="mt-2.5 rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-800 flex items-center gap-2 font-medium">
                  <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>⚡ Rush turnaround note: Orders under 7 days may require expedited artisan scheduling.</span>
                </div>
              )}
            </div>

            {/* Budget Range */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Estimated Budget Range (Optional)
              </label>
              <select
                value={budgetRange}
                onChange={(e) => setBudgetRange(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-250 bg-white px-3 text-xs text-gray-900 focus:border-indigo-600 focus:outline-none"
              >
                <option value="Under KSh 10,000">Under KSh 10,000</option>
                <option value="KSh 10,000 - 25,000">KSh 10,000 – KSh 25,000</option>
                <option value="KSh 25,000 - 50,000">KSh 25,000 – KSh 50,000</option>
                <option value="KSh 50,000 - 100,000">KSh 50,000 – KSh 100,000</option>
                <option value="Over KSh 100,000 / Flexible">Over KSh 100,000 / Flexible Luxury</option>
              </select>
            </div>

            {/* Delivery / Fitting Location */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Fitting & Delivery Preference (Optional)
              </label>
              <select
                value={deliveryLocation}
                onChange={(e) => setDeliveryLocation(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-250 bg-white px-3 text-xs text-gray-900 focus:border-indigo-600 focus:outline-none"
              >
                <option value="In-Person Fitting at Atelier Nairobi">In-Person Fitting at Atelier (Nairobi)</option>
                <option value="Courier Home Delivery">Courier Home Delivery (Self-Measurement)</option>
                <option value="Pickup at Ropenix Store Hub">Pickup at Ropenix Store Hub</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section C: Structured Body Measurements */}
        <div className="rounded-xl border border-gray-150 bg-white p-6 md:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4 mb-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 font-bold text-xs">
                3
              </div>
              <div>
                <h3 className="font-display text-base font-semibold text-gray-900 flex items-center gap-2">
                  Body Measurements <span className="text-rose-500">*</span>
                </h3>
                <p className="text-xs text-gray-500 font-light">Enter your exact measurements for a tailor-made fit.</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Unit Toggle Button */}
              <div className="flex items-center rounded-lg bg-gray-100 p-1 border border-gray-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setMeasurementUnit('cm')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    measurementUnit === 'cm' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  cm
                </button>
                <button
                  type="button"
                  onClick={() => setMeasurementUnit('inches')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    measurementUnit === 'inches' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  inches
                </button>
              </div>

              {/* Open Measurement Guide Modal */}
              <button
                type="button"
                onClick={() => setShowMeasurementGuide(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50/80 px-3 py-1.5 rounded-lg border border-indigo-100 transition-colors cursor-pointer"
              >
                <HelpCircle className="h-4 w-4" /> Measurement Guide
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Bust/Chest */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Bust / Chest ({measurementUnit}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={bust}
                onChange={(e) => {
                  setBust(e.target.value);
                  if (errors.bust) setErrors((prev) => ({ ...prev, bust: '' }));
                }}
                placeholder={`e.g. ${measurementUnit === 'cm' ? '92' : '36'}`}
                className={`h-9 w-full rounded-lg border bg-white px-3 text-xs text-gray-900 focus:outline-none ${
                  errors.bust ? 'border-rose-400 bg-rose-50/20 input-error-field' : 'border-gray-250 focus:border-indigo-600'
                }`}
              />
              {errors.bust && <p className="mt-1 text-[10px] text-rose-500">{errors.bust}</p>}
            </div>

            {/* Waist */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Waist ({measurementUnit}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={waist}
                onChange={(e) => {
                  setWaist(e.target.value);
                  if (errors.waist) setErrors((prev) => ({ ...prev, waist: '' }));
                }}
                placeholder={`e.g. ${measurementUnit === 'cm' ? '70' : '28'}`}
                className={`h-9 w-full rounded-lg border bg-white px-3 text-xs text-gray-900 focus:outline-none ${
                  errors.waist ? 'border-rose-400 bg-rose-50/20 input-error-field' : 'border-gray-250 focus:border-indigo-600'
                }`}
              />
              {errors.waist && <p className="mt-1 text-[10px] text-rose-500">{errors.waist}</p>}
            </div>

            {/* Hips */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Hips ({measurementUnit}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={hips}
                onChange={(e) => {
                  setHips(e.target.value);
                  if (errors.hips) setErrors((prev) => ({ ...prev, hips: '' }));
                }}
                placeholder={`e.g. ${measurementUnit === 'cm' ? '98' : '38.5'}`}
                className={`h-9 w-full rounded-lg border bg-white px-3 text-xs text-gray-900 focus:outline-none ${
                  errors.hips ? 'border-rose-400 bg-rose-50/20 input-error-field' : 'border-gray-250 focus:border-indigo-600'
                }`}
              />
              {errors.hips && <p className="mt-1 text-[10px] text-rose-500">{errors.hips}</p>}
            </div>

            {/* Shoulder Width */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Shoulder Width ({measurementUnit}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={shoulderWidth}
                onChange={(e) => {
                  setShoulderWidth(e.target.value);
                  if (errors.shoulderWidth) setErrors((prev) => ({ ...prev, shoulderWidth: '' }));
                }}
                placeholder={`e.g. ${measurementUnit === 'cm' ? '41' : '16'}`}
                className={`h-9 w-full rounded-lg border bg-white px-3 text-xs text-gray-900 focus:outline-none ${
                  errors.shoulderWidth ? 'border-rose-400 bg-rose-50/20 input-error-field' : 'border-gray-250 focus:border-indigo-600'
                }`}
              />
              {errors.shoulderWidth && <p className="mt-1 text-[10px] text-rose-500">{errors.shoulderWidth}</p>}
            </div>

            {/* Sleeve Length */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Sleeve Length ({measurementUnit}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={sleeveLength}
                onChange={(e) => {
                  setSleeveLength(e.target.value);
                  if (errors.sleeveLength) setErrors((prev) => ({ ...prev, sleeveLength: '' }));
                }}
                placeholder={`e.g. ${measurementUnit === 'cm' ? '60' : '23.5'}`}
                className={`h-9 w-full rounded-lg border bg-white px-3 text-xs text-gray-900 focus:outline-none ${
                  errors.sleeveLength ? 'border-rose-400 bg-rose-50/20 input-error-field' : 'border-gray-250 focus:border-indigo-600'
                }`}
              />
              {errors.sleeveLength && <p className="mt-1 text-[10px] text-rose-500">{errors.sleeveLength}</p>}
            </div>

            {/* Inseam / Leg Length */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Inseam / Leg ({measurementUnit}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={inseam}
                onChange={(e) => {
                  setInseam(e.target.value);
                  if (errors.inseam) setErrors((prev) => ({ ...prev, inseam: '' }));
                }}
                placeholder={`e.g. ${measurementUnit === 'cm' ? '82' : '32'}`}
                className={`h-9 w-full rounded-lg border bg-white px-3 text-xs text-gray-900 focus:outline-none ${
                  errors.inseam ? 'border-rose-400 bg-rose-50/20 input-error-field' : 'border-gray-250 focus:border-indigo-600'
                }`}
              />
              {errors.inseam && <p className="mt-1 text-[10px] text-rose-500">{errors.inseam}</p>}
            </div>

            {/* Total Height */}
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Total Height ({measurementUnit}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={height}
                onChange={(e) => {
                  setHeight(e.target.value);
                  if (errors.height) setErrors((prev) => ({ ...prev, height: '' }));
                }}
                placeholder={`e.g. ${measurementUnit === 'cm' ? '172' : '67.5'}`}
                className={`h-9 w-full rounded-lg border bg-white px-3 text-xs text-gray-900 focus:outline-none ${
                  errors.height ? 'border-rose-400 bg-rose-50/20 input-error-field' : 'border-gray-250 focus:border-indigo-600'
                }`}
              />
              {errors.height && <p className="mt-1 text-[10px] text-rose-500">{errors.height}</p>}
            </div>
          </div>

          {/* Custom Measurement Notes */}
          <div className="mt-4">
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Custom Measurement Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={measurementNotes}
              onChange={(e) => setMeasurementNotes(e.target.value)}
              placeholder="e.g. Broad shoulders, high waist preference, or specific posture considerations."
              className="w-full rounded-lg border border-gray-250 bg-white p-3 text-xs text-gray-900 focus:border-indigo-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Section D: Material Samples & Design Inspiration Uploads */}
        <div className="rounded-xl border border-gray-150 bg-white p-6 md:p-8 shadow-xs">
          <div className="flex items-center gap-2.5 border-b border-gray-100 pb-4 mb-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 font-bold text-xs">
              4
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-gray-900">Inspirations & Material Samples</h3>
              <p className="text-xs text-gray-500 font-light">Upload fabric swatches, sketch images, or video clips (Max 5MB each).</p>
            </div>
          </div>

          {/* Progress Bar Indicator */}
          {uploadingProgress !== null && (
            <div className="mb-5 rounded-lg bg-indigo-50 border border-indigo-100 p-3">
              <div className="flex items-center justify-between text-xs font-semibold text-indigo-800 mb-1">
                <span>Processing media upload...</span>
                <span>{uploadingProgress}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-indigo-200 overflow-hidden">
                <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${uploadingProgress}%` }}></div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. Material Sample Image Upload */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Material Samples (Image)
              </label>
              <p className="text-[11px] text-gray-500 mb-2">Max 3 files (JPG, PNG, WEBP, up to 5MB each).</p>
              
              <input
                ref={materialInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleMaterialUpload}
                className="hidden"
                id="material-sample-input"
              />
              
              <label
                htmlFor="material-sample-input"
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-250 bg-gray-50/50 p-4 text-center hover:border-indigo-500 hover:bg-indigo-50/20 cursor-pointer transition-colors"
              >
                <ImageIcon className="h-6 w-6 text-gray-400 mb-1" />
                <span className="text-xs font-semibold text-indigo-600">Browse Fabric Photos</span>
                <span className="text-[10px] text-gray-400 mt-0.5">Click to upload swatches</span>
              </label>

              {fileErrors.material && (
                <p className="mt-2 text-[11px] text-rose-600 font-medium bg-rose-50 p-2 rounded border border-rose-200">
                  {fileErrors.material}
                </p>
              )}

              {/* Material Previews */}
              {materialSamples.length > 0 && (
                <div className="mt-3 space-y-2">
                  {materialSamples.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <img src={file.url} alt={file.name} className="h-8 w-8 rounded object-cover shrink-0" />
                        <span className="truncate text-gray-700 font-medium">{file.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMaterialSamples(materialSamples.filter((_, i) => i !== idx))}
                        className="text-gray-400 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Design Inspiration Image Upload */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Design Inspiration (Images)
              </label>
              <p className="text-[11px] text-gray-500 mb-2">Up to 5 images (JPG, PNG, WEBP, max 5MB each).</p>

              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleDesignImageUpload}
                className="hidden"
                id="design-image-input"
              />

              <label
                htmlFor="design-image-input"
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-250 bg-gray-50/50 p-4 text-center hover:border-indigo-500 hover:bg-indigo-50/20 cursor-pointer transition-colors"
              >
                <Upload className="h-6 w-6 text-gray-400 mb-1" />
                <span className="text-xs font-semibold text-indigo-600">Upload Sketches & Gowns</span>
                <span className="text-[10px] text-gray-400 mt-0.5">Pinterest / Runway photos</span>
              </label>

              {fileErrors.designImages && (
                <p className="mt-2 text-[11px] text-rose-600 font-medium bg-rose-50 p-2 rounded border border-rose-200">
                  {fileErrors.designImages}
                </p>
              )}

              {/* Image Previews */}
              {designImages.length > 0 && (
                <div className="mt-3 space-y-2">
                  {designImages.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <img src={file.url} alt={file.name} className="h-8 w-8 rounded object-cover shrink-0" />
                        <span className="truncate text-gray-700 font-medium">{file.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDesignImages(designImages.filter((_, i) => i !== idx))}
                        className="text-gray-400 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Design Inspiration Video Upload */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Design Inspiration (Video Clip)
              </label>
              <p className="text-[11px] text-gray-500 mb-2">Optional 1 video clip (MP4, MOV, max 5MB limit).</p>

              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                onChange={handleDesignVideoUpload}
                className="hidden"
                id="design-video-input"
              />

              <label
                htmlFor="design-video-input"
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-250 bg-gray-50/50 p-4 text-center hover:border-indigo-500 hover:bg-indigo-50/20 cursor-pointer transition-colors"
              >
                <Video className="h-6 w-6 text-gray-400 mb-1" />
                <span className="text-xs font-semibold text-indigo-600">Upload Video File</span>
                <span className="text-[10px] text-gray-400 mt-0.5">Strict max 5MB limit</span>
              </label>

              {fileErrors.designVideo && (
                <div className="mt-2 text-[11px] text-amber-800 font-medium bg-amber-50 p-2.5 rounded-lg border border-amber-200 leading-relaxed">
                  {fileErrors.designVideo}
                </div>
              )}

              {designVideos.length > 0 && (
                <div className="mt-3 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Video className="h-5 w-5 text-indigo-600 shrink-0" />
                    <span className="truncate text-gray-700 font-medium">{designVideos[0].name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDesignVideos([])}
                    className="text-gray-400 hover:text-rose-600 p-1 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Dynamic Design Inspiration Links Input */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Design Inspiration Links (Pinterest, Instagram, TikTok, YouTube, Drive)
            </label>
            <p className="text-[11px] text-gray-500 mb-3">
              If your video or high-res photo exceeds 5MB, paste public links here.
            </p>

            <div className="space-y-2.5">
              {designLinks.map((link, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <LinkIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="url"
                      value={link}
                      onChange={(e) => handleLinkChange(idx, e.target.value)}
                      placeholder="https://pinterest.com/pin/... or https://instagram.com/p/..."
                      className="h-9 w-full rounded-lg border border-gray-250 bg-white pl-9 pr-3 text-xs text-gray-900 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                  {designLinks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLinkInput(idx)}
                      className="text-gray-400 hover:text-rose-600 p-1.5 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {designLinks.length < 5 && (
              <button
                type="button"
                onClick={handleAddLinkInput}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Add Another Inspiration Link
              </button>
            )}
          </div>
        </div>

        {/* Section E: Additional Instructions & Submit */}
        <div className="rounded-xl border border-gray-150 bg-white p-6 md:p-8 shadow-xs">
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Special Instructions & Embellishments (Optional)
          </label>
          <textarea
            rows={3}
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="Describe specific lining preferences, lace details, embroidery, beadwork, or custom buttons..."
            className="w-full rounded-lg border border-gray-250 bg-white p-3 text-xs text-gray-900 focus:border-indigo-600 focus:outline-none"
          />

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-100">
            <span className="text-[11px] text-gray-400 font-mono">
              🔒 Your request is saved securely. All file uploads validated server-side.
            </span>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`h-12 w-full sm:w-auto px-8 rounded-xl font-display text-xs font-bold text-white transition-all shadow-md shadow-indigo-500/10 cursor-pointer flex items-center justify-center gap-2 ${
                isSubmitting ? 'bg-indigo-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-102'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  <span>Submitting Request...</span>
                </>
              ) : (
                <>
                  <Scissors className="h-4 w-4" />
                  <span>Submit Custom Clothing Request</span>
                </>
              )}
            </button>
          </div>
        </div>

      </form>

      {/* 3. Measurement Guide Diagram Modal */}
      {showMeasurementGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 md:p-8 shadow-2xl my-8">
            <button
              onClick={() => setShowMeasurementGuide(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 text-indigo-600 font-mono text-[10px] font-bold uppercase tracking-widest">
              <Ruler className="h-4 w-4" /> ATELIER MEASUREMENT GUIDE
            </div>
            <h3 className="mt-1 font-display text-xl font-bold text-gray-900">
              How to Take Body Measurements Accurately
            </h3>
            <p className="mt-1 text-xs text-gray-500 font-light">
              Use a flexible fabric measuring tape while standing straight. Keep tape snug but not tight.
            </p>

            <div className="mt-6 space-y-4 text-xs text-gray-700">
              <div className="rounded-xl bg-gray-50 p-4 border border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <strong className="text-gray-900 block mb-0.5">1. Bust / Chest</strong>
                  <span className="text-gray-600 text-[11px] leading-relaxed block">Measure around the fullest part of your chest, keeping the tape horizontal across your back.</span>
                </div>
                <div>
                  <strong className="text-gray-900 block mb-0.5">2. Natural Waist</strong>
                  <span className="text-gray-600 text-[11px] leading-relaxed block">Measure around your natural waistline, typically 1 inch above your belly button.</span>
                </div>
                <div>
                  <strong className="text-gray-900 block mb-0.5">3. Fullest Hips</strong>
                  <span className="text-gray-600 text-[11px] leading-relaxed block">Stand with feet together and measure around the widest part of your hips/buttocks.</span>
                </div>
                <div>
                  <strong className="text-gray-900 block mb-0.5">4. Shoulder Width</strong>
                  <span className="text-gray-600 text-[11px] leading-relaxed block">Measure across your back from shoulder tip to shoulder tip.</span>
                </div>
                <div>
                  <strong className="text-gray-900 block mb-0.5">5. Sleeve Length</strong>
                  <span className="text-gray-600 text-[11px] leading-relaxed block">Measure from your shoulder point down your arm to your wrist joint.</span>
                </div>
                <div>
                  <strong className="text-gray-900 block mb-0.5">6. Inseam / Leg Length</strong>
                  <span className="text-gray-600 text-[11px] leading-relaxed block">Measure from the top of your inner thigh down to your ankle bone.</span>
                </div>
              </div>

              <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3.5 text-[11px] text-indigo-900 flex items-center gap-2">
                <Info className="h-4 w-4 text-indigo-600 shrink-0" />
                <span>Need help with measurements? You can also choose <strong>In-Person Fitting at Atelier Nairobi</strong> to have our master tailors measure you in person!</span>
              </div>
            </div>

            <div className="mt-6 text-right">
              <button
                onClick={() => setShowMeasurementGuide(false)}
                className="rounded-xl bg-gray-900 px-6 py-2.5 font-display text-xs font-semibold text-white hover:bg-gray-800 cursor-pointer"
              >
                Got It, Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
