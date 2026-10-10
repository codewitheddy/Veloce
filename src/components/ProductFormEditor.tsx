import React, { useState, useEffect, useMemo, useRef } from 'react';
import DOMPurify from 'dompurify';
import {
  Package,
  PackagePlus,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  X,
  Plus,
  Trash2,
  Eye,
  Copy,
  Save,
  Check,
  Upload,
  Image as ImageIcon,
  DollarSign,
  Layers,
  Tag,
  FolderTree,
  FileText,
  Search,
  Truck,
  Globe,
  Clock,
  ShieldAlert,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Info,
  RefreshCw,
  ExternalLink,
  Edit2,
  HelpCircle,
  Zap,
  Sliders,
  Maximize2,
  Video,
  Film,
  GripVertical,
  RotateCw,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Table,
  Link as LinkIcon,
  ImagePlus,
  LayoutTemplate,
  Split,
  MoveUp,
  MoveDown,
  RotateCcw,
  FileSpreadsheet,
  Columns,
  FileVideo,
  Play,
  Pause,
  Building2,
  Phone,
  Mail,
  MapPin,
  CreditCard
} from 'lucide-react';
import { Product, ProductVariant } from '../types';
import { Supplier, SupplierPaymentTerms } from '../types/supplier';
import { supplierApi } from '../services/supplierApi';
import {
  getCategoryType,
  getSubcategoriesForCategory,
  COMMON_ALLERGENS,
  COMMON_COUNTRIES,
  COMMON_BRANDS,
  COUNTRY_FLAG_MAP,
  getCountryFlag,
  COMMON_SIZES,
  getDaysUntilExpiry,
  getExpiryStatus,
  CategoryClassification,
  generateSku,
  resolveColorHex,
} from '../utils/productUtils';
import {
  DEFAULT_TAX_CLASSES,
  getTaxClassConfig,
  getProductTaxInfo,
  TaxStatus,
} from '../utils/taxUtils';
import {
  uploadImageToCloudinary,
  isCloudinaryUrl,
  getOptimizedCloudinaryUrl,
} from '../lib/cloudinary';
import { ProductVariantManager } from './ProductVariantManager';
import { ProductOption, OptionValueImage } from '../types';
import { cleanDescriptionExcerpt } from '../utils/formatDescription';

export type UserRole = 'super_admin' | 'store_manager' | 'catalog_editor';

export interface ProductFormEditorProps {
  initialProduct?: Product | null;
  allProducts: Product[];
  categories: { id: string; name: string }[];
  currentUserRole?: UserRole;
  onSaveProduct: (product: Product, publishImmediately: boolean) => void;
  onCancel: () => void;
  onDuplicateProduct?: (product: Product) => void;
  onSwitchProductToEdit?: (product: Product) => void;
}

export interface ImageMetadata {
  url: string;
  width: number;
  height: number;
  aspectRatio: number;
  originalSizeKb?: number;
  compressedSizeKb?: number;
  warnings: string[];
  isCompressed?: boolean;
}

export type SectionTabId =
  | 'basic_info'
  | 'media'
  | 'pricing'
  | 'variants'
  | 'organization'
  | 'category_specs'
  | 'description'
  | 'seo'
  | 'shipping'
  | 'publish';

interface SectionConfig {
  id: SectionTabId;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
}

const SECTION_TABS: SectionConfig[] = [
  { id: 'basic_info', label: 'Basic Info', shortLabel: 'Basic', icon: FileText },
  { id: 'media', label: 'Media Assets', shortLabel: 'Media', icon: ImageIcon },
  { id: 'pricing', label: 'Pricing & Taxes', shortLabel: 'Pricing', icon: DollarSign },
  { id: 'variants', label: 'Variants & Stock', shortLabel: 'Variants', icon: Layers },
  { id: 'organization', label: 'Organization', shortLabel: 'Category', icon: FolderTree },
  { id: 'category_specs', label: 'Category & Expiry', shortLabel: 'Compliance', icon: ShieldAlert },
  { id: 'description', label: 'Description & Specs', shortLabel: 'Specs', icon: Zap },
  { id: 'seo', label: 'SEO & Search', shortLabel: 'SEO', icon: Globe },
  { id: 'shipping', label: 'Shipping & Logistics', shortLabel: 'Shipping', icon: Truck },
  { id: 'publish', label: 'Status & Publish', shortLabel: 'Publish', icon: CheckCircle2 }
];

export const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export function ProductFormEditor({
  initialProduct,
  allProducts,
  categories,
  currentUserRole = 'super_admin',
  onSaveProduct,
  onCancel,
  onDuplicateProduct,
  onSwitchProductToEdit,
}: ProductFormEditorProps) {
  const isEditing = !!initialProduct?.id;

  // Active section tab in single-page editor
  const [activeTab, setActiveTab] = useState<SectionTabId>('basic_info');

  // Smooth scroll to section in Single-Page layout
  const scrollToSection = (sectionId: SectionTabId) => {
    setActiveTab(sectionId);
    const el = document.getElementById(`section-${sectionId}`);
    if (el) {
      const yOffset = -90; // account for sticky header offset
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + 140;
      for (let i = SECTION_TABS.length - 1; i >= 0; i--) {
        const tab = SECTION_TABS[i];
        const el = document.getElementById(`section-${tab.id}`);
        if (el && el.offsetTop <= scrollPos) {
          setActiveTab(tab.id);
          break;
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const [role, setRole] = useState<UserRole>(currentUserRole);

  // Local draft cache for new product creation
  const draftData = useMemo(() => {
    if (!initialProduct && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('veloce_new_product_draft');
        if (saved) return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return null;
  }, [initialProduct]);

  // --- FORM STATES ---
  // Basic Info
  const [title, setTitle] = useState(initialProduct?.name || draftData?.title || '');
  const [slug, setSlug] = useState(initialProduct?.slug || draftData?.slug || generateSlug(initialProduct?.name || draftData?.title || ''));
  const [isSlugCustom, setIsSlugCustom] = useState(!!initialProduct?.slug || !!draftData?.slug);
  const [brand, setBrand] = useState(initialProduct?.brand || draftData?.brand || 'Veloce Kenya');
  const [countryOfOrigin, setCountryOfOrigin] = useState(
    initialProduct?.countryOfOrigin || draftData?.countryOfOrigin || (initialProduct as any)?.country_of_origin || 'Kenya'
  );
  const [shortDescription, setShortDescription] = useState(
    initialProduct?.shortDescription || draftData?.shortDescription || (initialProduct?.description ? cleanDescriptionExcerpt(initialProduct.description, 200) : '')
  );
  const [status, setStatus] = useState<
    'draft' | 'scheduled' | 'published' | 'archived' | 'Active' | 'Inactive'
  >( (initialProduct?.status as any) || 'draft');
  const [publishAt, setPublishAt] = useState(initialProduct?.publishAt || '');
  const [prodType, setProdType] = useState<'physical' | 'digital' | 'service'>(
    initialProduct?.type || draftData?.prodType || 'physical'
  );

  // Media & Rich Media State
  const [images, setImages] = useState<string[]>(
    initialProduct?.images?.length
      ? initialProduct.images
      : initialProduct?.imageUrl
      ? [initialProduct.imageUrl]
      : Array.isArray(draftData?.images) && draftData.images.length > 0
      ? draftData.images
      : []
  );
  const [primaryImageIndex, setPrimaryImageIndex] = useState<number>(0);
  const [imageAltTexts, setImageAltTexts] = useState<Record<number, string>>(
    initialProduct?.imageAltTexts || { 0: initialProduct?.name || '' }
  );
  const [newImageUrlInput, setNewImageUrlInput] = useState('');
  const [videoUrl, setVideoUrl] = useState(initialProduct?.videoUrl || '');
  const [images360, setImages360] = useState<string[]>(initialProduct?.images360 || []);

  const [imagesMeta, setImagesMeta] = useState<Record<string, ImageMetadata>>({});
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isDropzoneActive, setIsDropzoneActive] = useState(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [mediaNotice, setMediaNotice] = useState<{ type: 'info' | 'warning' | 'success'; text: string } | null>(null);

  // 360 Spin Viewer State
  const [spin360Index, setSpin360Index] = useState<number>(0);
  const [isAutoSpinning, setIsAutoSpinning] = useState<boolean>(false);
  const [is360DropzoneActive, setIs360DropzoneActive] = useState(false);

  const galleryFileInputRef = useRef<HTMLInputElement>(null);
  const spin360FileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let interval: any = null;
    if (isAutoSpinning && images360.length > 1) {
      interval = setInterval(() => {
        setSpin360Index((prev) => (prev + 1) % images360.length);
      }, 150);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAutoSpinning, images360.length]);

  // Pricing State Initializer
  const initialOriginalPrice =
    initialProduct?.previousPrice !== undefined && initialProduct?.previousPrice !== null && Number(initialProduct.previousPrice) > (initialProduct.price || 0)
      ? Number(initialProduct.previousPrice)
      : initialProduct?.originalPrice !== undefined && initialProduct?.originalPrice !== null && Number(initialProduct.originalPrice) > (initialProduct.price || 0)
      ? Number(initialProduct.originalPrice)
      : (initialProduct as any)?.original_price !== undefined && (initialProduct as any)?.original_price !== null && Number((initialProduct as any).original_price) > (initialProduct.price || 0)
      ? Number((initialProduct as any).original_price)
      : initialProduct?.basePrice || initialProduct?.price || 0;

  const [basePrice, setBasePrice] = useState<number>(draftData?.basePrice !== undefined ? Number(draftData.basePrice) : initialOriginalPrice);
  const [salePrice, setSalePrice] = useState<number | ''>(() => {
    if (draftData?.salePrice !== undefined && draftData.salePrice !== '') {
      return Number(draftData.salePrice);
    }
    if (initialProduct?.salePrice !== undefined && initialProduct?.salePrice !== null && (initialProduct?.salePrice as any) !== '') {
      const sp = Number(initialProduct.salePrice);
      if (sp > 0 && sp < initialOriginalPrice) {
        return sp;
      }
    }
    if (initialOriginalPrice > (initialProduct?.price || 0) && (initialProduct?.price || 0) > 0) {
      return Number(initialProduct?.price);
    }
    return '';
  });
  const [saleStartAt, setSaleStartAt] = useState(initialProduct?.saleStartAt || '');
  const [saleEndAt, setSaleEndAt] = useState(
    initialProduct?.saleEndAt || initialProduct?.saleEndDate || ''
  );
  const initialCostPrice =
    initialProduct?.costPrice !== undefined && initialProduct?.costPrice !== null && (initialProduct.costPrice as any) !== ''
      ? initialProduct.costPrice
      : (initialProduct as any)?.cost_price !== undefined && (initialProduct as any)?.cost_price !== null && (initialProduct as any)?.cost_price !== ''
      ? (initialProduct as any).cost_price
      : initialProduct?.agreedCostPrice !== undefined && initialProduct?.agreedCostPrice !== null && (initialProduct.agreedCostPrice as any) !== ''
      ? initialProduct.agreedCostPrice
      : (initialProduct as any)?.agreed_cost_price !== undefined && (initialProduct as any)?.agreed_cost_price !== null && (initialProduct as any)?.agreed_cost_price !== ''
      ? (initialProduct as any).agreed_cost_price
      : '';
  const [costPrice, setCostPrice] = useState<number | ''>(
    initialCostPrice !== '' && !isNaN(Number(initialCostPrice)) ? Number(initialCostPrice) : ''
  );
  const initialTaxInfo = getProductTaxInfo(initialProduct || {});
  const [taxStatus, setTaxStatus] = useState<TaxStatus>(initialTaxInfo.taxStatus);
  const [taxRate, setTaxRate] = useState<number>(initialTaxInfo.taxRate);
  const [taxClass, setTaxClass] = useState<string>(initialTaxInfo.taxClass);
  const [currency] = useState('KES');

  // Supplier & Consignment Sourcing State
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState<boolean>(false);
  const [supplierId, setSupplierId] = useState<string>(initialProduct?.supplierId || '');
  const [supplierName, setSupplierName] = useState<string>(initialProduct?.supplierName || '');
  const [supplierSku, setSupplierSku] = useState<string>(initialProduct?.supplierSku || '');
  const [agreedCostPrice, setAgreedCostPrice] = useState<number | ''>(
    initialProduct?.agreedCostPrice !== undefined && initialProduct?.agreedCostPrice !== null && (initialProduct.agreedCostPrice as any) !== ''
      ? Number(initialProduct.agreedCostPrice)
      : (initialCostPrice !== '' && !isNaN(Number(initialCostPrice)) ? Number(initialCostPrice) : '')
  );
  const [leadTimeDays, setLeadTimeDays] = useState<number>(initialProduct?.leadTimeDays || 3);
  const [isPrimarySupplier, setIsPrimarySupplier] = useState<boolean>(
    initialProduct?.isPrimarySupplier !== undefined ? initialProduct.isPrimarySupplier : true
  );
  const [showQuickAddSupplierModal, setShowQuickAddSupplierModal] = useState<boolean>(false);
  const [quickSupplierForm, setQuickSupplierForm] = useState<{
    name: string;
    company_name: string;
    email: string;
    phone: string;
    payment_terms: SupplierPaymentTerms;
    mpesa_number: string;
    notes: string;
  }>({
    name: '',
    company_name: '',
    email: '',
    phone: '',
    payment_terms: 'Consignment Sale',
    mpesa_number: '',
    notes: ''
  });
  const [isSavingQuickSupplier, setIsSavingQuickSupplier] = useState<boolean>(false);

  // Fetch available suppliers on mount
  useEffect(() => {
    let isMounted = true;
    setIsLoadingSuppliers(true);
    supplierApi
      .getSuppliers()
      .then((data) => {
        if (isMounted) {
          setSuppliersList(data);
          if (initialProduct?.supplierId) {
            const matched = data.find((s) => s.id === initialProduct.supplierId);
            if (matched) {
              setSupplierName(matched.name);
            }
          }
        }
      })
      .catch((err) => console.warn('Could not load suppliers for product editor:', err))
      .finally(() => {
        if (isMounted) setIsLoadingSuppliers(false);
      });
    return () => {
      isMounted = false;
    };
  }, [initialProduct?.supplierId]);

  const handleSupplierChange = (newSupId: string) => {
    setSupplierId(newSupId);
    if (!newSupId) {
      setSupplierName('');
      setSupplierSku('');
      return;
    }
    const sup = suppliersList.find((s) => s.id === newSupId);
    if (sup) {
      setSupplierName(sup.name);
      if (!supplierSku || supplierSku.startsWith('SUP-')) {
        const categoryName = categories.find((c) => c.id === categoryId)?.name || initialProduct?.category || 'GEN';
        const prodSkuPart = sku.trim() || generateSku(categoryName, title || 'PROD');
        setSupplierSku(`${sup.code}-${prodSkuPart}`);
      }
      if (costPrice !== '' && (agreedCostPrice === '' || agreedCostPrice === 0)) {
        setAgreedCostPrice(costPrice);
      } else if (agreedCostPrice !== '' && (costPrice === '' || costPrice === 0)) {
        setCostPrice(agreedCostPrice);
      }
    }
  };

  const handleCreateQuickSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSupplierForm.name.trim()) return;
    setIsSavingQuickSupplier(true);
    try {
      const created = await supplierApi.createSupplier(quickSupplierForm);
      setSuppliersList((prev) => [created, ...prev]);
      setSupplierId(created.id);
      setSupplierName(created.name);
      if (sku) {
        setSupplierSku(`${created.code}-${sku}`);
      }
      if (costPrice !== '') {
        setAgreedCostPrice(costPrice);
      }
      setShowQuickAddSupplierModal(false);
      setQuickSupplierForm({
        name: '',
        company_name: '',
        email: '',
        phone: '',
        payment_terms: 'Consignment Sale',
        mpesa_number: '',
        notes: ''
      });
    } catch (err) {
      alert('Failed to register supplier. Please try again.');
    } finally {
      setIsSavingQuickSupplier(false);
    }
  };

  const selectedSupplier = suppliersList.find((s) => s.id === supplierId);

  // Helper to check if a product has variations/variants configured
  const checkHasVariants = (prod?: Product | null): boolean => {
    if (!prod) return false;
    const anyProd = prod as any;
    if (
      anyProd.hasVariants === true ||
      anyProd.has_variants === true ||
      anyProd.hasVariants === 1 ||
      anyProd.has_variants === 1 ||
      anyProd.hasVariants === 'true' ||
      anyProd.has_variants === 'true'
    ) {
      return true;
    }
    const rawOpts = anyProd.options;
    const optsLen = Array.isArray(rawOpts)
      ? rawOpts.length
      : typeof rawOpts === 'string' && (rawOpts as string).trim().startsWith('[')
      ? (() => { try { return JSON.parse(rawOpts).length; } catch { return 0; } })()
      : 0;
    if (optsLen > 0) return true;

    const rawMatrix = anyProd.variantMatrix || anyProd.variant_matrix;
    const matrixLen = Array.isArray(rawMatrix)
      ? rawMatrix.length
      : typeof rawMatrix === 'string' && (rawMatrix as string).trim().startsWith('[')
      ? (() => { try { return JSON.parse(rawMatrix).length; } catch { return 0; } })()
      : 0;
    if (matrixLen > 0) return true;

    const rawVars = anyProd.variants;
    const varsLen = Array.isArray(rawVars)
      ? rawVars.length
      : typeof rawVars === 'string' && (rawVars as string).trim().startsWith('[')
      ? (() => { try { return JSON.parse(rawVars).length; } catch { return 0; } })()
      : 0;
    if (varsLen > 0) return true;

    const rawVariations = anyProd.variations;
    const variationsLen = Array.isArray(rawVariations)
      ? rawVariations.length
      : typeof rawVariations === 'string' && (rawVariations as string).trim().startsWith('[')
      ? (() => { try { return JSON.parse(rawVariations).length; } catch { return 0; } })()
      : 0;
    if (variationsLen > 0) return true;

    const rawColorImgs = anyProd.colorImages || anyProd.color_images;
    if (rawColorImgs && typeof rawColorImgs === 'object' && Object.keys(rawColorImgs).length > 0) return true;

    return false;
  };

  const extractOptionsFromProduct = (prod?: Product | null): ProductOption[] => {
    if (!prod) {
      return [
        {
          id: 'opt-size',
          name: 'Size',
          position: 0,
          values: [
            { id: 'v-s', name: 'S', position: 0 },
            { id: 'v-m', name: 'M', position: 1 },
            { id: 'v-l', name: 'L', position: 2 },
            { id: 'v-xl', name: 'XL', position: 3 },
          ],
        },
        {
          id: 'opt-color',
          name: 'Color',
          position: 1,
          values: [
            { id: 'v-black', name: 'Black', hexColor: '#111827', hexCode: '#111827', hex_code: '#111827', position: 0 },
            { id: 'v-navy', name: 'Navy', hexColor: '#1E3A8A', hexCode: '#1E3A8A', hex_code: '#1E3A8A', position: 1 },
            { id: 'v-white', name: 'White', hexColor: '#FFFFFF', hexCode: '#FFFFFF', hex_code: '#FFFFFF', position: 2 },
            { id: 'v-red', name: 'Crimson Red', hexColor: '#DC2626', hexCode: '#DC2626', hex_code: '#DC2626', position: 3 },
          ],
        },
      ];
    }

    const anyProd = prod as any;
    const rawOpts = anyProd.options;
    const parsedOpts: ProductOption[] = Array.isArray(rawOpts)
      ? rawOpts
      : typeof rawOpts === 'string' && (rawOpts as string).trim().startsWith('[')
      ? (() => { try { return JSON.parse(rawOpts); } catch { return []; } })()
      : [];

    if (parsedOpts.length > 0) {
      return parsedOpts.map((opt, oIdx) => ({
        ...opt,
        values: (opt.values || []).map((v, vIdx) => {
          const isColor = opt.name.toLowerCase().trim() === 'color' || opt.name.toLowerCase().trim() === 'colour';
          const hex = isColor ? (v.hexColor || v.hexCode || v.hex_code || resolveColorHex(v.name)) : undefined;
          return {
            ...v,
            hexColor: hex,
            hexCode: hex,
            hex_code: hex,
          };
        }),
      }));
    }

    const rawMatrix = anyProd.variantMatrix || anyProd.variant_matrix || anyProd.variants;
    const parsedMatrix: ProductVariant[] = Array.isArray(rawMatrix)
      ? rawMatrix
      : typeof rawMatrix === 'string' && (rawMatrix as string).trim().startsWith('[')
      ? (() => { try { return JSON.parse(rawMatrix); } catch { return []; } })()
      : [];

    if (parsedMatrix.length > 0) {
      const keys = Array.from(new Set(parsedMatrix.flatMap((v) => Object.keys(v.attributes || {}))));
      if (keys.length > 0) {
        return keys.map((k, idx) => {
          const vals = Array.from(new Set(parsedMatrix.map((v) => v.attributes[k]).filter(Boolean)));
          const isColor = k.toLowerCase().trim() === 'color' || k.toLowerCase().trim() === 'colour';
          return {
            id: `opt-${idx}`,
            name: k.charAt(0).toUpperCase() + k.slice(1),
            position: idx,
            values: vals.map((valName, vIdx) => {
              const hex = isColor ? resolveColorHex(valName) : undefined;
              return {
                id: `val-${idx}-${vIdx}`,
                name: valName,
                position: vIdx,
                hexColor: hex,
                hexCode: hex,
                hex_code: hex,
              };
            }),
          };
        });
      }
    }

    const rawVariations = anyProd.variations;
    const parsedVariations = Array.isArray(rawVariations)
      ? rawVariations
      : typeof rawVariations === 'string' && (rawVariations as string).trim().startsWith('[')
      ? (() => { try { return JSON.parse(rawVariations); } catch { return []; } })()
      : [];

    if (parsedVariations.length > 0) {
      return parsedVariations.map((v: any, idx: number) => {
        const optName = v.name || `Option ${idx + 1}`;
        const rawVals = Array.isArray(v.options) ? v.options : (Array.isArray(v.values) ? v.values : []);
        const isColor = optName.toLowerCase().trim() === 'color' || optName.toLowerCase().trim() === 'colour';
        return {
          id: `opt-${idx}`,
          name: optName,
          position: idx,
          values: rawVals.map((val: any, vIdx: number) => {
            const valName = typeof val === 'string' ? val : (val.name || String(val));
            const hex = isColor ? (val.hexColor || val.hexCode || val.hex_code || resolveColorHex(valName)) : undefined;
            return {
              id: `val-${idx}-${vIdx}`,
              name: valName,
              position: vIdx,
              hexColor: hex,
              hexCode: hex,
              hex_code: hex,
            };
          }),
        };
      });
    }

    return [];
  };

  const extractVariantsFromProduct = (prod?: Product | null): ProductVariant[] => {
    if (!prod) return [];
    if (prod.variants && Array.isArray(prod.variants) && prod.variants.length > 0) {
      return prod.variants;
    }
    if (prod.variantMatrix && Array.isArray(prod.variantMatrix) && prod.variantMatrix.length > 0) {
      return prod.variantMatrix;
    }
    if ((prod as any).variant_matrix && Array.isArray((prod as any).variant_matrix) && (prod as any).variant_matrix.length > 0) {
      return (prod as any).variant_matrix;
    }
    return [];
  };

  // Variants & Inventory
  const [hasVariants, setHasVariants] = useState<boolean>(() => {
    return checkHasVariants(initialProduct);
  });

  const [options, setOptions] = useState<ProductOption[]>(() => {
    return extractOptionsFromProduct(initialProduct);
  });

  const [colorImages, setColorImages] = useState<Record<string, OptionValueImage[]>>(() => {
    return initialProduct?.colorImages || (initialProduct as any)?.color_images || {};
  });

  const [variants, setVariants] = useState<ProductVariant[]>(() => {
    return extractVariantsFromProduct(initialProduct);
  });

  // Custom Variant Attributes Management (e.g. Material, Storage, Style, Pack Size)
  interface CustomVariantAttr {
    id: string;
    name: string;
    options: string;
  }

  const [customVariantAttrs, setCustomVariantAttrs] = useState<CustomVariantAttr[]>(() => {
    if (initialProduct?.variantMatrix && initialProduct.variantMatrix.length > 0) {
      const keys = new Set<string>();
      initialProduct.variantMatrix.forEach((v) => {
        Object.keys(v.attributes || {}).forEach((k) => {
          if (k !== 'size' && k !== 'color') keys.add(k);
        });
      });
      return Array.from(keys).map((k, idx) => {
        const vals = Array.from(
          new Set(initialProduct.variantMatrix!.map((v) => v.attributes[k]).filter(Boolean))
        );
        return {
          id: `custom-attr-${idx}`,
          name: k.charAt(0).toUpperCase() + k.slice(1),
          options: vals.join(', ')
        };
      });
    }
    return [
      { id: 'ca-1', name: 'Material', options: 'Leather, Synthetic, Canvas' }
    ];
  });

  const [newAttrNameInput, setNewAttrNameInput] = useState('');
  const [newAttrOptionsInput, setNewAttrOptionsInput] = useState('');

  // Dedicated Measurement Unit Pair State
  const [measurementValInput, setMeasurementValInput] = useState<string>('1');
  const [measurementUnitSelect, setMeasurementUnitSelect] = useState<string>('kg');

  // Single Custom Variant Form State
  const [showAddSingleVariant, setShowAddSingleVariant] = useState(false);
  const [singleVariantSku, setSingleVariantSku] = useState('');
  const [singleVariantPrice, setSingleVariantPrice] = useState<string>('');
  const [singleVariantStock, setSingleVariantStock] = useState<number>(5);
  const [singleVariantAttrs, setSingleVariantAttrs] = useState<Record<string, string>>({
    color: '',
    size: '',
    material: '',
    weight: '',
    length: ''
  });

  // Bulk actions for variant prices & stock
  const [bulkPriceInput, setBulkPriceInput] = useState<string>('');
  const [bulkStockInput, setBulkStockInput] = useState<string>('');
  const [sku, setSku] = useState(initialProduct?.sku || '');
  const [isSkuCustom, setIsSkuCustom] = useState<boolean>(!!initialProduct?.sku);
  const [stockQty, setStockQty] = useState<number>(initialProduct?.stock ?? 10);
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(
    initialProduct?.lowStockThreshold ?? 5
  );
  const [trackInventory, setTrackInventory] = useState<boolean>(
    initialProduct?.trackInventory !== false
  );

  // Organization
  const [categoryId, setCategoryId] = useState<string>(
    categories.find((c) => c.name.toLowerCase() === initialProduct?.category?.toLowerCase())?.id ||
      categories[0]?.id ||
      '1'
  );
  const sectionNavTabsRef = useRef<HTMLDivElement>(null);

  const scrollSectionTabs = (direction: 'left' | 'right') => {
    if (sectionNavTabsRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      sectionNavTabsRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };
  const [subcategoryId, setSubcategoryId] = useState<string>(initialProduct?.subcategoryId || '');
  const [tags, setTags] = useState<string[]>(() => {
    if (Array.isArray(initialProduct?.tags)) return initialProduct.tags;
    if (typeof initialProduct?.tags === 'string' && (initialProduct.tags as string).trim()) {
      return (initialProduct.tags as string).split(',').map((t) => t.trim()).filter(Boolean);
    }
    return ['featured', 'express-delivery'];
  });
  const [newTagInput, setNewTagInput] = useState('');
  const [relatedProducts, setRelatedProducts] = useState<string[]>(() => {
    if (Array.isArray(initialProduct?.relatedProducts)) return initialProduct.relatedProducts;
    if (typeof initialProduct?.relatedProducts === 'string' && (initialProduct.relatedProducts as string).trim()) {
      return (initialProduct.relatedProducts as string).split(',').map((r) => r.trim()).filter(Boolean);
    }
    return [];
  });

  // Description & Specs
  const [description, setDescription] = useState(
    initialProduct?.detailedDescription || initialProduct?.description || ''
  );
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [descViewMode, setDescViewMode] = useState<'edit' | 'preview' | 'split'>('edit');
  const [showImageInsertModal, setShowImageInsertModal] = useState(false);
  const [showLayoutTemplateModal, setShowLayoutTemplateModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkModalText, setLinkModalText] = useState('');
  const [linkModalUrl, setLinkModalUrl] = useState('');
  const [imageInsertType, setImageInsertType] = useState<'upload' | 'url' | 'gallery'>('upload');
  const [imageInsertUrl, setImageInsertUrl] = useState('');
  const [imageInsertAlt, setImageInsertAlt] = useState('');
  const [imageInsertCaption, setImageInsertCaption] = useState('');
  const [imageInsertLayout, setImageInsertLayout] = useState<'full' | 'split-left' | 'split-right' | 'center'>('full');
  const [showSpecPresetModal, setShowSpecPresetModal] = useState(false);
  const [specSearchTerm, setSpecSearchTerm] = useState('');

  const insertIntoDescription = (before: string, after: string = '', defaultText: string = '') => {
    const textarea = descriptionTextareaRef.current;
    if (!textarea) {
      setDescription(prev => prev + before + defaultText + after);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = description;
    const selectedText = currentText.substring(start, end) || defaultText;
    const newText = currentText.substring(0, start) + before + selectedText + after + currentText.substring(end);
    setDescription(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 10);
  };

  const handleInsertImageFromModal = (url: string, alt: string, caption: string, layout: string) => {
    if (!url.trim()) return;
    let snippet = '';
    const safeAlt = alt.trim() || 'Product Visual';
    const safeCaption = caption.trim();

    if (layout === 'full') {
      snippet = `\n<div class="my-6 rounded-2xl overflow-hidden shadow-md border border-slate-100 bg-slate-900 text-white relative">
  <img src="${url}" alt="${safeAlt}" class="w-full h-72 sm:h-96 object-cover" />
  ${safeCaption ? `<div class="p-4 bg-slate-900/90 backdrop-blur-xs text-xs text-slate-300 italic text-center">${safeCaption}</div>` : ''}
</div>\n`;
    } else if (layout === 'split-left') {
      snippet = `\n<div class="my-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-center p-5 rounded-2xl border border-slate-200 bg-slate-50/50">
  <div class="rounded-xl overflow-hidden aspect-video bg-slate-200">
    <img src="${url}" alt="${safeAlt}" class="w-full h-full object-cover" />
  </div>
  <div class="space-y-2">
    <h4 class="font-bold text-sm text-slate-900">${safeAlt}</h4>
    <p class="text-xs text-slate-600 leading-relaxed font-light">${safeCaption || 'Engineered with high-tolerance industrial standards for enduring daily performance.'}</p>
  </div>
</div>\n`;
    } else if (layout === 'split-right') {
      snippet = `\n<div class="my-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-center p-5 rounded-2xl border border-slate-200 bg-slate-50/50">
  <div class="space-y-2 order-2 md:order-1">
    <h4 class="font-bold text-sm text-slate-900">${safeAlt}</h4>
    <p class="text-xs text-slate-600 leading-relaxed font-light">${safeCaption || 'Refined aesthetics paired with robust, premium-grade materials.'}</p>
  </div>
  <div class="rounded-xl overflow-hidden aspect-video bg-slate-200 order-1 md:order-2">
    <img src="${url}" alt="${safeAlt}" class="w-full h-full object-cover" />
  </div>
</div>\n`;
    } else {
      snippet = `\n<div class="my-6 text-center">
  <img src="${url}" alt="${safeAlt}" class="max-w-md mx-auto rounded-xl shadow-xs border border-slate-200" />
  ${safeCaption ? `<p class="text-[11px] text-slate-400 mt-2 italic">${safeCaption}</p>` : ''}
</div>\n`;
    }

    insertIntoDescription(snippet, '', '');
    setShowImageInsertModal(false);
    setImageInsertUrl('');
    setImageInsertAlt('');
    setImageInsertCaption('');
  };

  const handleUploadImageFileForDescription = async (file: File) => {
    try {
      const uploadRes = await uploadImageToCloudinary(file, {
        folder: 'veloce_descriptions',
        tags: ['description', 'rich_text'],
      });
      if (uploadRes.success && uploadRes.url) {
        setImageInsertUrl(uploadRes.url);
        return;
      }
    } catch {
      // Fallback below
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result as string;
      if (result) {
        setImageInsertUrl(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const [specs, setSpecs] = useState<{ label: string; value: string }[]>(() => {
    if (Array.isArray(initialProduct?.specs) && initialProduct.specs.length > 0) {
      return initialProduct.specs;
    }
    if (Array.isArray(initialProduct?.specifications) && initialProduct.specifications.length > 0) {
      return initialProduct.specifications.map((s) => ({ label: s.key, value: s.value }));
    }
    return [
      { label: 'Material', value: 'Premium Mesh & TPU' },
      { label: 'Warranty', value: '1 Year Official Veloce Care' }
    ];
  });

  const handleMoveSpecRow = (idx: number, direction: 'up' | 'down') => {
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === specs.length - 1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const newSpecs = [...specs];
    const item = newSpecs[idx];
    newSpecs[idx] = newSpecs[targetIdx];
    newSpecs[targetIdx] = item;
    setSpecs(newSpecs);
  };

  const handleDuplicateSpecRow = (idx: number) => {
    const item = specs[idx];
    const newSpecs = [...specs];
    newSpecs.splice(idx + 1, 0, { ...item, label: `${item.label} (Copy)` });
    setSpecs(newSpecs);
  };

  const handleClearAllSpecs = () => {
    if (window.confirm('Are you sure you want to clear all specifications?')) {
      setSpecs([]);
    }
  };

  const handleApplySpecPreset = (presetKey: string) => {
    const PRESETS: Record<string, { label: string; value: string }[]> = {
      electronics: [
        { label: 'Brand & Model', value: 'Veloce Pro Series' },
        { label: 'Display / Dimensions', value: '6.7" Super OLED (1440x3200)' },
        { label: 'Processor / Chipset', value: 'Octa-Core High Performance 3.2GHz' },
        { label: 'Memory & Storage', value: '16GB LPDDR5X RAM + 512GB UFS 4.0' },
        { label: 'Battery & Charging', value: '5000mAh Battery + 65W Fast Charge' },
        { label: 'Connectivity', value: 'Wi-Fi 6E, Bluetooth 5.3, 5G LTE, NFC' },
        { label: 'Weight', value: '185 grams' },
        { label: 'Warranty', value: '12 Months Official Brand Warranty' }
      ],
      apparel: [
        { label: 'Material & Composition', value: '100% Organic Ring-Spun Cotton' },
        { label: 'Fit Type', value: 'Tailored Regular Comfort Fit' },
        { label: 'Fabric Weight', value: '240 GSM Heavyweight Jersey' },
        { label: 'Origin', value: 'Ethically Crafted in Kenya' },
        { label: 'Care Instructions', value: 'Machine wash cold inside-out, tumble dry low' },
        { label: 'Closure / Stitching', value: 'Double-needle reinforced seams' },
        { label: 'Available Sizes', value: 'XS, S, M, L, XL, XXL' }
      ],
      furniture: [
        { label: 'Dimensions (LxWxH)', value: '140cm x 75cm x 73-120cm (Adjustable)' },
        { label: 'Primary Material', value: 'Solid African Teak Wood & Steel Frame' },
        { label: 'Weight Capacity', value: '120 kg max load' },
        { label: 'Assembly', value: 'Tool-free quick assembly (~15 mins)' },
        { label: 'Surface Finish', value: 'Matte Scratch-Resistant Hardwax Oil' },
        { label: 'Warranty', value: '5-Year Structural Frame Warranty' }
      ],
      beauty: [
        { label: 'Net Volume', value: '100ml / 3.4 fl oz' },
        { label: 'Fragrance Profile', value: 'Warm Woody Amber & Citrus Bergamot' },
        { label: 'Formulation', value: 'Concentrated Eau de Parfum (20% Oil)' },
        { label: 'Skin Type', value: 'Suitable for all skin types, dermatologically tested' },
        { label: 'Origin', value: 'Nairobi Botanical Lab, Kenya' },
        { label: 'Shelf Life', value: '36 Months after opening' }
      ],
      food: [
        { label: 'Net Weight', value: '500g (1.1 lbs)' },
        { label: 'Roast / Flavor Notes', value: 'Medium-Dark Roast with Notes of Cocoa & Berry' },
        { label: 'Origin Region', value: 'Nyeri Highlands, Mount Kenya (1,800m ASL)' },
        { label: 'Certification', value: '100% Arabica, Fair Trade Certified' },
        { label: 'Storage', value: 'Keep sealed in cool, dry place away from light' },
        { label: 'Best Before', value: '12 Months from roast date' }
      ]
    };

    if (PRESETS[presetKey]) {
      setSpecs(PRESETS[presetKey]);
      setShowSpecPresetModal(false);
    }
  };

  const renderDescriptionPreview = (text: string) => {
    if (!text || !text.trim()) {
      return '<p class="text-slate-400 italic text-center py-8">No description copy entered yet. Use the editor toolbar or template blocks to compose long-form product details.</p>';
    }
    let html = text;
    // Headings
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-base font-bold text-slate-900 dark:text-white mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-slate-900 dark:text-white mt-5 mb-2.5 border-b border-slate-100 dark:border-slate-800 pb-1">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-xl font-extrabold text-slate-900 dark:text-white mt-6 mb-3">$1</h1>');
    // Formatting
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
    html = html.replace(/~~(.*?)~~/gim, '<del>$1</del>');
    // Images
    html = html.replace(/!\[(.*?)\]\((.*?)\)/gim, '<div class="my-4 rounded-xl overflow-hidden shadow-xs border border-slate-200"><img src="$2" alt="$1" class="w-full max-h-80 object-cover" /><p class="text-[11px] text-center text-slate-400 py-1.5 bg-slate-50">$1</p></div>');
    // Links
    html = html.replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-600 font-semibold underline hover:text-indigo-800">$1</a>');
    // Blockquote
    html = html.replace(/^\> (.*$)/gim, '<blockquote class="border-l-4 border-indigo-500 pl-4 py-2 my-3 bg-indigo-50/40 dark:bg-indigo-950/30 text-xs italic text-slate-700 dark:text-slate-300 rounded-r-lg">$1</blockquote>');
    // Lists
    html = html.replace(/^- (.*$)/gim, '<li class="ml-4 list-disc text-slate-700 dark:text-slate-300 my-0.5 text-xs">$1</li>');
    html = html.replace(/^\* (.*$)/gim, '<li class="ml-4 list-disc text-slate-700 dark:text-slate-300 my-0.5 text-xs">$1</li>');
    return html;
  };
  const [whatsInTheBox, setWhatsInTheBox] = useState(
    initialProduct?.whatsInTheBox || '1x Main Unit, 1x Charging/Connect Cable, 1x Quick Start Guide, 1x Warranty Card'
  );

  // Category Specific States: Clothes & Wearables
  const [sizeGuide, setSizeGuide] = useState(initialProduct?.sizeGuide || '');
  const [availableSizes, setAvailableSizes] = useState<string[]>(() => {
    if (Array.isArray(initialProduct?.availableSizes)) return initialProduct.availableSizes;
    if (typeof initialProduct?.availableSizes === 'string' && (initialProduct.availableSizes as string).trim()) {
      return (initialProduct.availableSizes as string).split(',').map((s) => s.trim()).filter(Boolean);
    }
    return ['S', 'M', 'L', 'XL'];
  });
  const [material, setMaterial] = useState(initialProduct?.material || '');
  const [colorOptions, setColorOptions] = useState<string[]>(() => {
    if (Array.isArray(initialProduct?.colorOptions)) return initialProduct.colorOptions;
    if (typeof initialProduct?.colorOptions === 'string' && (initialProduct.colorOptions as string).trim()) {
      return (initialProduct.colorOptions as string).split(',').map((c) => c.trim()).filter(Boolean);
    }
    return ['Black', 'White', 'Navy'];
  });
  const [careInstructions, setCareInstructions] = useState(initialProduct?.careInstructions || '');
  const [customSizeInput, setCustomSizeInput] = useState('');
  const [customColorInput, setCustomColorInput] = useState('');

  // Category Specific States: Food & Beverages
  const [ingredients, setIngredients] = useState(initialProduct?.ingredients || '');
  const [manufacturer, setManufacturer] = useState(
    initialProduct?.manufacturer || initialProduct?.brand || 'Veloce Foods Kenya'
  );
  const [allergyInfo, setAllergyInfo] = useState<string[]>(() => {
    if (Array.isArray(initialProduct?.allergyInfo)) return initialProduct.allergyInfo;
    if (typeof initialProduct?.allergyInfo === 'string' && (initialProduct.allergyInfo as string).trim()) {
      return (initialProduct.allergyInfo as string).split(',').map((a) => a.trim()).filter(Boolean);
    }
    return [];
  });
  const [allergyTracesNotes, setAllergyTracesNotes] = useState(initialProduct?.allergyTracesNotes || '');
  const [nutritionalInfo, setNutritionalInfo] = useState(initialProduct?.nutritionalInfo || '');
  const [storageInstructions, setStorageInstructions] = useState(
    initialProduct?.storageInstructions || 'Store in a cool, dry place away from direct sunlight.'
  );

  // Category Specific States: Perfumes & Beauty
  const [beautyIngredients, setBeautyIngredients] = useState(
    initialProduct?.beautyIngredients || initialProduct?.ingredients || ''
  );
  const [howToUse, setHowToUse] = useState(initialProduct?.howToUse || '');
  const [beautyManufacturer, setBeautyManufacturer] = useState(
    initialProduct?.beautyManufacturer || initialProduct?.manufacturer || initialProduct?.brand || 'Veloce Beauty'
  );
  const [beautyCountryOfOrigin, setBeautyCountryOfOrigin] = useState(
    initialProduct?.beautyCountryOfOrigin || initialProduct?.countryOfOrigin || 'France'
  );
  const [beautyAllergyInfo, setBeautyAllergyInfo] = useState<string[]>(() => {
    if (Array.isArray(initialProduct?.beautyAllergyInfo)) return initialProduct.beautyAllergyInfo;
    if (typeof initialProduct?.beautyAllergyInfo === 'string' && (initialProduct.beautyAllergyInfo as string).trim()) {
      return (initialProduct.beautyAllergyInfo as string).split(',').map((a) => a.trim()).filter(Boolean);
    }
    return [];
  });
  const [volumeNetWeight, setVolumeNetWeight] = useState(initialProduct?.volumeNetWeight || '100ml');

  // Expiry Date Tracking States
  const [hasExpiryDate, setHasExpiryDate] = useState<boolean>(initialProduct?.hasExpiryDate ?? false);
  const [expiryDate, setExpiryDate] = useState(initialProduct?.expiryDate || '');
  const [batchLotNumber, setBatchLotNumber] = useState(initialProduct?.batchLotNumber || '');

  // Active Category Type helper
  const selectedCategoryObj = categories.find((c) => c.id === categoryId);
  const activeCategoryType = getCategoryType(selectedCategoryObj?.name || initialProduct?.category || '');
  const availableSubcategories = useMemo(() => {
    const catName = selectedCategoryObj?.name || initialProduct?.category || '';
    return getSubcategoriesForCategory(catName);
  }, [selectedCategoryObj, initialProduct?.category]);

  // SEO
  const [metaTitle, setMetaTitle] = useState(initialProduct?.metaTitle || '');
  const [metaDescription, setMetaDescription] = useState(initialProduct?.metaDescription || '');
  const [ogImage, setOgImage] = useState(initialProduct?.ogImage || '');

  // Shipping
  const [weightKg, setWeightKg] = useState<number | ''>(
    initialProduct?.weightKg !== undefined ? initialProduct.weightKg : 0.8
  );
  const [dimensionsCm, setDimensionsCm] = useState<{ length: number; width: number; height: number }>(
    initialProduct?.dimensionsCm || { length: 30, width: 20, height: 12 }
  );
  const [shippingClass, setShippingClass] = useState<'standard' | 'fragile' | 'oversized'>(
    initialProduct?.shippingClass || 'standard'
  );
  const [deliveryZones, setDeliveryZones] = useState<string[]>(() => {
    if (Array.isArray(initialProduct?.deliveryZones)) return initialProduct.deliveryZones;
    if (typeof initialProduct?.deliveryZones === 'string' && (initialProduct.deliveryZones as string).trim()) {
      return (initialProduct.deliveryZones as string).split(',').map((d) => d.trim()).filter(Boolean);
    }
    return ['Nairobi CBD & Environs', 'Mombasa & Coastal Region', 'Countrywide Express'];
  });

  // --- UI & VALIDATION STATES ---
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [apiLogMessage, setApiLogMessage] = useState<{
    type: 'success' | 'error';
    text: string;
    errors?: { section: SectionTabId; field: string; message: string }[];
  } | null>(null);

  // Auto-generate slug when title changes unless custom edited
  useEffect(() => {
    if (!isSlugCustom && title.trim()) {
      setSlug(generateSlug(title));
    }
  }, [title, isSlugCustom]);

  // Sync categoryId when categories list or initialProduct changes
  useEffect(() => {
    if (categories.length > 0) {
      if (!categoryId || !categories.some(c => c.id === categoryId)) {
        const match = categories.find((c) => c.name.toLowerCase() === initialProduct?.category?.toLowerCase());
        if (match) {
          setCategoryId(match.id);
        } else if (!categoryId && categories[0]) {
          setCategoryId(categories[0].id);
        }
      }
    }
  }, [categories, initialProduct?.category, categoryId]);

  // Sync all product fields and media assets if initialProduct is updated or switched
  useEffect(() => {
    if (initialProduct) {
      const rawGallery = initialProduct.images || (initialProduct as any).gallery_images;
      if (Array.isArray(rawGallery) && rawGallery.length > 0) {
        setImages(rawGallery);
      } else if (initialProduct.imageUrl) {
        setImages([initialProduct.imageUrl]);
      }
      if (initialProduct.imageAltTexts) {
        setImageAltTexts(initialProduct.imageAltTexts);
      }
      if (initialProduct.videoUrl) {
        setVideoUrl(initialProduct.videoUrl);
      }
      if (initialProduct.images360) {
        setImages360(initialProduct.images360);
      }

      // Sync Cost Price & Pricing
      const extractedCost =
        initialProduct.costPrice !== undefined && initialProduct.costPrice !== null && (initialProduct.costPrice as any) !== ''
          ? initialProduct.costPrice
          : (initialProduct as any).cost_price !== undefined && (initialProduct as any).cost_price !== null && (initialProduct as any).cost_price !== ''
          ? (initialProduct as any).cost_price
          : initialProduct.agreedCostPrice !== undefined && initialProduct.agreedCostPrice !== null && (initialProduct.agreedCostPrice as any) !== ''
          ? initialProduct.agreedCostPrice
          : (initialProduct as any).agreed_cost_price !== undefined && (initialProduct as any).agreed_cost_price !== null && (initialProduct as any).agreed_cost_price !== ''
          ? (initialProduct as any).agreed_cost_price
          : '';

      if (extractedCost !== '' && !isNaN(Number(extractedCost))) {
        setCostPrice(Number(extractedCost));
      }

      const extractedAgreedCost =
        initialProduct.agreedCostPrice !== undefined && initialProduct.agreedCostPrice !== null && (initialProduct.agreedCostPrice as any) !== ''
          ? Number(initialProduct.agreedCostPrice)
          : (extractedCost !== '' && !isNaN(Number(extractedCost)) ? Number(extractedCost) : '');
      if (extractedAgreedCost !== '') {
        setAgreedCostPrice(extractedAgreedCost);
      }

      if (initialProduct.name) setTitle(initialProduct.name);
      if (initialProduct.slug) {
        setSlug(initialProduct.slug);
        setIsSlugCustom(true);
      }
      if (initialProduct.brand) setBrand(initialProduct.brand);
      if (initialProduct.countryOfOrigin || (initialProduct as any).country_of_origin) {
        setCountryOfOrigin(initialProduct.countryOfOrigin || (initialProduct as any).country_of_origin);
      }
      if (initialProduct.shortDescription) setShortDescription(initialProduct.shortDescription);
      if (initialProduct.description) setDescription(initialProduct.detailedDescription || initialProduct.description);
      const origPrice =
        initialProduct.previousPrice && Number(initialProduct.previousPrice) > (initialProduct.price || 0)
          ? Number(initialProduct.previousPrice)
          : initialProduct.originalPrice && Number(initialProduct.originalPrice) > (initialProduct.price || 0)
          ? Number(initialProduct.originalPrice)
          : (initialProduct as any)?.original_price && Number((initialProduct as any).original_price) > (initialProduct.price || 0)
          ? Number((initialProduct as any).original_price)
          : initialProduct.basePrice || initialProduct.price || 0;
      if (origPrice > 0) {
        setBasePrice(origPrice);
      }
      if (initialProduct.salePrice !== undefined && initialProduct.salePrice !== null && (initialProduct.salePrice as any) !== '') {
        const sp = Number(initialProduct.salePrice);
        if (sp > 0 && sp < origPrice) {
          setSalePrice(sp);
        } else {
          setSalePrice('');
        }
      } else if (
        origPrice > (initialProduct.price || 0) &&
        (initialProduct.price || 0) > 0
      ) {
        setSalePrice(Number(initialProduct.price));
      } else {
        setSalePrice('');
      }
      if (initialProduct.sku) {
        setSku(initialProduct.sku);
        setIsSkuCustom(true);
      }
      const loadedOptions = extractOptionsFromProduct(initialProduct);
      if (loadedOptions.length > 0) {
        setOptions(loadedOptions);
      }
      if (initialProduct.colorImages || (initialProduct as any).color_images) {
        setColorImages(initialProduct.colorImages || (initialProduct as any).color_images || {});
      }
      const loadedVariants = extractVariantsFromProduct(initialProduct);
      if (loadedVariants.length > 0) {
        setVariants(loadedVariants);
      }
      const isProductVar = checkHasVariants(initialProduct);
      setHasVariants(isProductVar);
      if (initialProduct.supplierId) setSupplierId(initialProduct.supplierId);
      if (initialProduct.supplierName) setSupplierName(initialProduct.supplierName);
      if (initialProduct.supplierSku) setSupplierSku(initialProduct.supplierSku);
    }
  }, [initialProduct]);

  // Auto-generate unique SKU when category or title changes unless user custom overridden
  useEffect(() => {
    if (!isSkuCustom) {
      const selectedCatObj = categories.find((c) => c.id === categoryId);
      const catName = selectedCatObj?.name || '';
      if (title.trim() || catName) {
        const autoGeneratedSku = generateSku(catName, title, allProducts);
        setSku(autoGeneratedSku);
      }
    }
  }, [title, categoryId, isSkuCustom, categories, allProducts]);

  const handleForceRegenerateSku = () => {
    const selectedCatObj = categories.find((c) => c.id === categoryId);
    const catName = selectedCatObj?.name || '';
    const freshSku = generateSku(catName, title || 'Product', allProducts);
    setSku(freshSku);
    setIsSkuCustom(false);
  };

  // Debounced Autosave simulation & local draft caching
  useEffect(() => {
    const timer = setTimeout(() => {
      if (title.trim()) {
        setAutosaveStatus('saving');
        if (!initialProduct) {
          try {
            localStorage.setItem(
              'veloce_new_product_draft',
              JSON.stringify({
                title,
                slug,
                brand,
                countryOfOrigin,
                shortDescription,
                description,
                basePrice,
                salePrice,
                costPrice,
                categoryId,
                stockQty,
                sku,
                tags,
                images,
                prodType,
              })
            );
          } catch {
            // ignore
          }
        }
        setTimeout(() => {
          setAutosaveStatus('saved');
          setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }, 300);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [title, slug, brand, countryOfOrigin, shortDescription, description, basePrice, salePrice, costPrice, categoryId, stockQty, sku, tags, images, prodType, initialProduct]);

  // Real-time Slug & SKU Async Uniqueness Validation
  const isSlugDuplicate = useMemo(() => {
    if (!slug.trim()) return false;
    return allProducts.some(
      (p) => p.id !== initialProduct?.id && (p.slug === slug || generateSlug(p.name) === slug)
    );
  }, [slug, allProducts, initialProduct?.id]);

  const isSkuDuplicate = useMemo(() => {
    if (!sku.trim()) return false;
    return allProducts.some(
      (p) => p.id !== initialProduct?.id && p.sku?.trim().toUpperCase() === sku.trim().toUpperCase()
    );
  }, [sku, allProducts, initialProduct?.id]);

  // --- SECTION VALIDITY CALCULATIONS ---
  const basicInfoValidation = useMemo(() => {
    const errors: string[] = [];
    if (!title.trim()) errors.push('Product name is required');
    if (!slug.trim()) errors.push('Slug is required');
    if (isSlugDuplicate) errors.push('Slug already exists in catalog');
    if (status === 'scheduled' && !publishAt) errors.push('Publish date required for scheduled status');
    return { isValid: errors.length === 0, errors };
  }, [title, slug, isSlugDuplicate, status, publishAt]);

  const mediaValidation = useMemo(() => {
    const errors: string[] = [];
    if (images.length === 0 && !initialProduct?.imageUrl) errors.push('At least 1 product image is required');
    if (images.length > 15) errors.push('Maximum 15 images allowed');
    return { isValid: errors.length === 0, errors };
  }, [images, initialProduct?.imageUrl]);

  const pricingValidation = useMemo(() => {
    const errors: string[] = [];
    if (costPrice === '' || costPrice === undefined || costPrice === null || Number(costPrice) <= 0) {
      errors.push('Cost Price is required and must be greater than 0 ' + currency);
    }
    if (!basePrice || basePrice <= 0) {
      errors.push('Base Selling Price must be greater than 0 ' + currency);
    }
    if (salePrice !== '' && Number(salePrice) >= basePrice) {
      errors.push('Sale price must be strictly lower than base price');
    }
    if (saleStartAt && saleEndAt && new Date(saleEndAt) <= new Date(saleStartAt)) {
      errors.push('Sale end date must be after sale start date');
    }
    return { isValid: errors.length === 0, errors };
  }, [costPrice, basePrice, salePrice, saleStartAt, saleEndAt, currency]);

  const variantsValidation = useMemo(() => {
    const errors: string[] = [];
    if (!sku.trim()) errors.push('SKU is required');
    if (isSkuDuplicate) errors.push('SKU code already exists in catalog');
    if (hasVariants && variants.length === 0) {
      errors.push('Variants enabled but no matrix items generated');
    }
    return { isValid: errors.length === 0, errors };
  }, [sku, isSkuDuplicate, hasVariants, variants]);

  const organizationValidation = useMemo(() => {
    const errors: string[] = [];
    if (!categoryId) errors.push('Category is required');
    return { isValid: errors.length === 0, errors };
  }, [categoryId]);

  const descriptionValidation = useMemo(() => {
    return { isValid: true, errors: [] };
  }, []);

  const seoValidation = useMemo(() => {
    return { isValid: true, errors: [] };
  }, []);

  const shippingValidation = useMemo(() => {
    return { isValid: true, errors: [] };
  }, []);

  const categorySpecsValidation = useMemo(() => {
    const errors: string[] = [];

    // Expiry Date Tracking validation only if explicitly enabled
    if (hasExpiryDate && !expiryDate) {
      errors.push('Expiry Date is required when Expiry Tracking is enabled.');
    }

    return { isValid: errors.length === 0, errors };
  }, [hasExpiryDate, expiryDate]);

  const sectionStatusMap = useMemo(() => {
    return {
      basic_info: basicInfoValidation,
      media: mediaValidation,
      pricing: pricingValidation,
      variants: variantsValidation,
      organization: organizationValidation,
      category_specs: categorySpecsValidation,
      description: descriptionValidation,
      seo: seoValidation,
      shipping: shippingValidation,
      publish: { isValid: true, errors: [] }
    };
  }, [
    basicInfoValidation,
    mediaValidation,
    pricingValidation,
    variantsValidation,
    organizationValidation,
    categorySpecsValidation,
    descriptionValidation,
    seoValidation,
    shippingValidation
  ]);

  // Overall publish readiness check
  const allPublishBlockingErrors = useMemo(() => {
    const list: { section: SectionTabId; field: string; message: string }[] = [];
    if (!basicInfoValidation.isValid) {
      basicInfoValidation.errors.forEach((e) => list.push({ section: 'basic_info', field: 'Basic Info', message: e }));
    }
    if (!mediaValidation.isValid) {
      mediaValidation.errors.forEach((e) => list.push({ section: 'media', field: 'Media Assets', message: e }));
    }
    if (!pricingValidation.isValid) {
      pricingValidation.errors.forEach((e) => list.push({ section: 'pricing', field: 'Pricing', message: e }));
    }
    if (!variantsValidation.isValid) {
      variantsValidation.errors.forEach((e) => list.push({ section: 'variants', field: 'Inventory / SKU', message: e }));
    }
    if (!organizationValidation.isValid) {
      organizationValidation.errors.forEach((e) => list.push({ section: 'organization', field: 'Category', message: e }));
    }
    if (!categorySpecsValidation.isValid) {
      categorySpecsValidation.errors.forEach((e) => list.push({ section: 'category_specs', field: 'Category Specs & Expiry', message: e }));
    }
    if (!descriptionValidation.isValid) {
      descriptionValidation.errors.forEach((e) => list.push({ section: 'description', field: 'Description', message: e }));
    }
    if (!seoValidation.isValid) {
      seoValidation.errors.forEach((e) => list.push({ section: 'seo', field: 'SEO Meta', message: e }));
    }
    if (!shippingValidation.isValid) {
      shippingValidation.errors.forEach((e) => list.push({ section: 'shipping', field: 'Shipping Weight', message: e }));
    }
    return list;
  }, [
    basicInfoValidation,
    mediaValidation,
    pricingValidation,
    variantsValidation,
    organizationValidation,
    categorySpecsValidation,
    descriptionValidation,
    seoValidation,
    shippingValidation
  ]);

  const canPublishDirectly = role === 'super_admin' || role === 'store_manager';

  // --- ACTIONS ---
  // Inspect image dimensions and check storefront guidelines
  const inspectAndGetMeta = (url: string): Promise<ImageMetadata> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        const aspectRatio = Number((width / height).toFixed(2));
        const warnings: string[] = [];

        if (width < 600 || height < 600) {
          warnings.push(`Low resolution (${width}x${height}px). Recommended minimum is 600x600px.`);
        }
        if (aspectRatio < 0.6 || aspectRatio > 1.8) {
          warnings.push(`Non-standard aspect ratio (${aspectRatio}:1). Recommended 1:1 square or 4:3.`);
        }

        resolve({
          url,
          width,
          height,
          aspectRatio,
          warnings,
        });
      };
      img.onerror = () => {
        resolve({
          url,
          width: 800,
          height: 600,
          aspectRatio: 1.33,
          warnings: ['Unable to inspect remote image header.'],
        });
      };
      img.src = url;
    });
  };

  // Client-Side Image Compression & Cloudinary CDN Upload
  const processImageFile = async (file: File): Promise<{ dataUrl: string; meta: ImageMetadata }> => {
    const originalSizeKb = Math.round(file.size / 1024);

    // 1. Try Cloudinary CDN signed/preset upload
    try {
      const uploadRes = await uploadImageToCloudinary(file, {
        folder: 'veloce_products',
        tags: ['product', 'gallery', title || 'item'],
      });

      if (uploadRes.success && uploadRes.url) {
        const meta = await inspectAndGetMeta(uploadRes.url);
        return {
          dataUrl: uploadRes.url,
          meta: {
            ...meta,
            originalSizeKb,
            compressedSizeKb: uploadRes.bytes ? Math.round(uploadRes.bytes / 1024) : originalSizeKb,
            isCompressed: uploadRes.isCloudinary || originalSizeKb > 200,
          },
        };
      }
    } catch (uploadErr) {
      console.warn('[ProductFormEditor Cloudinary Warning]:', uploadErr);
    }

    // 2. High-efficiency canvas downscaling fallback
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const src = e.target?.result as string;
        const img = new Image();

        img.onload = () => {
          const width = img.naturalWidth;
          const height = img.naturalHeight;
          const aspectRatio = Number((width / height).toFixed(2));
          const warnings: string[] = [];

          if (width < 600 || height < 600) {
            warnings.push(`Low resolution (${width}x${height}px). Recommended minimum is 600x600px.`);
          }
          if (aspectRatio < 0.6 || aspectRatio > 1.8) {
            warnings.push(`Aspect ratio (${aspectRatio}:1) is non-standard. Standard storefront uses 1:1 or 4:3.`);
          }

          const maxDim = 1600;
          if (file.type.startsWith('image/') && !file.type.includes('svg')) {
            let targetW = width;
            let targetH = height;

            if (width > maxDim || height > maxDim) {
              if (width > height) {
                targetW = maxDim;
                targetH = Math.round((height * maxDim) / width);
              } else {
                targetH = maxDim;
                targetW = Math.round((width * maxDim) / height);
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, targetW, targetH);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
              const compressedSizeKb = Math.round((dataUrl.length * 0.75) / 1024);

              resolve({
                dataUrl,
                meta: {
                  url: dataUrl,
                  width: targetW,
                  height: targetH,
                  aspectRatio,
                  originalSizeKb,
                  compressedSizeKb,
                  warnings,
                  isCompressed: width > maxDim || height > maxDim || originalSizeKb > compressedSizeKb,
                },
              });
              return;
            }
          }

          resolve({
            dataUrl: src,
            meta: {
              url: src,
              width,
              height,
              aspectRatio,
              originalSizeKb,
              compressedSizeKb: originalSizeKb,
              warnings,
              isCompressed: false,
            },
          });
        };

        img.onerror = () => reject(new Error(`Failed to decode image ${file.name}`));
        img.src = src;
      };

      reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
      reader.readAsDataURL(file);
    });
  };

  // Add URL Image Handler (Auto-optimizes Cloudinary URLs)
  const handleAddImageFromUrl = async () => {
    if (!newImageUrlInput.trim()) return;
    const rawUrl = newImageUrlInput.trim();
    const url = getOptimizedCloudinaryUrl(rawUrl);

    if (images.length >= 10) {
      setMediaNotice({ type: 'warning', text: 'Maximum 10 product images allowed.' });
      return;
    }

    const updated = [...images, url];
    setImages(updated);
    const newIdx = updated.length - 1;
    setImageAltTexts({ ...imageAltTexts, [newIdx]: title || `Product angle ${newIdx + 1}` });
    setNewImageUrlInput('');

    const meta = await inspectAndGetMeta(url);
    setImagesMeta((prev) => ({ ...prev, [url]: meta }));

    if (meta.warnings.length > 0) {
      setMediaNotice({
        type: 'warning',
        text: `Image added with quality warning: ${meta.warnings.join(' ')}`,
      });
    } else {
      setMediaNotice({ type: 'success', text: isCloudinaryUrl(url) ? 'Product image connected to Cloudinary CDN!' : 'Product image URL added successfully.' });
    }
  };

  // Batch Dropzone Upload Handler
  const handleBatchImageUpload = async (files: FileList | File[]) => {
    const fileList = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileList.length === 0) return;

    if (images.length + fileList.length > 10) {
      setMediaNotice({
        type: 'warning',
        text: `Maximum 10 images allowed. You currently have ${images.length}.`,
      });
      return;
    }

    setIsProcessingImages(true);
    setMediaNotice({ type: 'info', text: `Compressing and validating ${fileList.length} image(s)...` });

    try {
      const results = await Promise.all(fileList.map((f) => processImageFile(f)));
      const newUrls = results.map((r) => r.dataUrl);

      const updatedImages = [...images, ...newUrls];
      setImages(updatedImages);

      const newAltTexts = { ...imageAltTexts };
      const newMetaMap = { ...imagesMeta };

      results.forEach((r, index) => {
        const targetIndex = images.length + index;
        newAltTexts[targetIndex] = title ? `${title} - View ${targetIndex + 1}` : `Product view ${targetIndex + 1}`;
        newMetaMap[r.dataUrl] = r.meta;
      });

      setImageAltTexts(newAltTexts);
      setImagesMeta(newMetaMap);

      const totalWarnings = results.reduce((acc, r) => acc + r.meta.warnings.length, 0);
      if (totalWarnings > 0) {
        setMediaNotice({
          type: 'warning',
          text: `Added ${results.length} image(s). ${totalWarnings} quality warning(s) detected (resolution or aspect ratio).`,
        });
      } else {
        setMediaNotice({
          type: 'success',
          text: `Uploaded and compressed ${results.length} image(s) successfully!`,
        });
      }
    } catch (err: any) {
      setMediaNotice({ type: 'warning', text: err.message || 'Error processing images.' });
    } finally {
      setIsProcessingImages(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    const updated = images.filter((_, i) => i !== index);
    setImages(updated);
    if (primaryImageIndex >= updated.length) {
      setPrimaryImageIndex(Math.max(0, updated.length - 1));
    }
  };

  // Reorder Images (Move Left/Right or Drag & Drop)
  const handleMoveImage = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= images.length || fromIdx === toIdx) return;
    const updated = [...images];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);

    setImages(updated);

    if (primaryImageIndex === fromIdx) {
      setPrimaryImageIndex(toIdx);
    } else if (primaryImageIndex > fromIdx && primaryImageIndex <= toIdx) {
      setPrimaryImageIndex(primaryImageIndex - 1);
    } else if (primaryImageIndex < fromIdx && primaryImageIndex >= toIdx) {
      setPrimaryImageIndex(primaryImageIndex + 1);
    }

    const newAltTexts: Record<number, string> = {};
    updated.forEach((url, idx) => {
      const oldIdx = images.indexOf(url);
      if (oldIdx !== -1 && imageAltTexts[oldIdx]) {
        newAltTexts[idx] = imageAltTexts[oldIdx];
      } else {
        newAltTexts[idx] = imageAltTexts[idx] || title || 'Product view';
      }
    });
    setImageAltTexts(newAltTexts);
  };

  // 360 Spin Sequence Batch Upload
  const handleBatch360Upload = async (files: FileList | File[]) => {
    const fileList = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileList.length === 0) return;

    setIsProcessingImages(true);
    try {
      const results = await Promise.all(fileList.map((f) => processImageFile(f)));
      const newUrls = results.map((r) => r.dataUrl);
      setImages360((prev) => [...prev, ...newUrls]);
      setMediaNotice({
        type: 'success',
        text: `Loaded ${fileList.length} 360° spin frame(s). Total frames: ${images360.length + fileList.length}.`,
      });
    } catch (err: any) {
      setMediaNotice({ type: 'warning', text: 'Error processing 360° spin images.' });
    } finally {
      setIsProcessingImages(false);
    }
  };

  // Video Upload Handler
  const handleVideoFileUpload = (file: File) => {
    if (!file.type.startsWith('video/')) {
      setMediaNotice({ type: 'warning', text: 'Selected file is not a supported video file.' });
      return;
    }
    const blobUrl = URL.createObjectURL(file);
    setVideoUrl(blobUrl);
    setMediaNotice({
      type: 'success',
      text: `Product video attached: ${file.name} (${Math.round(file.size / (1024 * 1024))} MB).`,
    });
  };

  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    const normalized = newTagInput.trim().toLowerCase().replace(/\s+/g, '-');
    const currentTags = Array.isArray(tags) ? tags : [];
    if (!currentTags.includes(normalized) && currentTags.length < 15) {
      setTags([...currentTags, normalized]);
      setNewTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = Array.isArray(tags) ? tags : [];
    setTags(currentTags.filter((t) => t !== tagToRemove));
  };

  const handleAddSpecRow = () => {
    setSpecs([...specs, { label: 'Feature', value: 'Value' }]);
  };

  const handleRemoveSpecRow = (idx: number) => {
    setSpecs(specs.filter((_, i) => i !== idx));
  };

  const handleSaveSubmit = (publishImmediately: boolean) => {
    if (publishImmediately && allPublishBlockingErrors.length > 0) {
      setTouched({
        title: true,
        slug: true,
        costPrice: true,
        basePrice: true,
        sku: true,
        categoryId: true,
        images: true,
      });
      setIsChecklistOpen(true);
      const errorBulletSummary = allPublishBlockingErrors.map((e) => `[${e.field}] ${e.message}`).join(' • ');
      setApiLogMessage({
        type: 'error',
        text: `HTTP 422 Unprocessable Entity: Product is not publish-ready. Missing or invalid ${allPublishBlockingErrors.length} required field${allPublishBlockingErrors.length > 1 ? 's' : ''}: ${errorBulletSummary}`,
        errors: allPublishBlockingErrors,
      });
      if (allPublishBlockingErrors[0]?.section) {
        scrollToSection(allPublishBlockingErrors[0].section);
      }
      return;
    }

    const categoryObj = categories.find((c) => c.id === categoryId);

    // Ensure primary image is at index 0 and all valid gallery images are kept
    let finalImages: string[] = [];
    if (images.length > 0) {
      if (primaryImageIndex >= 0 && primaryImageIndex < images.length) {
        const primaryImg = images[primaryImageIndex];
        finalImages = [primaryImg, ...images.filter((_, i) => i !== primaryImageIndex)];
      } else {
        finalImages = [...images];
      }
    } else if (initialProduct?.images && initialProduct.images.length > 0) {
      finalImages = [...initialProduct.images];
    } else if (initialProduct?.imageUrl) {
      finalImages = [initialProduct.imageUrl];
    }

    const finalPrimaryCover = finalImages[0] || initialProduct?.imageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600';
    if (finalImages.length === 0 && finalPrimaryCover) {
      finalImages = [finalPrimaryCover];
    }

    const updatedProduct: Product = {
      ...(initialProduct || {}),
      id: initialProduct?.id || `prod-${Date.now()}`,
      sku: sku.trim() || initialProduct?.sku || generateSlug(title).toUpperCase().slice(0, 10),
      slug: slug.trim() || initialProduct?.slug || generateSlug(title),
      name: title.trim() || initialProduct?.name || '',
      brand: brand.trim() || initialProduct?.brand || 'Veloce Kenya',
      countryOfOrigin: countryOfOrigin.trim() || initialProduct?.countryOfOrigin || 'Kenya',
      country_of_origin: countryOfOrigin.trim() || initialProduct?.countryOfOrigin || 'Kenya',
      description: description.trim() || shortDescription.trim() || initialProduct?.description || '',
      shortDescription: shortDescription.trim() || initialProduct?.shortDescription || '',
      detailedDescription: description.trim() || initialProduct?.detailedDescription || '',
      price: salePrice !== '' && Number(salePrice) > 0 && Number(salePrice) < basePrice ? Number(salePrice) : basePrice,
      basePrice,
      salePrice: salePrice !== '' && Number(salePrice) > 0 && Number(salePrice) < basePrice ? Number(salePrice) : null,
      previousPrice: salePrice !== '' && Number(salePrice) > 0 && basePrice > Number(salePrice) ? basePrice : undefined,
      originalPrice: salePrice !== '' && Number(salePrice) > 0 && basePrice > Number(salePrice) ? basePrice : undefined,
      original_price: salePrice !== '' && Number(salePrice) > 0 && basePrice > Number(salePrice) ? basePrice : null,
      saleStartAt: saleStartAt || initialProduct?.saleStartAt || undefined,
      saleEndAt: saleEndAt || initialProduct?.saleEndAt || undefined,
      costPrice: costPrice !== '' && !isNaN(Number(costPrice))
        ? Number(costPrice)
        : initialProduct?.costPrice !== undefined && initialProduct?.costPrice !== null
        ? Number(initialProduct.costPrice)
        : (initialProduct as any)?.cost_price !== undefined && (initialProduct as any)?.cost_price !== null
        ? Number((initialProduct as any).cost_price)
        : agreedCostPrice !== '' && !isNaN(Number(agreedCostPrice))
        ? Number(agreedCostPrice)
        : undefined,
      cost_price: costPrice !== '' && !isNaN(Number(costPrice))
        ? Number(costPrice)
        : initialProduct?.costPrice !== undefined && initialProduct?.costPrice !== null
        ? Number(initialProduct.costPrice)
        : (initialProduct as any)?.cost_price !== undefined && (initialProduct as any)?.cost_price !== null
        ? Number((initialProduct as any).cost_price)
        : agreedCostPrice !== '' && !isNaN(Number(agreedCostPrice))
        ? Number(agreedCostPrice)
        : undefined,
      taxStatus,
      taxRate,
      taxClass,
      currency,
      category: categoryObj?.name || initialProduct?.category || 'General',
      subcategoryId: subcategoryId || initialProduct?.subcategoryId || undefined,
      tags: tags.length > 0 ? tags : (initialProduct?.tags || ['Catalog']),
      type: prodType || initialProduct?.type || 'physical',
      imageUrl: finalPrimaryCover,
      images: finalImages,
      gallery_images: finalImages as any,
      imageAltTexts: Object.keys(imageAltTexts).length > 0 ? imageAltTexts : (initialProduct?.imageAltTexts || {}),
      videoUrl: videoUrl || initialProduct?.videoUrl || undefined,
      images360: images360.length > 0 ? images360 : (initialProduct?.images360 || undefined),
      stock: prodType === 'physical' ? Number(stockQty) : (initialProduct?.stock ?? null),
      lowStockThreshold: Number(lowStockThreshold),
      trackInventory,
      hasVariants,
      options: hasVariants ? options : (initialProduct?.options || []),
      colorImages: hasVariants ? colorImages : (initialProduct?.colorImages || {}),
      color_images: hasVariants ? colorImages : (initialProduct?.color_images || {}),
      variantAttributes: options.map((o) => o.name.toLowerCase()),
      variantMatrix: hasVariants ? variants : (initialProduct?.variantMatrix || undefined),
      variants: hasVariants ? variants : (initialProduct?.variants || undefined),
      rating: initialProduct?.rating || 5.0,
      reviewsCount: initialProduct?.reviewsCount || 0,
      reviews: initialProduct?.reviews || [],
      status: publishImmediately ? 'Active' : status === 'scheduled' ? 'scheduled' : (initialProduct?.status || 'Draft'),
      publishAt: publishAt || initialProduct?.publishAt || undefined,
      paymentRestriction: initialProduct?.paymentRestriction || 'both',
      features: specs.length > 0 ? specs.map((s) => `${s.label}: ${s.value}`) : (initialProduct?.features || []),
      specifications: specs.length > 0 ? specs.map((s) => ({ key: s.label, value: s.value })) : (initialProduct?.specifications || []),
      specs: specs.length > 0 ? specs : (initialProduct?.specs || []),
      whatsInTheBox: whatsInTheBox.trim() || initialProduct?.whatsInTheBox || '',
      // Category Specific Fields: Clothes & Wearables
      sizeGuide: sizeGuide.trim() || initialProduct?.sizeGuide || '',
      availableSizes: availableSizes.length > 0 ? availableSizes : (initialProduct?.availableSizes || []),
      material: material.trim() || initialProduct?.material || '',
      colorOptions: colorOptions.length > 0 ? colorOptions : (initialProduct?.colorOptions || []),
      careInstructions: careInstructions.trim() || initialProduct?.careInstructions || '',
      // Category Specific Fields: Food & Beverages
      ingredients: ingredients.trim() || initialProduct?.ingredients || '',
      manufacturer: manufacturer.trim() || initialProduct?.manufacturer || '',
      allergyInfo: allergyInfo.length > 0 ? allergyInfo : (initialProduct?.allergyInfo || []),
      allergyTracesNotes: allergyTracesNotes.trim() || initialProduct?.allergyTracesNotes || '',
      nutritionalInfo: nutritionalInfo.trim() || initialProduct?.nutritionalInfo || '',
      storageInstructions: storageInstructions.trim() || initialProduct?.storageInstructions || '',
      // Category Specific Fields: Perfumes & Beauty Products
      beautyIngredients: beautyIngredients.trim() || initialProduct?.beautyIngredients || '',
      howToUse: howToUse.trim() || initialProduct?.howToUse || '',
      beautyManufacturer: beautyManufacturer.trim() || initialProduct?.beautyManufacturer || '',
      beautyCountryOfOrigin: beautyCountryOfOrigin || initialProduct?.beautyCountryOfOrigin || 'France',
      beautyAllergyInfo: beautyAllergyInfo.length > 0 ? beautyAllergyInfo : (initialProduct?.beautyAllergyInfo || []),
      volumeNetWeight: volumeNetWeight.trim() || initialProduct?.volumeNetWeight || '',
      // Expiry Date Tracking
      hasExpiryDate: hasExpiryDate ?? initialProduct?.hasExpiryDate ?? false,
      expiryDate: expiryDate || initialProduct?.expiryDate || '',
      batchLotNumber: batchLotNumber.trim() || initialProduct?.batchLotNumber || '',
      metaTitle: metaTitle.trim() || initialProduct?.metaTitle || title.trim(),
      metaDescription: metaDescription.trim() || initialProduct?.metaDescription || shortDescription.trim(),
      ogImage: ogImage.trim() || initialProduct?.ogImage || images[0] || '',
      weightKg: weightKg !== '' ? Number(weightKg) : (initialProduct?.weightKg ?? 0),
      dimensionsCm: dimensionsCm || initialProduct?.dimensionsCm || { length: 30, width: 20, height: 12 },
      shippingClass: shippingClass || initialProduct?.shippingClass || 'standard',
      deliveryZones: deliveryZones.length > 0 ? deliveryZones : (initialProduct?.deliveryZones || []),
      relatedProducts: relatedProducts.length > 0 ? relatedProducts : (initialProduct?.relatedProducts || []),
      // Supplier Sourcing Link
      supplierId: supplierId || undefined,
      supplierName: supplierName || undefined,
      supplierSku: supplierSku || undefined,
      agreedCostPrice: agreedCostPrice !== '' ? Number(agreedCostPrice) : (costPrice !== '' ? Number(costPrice) : undefined),
      leadTimeDays: leadTimeDays || 3,
      isPrimarySupplier: isPrimarySupplier,
    };

    onSaveProduct(updatedProduct, publishImmediately);

    // If linked to a supplier, record the relationship in supplier backend
    if (supplierId) {
      supplierApi.linkProductToSupplier({
        supplier: supplierId,
        product: updatedProduct.id,
        agreed_cost_price: agreedCostPrice !== '' ? Number(agreedCostPrice) : (costPrice !== '' ? Number(costPrice) : 0),
        selling_price: updatedProduct.price,
        supplier_sku: supplierSku || updatedProduct.sku,
        lead_time_days: leadTimeDays || 3,
      }).catch((err) => console.warn('Supplier link synchronization note:', err));
    }
  };

  return (
    <div className="w-full h-full min-h-full flex-1 overflow-y-auto overflow-x-hidden px-3 sm:px-6 lg:px-8 xl:px-10 py-6 font-sans text-gray-900 bg-slate-50/50 pb-28">
      {/* HEADER & ACTION TOOLBAR */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            id="btn-back-to-product-catalog"
            onClick={(e) => {
              e.preventDefault();
              if (onCancel) onCancel();
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors uppercase tracking-wider mb-2.5 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Product Catalog
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
              <PackagePlus className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                {isEditing ? `Edit Product: ${initialProduct?.name}` : 'Add Product'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage product details, media assets, pricing, variants, and stock on a single page.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
          {/* Switch product dropdown if editing */}
          {isEditing && onSwitchProductToEdit && allProducts && allProducts.length > 1 && (
            <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl px-2.5 py-1.5 border border-slate-200" title="Quickly switch to editing another product">
              <Sliders className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
              <select
                id="select-quick-switch-product"
                value={initialProduct?.id || ''}
                onChange={(e) => {
                  const targetProd = allProducts.find((p) => p.id === e.target.value);
                  if (targetProd) onSwitchProductToEdit(targetProd);
                }}
                className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer max-w-[150px] sm:max-w-[200px] truncate"
              >
                {allProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Autosave Status Badge */}
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-mono flex items-center gap-2">
            {autosaveStatus === 'saving' ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 text-indigo-600 animate-spin" />
                <span className="font-bold text-indigo-600">Autosaving...</span>
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>Saved draft {lastSavedTime ? `at ${lastSavedTime}` : 'locally'}</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsPreviewModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
          >
            <Eye className="h-4 w-4 text-slate-500" />
            <span className="hidden sm:inline">Preview</span>
          </button>

          {isEditing && onDuplicateProduct && (
            <button
              type="button"
              onClick={() => initialProduct && onDuplicateProduct(initialProduct)}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
            >
              <Copy className="h-4 w-4 text-slate-500" />
              <span className="hidden sm:inline">Duplicate</span>
            </button>
          )}

          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer transition flex items-center gap-1.5 border border-slate-300 shadow-2xs"
          >
            Discard
          </button>

          <button
            type="button"
            onClick={() => handleSaveSubmit(false)}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer transition flex items-center gap-1.5 shadow-xs"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Draft</span>
          </button>

          <button
            type="button"
            onClick={() => handleSaveSubmit(true)}
            disabled={!canPublishDirectly}
            className={`px-5 py-2 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
              canPublishDirectly
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{isEditing ? 'Save Product Changes' : 'Publish Product'}</span>
          </button>
        </div>
      </div>

      {/* API RESPONSE OR VALIDATION ERROR BANNER */}
      {apiLogMessage && (
        <div
          className={`mb-6 p-5 rounded-2xl border shadow-sm animate-slide-down ${
            apiLogMessage.type === 'error'
              ? 'bg-rose-50/95 border-rose-200 text-rose-900'
              : 'bg-emerald-50/95 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5 flex-1 min-w-0">
              <div className={`p-2 rounded-xl mt-0.5 shrink-0 ${
                apiLogMessage.type === 'error' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {apiLogMessage.type === 'error' ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
              </div>
              <div className="space-y-2 flex-1 min-w-0">
                <div className="font-bold text-sm leading-snug">
                  {apiLogMessage.text}
                </div>
                {apiLogMessage.errors && apiLogMessage.errors.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-rose-200 space-y-2">
                    <p className="text-[11px] font-black text-rose-950 uppercase tracking-wider font-mono">
                      Action Required — Exactly what is missing or invalid:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {apiLogMessage.errors.map((err, idx) => (
                        <div
                          key={idx}
                          onClick={() => scrollToSection(err.section)}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-rose-200/90 text-xs text-rose-950 font-sans hover:bg-rose-100 hover:border-rose-300 transition cursor-pointer group shadow-2xs"
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                            <span className="font-bold text-rose-950 truncate font-mono text-[11px]">
                              [{err.field}]
                            </span>
                            <span className="truncate text-rose-800">{err.message}</span>
                          </div>
                          <span className="shrink-0 text-[10px] font-bold text-indigo-600 group-hover:text-indigo-800 flex items-center gap-0.5 font-mono">
                            Fix <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setApiLogMessage(null)}
              className="p-1.5 hover:bg-black/5 rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer transition shrink-0"
              title="Dismiss banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2-COLUMN MODERN SINGLE-PAGE LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start mb-12">
        {/* LEFT COLUMN: MAIN PRODUCT SPECS (2/3 width) */}
        <div className="lg:col-span-2 space-y-8">
<section id="section-basic_info" className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-8 shadow-xs scroll-mt-24">
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-600" /> Basic Specification & Identity
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Define primary naming, human-readable slug, status lifecycle, and short summary.
                </p>
              </div>
              
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                  Product Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onBlur={() => setTouched((prev) => ({ ...prev, title: true }))}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Veloce Ergonomic Motorized Desk"
                  className={`w-full h-11 px-3.5 rounded-xl border text-sm font-medium focus:outline-hidden focus:ring-2 transition ${
                    touched.title && !title.trim()
                      ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:ring-rose-500 focus:border-rose-500'
                      : 'border-slate-300 focus:ring-indigo-500 focus:border-indigo-500'
                  }`}
                />
                {touched.title && !title.trim() ? (
                  <span className="text-[11px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Product Title is required.
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400 mt-1 block">Length: {title.length}/150 characters</span>
                )}
              </div>

              {/* Slug with Async Uniqueness check */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase font-mono">
                    URL Slug <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setSlug(generateSlug(title));
                      setIsSlugCustom(false);
                    }}
                    className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="h-3 w-3" /> Reset to Kebab Title
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value);
                      setIsSlugCustom(true);
                    }}
                    placeholder="e.g. veloce-ergonomic-desk"
                    className={`w-full h-11 px-3.5 rounded-xl border text-sm font-mono transition ${
                      isSlugDuplicate
                        ? 'border-rose-400 bg-rose-50/50 text-rose-900 focus:ring-rose-500'
                        : 'border-slate-300 focus:ring-indigo-500 focus:border-indigo-500'
                    }`}
                  />
                </div>
                {isSlugDuplicate ? (
                  <span className="text-[11px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> Slug already in use by another product!
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400 mt-1 block font-mono">
                    Permalink: https://ropenix.co.ke/products/{slug || '...'}
                  </span>
                )}
              </div>

              {/* Brand */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase font-mono flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-indigo-600" /> Brand / Label
                  </label>
                  {brand && (
                    <button
                      type="button"
                      onClick={() => setBrand('')}
                      className="text-[10px] text-slate-400 hover:text-slate-600 font-mono"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    list="product-form-brand-suggestions"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g. Veloce Kenya or Ropenix Atelier"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                  <datalist id="product-form-brand-suggestions">
                    {COMMON_BRANDS.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>
                {/* Quick Brand Pills */}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-mono">Quick select:</span>
                  {['Veloce Kenya', 'Ropenix Atelier', 'Apple', 'Samsung', 'Nike', 'Generic'].map((qb) => (
                    <button
                      key={qb}
                      type="button"
                      onClick={() => setBrand(qb)}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md border transition cursor-pointer ${
                        brand === qb
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-bold'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {qb}
                    </button>
                  ))}
                </div>
              </div>

              {/* Country of Origin */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase font-mono flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-emerald-600" /> Country of Origin
                  </label>
                  <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                    {getCountryFlag(countryOfOrigin)} {countryOfOrigin || 'Select / Enter'}
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base">
                    {getCountryFlag(countryOfOrigin)}
                  </div>
                  <input
                    type="text"
                    list="product-form-country-suggestions"
                    value={countryOfOrigin}
                    onChange={(e) => setCountryOfOrigin(e.target.value)}
                    placeholder="e.g. Kenya, Italy, Japan..."
                    className="w-full h-11 pl-9 pr-3.5 rounded-xl border border-slate-300 text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                  <datalist id="product-form-country-suggestions">
                    {COMMON_COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {getCountryFlag(c)} {c}
                      </option>
                    ))}
                  </datalist>
                </div>
                {/* Quick Country Pills */}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-mono">Popular:</span>
                  {[
                    { name: 'Kenya', flag: '🇰🇪' },
                    { name: 'Italy', flag: '🇮🇹' },
                    { name: 'Japan', flag: '🇯🇵' },
                    { name: 'United States', flag: '🇺🇸' },
                    { name: 'Germany', flag: '🇩🇪' },
                    { name: 'United Kingdom', flag: '🇬🇧' },
                    { name: 'China', flag: '🇨🇳' },
                  ].map((qc) => (
                    <button
                      key={qc.name}
                      type="button"
                      onClick={() => setCountryOfOrigin(qc.name)}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md border transition cursor-pointer flex items-center gap-1 ${
                        countryOfOrigin === qc.name
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      <span>{qc.flag}</span>
                      <span>{qc.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                  Product Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={categoryId}
                  onBlur={() => setTouched((prev) => ({ ...prev, categoryId: true }))}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setSubcategoryId('');
                  }}
                  className={`w-full h-11 px-3.5 rounded-xl border text-sm font-bold bg-white focus:outline-hidden focus:ring-2 transition cursor-pointer ${
                    touched.categoryId && !categoryId
                      ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:ring-rose-500'
                      : 'border-slate-300 focus:ring-indigo-500'
                  }`}
                >
                  <option value="">-- Select Product Category --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {touched.categoryId && !categoryId ? (
                  <span className="text-[11px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Category selection is required.
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 mt-1 block">Determines store department and compliance parameters.</span>
                )}
              </div>

              {/* Subcategory Selection (if available) */}
              {availableSubcategories.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                    Subcategory (Optional)
                  </label>
                  <select
                    value={subcategoryId}
                    onChange={(e) => setSubcategoryId(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-bold bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="">-- Select Subcategory --</option>
                    {availableSubcategories.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Product Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">Inventory Type</label>
                <select
                  value={prodType}
                  onChange={(e) => setProdType(e.target.value as any)}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-bold bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="physical">Physical Goods (Shipped via Logistics)</option>
                  <option value="digital">Digital Product (Download File / Key)</option>
                  <option value="service">Service / Subscription</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">Publish Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-bold bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="draft">Draft (Private in admin)</option>
                  <option value="scheduled">Scheduled (Auto-publish at datetime)</option>
                  <option value="published">Published (Live in catalog)</option>
                  <option value="archived">Archived (Hidden)</option>
                </select>
              </div>

              {/* Scheduled DateTime */}
              {status === 'scheduled' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                    Scheduled Publish Date & Time <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={publishAt}
                    onChange={(e) => setPublishAt(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            {/* Short Description */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase font-mono">
                  Short Description (Used in cards & listings) <span className="text-rose-500">*</span>
                </label>
                <span
                  className={`text-[11px] font-mono font-bold ${
                    shortDescription.length > 300 ? 'text-rose-600' : 'text-slate-400'
                  }`}
                >
                  {shortDescription.length}/300 chars
                </span>
              </div>
              <textarea
                rows={3}
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="Concise overview summarizing key benefits..."
                className="w-full p-3.5 rounded-xl border border-slate-300 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </section>
        <section id="section-description" className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-8 shadow-xs scroll-mt-24">
          <div className="space-y-6">
            {/* Header with Stats and View Mode Toggle */}
            <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-indigo-600" /> Rich Description & Specifications Table
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Format long-form copy, upload images, insert structured layout blocks, and manage technical specifications.
                </p>
              </div>

              {/* View Mode Switcher */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setDescViewMode('edit')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    descViewMode === 'edit'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Edit2 className="h-3.5 w-3.5" /> Editor
                </button>
                <button
                  type="button"
                  onClick={() => setDescViewMode('preview')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    descViewMode === 'preview'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" /> Live Preview
                </button>
                <button
                  type="button"
                  onClick={() => setDescViewMode('split')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    descViewMode === 'split'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Split className="h-3.5 w-3.5" /> Split View
                </button>
              </div>
            </div>

            {/* Rich Text Toolbar */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100/90 p-2 rounded-t-xl border border-slate-300">
                {/* Formatting Tools */}
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => insertIntoDescription('**', '**', 'bold text')}
                    className="p-1.5 px-2 bg-white hover:bg-slate-50 text-slate-700 rounded border border-slate-200 text-xs font-black shadow-3xs cursor-pointer"
                    title="Bold (**text**)"
                  >
                    <Bold className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertIntoDescription('*', '*', 'italic text')}
                    className="p-1.5 px-2 bg-white hover:bg-slate-50 text-slate-700 rounded border border-slate-200 text-xs italic shadow-3xs cursor-pointer"
                    title="Italic (*text*)"
                  >
                    <Italic className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertIntoDescription('<u>', '</u>', 'underlined text')}
                    className="p-1.5 px-2 bg-white hover:bg-slate-50 text-slate-700 rounded border border-slate-200 text-xs underline shadow-3xs cursor-pointer"
                    title="Underline (<u>text</u>)"
                  >
                    <Underline className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertIntoDescription('~~', '~~', 'strikethrough text')}
                    className="p-1.5 px-2 bg-white hover:bg-slate-50 text-slate-700 rounded border border-slate-200 text-xs line-through shadow-3xs cursor-pointer"
                    title="Strikethrough (~~text~~)"
                  >
                    <Strikethrough className="h-3.5 w-3.5" />
                  </button>

                  <span className="h-4 w-px bg-slate-300 mx-1"></span>

                  <button
                    type="button"
                    onClick={() => insertIntoDescription('## ', '\n', 'Section Title')}
                    className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-800 rounded border border-slate-200 text-xs font-bold shadow-3xs cursor-pointer"
                    title="Heading 2 (## Title)"
                  >
                    H2
                  </button>
                  <button
                    type="button"
                    onClick={() => insertIntoDescription('### ', '\n', 'Subheading Title')}
                    className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-800 rounded border border-slate-200 text-xs font-bold shadow-3xs cursor-pointer"
                    title="Heading 3 (### Subheading)"
                  >
                    H3
                  </button>

                  <span className="h-4 w-px bg-slate-300 mx-1"></span>

                  <button
                    type="button"
                    onClick={() => insertIntoDescription('- ', '\n', 'Bullet point item')}
                    className="p-1.5 px-2 bg-white hover:bg-slate-50 text-slate-700 rounded border border-slate-200 text-xs shadow-3xs cursor-pointer flex items-center gap-1"
                    title="Bulleted List"
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertIntoDescription('1. ', '\n', 'Numbered list step')}
                    className="p-1.5 px-2 bg-white hover:bg-slate-50 text-slate-700 rounded border border-slate-200 text-xs shadow-3xs cursor-pointer flex items-center gap-1"
                    title="Numbered List"
                  >
                    <ListOrdered className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertIntoDescription('> ', '\n', 'Key insight or customer testimonial quote')}
                    className="p-1.5 px-2 bg-white hover:bg-slate-50 text-slate-700 rounded border border-slate-200 text-xs shadow-3xs cursor-pointer flex items-center gap-1"
                    title="Blockquote (> Quote)"
                  >
                    <Quote className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertIntoDescription('\n<div class="p-4 bg-indigo-50 border-l-4 border-indigo-600 rounded-r-xl my-3"><p class="text-xs font-semibold text-indigo-950">💡 Highlight: ', '</p></div>\n', 'Important product characteristic or special advisory.')}
                    className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded border border-indigo-200 text-xs font-bold shadow-3xs cursor-pointer flex items-center gap-1"
                    title="Insert Highlight Callout Box"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-indigo-600" /> Callout
                  </button>
                  <button
                    type="button"
                    onClick={() => insertIntoDescription('\n| Feature | Specification |\n| :--- | :--- |\n| Material | Aerospace Aluminum |\n| Weight | 185g |\n\n', '', '')}
                    className="p-1.5 px-2 bg-white hover:bg-slate-50 text-slate-700 rounded border border-slate-200 text-xs shadow-3xs cursor-pointer flex items-center gap-1"
                    title="Insert Markdown Table"
                  >
                    <Table className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLinkModal(true)}
                    className="p-1.5 px-2 bg-white hover:bg-slate-50 text-slate-700 rounded border border-slate-200 text-xs shadow-3xs cursor-pointer flex items-center gap-1"
                    title="Insert Hyperlink"
                  >
                    <LinkIcon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertIntoDescription('\n---\n\n', '', '')}
                    className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 rounded border border-slate-200 text-xs font-mono shadow-3xs cursor-pointer"
                    title="Insert Horizontal Divider (---)"
                  >
                    ⎯ Line
                  </button>
                </div>

                {/* Media & Template Inserters */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowImageInsertModal(true)}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <ImagePlus className="h-3.5 w-3.5" /> Upload / Insert Image
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLayoutTemplateModal(true)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <LayoutTemplate className="h-3.5 w-3.5" /> Design Blocks
                  </button>
                </div>
              </div>

              {/* Editor / Live Preview Display Area */}
              {descViewMode === 'edit' && (
                <div>
                  <textarea
                    ref={descriptionTextareaRef}
                    rows={12}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Full technical overview, manufacturing origin, craftsmanship story, feature highlights, and warranty details..."
                    className="w-full p-4 rounded-b-xl border-x border-b border-slate-300 text-xs font-mono leading-relaxed focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
              )}

              {descViewMode === 'preview' && (
                <div className="p-6 rounded-b-xl border-x border-b border-slate-300 bg-white min-h-[300px]">
                  <div className="prose prose-sm max-w-none prose-slate">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(renderDescriptionPreview(description))
                      }}
                    />
                  </div>
                </div>
              )}

              {descViewMode === 'split' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-x border-b border-slate-300 rounded-b-xl overflow-hidden">
                  <div className="border-r border-slate-200">
                    <textarea
                      ref={descriptionTextareaRef}
                      rows={12}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Type markdown or HTML copy here..."
                      className="w-full h-full p-4 text-xs font-mono leading-relaxed focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-slate-50/30 resize-none"
                    />
                  </div>
                  <div className="p-5 bg-white overflow-y-auto max-h-[360px]">
                    <div className="text-[10px] uppercase font-mono font-bold text-slate-400 mb-2 border-b border-slate-100 pb-1 flex items-center gap-1">
                      <Eye className="h-3 w-3" /> Live Customer Presentation Preview
                    </div>
                    <div
                      className="prose prose-xs max-w-none text-slate-700"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(renderDescriptionPreview(description))
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Description Stats Bar */}
              <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-500 px-1 pt-1">
                <div className="flex items-center gap-4">
                  <span>
                    <strong>{description.trim() ? description.trim().split(/\s+/).length : 0}</strong> Words
                  </span>
                  <span>
                    <strong>{description.length}</strong> Characters
                  </span>
                  <span>
                    <strong>~{Math.max(1, Math.ceil((description.trim() ? description.trim().split(/\s+/).length : 0) / 200))} min</strong> Read Time
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Markdown & HTML Enabled
                  </span>
                </div>
              </div>
            </div>

            {/* Technical Specs Key-Value Table */}
            <div className="mt-8 pt-6 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                  <h4 className="font-bold text-xs text-slate-900 uppercase font-mono flex items-center gap-1.5">
                    <FileSpreadsheet className="h-4 w-4 text-indigo-600" /> Structured Technical Specifications
                  </h4>
                  <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                    Maintain an accurate, crawlable tabular breakdown of technical dimensions, materials, and compliance standards.
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSpecPresetModal(true)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-indigo-600" /> Load Industry Presets
                  </button>
                  {specs.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllSpecs}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-lg transition cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAddSpecRow}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Spec Line
                  </button>
                </div>
              </div>

              {specs.length === 0 ? (
                <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/50">
                  <FileSpreadsheet className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">No specifications added yet</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                    Add custom specification rows or load industry presets for Electronics, Apparel, Furniture, Beauty, or Food items.
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleApplySpecPreset('electronics')}
                      className="px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                    >
                      🖥️ Electronics
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplySpecPreset('apparel')}
                      className="px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                    >
                      👔 Apparel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplySpecPreset('furniture')}
                      className="px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                    >
                      🪑 Furniture
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {specs.map((sp, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50/60 p-2 rounded-xl border border-slate-200 hover:border-indigo-200 transition">
                      <span className="text-[10px] font-mono font-bold text-slate-400 w-6 text-center shrink-0">
                        #{idx + 1}
                      </span>
                      <input
                        type="text"
                        value={sp.label}
                        onChange={(e) => {
                          const updated = [...specs];
                          updated[idx].label = e.target.value;
                          setSpecs(updated);
                        }}
                        placeholder="Specification Name (e.g. Battery Life)"
                        className="w-1/3 h-10 px-3 rounded-lg border border-slate-300 text-xs font-bold bg-white focus:ring-2 focus:ring-indigo-500"
                      />
                      <input
                        type="text"
                        value={sp.value}
                        onChange={(e) => {
                          const updated = [...specs];
                          updated[idx].value = e.target.value;
                          setSpecs(updated);
                        }}
                        placeholder="Value / Detail (e.g. 5000 mAh Fast Charge)"
                        className="flex-1 h-10 px-3 rounded-lg border border-slate-300 text-xs font-mono bg-white focus:ring-2 focus:ring-indigo-500"
                      />
                      
                      {/* Row Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveSpecRow(idx, 'up')}
                          className="p-1.5 text-slate-500 hover:text-slate-800 disabled:opacity-25 rounded hover:bg-slate-200 transition cursor-pointer"
                          title="Move row up"
                        >
                          <MoveUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === specs.length - 1}
                          onClick={() => handleMoveSpecRow(idx, 'down')}
                          className="p-1.5 text-slate-500 hover:text-slate-800 disabled:opacity-25 rounded hover:bg-slate-200 transition cursor-pointer"
                          title="Move row down"
                        >
                          <MoveDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateSpecRow(idx)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 rounded hover:bg-slate-200 transition cursor-pointer"
                          title="Duplicate row"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveSpecRow(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                          title="Delete row"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Modal: Image Inserter & Custom Image Layouts */}
        {showImageInsertModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <ImagePlus className="h-5 w-5 text-indigo-600" />
                  <h3 className="font-bold text-sm text-slate-900">Upload & Embed Product Visual</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowImageInsertModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Source Tabs */}
              <div className="flex gap-2 border-b border-slate-100 pb-3">
                <button
                  type="button"
                  onClick={() => setImageInsertType('upload')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    imageInsertType === 'upload' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setImageInsertType('url')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    imageInsertType === 'url' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Direct URL
                </button>
                {images && images.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setImageInsertType('gallery')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      imageInsertType === 'gallery' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    From Product Gallery
                  </button>
                )}
              </div>

              {/* Tab 1: Upload File */}
              {imageInsertType === 'upload' && (
                <div className="space-y-3">
                  <label className="block p-6 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/20 hover:bg-indigo-50/40 text-center cursor-pointer transition">
                    <Upload className="h-8 w-8 text-indigo-500 mx-auto mb-2" />
                    <span className="text-xs font-bold text-indigo-900 block">Click or drag an image here to upload</span>
                    <span className="text-[11px] text-slate-400 mt-1 block">Supports PNG, JPG, WebP up to 10MB</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadImageFileForDescription(file);
                      }}
                    />
                  </label>
                  {imageInsertUrl && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                      <img src={imageInsertUrl} alt="Preview" className="w-16 h-16 object-cover rounded-lg border border-slate-300" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-slate-800 block">Image Ready for Insertion</span>
                        <span className="text-[10px] text-slate-400 block truncate">{imageInsertUrl.slice(0, 50)}...</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Direct URL */}
              {imageInsertType === 'url' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1">Image URL</label>
                    <input
                      type="text"
                      value={imageInsertUrl}
                      onChange={(e) => setImageInsertUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/photo-..."
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs font-mono"
                    />
                  </div>
                  {imageInsertUrl && (
                    <div className="rounded-xl overflow-hidden aspect-video max-h-48 bg-slate-100 border border-slate-200">
                      <img src={imageInsertUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Select from Gallery */}
              {imageInsertType === 'gallery' && (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-700 uppercase font-mono">Select Uploaded Product Photo</label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1">
                    {images.filter(Boolean).map((imgUrl, i) => (
                      <div
                        key={i}
                        onClick={() => setImageInsertUrl(imgUrl)}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition ${
                          imageInsertUrl === imgUrl ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        <img src={imgUrl} alt={`Gallery ${i}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Layout Choices */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 uppercase font-mono">Display Layout</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setImageInsertLayout('full')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                      imageInsertLayout === 'full' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 font-bold' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <span className="text-xs block font-bold">Full Banner</span>
                    <span className="text-[10px] text-slate-400 block font-light">Hero presentation</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageInsertLayout('split-left')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                      imageInsertLayout === 'split-left' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 font-bold' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <span className="text-xs block font-bold">Image Left</span>
                    <span className="text-[10px] text-slate-400 block font-light">Split copy right</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageInsertLayout('split-right')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                      imageInsertLayout === 'split-right' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 font-bold' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <span className="text-xs block font-bold">Image Right</span>
                    <span className="text-[10px] text-slate-400 block font-light">Split copy left</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageInsertLayout('center')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                      imageInsertLayout === 'center' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 font-bold' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <span className="text-xs block font-bold">Centered</span>
                    <span className="text-[10px] text-slate-400 block font-light">Medium graphic</span>
                  </button>
                </div>
              </div>

              {/* Alt & Caption */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1">Alt Text / Headline</label>
                  <input
                    type="text"
                    value={imageInsertAlt}
                    onChange={(e) => setImageInsertAlt(e.target.value)}
                    placeholder="e.g. Ergonomic Cushion Structure"
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1">Caption / Subtext</label>
                  <input
                    type="text"
                    value={imageInsertCaption}
                    onChange={(e) => setImageInsertCaption(e.target.value)}
                    placeholder="e.g. Precision stitching designed for comfort."
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowImageInsertModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!imageInsertUrl}
                  onClick={() => handleInsertImageFromModal(imageInsertUrl, imageInsertAlt, imageInsertCaption, imageInsertLayout)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="h-4 w-4" /> Embed in Description
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Ready-to-use Design Block Templates */}
        {showLayoutTemplateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <LayoutTemplate className="h-5 w-5 text-indigo-600" />
                  <h3 className="font-bold text-sm text-slate-900">1-Click Content Layout Blocks</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLayoutTemplateModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                {/* Block 1 */}
                <div className="p-4 rounded-xl border border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/10 transition flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                      🌟 Hero Spotlight Feature Banner
                    </span>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Dark-themed hero card with bold uppercase badge, main headline, and craftsmanship story narrative.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      insertIntoDescription(
                        `\n<div class="my-6 p-6 rounded-2xl bg-slate-900 text-white shadow-xl relative overflow-hidden">
  <span class="text-[10px] font-mono font-bold tracking-widest text-indigo-400 uppercase">SIGNATURE CRAFTSMANSHIP</span>
  <h3 class="text-xl font-bold mt-1 mb-2">Uncompromising Performance & Elegance</h3>
  <p class="text-xs text-slate-300 leading-relaxed font-light">Every component is precision-engineered from top-tier materials to deliver unparalleled longevity and flawless daily utility.</p>
</div>\n`,
                        '',
                        ''
                      );
                      setShowLayoutTemplateModal(false);
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shrink-0 cursor-pointer shadow-xs"
                  >
                    Insert Block
                  </button>
                </div>

                {/* Block 2 */}
                <div className="p-4 rounded-xl border border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/10 transition flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                      ⚡ 3-Pillar Highlight Grid
                    </span>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Three responsive side-by-side cards highlighting speed, military-grade durability, and sustainability.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      insertIntoDescription(
                        `\n<div class="my-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
  <div class="p-4 rounded-xl border border-indigo-100 bg-white shadow-xs text-center">
    <div class="text-2xl mb-1">⚡</div>
    <h5 class="font-bold text-xs text-slate-900 uppercase tracking-tight">Ultra Fast</h5>
    <p class="text-[11px] text-slate-500 mt-1 font-light">Instant responsiveness and low-latency interaction.</p>
  </div>
  <div class="p-4 rounded-xl border border-indigo-100 bg-white shadow-xs text-center">
    <div class="text-2xl mb-1">🛡️</div>
    <h5 class="font-bold text-xs text-slate-900 uppercase tracking-tight">Military Grade</h5>
    <p class="text-[11px] text-slate-500 mt-1 font-light">Tested against extreme stress and continuous daily strain.</p>
  </div>
  <div class="p-4 rounded-xl border border-indigo-100 bg-white shadow-xs text-center">
    <div class="text-2xl mb-1">🌱</div>
    <h5 class="font-bold text-xs text-slate-900 uppercase tracking-tight">Sustainable</h5>
    <p class="text-[11px] text-slate-500 mt-1 font-light">Responsibly sourced materials crafted for longevity.</p>
  </div>
</div>\n`,
                        '',
                        ''
                      );
                      setShowLayoutTemplateModal(false);
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shrink-0 cursor-pointer shadow-xs"
                  >
                    Insert Block
                  </button>
                </div>

                {/* Block 3 */}
                <div className="p-4 rounded-xl border border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/10 transition flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                      📦 Package Contents & Unboxing Box
                    </span>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Emerald-accented container itemizing all included accessories, chargers, and manuals.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      insertIntoDescription(
                        `\n<div class="my-6 p-5 rounded-xl border border-emerald-200 bg-emerald-50/40">
  <h4 class="font-bold text-xs text-emerald-900 uppercase tracking-wider font-mono flex items-center gap-1.5">📦 What's Inside The Box</h4>
  <ul class="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
    <li>• 1x Main Unit</li>
    <li>• 1x High-Speed Braided Cable</li>
    <li>• 1x Certificate of Authenticity</li>
    <li>• 1x User Manual & Quick Guide</li>
  </ul>
</div>\n`,
                        '',
                        ''
                      );
                      setShowLayoutTemplateModal(false);
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shrink-0 cursor-pointer shadow-xs"
                  >
                    Insert Block
                  </button>
                </div>

                {/* Block 4 */}
                <div className="p-4 rounded-xl border border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/10 transition flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                      🛡️ Official Warranty & Guarantee Callout
                    </span>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Prominent brand assurance callout guaranteeing customer satisfaction and genuine parts.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      insertIntoDescription(
                        `\n<div class="my-6 p-4 rounded-xl border-l-4 border-indigo-600 bg-indigo-50/60 flex items-start gap-3">
  <div class="text-lg">🛡️</div>
  <div>
    <h5 class="font-bold text-xs text-indigo-950 uppercase font-mono">Official Veloce 1-Year Guarantee</h5>
    <p class="text-xs text-slate-600 mt-0.5 font-light">Backed by our comprehensive hassle-free replacement warranty and local East Africa support center.</p>
  </div>
</div>\n`,
                        '',
                        ''
                      );
                      setShowLayoutTemplateModal(false);
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shrink-0 cursor-pointer shadow-xs"
                  >
                    Insert Block
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Hyperlink Inserter */}
        {showLinkModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <LinkIcon className="h-5 w-5 text-indigo-600" />
                  <h3 className="font-bold text-sm text-slate-900">Insert Hyperlink</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1">Link Display Text</label>
                  <input
                    type="text"
                    value={linkModalText}
                    onChange={(e) => setLinkModalText(e.target.value)}
                    placeholder="e.g. View Technical Certificate"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1">Destination URL</label>
                  <input
                    type="text"
                    value={linkModalUrl}
                    onChange={(e) => setLinkModalUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!linkModalUrl}
                  onClick={() => {
                    const text = linkModalText.trim() || 'Link';
                    insertIntoDescription(`[${text}](${linkModalUrl.trim()})`, '', '');
                    setShowLinkModal(false);
                    setLinkModalText('');
                    setLinkModalUrl('');
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                >
                  Insert Link
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Specification Industry Presets */}
        {showSpecPresetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-600" />
                  <h3 className="font-bold text-sm text-slate-900">Industry Technical Specification Templates</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSpecPresetModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Choose a pre-filled specification template tailored to your product category. You can edit, add, or remove rows anytime.
              </p>

              <div className="space-y-2.5">
                <div
                  onClick={() => handleApplySpecPreset('electronics')}
                  className="p-4 rounded-xl border border-slate-200 hover:border-indigo-500 bg-slate-50/50 hover:bg-indigo-50/20 transition cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      🖥️ Electronics & Smart Hardware
                    </h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Includes Display, Processor, RAM/Storage, Battery, Connectivity, Weight & Warranty.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-indigo-600">Apply Template &rarr;</span>
                </div>

                <div
                  onClick={() => handleApplySpecPreset('apparel')}
                  className="p-4 rounded-xl border border-slate-200 hover:border-indigo-500 bg-slate-50/50 hover:bg-indigo-50/20 transition cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      👔 Apparel, Footwear & Fashion
                    </h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Includes Composition, Fit Type, Fabric Weight (GSM), Origin, Wash Care & Stitching.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-indigo-600">Apply Template &rarr;</span>
                </div>

                <div
                  onClick={() => handleApplySpecPreset('furniture')}
                  className="p-4 rounded-xl border border-slate-200 hover:border-indigo-500 bg-slate-50/50 hover:bg-indigo-50/20 transition cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      🪑 Furniture & Workspace Objects
                    </h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Includes Dimensions, Primary Wood/Metal, Weight Capacity, Assembly Time & Surface Finish.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-indigo-600">Apply Template &rarr;</span>
                </div>

                <div
                  onClick={() => handleApplySpecPreset('beauty')}
                  className="p-4 rounded-xl border border-slate-200 hover:border-indigo-500 bg-slate-50/50 hover:bg-indigo-50/20 transition cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      💄 Beauty, Fragrance & Skincare
                    </h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Includes Net Volume, Scent Profile, Formulation, Dermatological Testing & Shelf Life.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-indigo-600">Apply Template &rarr;</span>
                </div>

                <div
                  onClick={() => handleApplySpecPreset('food')}
                  className="p-4 rounded-xl border border-slate-200 hover:border-indigo-500 bg-slate-50/50 hover:bg-indigo-50/20 transition cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      ☕ Food, Gourmet & Beverages
                    </h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Includes Net Weight, Flavor Notes, Geographic Origin, Fair Trade Certification & Expiry.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-indigo-600">Apply Template &rarr;</span>
                </div>
              </div>
            </div>
          </div>
        )}
<section id="section-media" className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-8 shadow-xs scroll-mt-24">
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-indigo-600" /> Rich Media & Image Gallery
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Drag-and-drop image upload, automatic client-side compression, storefront quality checks, 360° product spin set, and video previews.
                </p>
              </div>
              
            </div>

            {/* Notice Banner */}
            {mediaNotice && (
              <div
                className={`p-3.5 rounded-xl text-xs font-medium flex items-center justify-between border ${
                  mediaNotice.type === 'success'
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    : mediaNotice.type === 'warning'
                    ? 'bg-amber-50 text-amber-900 border-amber-200'
                    : 'bg-indigo-50 text-indigo-900 border-indigo-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {mediaNotice.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  ) : mediaNotice.type === 'warning' ? (
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  ) : (
                    <Info className="h-4 w-4 text-indigo-600 shrink-0" />
                  )}
                  <span>{mediaNotice.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMediaNotice(null)}
                  className="p-1 rounded-lg hover:bg-black/5 cursor-pointer text-slate-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* DRAG AND DROP MULTI-IMAGE DROPZONE */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDropzoneActive(true);
              }}
              onDragLeave={() => setIsDropzoneActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDropzoneActive(false);
                if (e.dataTransfer.files) {
                  handleBatchImageUpload(e.dataTransfer.files);
                }
              }}
              className={`p-8 rounded-2xl border-2 border-dashed transition text-center relative overflow-hidden ${
                isDropzoneActive
                  ? 'border-indigo-500 bg-indigo-50/60 ring-4 ring-indigo-500/10'
                  : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400'
              }`}
            >
              <input
                ref={galleryFileInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                onChange={(e) => e.target.files && handleBatchImageUpload(e.target.files)}
                className="hidden"
              />

              <div className="max-w-md mx-auto space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-xs">
                  {isProcessingImages ? (
                    <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
                  ) : (
                    <Upload className="h-6 w-6" />
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-800">
                    {isDropzoneActive ? 'Drop Images Here to Upload' : 'Drag & Drop Product Images Here'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Select multiple high-res files from your device or drop them directly.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => galleryFileInputRef.current?.click()}
                    disabled={isProcessingImages}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" /> Browse Local Images
                  </button>
                </div>

                {/* Feature Tags */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-[10px] font-mono text-slate-500">
                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200">✨ Canvas Compressed</span>
                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200">📐 Min 600x600px Check</span>
                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200">🔄 Drag to Reorder</span>
                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200">📸 Max 10 Photos</span>
                </div>
              </div>
            </div>

            {/* Add Image via URL */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase font-mono">
                Or Import via Image URL / Web CDN
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={newImageUrlInput}
                  onChange={(e) => setNewImageUrlInput(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-... or CDN URL"
                  className="flex-1 h-10 px-3.5 rounded-xl border border-slate-300 text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddImageFromUrl}
                  className="px-4 h-10 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Add URL
                </button>
              </div>
            </div>

            {/* GALLERY GRID WITH DRAG-TO-REORDER */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase font-mono flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-indigo-600" /> Catalog Image Gallery ({images.length}/10)
                </h4>
                {images.length > 0 && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    Drag items or use arrow controls to reorder cover priority
                  </span>
                )}
              </div>

              {images.length === 0 ? (
                <div className="p-8 text-center border border-slate-200 rounded-2xl bg-white">
                  <ImageIcon className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <h4 className="text-xs font-bold text-slate-600">No Product Images Added Yet</h4>
                  <p className="text-[11px] text-slate-400 mt-1">At least 1 product image is required before publishing.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {images.map((imgUrl, idx) => {
                    const isPrimary = primaryImageIndex === idx;
                    const meta = imagesMeta[imgUrl];
                    const warnings = meta?.warnings || [];

                    return (
                      <div
                        key={idx}
                        draggable
                        onDragStart={() => setDraggedIndex(idx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggedIndex !== null && draggedIndex !== idx) {
                            handleMoveImage(draggedIndex, idx);
                            setDraggedIndex(null);
                          }
                        }}
                        className={`p-3.5 rounded-2xl border transition flex flex-col gap-3 relative group ${
                          isPrimary
                            ? 'border-indigo-500 bg-indigo-50/20 ring-2 ring-indigo-500/20 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        {/* Drag Handle & Primary Badge Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-100 rounded-md text-slate-400">
                              <GripVertical className="h-4 w-4" />
                            </span>
                            <span className="text-[10px] font-bold font-mono text-slate-500">
                              #{idx + 1} {isPrimary ? '• Cover' : ''}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Reorder Left/Right Arrow Controls */}
                            <button
                              type="button"
                              onClick={() => handleMoveImage(idx, idx - 1)}
                              disabled={idx === 0}
                              className="p-1 rounded-md hover:bg-slate-100 text-slate-500 disabled:opacity-20 cursor-pointer"
                              title="Move Left"
                            >
                              <ChevronLeft className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveImage(idx, idx + 1)}
                              disabled={idx === images.length - 1}
                              className="p-1 rounded-md hover:bg-slate-100 text-slate-500 disabled:opacity-20 cursor-pointer"
                              title="Move Right"
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(idx)}
                              className="p-1 rounded-md hover:bg-rose-100 text-rose-600 transition cursor-pointer ml-1"
                              title="Delete Image"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Image Preview Canvas */}
                        <div className="relative aspect-video rounded-xl bg-slate-100 overflow-hidden border border-slate-200">
                          <img src={imgUrl} alt={`Product view ${idx + 1}`} className="w-full h-full object-cover" />

                          {isPrimary && (
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-indigo-600 text-white font-bold text-[9px] uppercase tracking-wider font-mono shadow-md">
                              Primary Cover
                            </span>
                          )}

                          {meta?.isCompressed && (
                            <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-slate-900 text-emerald-300 text-[9px] font-mono font-bold">
                              Compressed ({meta.compressedSizeKb} KB)
                            </span>
                          )}
                        </div>

                        {/* Image Metadata Badges */}
                        {meta && (
                          <div className="flex flex-wrap items-center justify-between text-[10px] font-mono text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-150">
                            <span>Dimensions: {meta.width}×{meta.height}px</span>
                            <span>Ratio: {meta.aspectRatio}:1</span>
                          </div>
                        )}

                        {/* Storefront Quality Warnings */}
                        {warnings.length > 0 && (
                          <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[10px] space-y-1">
                            <div className="font-bold flex items-center gap-1 text-amber-800">
                              <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" />
                              <span>Storefront Quality Warning:</span>
                            </div>
                            <ul className="list-disc list-inside space-y-0.5 pl-0.5">
                              {warnings.map((w, wIdx) => (
                                <li key={wIdx}>{w}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Primary Image Toggle Button */}
                        {!isPrimary && (
                          <button
                            type="button"
                            onClick={() => setPrimaryImageIndex(idx)}
                            className="w-full py-1.5 rounded-lg border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-600 hover:text-white text-indigo-700 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Sparkles className="h-3.5 w-3.5" /> Set as Primary Cover
                          </button>
                        )}

                        {/* Alt Text input */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1">
                            Accessibility & SEO Alt Text <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={imageAltTexts[idx] || ''}
                            onChange={(e) =>
                              setImageAltTexts({ ...imageAltTexts, [idx]: e.target.value })
                            }
                            placeholder="Describe item angle for SEO..."
                            className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SHORT PRODUCT VIDEO SECTION */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-indigo-100 text-indigo-600">
                    <Video className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase font-mono">Short Product Video (Optional)</h4>
                    <p className="text-[11px] text-slate-500">Provide a product showcase video link or upload a short MP4 file.</p>
                  </div>
                </div>
                <input
                  ref={videoFileInputRef}
                  type="file"
                  accept="video/mp4,video/webm"
                  onChange={(e) => e.target.files?.[0] && handleVideoFileUpload(e.target.files[0])}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => videoFileInputRef.current?.click()}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <FileVideo className="h-3.5 w-3.5 text-indigo-600" /> Upload Video File
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... or direct MP4 URL"
                  className="flex-1 h-10 px-3.5 rounded-xl border border-slate-300 text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                {videoUrl && (
                  <button
                    type="button"
                    onClick={() => setVideoUrl('')}
                    className="p-2.5 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 cursor-pointer"
                    title="Remove Video"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Video Player Preview */}
              {videoUrl && (
                <div className="rounded-2xl bg-black overflow-hidden border border-slate-300 aspect-video max-w-xl mx-auto relative group">
                  {videoUrl.startsWith('data:') || videoUrl.startsWith('blob:') || videoUrl.endsWith('.mp4') || videoUrl.endsWith('.webm') ? (
                    <video controls src={videoUrl} className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-white p-6 text-center space-y-2">
                      <Film className="h-10 w-10 text-indigo-400" />
                      <p className="text-xs font-bold font-mono">External Video Stream Attached</p>
                      <p className="text-[11px] text-slate-400 truncate max-w-md">{videoUrl}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 360° INTERACTIVE PRODUCT SPIN SET */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-indigo-100 text-indigo-600">
                    <RotateCw className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase font-mono">360° Interactive Product Spin Set</h4>
                    <p className="text-[11px] text-slate-500">Upload 8 to 36 frame images in sequential angle order for interactive 360° rotating view.</p>
                  </div>
                </div>

                <input
                  ref={spin360FileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => e.target.files && handleBatch360Upload(e.target.files)}
                  className="hidden"
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => spin360FileInputRef.current?.click()}
                    disabled={isProcessingImages}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add 360° Frames
                  </button>
                  {images360.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setImages360([]);
                        setIsAutoSpinning(false);
                      }}
                      className="px-3 py-1.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 font-bold text-xs cursor-pointer"
                    >
                      Clear Frames
                    </button>
                  )}
                </div>
              </div>

              {/* 360 Spin Viewer Widget */}
              {images360.length === 0 ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIs360DropzoneActive(true);
                  }}
                  onDragLeave={() => setIs360DropzoneActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIs360DropzoneActive(false);
                    if (e.dataTransfer.files) {
                      handleBatch360Upload(e.dataTransfer.files);
                    }
                  }}
                  className={`p-6 text-center border-2 border-dashed rounded-xl transition ${
                    is360DropzoneActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <RotateCw className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <h5 className="text-xs font-bold text-slate-700">No 360° Spin Sequence Loaded</h5>
                  <p className="text-[11px] text-slate-400 mt-1">Drag and drop a series of sequential photo frames here (e.g. 12 or 24 angles).</p>
                </div>
              ) : (
                <div className="space-y-4 max-w-lg mx-auto bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="relative aspect-square max-w-xs mx-auto rounded-xl bg-white border border-slate-200 overflow-hidden shadow-xs">
                    <img
                      src={images360[spin360Index]}
                      alt={`360 spin frame ${spin360Index + 1}`}
                      className="w-full h-full object-cover select-none"
                    />
                    <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-slate-900/80 text-white text-[10px] font-mono font-bold">
                      Frame {spin360Index + 1} / {images360.length}
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono text-slate-600">
                      <span>Rotation Angle: {Math.round((spin360Index / images360.length) * 360)}°</span>
                      <button
                        type="button"
                        onClick={() => setIsAutoSpinning(!isAutoSpinning)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                          isAutoSpinning ? 'bg-rose-500 text-white' : 'bg-indigo-600 text-white'
                        }`}
                      >
                        {isAutoSpinning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        <span>{isAutoSpinning ? 'Pause Rotation' : 'Auto Rotate 360°'}</span>
                      </button>
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={images360.length - 1}
                      value={spin360Index}
                      onChange={(e) => setSpin360Index(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
<section id="section-pricing" className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-8 shadow-xs scroll-mt-24">
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-indigo-600" /> Pricing, Discounts & Taxes
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Configure base selling price, scheduled promotional sales, cost price & tax classes.
                </p>
              </div>
              
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Cost Price (Required - Comes First to calculate profit, markup & margin) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                  Cost Price ({currency}) <span className="text-rose-500">*</span> {role === 'catalog_editor' && '(Restricted Role)'}
                </label>
                {role === 'catalog_editor' ? (
                  <div className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-100 text-xs font-mono text-slate-400 flex items-center justify-between">
                    <span>•••••• Locked</span>
                    <ShieldAlert className="h-4 w-4 text-slate-400" />
                  </div>
                ) : (
                  <input
                    type="number"
                    required
                    min={1}
                    value={costPrice ?? ''}
                    onBlur={() => setTouched((prev) => ({ ...prev, costPrice: true }))}
                    onChange={(e) => setCostPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 2500"
                    className={`w-full h-11 px-3.5 rounded-xl border text-sm font-mono font-bold focus:outline-hidden focus:ring-2 transition ${
                      touched.costPrice && (costPrice === '' || costPrice === undefined || costPrice === null || Number(costPrice) <= 0)
                        ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:ring-rose-500'
                        : 'border-slate-300 text-slate-900 focus:ring-indigo-500'
                    }`}
                  />
                )}
                {touched.costPrice && (costPrice === '' || costPrice === undefined || costPrice === null || Number(costPrice) <= 0) ? (
                  <span className="text-[11px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Cost price is required and must be greater than 0 {currency}.
                  </span>
                ) : (
                  <span className="block text-[10px] text-slate-400 mt-1">Acquisition or production unit cost.</span>
                )}
              </div>

              {/* Base Price (Selling Price) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                  Base Selling Price ({currency}) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={basePrice ?? ''}
                  onBlur={() => setTouched((prev) => ({ ...prev, basePrice: true }))}
                  onChange={(e) => setBasePrice(Number(e.target.value))}
                  placeholder="e.g. 45000"
                  className={`w-full h-11 px-3.5 rounded-xl border text-sm font-mono font-bold focus:outline-hidden focus:ring-2 transition ${
                    touched.basePrice && (!basePrice || basePrice <= 0)
                      ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:ring-rose-500'
                      : 'border-slate-300 text-slate-900 focus:ring-indigo-500'
                  }`}
                />
                {touched.basePrice && (!basePrice || basePrice <= 0) ? (
                  <span className="text-[11px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Base selling price must be greater than 0 {currency}.
                  </span>
                ) : (
                  <span className="block text-[10px] text-slate-400 mt-1">Standard retail listing price tag.</span>
                )}
              </div>

              {/* Sale Price */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                  Sale / Promo Price ({currency})
                </label>
                <input
                  type="number"
                  value={salePrice ?? ''}
                  onChange={(e) => setSalePrice(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Leave empty if no sale"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-mono font-bold text-emerald-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                <span className="block text-[10px] text-slate-400 mt-1">Discounted promo price tag.</span>
              </div>

              {/* Real-Time Profit Preview */}
              <div>
                <label className="block text-xs font-bold text-indigo-900 uppercase font-mono mb-1.5 flex items-center justify-between">
                  <span>Profit Preview</span>
                  <span className="text-[10px] text-indigo-600 font-bold font-sans">Live Margin</span>
                </label>
                {(() => {
                  const cost = costPrice !== '' ? Number(costPrice) : 0;
                  const sell = salePrice !== '' ? Number(salePrice) : (basePrice || 0);
                  const taxRates: Record<string, number> = { standard: 0.16, zero_rated: 0, exempt: 0 };
                  const rate = taxRates[taxClass] ?? 0;
                  const vatAmount = sell * (rate / (1 + rate));
                  const netProfit = (sell - vatAmount) - cost;
                  const netMarginPercent = sell > 0 ? (netProfit / sell) * 100 : 0;
                  const isPositive = netProfit >= 0;

                  return (
                    <div className={`w-full h-11 px-3.5 rounded-xl border flex items-center justify-between font-mono shadow-3xs ${
                      cost <= 0
                        ? 'bg-slate-100 border-slate-200 text-slate-400'
                        : isPositive
                          ? 'bg-emerald-50 border-emerald-300/80 text-emerald-950'
                          : 'bg-rose-50 border-rose-300/80 text-rose-950'
                    }`}>
                      {cost <= 0 ? (
                        <span className="text-xs text-slate-400 italic font-sans">Enter cost & price</span>
                      ) : (
                        <>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold font-sans">Net Profit</span>
                            <span className={`text-xs font-black truncate ${isPositive ? 'text-emerald-700' : 'text-rose-600'}`}>
                              KSh {netProfit.toLocaleString('en-KE', { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                          <div className="text-right flex flex-col shrink-0">
                            <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold font-sans">Margin</span>
                            <span className={`text-xs font-black ${isPositive ? 'text-emerald-700' : 'text-rose-600'}`}>
                              {netMarginPercent.toFixed(1)}%
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
                <span className="block text-[10px] text-slate-400 mt-1">Calculated automatically as you type.</span>
              </div>
            </div>

            {/* Sale Schedule Dates */}
            {salePrice !== '' && (
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-emerald-950 uppercase font-mono mb-1.5">
                    Sale Start Date & Time <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={saleStartAt}
                    onChange={(e) => setSaleStartAt(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-emerald-300 bg-white text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-emerald-950 uppercase font-mono mb-1.5">
                    Sale End Date & Time <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={saleEndAt}
                    onChange={(e) => setSaleEndAt(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-emerald-300 bg-white text-xs font-mono"
                  />
                </div>
              </div>
            )}

            {/* Supplier Sourcing & Consignment Link (Requirement) */}
            <div className="bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-400">
                    <Truck className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase font-mono tracking-wider flex items-center gap-2">
                      Supplier & Consignment Sourcing
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                      Link this product to a registered supplier to automate goods received notes (GRN), consignment payables, and profitability reports.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowQuickAddSupplierModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-indigo-800 transition cursor-pointer self-start sm:self-auto shrink-0 shadow-2xs"
                >
                  <Plus className="h-3.5 w-3.5" /> Quick Add Supplier
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Supplier Selection */}
                <div className="lg:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase font-mono mb-1.5">
                    Source Supplier
                  </label>
                  <select
                    value={supplierId}
                    onChange={(e) => handleSupplierChange(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="">Direct In-House / Manufactured In-House</option>
                    {suppliersList.map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.name} {sup.company_name ? `(${sup.company_name})` : `[${sup.code}]`} — {sup.payment_terms}
                      </option>
                    ))}
                  </select>
                  <span className="block text-[10px] text-slate-400 mt-1">
                    {supplierId ? 'Linked to supplier for consignment and debt calculation.' : 'No external supplier linked.'}
                  </span>
                </div>

                {/* Supplier SKU */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase font-mono mb-1.5 flex items-center justify-between">
                    <span>Supplier SKU / Part #</span>
                    {selectedSupplier && (
                      <button
                        type="button"
                        onClick={() => {
                          const categoryName = categories.find((c) => c.id === categoryId)?.name || initialProduct?.category || 'GEN';
                          const prodSkuPart = sku.trim() || generateSku(categoryName, title || 'PROD');
                          setSupplierSku(`${selectedSupplier.code}-${prodSkuPart}`);
                        }}
                        className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-sans font-bold cursor-pointer"
                      >
                        Auto-Gen
                      </button>
                    )}
                  </label>
                  <input
                    type="text"
                    disabled={!supplierId}
                    value={supplierSku}
                    onChange={(e) => setSupplierSku(e.target.value)}
                    placeholder={supplierId ? 'e.g. SUP-NRB-01-BLZ' : 'Select supplier first'}
                    className={`w-full h-11 px-3.5 rounded-xl border text-xs font-mono font-bold transition ${
                      !supplierId
                        ? 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500'
                    }`}
                  />
                  <span className="block text-[10px] text-slate-400 mt-1">Supplier's internal product reference code.</span>
                </div>

                {/* Agreed Cost & Lead Time */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase font-mono mb-1.5">
                      Agreed Cost ({currency})
                    </label>
                    <input
                      type="number"
                      disabled={!supplierId}
                      min={0}
                      value={agreedCostPrice ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Number(e.target.value);
                        setAgreedCostPrice(val);
                        if (val !== '') {
                          setCostPrice(val);
                        }
                      }}
                      placeholder="e.g. 2500"
                      className={`w-full h-11 px-3.5 rounded-xl border text-xs font-mono font-bold transition ${
                        !supplierId
                          ? 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed'
                          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500'
                      }`}
                    />
                    <span className="block text-[10px] text-slate-400 mt-1">Contract unit cost.</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase font-mono mb-1.5">
                      Lead Time
                    </label>
                    <input
                      type="number"
                      disabled={!supplierId}
                      min={1}
                      max={90}
                      value={leadTimeDays}
                      onChange={(e) => setLeadTimeDays(Math.max(1, Number(e.target.value)))}
                      className={`w-full h-11 px-3.5 rounded-xl border text-xs font-mono font-bold transition ${
                        !supplierId
                          ? 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed'
                          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500'
                      }`}
                    />
                    <span className="block text-[10px] text-slate-400 mt-1">Days to restock.</span>
                  </div>
                </div>
              </div>

              {/* Selected Supplier Info Card */}
              {selectedSupplier && (
                <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
                      {selectedSupplier.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">{selectedSupplier.name}</span>
                        {selectedSupplier.company_name && (
                          <span className="text-slate-500 dark:text-slate-400 font-medium">({selectedSupplier.company_name})</span>
                        )}
                        <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 font-mono text-[10px] font-bold">
                          {selectedSupplier.code}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                        <span>Terms: <strong className="text-indigo-700 dark:text-indigo-300 font-semibold">{selectedSupplier.payment_terms}</strong></span>
                        {selectedSupplier.phone && <span>Tel: {selectedSupplier.phone}</span>}
                        {selectedSupplier.mpesa_number && <span>M-PESA: {selectedSupplier.mpesa_number}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-mono text-[11px] font-bold">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Consignment Linked
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Product-Level Tax Classification (Requirement 6.1) */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase font-mono flex items-center gap-2">
                  🛡️ Product-Level Tax Classification (KRA Compliant)
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Tax rate applied per line-item in mixed carts
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                    Tax Status <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={taxStatus}
                    onChange={(e) => {
                      const newStatus = e.target.value as TaxStatus;
                      setTaxStatus(newStatus);
                      if (newStatus === 'zero_rated') {
                        setTaxClass('zero_rated');
                        setTaxRate(0);
                      } else if (newStatus === 'exempt') {
                        setTaxClass('exempt');
                        setTaxRate(0);
                      } else {
                        setTaxClass('standard');
                        setTaxRate(16);
                      }
                    }}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-bold bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="taxable">Taxable (Standard/Reduced Tax Owed)</option>
                    <option value="zero_rated">Zero-Rated (0% VAT - Exports/Essential)</option>
                    <option value="exempt">Tax Exempt (No Tax Owed)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                    Tax Class Rule Set
                  </label>
                  <select
                    value={taxClass}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setTaxClass(selectedId);
                      const config = getTaxClassConfig(selectedId);
                      setTaxStatus(config.status);
                      setTaxRate(config.ratePercent);
                    }}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-bold bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {DEFAULT_TAX_CLASSES.map((tc) => (
                      <option key={tc.id} value={tc.id}>
                        {tc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                    Tax Rate (%)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`${taxRate}% VAT ${taxStatus === 'zero_rated' ? '(Zero-Rated)' : taxStatus === 'exempt' ? '(Exempt)' : ''}`}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-100 text-xs font-mono font-bold text-slate-700 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Financial Analysis & Margin Projections Card */}
            {(() => {
              const cost = costPrice !== '' ? Number(costPrice) : 0;
              const sell = salePrice !== '' ? Number(salePrice) : (basePrice || 0);
              const grossProfit = sell - cost;
              const markupPercent = cost > 0 ? ((sell - cost) / cost) * 100 : 0;
              const grossMarginPercent = sell > 0 ? ((sell - cost) / sell) * 100 : 0;

              const rate = taxStatus === 'taxable' ? taxRate / 100 : 0;
              const vatAmount = sell * (rate / (1 + rate));
              const sellExclTax = sell - vatAmount;
              const netProfit = sellExclTax - cost;
              const netMarginPercent = sell > 0 ? (netProfit / sell) * 100 : 0;

              return (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 font-sans text-left space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-black font-mono text-indigo-900 uppercase tracking-wider flex items-center gap-2">
                      💸 Financial Analysis & Margin Projections (After Tax)
                    </span>
                    <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                      {taxStatus === 'taxable' ? `${taxRate}% VAT Tax Included` : taxStatus === 'zero_rated' ? '0% Zero-Rated Tax' : 'Tax Exempt'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    <div className="bg-white border border-slate-200 p-2.5 rounded-xl shadow-2xs">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Cost Price</span>
                      <span className={`text-xs font-bold block mt-0.5 font-mono ${cost > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                        {cost > 0 ? `KSh ${cost.toLocaleString('en-KE')}` : 'Not set'}
                      </span>
                    </div>

                    <div className="bg-white border border-slate-200 p-2.5 rounded-xl shadow-2xs">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Selling Price</span>
                      <span className="text-xs font-bold block mt-0.5 text-slate-900 font-mono">
                        KSh {sell.toLocaleString('en-KE')}
                      </span>
                    </div>

                    <div className="bg-white border border-slate-200 p-2.5 rounded-xl shadow-2xs">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Gross Profit</span>
                      <span className={`text-xs font-bold block mt-0.5 font-mono ${grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        KSh {grossProfit.toLocaleString('en-KE')}
                      </span>
                    </div>

                    <div className="bg-white border border-slate-200 p-2.5 rounded-xl shadow-2xs">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">VAT Tax ({rate * 100}%)</span>
                      <span className="text-xs font-bold block mt-0.5 text-amber-700 font-mono">
                        KSh {vatAmount.toLocaleString('en-KE', { maximumFractionDigits: 1 })}
                      </span>
                    </div>

                    <div className="bg-white border border-slate-200 p-2.5 rounded-xl shadow-2xs">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Net Profit (After Tax)</span>
                      <span className={`text-xs font-bold block mt-0.5 font-mono ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        KSh {netProfit.toLocaleString('en-KE', { maximumFractionDigits: 1 })}
                      </span>
                    </div>

                    <div className="bg-white border border-slate-200 p-2.5 rounded-xl shadow-2xs">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Markup & Margin</span>
                      <div className="text-[10px] font-bold mt-0.5 flex flex-col font-mono leading-tight">
                        <span className={markupPercent >= 0 ? 'text-indigo-600' : 'text-rose-600'}>
                          Markup: {markupPercent.toFixed(1)}%
                        </span>
                        <span className={netMarginPercent >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                          Net Margin: {netMarginPercent.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>
        </section>
<section id="section-variants" className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-8 shadow-xs scroll-mt-24">
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="h-5 w-5 text-indigo-600" /> Variants, Stock & SKU Registry
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Manage primary SKU code, stock tracking, and generate multi-attribute variant matrix tables.
                </p>
              </div>
              
            </div>

            {/* Primary SKU & Stock */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase font-mono">
                    Master Product SKU <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold ${
                        isSkuCustom
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {isSkuCustom ? '✏️ Custom SKU' : '⚡ Auto-Generated'}
                    </span>
                    <button
                      type="button"
                      onClick={handleForceRegenerateSku}
                      className="px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10.5px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Regenerate unique SKU code based on category and title"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>Regenerate</span>
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={sku}
                  onBlur={() => setTouched((prev) => ({ ...prev, sku: true }))}
                  onChange={(e) => {
                    setSku(e.target.value);
                    setIsSkuCustom(true);
                  }}
                  placeholder="e.g. FOD-ARCO-101"
                  className={`w-full h-11 px-3.5 rounded-xl border text-sm font-mono font-bold uppercase transition ${
                    isSkuDuplicate || (touched.sku && !sku.trim())
                      ? 'border-rose-400 bg-rose-50/50 text-rose-900 focus:ring-rose-500'
                      : 'border-slate-300 focus:ring-2 focus:ring-indigo-500'
                  }`}
                />
                {isSkuDuplicate ? (
                  <span className="text-[11px] text-rose-600 font-bold mt-1 block flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" /> SKU code is already registered in catalog!
                  </span>
                ) : touched.sku && !sku.trim() ? (
                  <span className="text-[11px] text-rose-600 font-bold mt-1 block flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" /> SKU (Stock Keeping Unit) is required.
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Auto-generated unique code based on category and product title. You can edit to override.
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                  Stock Quantity (Units)
                </label>
                <input
                  type="number"
                  min={0}
                  value={stockQty ?? ''}
                  onChange={(e) => setStockQty(Number(e.target.value))}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                  Low Stock Alert Threshold
                </label>
                <input
                  type="number"
                  min={1}
                  value={lowStockThreshold ?? ''}
                  onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Modern Product Variant & Color Image Gallery Manager */}
            <div className="pt-2">
              <ProductVariantManager
                basePrice={salePrice && salePrice > 0 ? Number(salePrice) : (basePrice || 0)}
                baseSku={sku || 'SKU'}
                productName={title || 'Product'}
                currency={currency}
                hasVariants={hasVariants}
                onHasVariantsChange={setHasVariants}
                options={options}
                onOptionsChange={setOptions}
                colorImages={colorImages}
                onColorImagesChange={setColorImages}
                variants={variants}
                onVariantsChange={setVariants}
              />
            </div>
          </div>
        </section>
<section id="section-seo" className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-8 shadow-xs scroll-mt-24">
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Globe className="h-5 w-5 text-indigo-600" /> Search Engine Optimization (SEO) & Google SERP
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Preview live Google Search result card and customize Meta tags.
                </p>
              </div>
              
            </div>

            {/* LIVE GOOGLE SERP PREVIEW BOX */}
            <div className="p-5 rounded-2xl bg-white border border-slate-300 shadow-sm space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1">
                Google Search Result SERP Snippet Preview
              </span>
              <div className="text-xs text-slate-800 font-mono flex items-center gap-1.5 truncate">
                <span className="text-emerald-700 font-bold">https://ropenix.co.ke</span>
                <span className="text-slate-400">› products › {slug || 'product-slug'}</span>
              </div>
              <h4 className="text-base font-medium text-blue-800 hover:underline cursor-pointer truncate">
                {metaTitle || title || 'Product Title Placeholder'}
              </h4>
              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                {metaDescription || shortDescription || 'Search snippet description meta overview will appear here...'}
              </p>
            </div>

            <div className="space-y-4">
              {/* Meta Title */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase font-mono">Meta Title</label>
                  <span
                    className={`text-[11px] font-mono font-bold ${
                      metaTitle.length > 60 ? 'text-rose-600' : 'text-slate-400'
                    }`}
                  >
                    {metaTitle.length}/60 chars
                  </span>
                </div>
                <input
                  type="text"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  placeholder={title || 'Auto-fallback to Product Title'}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Meta Description */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase font-mono">Meta Description</label>
                  <span
                    className={`text-[11px] font-mono font-bold ${
                      metaDescription.length > 160 ? 'text-rose-600' : 'text-slate-400'
                    }`}
                  >
                    {metaDescription.length}/160 chars
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder={shortDescription || 'Auto-fallback to Short Description'}
                  className="w-full p-3.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        </section>
        </div>

        {/* RIGHT COLUMN: SIDEBAR SETTINGS & LOGISTICS (1/3 width) */}
        <div className="lg:col-span-1 space-y-6">
        <section id="section-publish" className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs scroll-mt-24">
          <div className="space-y-5">
            {/* Header with Title and Validation Pill */}
            <div className="border-b border-slate-100 pb-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 shrink-0 mt-0.5">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                    Commit, Publish & Release Control
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Final pre-flight check before releasing specification to live catalog.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChecklistOpen(true)}
                className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border transition-colors flex items-center gap-1 cursor-pointer ${
                  allPublishBlockingErrors.length === 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                }`}
                title="View validation checklist"
              >
                {allPublishBlockingErrors.length === 0 ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Ready
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3 w-3 text-rose-600" /> {allPublishBlockingErrors.length} Issue{allPublishBlockingErrors.length > 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>

            {/* Product Summary Pre-flight Card */}
            <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50/70 to-white p-4 space-y-3.5 shadow-2xs">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono font-bold text-[9px] uppercase tracking-wider">
                      {prodType} Product
                    </span>
                    <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-[9px] uppercase border ${
                      (status as string) === 'published' || (status as string) === 'Active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : (status as string) === 'draft' || (status as string) === 'Draft'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      {status}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mt-1.5 truncate" title={title || 'Untitled Product'}>
                    {title || 'Untitled Product'}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-mono truncate mt-0.5">
                    SKU: <strong className="text-slate-800 font-bold">{sku || 'AUTO-GEN'}</strong>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-base sm:text-lg font-mono font-black text-slate-900 block leading-tight">
                    KSh {basePrice.toLocaleString('en-KE')}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 block mt-0.5">
                    {prodType === 'physical' ? `Stock: ${stockQty} units` : `${prodType} item`}
                  </span>
                </div>
              </div>

              {/* 2x2 Specs Grid */}
              <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-slate-200/70 text-xs font-mono">
                <div className="bg-white p-2 rounded-lg border border-slate-150">
                  <span className="text-slate-400 block text-[9.5px] uppercase font-bold">Images</span>
                  <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1 mt-0.5">
                    <ImageIcon className="h-3 w-3 text-indigo-500" /> {images.length} uploaded
                  </span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-150">
                  <span className="text-slate-400 block text-[9.5px] uppercase font-bold">Category</span>
                  <span className="font-bold text-slate-800 text-[11px] truncate block mt-0.5" title={categories.find(c => c.id === categoryId)?.name || 'General'}>
                    {categories.find(c => c.id === categoryId)?.name || 'General'}
                  </span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-150">
                  <span className="text-slate-400 block text-[9.5px] uppercase font-bold">URL Slug</span>
                  <span className="font-bold text-slate-800 text-[11px] truncate block mt-0.5" title={slug || title.toLowerCase().replace(/\s+/g, '-')}>
                    /{slug || 'auto'}
                  </span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-150">
                  <span className="text-slate-400 block text-[9.5px] uppercase font-bold">Role Access</span>
                  <span className="font-bold text-indigo-700 text-[11px] uppercase truncate block mt-0.5">
                    {role}
                  </span>
                </div>
              </div>
            </div>

            {/* Commit Actions */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleSaveSubmit(true)}
                disabled={!canPublishDirectly}
                className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-xs ${
                  canPublishDirectly
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{canPublishDirectly ? (isEditing ? 'Save & Update Live Product' : 'Publish to Live Catalog') : 'Submit for Review (Catalog Editor)'}</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveSubmit(false)}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Save className="h-3.5 w-3.5" /> Save Draft
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        </section>
<section id="section-organization" className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-8 shadow-xs scroll-mt-24">
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FolderTree className="h-5 w-5 text-indigo-600" /> Taxonomy & Tags Organization
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Assign category, subcategory, search tags, and cross-sell related products.
                </p>
              </div>
              
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                  Primary Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-bold bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subcategory */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5 flex items-center justify-between">
                  <span>Subcategory (Optional)</span>
                  {availableSubcategories.length > 0 && (
                    <span className="text-[10px] text-indigo-600 font-semibold uppercase">
                      {availableSubcategories.length} presets
                    </span>
                  )}
                </label>
                {availableSubcategories.length > 0 ? (
                  <div className="space-y-2">
                    <select
                      value={availableSubcategories.includes(subcategoryId) ? subcategoryId : (subcategoryId ? '__custom__' : '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__custom__') {
                          // keep subcategoryId or reset if it was in availableSubcategories
                          if (availableSubcategories.includes(subcategoryId)) {
                            setSubcategoryId('');
                          }
                        } else {
                          setSubcategoryId(val);
                        }
                      }}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-medium bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="">-- Select Subcategory --</option>
                      {availableSubcategories.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                      <option value="__custom__">✏️ Custom Subcategory...</option>
                    </select>

                    {(!availableSubcategories.includes(subcategoryId) || subcategoryId === '') && (
                      <input
                        type="text"
                        value={subcategoryId}
                        onChange={(e) => setSubcategoryId(e.target.value)}
                        placeholder="Or enter custom subcategory..."
                        className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                      />
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={subcategoryId}
                    onChange={(e) => setSubcategoryId(e.target.value)}
                    placeholder="e.g. Ergonomic Office Standing Desks"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                  />
                )}
              </div>
            </div>

            {/* Tag Pills Manager */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase font-mono">
                  Product Tags (Max 15)
                </label>
                <span className="text-[11px] font-mono text-slate-400">{tags.length}/15 tags</span>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  placeholder="Type tag name and press Enter or Add..."
                  className="flex-1 h-10 px-3.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-4 h-10 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Add Tag
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {(Array.isArray(tags) ? tags : []).map((t) => (
                  <span
                    key={t}
                    className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 font-mono text-xs font-bold flex items-center gap-1.5"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="p-0.5 hover:bg-indigo-200 rounded text-indigo-700 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
<section id="section-shipping" className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-8 shadow-xs scroll-mt-24">
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="h-5 w-5 text-indigo-600" /> Shipping & Freight Logistics
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Specify parcel weight, dimensions, shipping class, and regional delivery zone coverage.
                </p>
              </div>
              
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">Weight (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.8"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">Length (cm)</label>
                <input
                  type="number"
                  value={dimensionsCm.length}
                  onChange={(e) => setDimensionsCm({ ...dimensionsCm, length: Number(e.target.value) })}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">Width (cm)</label>
                <input
                  type="number"
                  value={dimensionsCm.width}
                  onChange={(e) => setDimensionsCm({ ...dimensionsCm, width: Number(e.target.value) })}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">Height (cm)</label>
                <input
                  type="number"
                  value={dimensionsCm.height}
                  onChange={(e) => setDimensionsCm({ ...dimensionsCm, height: Number(e.target.value) })}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Shipping Class */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">Shipping Class</label>
              <select
                value={shippingClass}
                onChange={(e) => setShippingClass(e.target.value as any)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-bold bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="standard">Standard Parcel Shipping</option>
                <option value="fragile">Fragile Handling Required</option>
                <option value="oversized">Oversized / Heavy Freight</option>
              </select>
            </div>
          </div>
        </section>
<section id="section-category_specs" className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-8 shadow-xs scroll-mt-24">
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-indigo-600" /> Category Compliance & Package Inventory
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Manage required package contents ("What's in the Box"), category-specific disclosures, and automated 8-day expiry storefront tracking.
                </p>
              </div>
              
            </div>

            {/* CATEGORY TYPE INDICATOR BANNER */}
            <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-100 flex items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
                  {activeCategoryType === 'clothing' && '👕'}
                  {activeCategoryType === 'food' && '🍲'}
                  {activeCategoryType === 'beauty' && '💄'}
                  {activeCategoryType === 'general' && '📦'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 font-mono">
                      Active Category Format:
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-200 text-indigo-900">
                      {activeCategoryType === 'clothing' && 'Clothes & Wearables'}
                      {activeCategoryType === 'food' && 'Food & Beverages'}
                      {activeCategoryType === 'beauty' && 'Perfumes & Beauty Products'}
                      {activeCategoryType === 'general' && 'General Merchandise'}
                    </span>
                  </div>
                  <p className="text-xs text-indigo-700/80 mt-0.5">
                    Category selection dynamically adjusts mandatory product parameters & compliance fields.
                  </p>
                </div>
              </div>
            </div>

            {/* BASE MANDATORY FIELD: WHAT'S IN THE BOX */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-900 uppercase font-mono">
                  What's in the Box <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] font-mono font-semibold text-indigo-600">Mandatory for all products</span>
              </div>
              <p className="text-xs text-slate-500">
                Provide an itemized list of everything included with the purchase (e.g., main product, accessories, charging cables, manuals, warranty cards).
              </p>
              <textarea
                rows={3}
                value={whatsInTheBox}
                onChange={(e) => setWhatsInTheBox(e.target.value)}
                placeholder="e.g. 1x Main Product Unit, 1x USB-C Charging Cable, 1x Quick Start Guide, 1x 1-Year Warranty Card"
                className="w-full p-3.5 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>

            {/* CONDITIONAL CATEGORY FIELDS: CLOTHES & WEARABLES */}
            {activeCategoryType === 'clothing' && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <span>👕</span> Clothes & Wearables Specification
                  </h4>
                  <span className="text-xs text-indigo-600 font-mono font-semibold">Optional Specifications</span>
                </div>

                {/* Size Guide */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1">
                    Size Guide (Measurements & Conversions)
                  </label>
                  <p className="text-xs text-slate-500 mb-2">
                    Enter measurement details (e.g. Chest, Waist, Inseam) or size conversion table (UK / EU / US).
                  </p>
                  <textarea
                    rows={3}
                    value={sizeGuide}
                    onChange={(e) => setSizeGuide(e.target.value)}
                    placeholder="e.g. Size S: Chest 36-38in | Size M: Chest 38-40in | Size L: Chest 40-42in | Size XL: Chest 42-44in"
                    className="w-full p-3 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Available Sizes Pills */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                    Available Sizes
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {COMMON_SIZES.slice(0, 16).map((sz) => {
                      const isSelected = availableSizes.includes(sz);
                      return (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setAvailableSizes(availableSizes.filter((s) => s !== sz));
                            } else {
                              setAvailableSizes([...availableSizes, sz]);
                            }
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold font-mono transition cursor-pointer border ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}{sz}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customSizeInput}
                      onChange={(e) => setCustomSizeInput(e.target.value)}
                      placeholder="Add custom size (e.g. 42 EU)..."
                      className="h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customSizeInput.trim() && !availableSizes.includes(customSizeInput.trim())) {
                          setAvailableSizes([...availableSizes, customSizeInput.trim()]);
                          setCustomSizeInput('');
                        }
                      }}
                      className="h-9 px-3 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800"
                    >
                      Add Size
                    </button>
                  </div>
                </div>

                {/* Material */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                      Material / Fabric Composition <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={material}
                      onChange={(e) => setMaterial(e.target.value)}
                      placeholder="e.g. 100% Organic Egyptian Cotton"
                      className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                      Care Instructions (Optional)
                    </label>
                    <input
                      type="text"
                      value={careInstructions}
                      onChange={(e) => setCareInstructions(e.target.value)}
                      placeholder="e.g. Machine wash cold at 30°C, do not tumble dry"
                      className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Colors */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                    Color Options <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {colorOptions.map((clr) => (
                      <span
                        key={clr}
                        className="px-3 py-1 rounded-full bg-slate-100 border border-slate-300 text-slate-900 text-xs font-bold flex items-center gap-1.5"
                      >
                        {clr}
                        <button
                          type="button"
                          onClick={() => setColorOptions(colorOptions.filter((c) => c !== clr))}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customColorInput}
                      onChange={(e) => setCustomColorInput(e.target.value)}
                      placeholder="Add color option (e.g. Midnight Navy)..."
                      className="h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customColorInput.trim() && !colorOptions.includes(customColorInput.trim())) {
                          setColorOptions([...colorOptions, customColorInput.trim()]);
                          setCustomColorInput('');
                        }
                      }}
                      className="h-9 px-3 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800"
                    >
                      Add Color
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* CONDITIONAL CATEGORY FIELDS: FOOD & BEVERAGES */}
            {activeCategoryType === 'food' && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <span>🍲</span> Food & Beverages Disclosures & Compliance
                  </h4>
                  <span className="text-xs text-rose-500 font-mono font-bold">* Regulatory Standard</span>
                </div>

                {/* Ingredients */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1">
                    Ingredients (Descending Order) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={ingredients}
                    onChange={(e) => setIngredients(e.target.value)}
                    placeholder="e.g. Whole Grain Wheat, Water, Cane Sugar, Sea Salt, Natural Flavors..."
                    className="w-full p-3 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Manufacturer & Country of Origin */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                      Manufacturer <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={manufacturer}
                      onChange={(e) => setManufacturer(e.target.value)}
                      placeholder="e.g. Veloce Fresh Kenya Ltd"
                      className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                      Country of Origin <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={countryOfOrigin}
                      onChange={(e) => setCountryOfOrigin(e.target.value)}
                      className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:ring-2 focus:ring-indigo-500"
                    >
                      {COMMON_COUNTRIES.map((cnt) => (
                        <option key={cnt} value={cnt}>
                          {cnt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Allergy Information */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                    Allergy Information (Select Allergens Present) <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {COMMON_ALLERGENS.map((alg) => {
                      const isSel = allergyInfo.includes(alg);
                      return (
                        <button
                          key={alg}
                          type="button"
                          onClick={() => {
                            if (isSel) {
                              setAllergyInfo(allergyInfo.filter((a) => a !== alg));
                            } else {
                              setAllergyInfo([...allergyInfo, alg]);
                            }
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold font-mono transition cursor-pointer border ${
                            isSel
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {isSel ? '⚠️ ' : '+ '}{alg}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="text"
                    value={allergyTracesNotes}
                    onChange={(e) => setAllergyTracesNotes(e.target.value)}
                    placeholder="Additional Allergen Notes (e.g. 'May contain traces of peanuts and sesame')..."
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Nutritional Info & Storage */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                      Nutritional Information (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={nutritionalInfo}
                      onChange={(e) => setNutritionalInfo(e.target.value)}
                      placeholder="e.g. Energy 250 kcal, Protein 8g, Fat 3.5g, Carbs 45g per 100g serving"
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                      Storage Instructions (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={storageInstructions}
                      onChange={(e) => setStorageInstructions(e.target.value)}
                      placeholder="e.g. Store in a cool dry place below 20°C. Refrigerate after opening."
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* CONDITIONAL CATEGORY FIELDS: PERFUMES & BEAUTY */}
            {activeCategoryType === 'beauty' && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <span>💄</span> Perfumes & Beauty Formulation Details
                  </h4>
                  <span className="text-xs text-indigo-600 font-mono font-semibold">Optional Specifications</span>
                </div>

                {/* INCI Ingredients */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1">
                    Ingredients (Full INCI Nomenclature)
                  </label>
                  <textarea
                    rows={3}
                    value={beautyIngredients}
                    onChange={(e) => setBeautyIngredients(e.target.value)}
                    placeholder="e.g. Aqua (Water), Alcohol Denat., Parfum (Fragrance), Glycerin, Limonene, Linalool, Citronellol..."
                    className="w-full p-3 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* How to Use */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1">
                    How to Use (Step-by-Step Instructions) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={howToUse}
                    onChange={(e) => setHowToUse(e.target.value)}
                    placeholder="e.g. Spray gently onto pulse points (wrists, neck, behind ears) from 15cm distance. Allow to dry naturally."
                    className="w-full p-3 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Manufacturer, Country & Volume */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                      Manufacturer <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={beautyManufacturer}
                      onChange={(e) => setBeautyManufacturer(e.target.value)}
                      placeholder="e.g. Maison de Fragrance Paris"
                      className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                      Country of Origin <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={beautyCountryOfOrigin}
                      onChange={(e) => setBeautyCountryOfOrigin(e.target.value)}
                      className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:ring-2 focus:ring-indigo-500"
                    >
                      {COMMON_COUNTRIES.map((cnt) => (
                        <option key={cnt} value={cnt}>
                          {cnt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                      Volume / Net Weight <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={volumeNetWeight}
                      onChange={(e) => setVolumeNetWeight(e.target.value)}
                      placeholder="e.g. 100ml / 3.4 fl. oz."
                      className="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* EXPIRY DATE TRACKING & AUTOMATED REMOVAL */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600" /> Expiry Date Tracking & Storefront Automation
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Enable shelf-life tracking for perishable or dated products. Products within ≤8 days of expiry are automatically hidden from the storefront.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasExpiryDate}
                    onChange={(e) => setHasExpiryDate(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                  <span className="ml-2 text-xs font-bold text-slate-800">
                    {hasExpiryDate ? 'Expiry Enabled' : 'No Expiry'}
                  </span>
                </label>
              </div>

              {hasExpiryDate && (
                <div className="space-y-4 animate-fade-in pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                        Expiry Date <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs font-bold font-mono focus:ring-2 focus:ring-amber-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase font-mono mb-1.5">
                        Batch / Lot Number (Optional)
                      </label>
                      <input
                        type="text"
                        value={batchLotNumber}
                        onChange={(e) => setBatchLotNumber(e.target.value)}
                        placeholder="e.g. LOT-2026-0812-B"
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-amber-500 bg-white"
                      />
                    </div>
                  </div>

                  {/* LIVE EXPIRY STATUS BANNER */}
                  {expiryDate && (() => {
                    const status = getExpiryStatus({
                      hasExpiryDate: true,
                      expiryDate,
                      id: 'test'
                    } as any);

                    return (
                      <div className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${status.badgeColorClass}`}>
                        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold text-sm mb-0.5">
                            {status.badgeLabel}
                          </div>
                          {status.isNearExpiry ? (
                            <p className="mt-1 leading-relaxed opacity-90">
                              ⚡ <strong>AUTOMATED STOREFRONT REMOVAL TRIGGERED:</strong> Because this product has {status.daysRemaining !== null ? `${status.daysRemaining} days` : 'fewer than 8 days'} until expiry, it is automatically hidden from public storefront customers. It remains accessible in backend inventory for clearance, disposal, or return-to-supplier workflows.
                            </p>
                          ) : (
                            <p className="mt-1 leading-relaxed opacity-90">
                              ✓ Product expiry is set for {expiryDate} ({status.daysRemaining} days remaining). Product will remain live on storefront until 8 days before expiry.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </section>
          {/* LIVE PUBLISH READINESS CHECKLIST CARD */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
            <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-indigo-600" /> Product Readiness
              </h3>
              <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
                allPublishBlockingErrors.length === 0
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {allPublishBlockingErrors.length === 0 ? 'Ready to Publish' : `${allPublishBlockingErrors.length} pending`}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-600 flex items-center gap-1.5">
                  {basicInfoValidation.isValid ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <AlertCircle className="h-3.5 w-3.5 text-amber-500" />}
                  Title & Basic Info
                </span>
                <span className={basicInfoValidation.isValid ? 'text-emerald-700 font-bold text-[11px]' : 'text-amber-600 font-medium text-[11px]'}>
                  {basicInfoValidation.isValid ? 'Valid' : 'Required'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-600 flex items-center gap-1.5">
                  {mediaValidation.isValid ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <AlertCircle className="h-3.5 w-3.5 text-amber-500" />}
                  Media Gallery
                </span>
                <span className={mediaValidation.isValid ? 'text-emerald-700 font-bold text-[11px]' : 'text-amber-600 font-medium text-[11px]'}>
                  {images.length > 0 ? `${images.length} Image(s)` : 'Add image'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-600 flex items-center gap-1.5">
                  {pricingValidation.isValid ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <AlertCircle className="h-3.5 w-3.5 text-amber-500" />}
                  Base Price & Cost
                </span>
                <span className={pricingValidation.isValid ? 'text-emerald-700 font-bold text-[11px]' : 'text-amber-600 font-medium text-[11px]'}>
                  {basePrice > 0 ? `KES ${basePrice.toLocaleString()}` : 'Set price'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-600 flex items-center gap-1.5">
                  {variantsValidation.isValid ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <AlertCircle className="h-3.5 w-3.5 text-amber-500" />}
                  SKU & Stock
                </span>
                <span className={variantsValidation.isValid ? 'text-emerald-700 font-bold text-[11px]' : 'text-amber-600 font-medium text-[11px]'}>
                  {sku ? `${sku} (${stockQty} in stock)` : 'Enter SKU'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-slate-600 flex items-center gap-1.5">
                  {organizationValidation.isValid ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <AlertCircle className="h-3.5 w-3.5 text-amber-500" />}
                  Category & Taxonomy
                </span>
                <span className={organizationValidation.isValid ? 'text-emerald-700 font-bold text-[11px]' : 'text-amber-600 font-medium text-[11px]'}>
                  {categoryId ? 'Assigned' : 'Required'}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2">
              <button
                type="button"
                id="btn-save-publish-product-sidebar"
                onClick={() => handleSaveSubmit(true)}
                disabled={!canPublishDirectly}
                className={`w-full py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                  canPublishDirectly
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{isEditing ? 'Save Product Changes' : 'Publish Product'}</span>
              </button>
              <button
                type="button"
                id="btn-save-draft-product-sidebar"
                onClick={() => handleSaveSubmit(false)}
                className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition flex items-center justify-center gap-1.5"
              >
                <Save className="h-3.5 w-3.5 text-slate-500" />
                <span>Save as Draft</span>
              </button>
              <button
                type="button"
                id="btn-discard-back-product-sidebar"
                onClick={(e) => {
                  e.preventDefault();
                  if (onCancel) onCancel();
                }}
                className="w-full py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs cursor-pointer transition flex items-center justify-center gap-1.5 border border-slate-200"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-slate-400" />
                <span>Discard &amp; Back to Catalog</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* CUSTOMER PDP PREVIEW MODAL */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <span className="font-bold text-xs font-mono flex items-center gap-2">
                <Eye className="h-4 w-4 text-indigo-400" /> Customer Product Page Simulation
              </span>
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="aspect-square rounded-2xl bg-slate-100 overflow-hidden border border-slate-200">
                  <img
                    src={images[primaryImageIndex] || images[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'}
                    alt={title}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase font-mono bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {brand || 'Veloce Kenya'}
                    </span>
                    {countryOfOrigin && (
                      <span className="text-[10px] font-medium text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
                        <span>{getCountryFlag(countryOfOrigin)}</span>
                        <span>{countryOfOrigin}</span>
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">{title || 'Product Title'}</h2>
                  <p className="text-xs text-slate-500 leading-relaxed">{shortDescription || 'Short description...'}</p>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-xl font-mono font-black text-slate-900">
                      KES {(salePrice !== '' ? Number(salePrice) : basePrice).toLocaleString()}
                    </span>
                    {salePrice !== '' && (
                      <span className="ml-2 text-xs font-mono text-slate-400 line-through">
                        KES {basePrice.toLocaleString()}
                      </span>
                    )}
                  </div>

                  <button className="w-full py-3 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-xs">
                    Add to Shopping Cart
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PUBLISH READINESS CHECKLIST MODAL */}
      {isChecklistOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${allPublishBlockingErrors.length === 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                  {allPublishBlockingErrors.length === 0 ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-sm font-mono flex items-center gap-2">
                    Product Publish Validation Checklist
                  </h3>
                  <p className="text-xs text-slate-400">
                    {allPublishBlockingErrors.length === 0
                      ? 'All required fields are complete and ready for publishing!'
                      : `${allPublishBlockingErrors.length} required field${allPublishBlockingErrors.length > 1 ? 's are' : ' is'} missing or invalid.`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChecklistOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {allPublishBlockingErrors.length > 0 && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2">
                  <div className="font-bold text-xs uppercase tracking-wider font-mono text-rose-950 flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    Missing Required Attributes:
                  </div>
                  <div className="space-y-1.5">
                    {allPublishBlockingErrors.map((err, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setIsChecklistOpen(false);
                          scrollToSection(err.section);
                        }}
                        className="flex items-center justify-between p-3 rounded-xl bg-white border border-rose-200 hover:border-rose-400 hover:bg-rose-100 transition cursor-pointer group shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                          <span className="font-bold text-rose-950 font-mono text-xs">
                            [{err.field}]
                          </span>
                          <span className="text-xs text-rose-800 truncate">{err.message}</span>
                        </div>
                        <span className="shrink-0 text-xs font-bold text-indigo-600 group-hover:text-indigo-800 flex items-center gap-1 font-mono">
                          Go to Field <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section-by-Section Status */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
                  Catalog Section Audit
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {Object.entries(sectionStatusMap).map(([secKey, secVal]) => {
                    const secId = secKey as SectionTabId;
                    const isValid = secVal.isValid;
                    return (
                      <div
                        key={secKey}
                        onClick={() => {
                          setIsChecklistOpen(false);
                          scrollToSection(secId);
                        }}
                        className={`p-3 rounded-xl border flex items-center justify-between transition cursor-pointer ${
                          isValid
                            ? 'bg-emerald-50/50 border-emerald-200 hover:bg-emerald-50'
                            : 'bg-rose-50/50 border-rose-200 hover:bg-rose-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isValid ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                          )}
                          <span className={`text-xs font-bold capitalize truncate ${isValid ? 'text-emerald-900' : 'text-rose-950'}`}>
                            {secKey.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-md ${
                          isValid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {isValid ? 'Ready' : `${secVal.errors.length} Issue${secVal.errors.length > 1 ? 's' : ''}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">
                {allPublishBlockingErrors.length === 0 ? 'Ready to publish' : `${allPublishBlockingErrors.length} item(s) to fix`}
              </span>
              <button
                type="button"
                onClick={() => setIsChecklistOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
              >
                Close Checklist
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Supplier Modal */}
      {showQuickAddSupplierModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150 font-sans">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 text-slate-900 dark:text-white space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Quick Register Supplier</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Add a new supplier to immediately link to this product</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickAddSupplierModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateQuickSupplier} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Supplier / Contact Person Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={quickSupplierForm.name}
                  onChange={(e) => setQuickSupplierForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. David Kiprono"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Company / Trading Name
                  </label>
                  <input
                    type="text"
                    value={quickSupplierForm.company_name}
                    onChange={(e) => setQuickSupplierForm((prev) => ({ ...prev, company_name: e.target.value }))}
                    placeholder="e.g. Savannah Leatherworks"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Payment Terms
                  </label>
                  <select
                    value={quickSupplierForm.payment_terms}
                    onChange={(e) => setQuickSupplierForm((prev) => ({ ...prev, payment_terms: e.target.value as SupplierPaymentTerms }))}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="Consignment Sale">Consignment Sale (Pay on Sale)</option>
                    <option value="Immediate">Immediate (On Delivery)</option>
                    <option value="Net 15">Net 15 (15 Days)</option>
                    <option value="Net 30">Net 30 (30 Days)</option>
                    <option value="Bi-weekly">Bi-weekly (Every 2 Weeks)</option>
                    <option value="Monthly">Monthly (End of Month)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={quickSupplierForm.phone}
                    onChange={(e) => setQuickSupplierForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="+254 7..."
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    M-PESA Number / Till / Paybill
                  </label>
                  <input
                    type="text"
                    value={quickSupplierForm.mpesa_number}
                    onChange={(e) => setQuickSupplierForm((prev) => ({ ...prev, mpesa_number: e.target.value }))}
                    placeholder="e.g. 522522 / Acc: 123"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowQuickAddSupplierModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingQuickSupplier}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSavingQuickSupplier ? 'Saving...' : 'Register & Select Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
