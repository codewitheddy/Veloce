/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, DragEvent, ChangeEvent, useMemo, useEffect } from 'react';
import { Product } from '../types';
import { generateSku } from '../utils/productUtils';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  Check,
  AlertCircle,
  HelpCircle,
  Trash2,
  Settings2,
  Sparkles,
  Info,
  CheckCircle2,
  ArrowRight,
  Shuffle,
  Columns,
  SlidersHorizontal,
  RefreshCw,
  Layers,
  Table,
  CheckSquare,
  AlertTriangle,
  Eye,
  FileText
} from 'lucide-react';

export type ProductAttributeKey =
  | 'name'
  | 'price'
  | 'sku'
  | 'type'
  | 'stock'
  | 'lowStockThreshold'
  | 'category'
  | 'description'
  | 'imageUrl'
  | 'tags'
  | 'status'
  | 'ignore';

export interface AttributeDefinition {
  key: ProductAttributeKey;
  label: string;
  required?: boolean;
  badge?: string;
  description: string;
}

export const PRODUCT_ATTRIBUTES: AttributeDefinition[] = [
  { key: 'name', label: 'Product Name / Title', required: true, badge: 'Required', description: 'Product title (e.g., Desk Chair)' },
  { key: 'price', label: 'Price (KSh)', required: true, badge: 'Required', description: 'Numeric selling price in KSh' },
  { key: 'sku', label: 'SKU Code', description: 'Unique stock keeping unit identifier' },
  { key: 'type', label: 'Product Type', description: 'physical, digital, or service' },
  { key: 'stock', label: 'Stock Level / Quantity', description: 'Inventory quantity for physical items' },
  { key: 'lowStockThreshold', label: 'Reorder Threshold', description: 'Low stock notification trigger count' },
  { key: 'category', label: 'Category / Department', description: 'Store catalog group' },
  { key: 'description', label: 'Description', description: 'Detailed product specifications' },
  { key: 'imageUrl', label: 'Image URL', description: 'Direct image link URL' },
  { key: 'tags', label: 'Tags / Keywords', description: 'Comma-separated keywords' },
  { key: 'status', label: 'Status', description: 'Active, Draft, Inactive, or Archived' },
  { key: 'ignore', label: '-- Do Not Import (Ignore Column) --', description: 'Skip this column' },
];

// Smart auto-detection utility to match CSV headers to product attributes
export function autoDetectColumnMapping(headers: string[]): Record<string, ProductAttributeKey> {
  const mapping: Record<string, ProductAttributeKey> = {};
  const assigned = new Set<ProductAttributeKey>();

  headers.forEach((header) => {
    const norm = header.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

    let detected: ProductAttributeKey = 'ignore';

    if (!assigned.has('sku') && (norm.includes('sku') || norm.includes('code') || norm.includes('itemid') || norm.includes('productid') || norm.includes('barcode'))) {
      detected = 'sku';
    } else if (!assigned.has('name') && (norm.includes('name') || norm.includes('title') || norm.includes('productname') || norm.includes('itemname'))) {
      detected = 'name';
    } else if (!assigned.has('price') && (norm.includes('price') || norm.includes('cost') || norm.includes('amount') || norm.includes('ksh') || norm.includes('unitprice') || norm.includes('msrp') || norm.includes('rrp'))) {
      detected = 'price';
    } else if (!assigned.has('type') && (norm === 'type' || norm.includes('producttype') || norm.includes('itemtype'))) {
      detected = 'type';
    } else if (!assigned.has('stock') && (norm.includes('stock') || norm.includes('qty') || norm.includes('quantity') || norm.includes('count') || norm.includes('inventory') || norm.includes('units'))) {
      detected = 'stock';
    } else if (!assigned.has('lowStockThreshold') && (norm.includes('threshold') || norm.includes('reorder') || norm.includes('minstock') || norm.includes('lowstock'))) {
      detected = 'lowStockThreshold';
    } else if (!assigned.has('category') && (norm.includes('category') || norm.includes('cat') || norm.includes('department') || norm.includes('dept') || norm.includes('group'))) {
      detected = 'category';
    } else if (!assigned.has('description') && (norm.includes('description') || norm.includes('desc') || norm.includes('summary') || norm.includes('details') || norm.includes('overview') || norm.includes('notes'))) {
      detected = 'description';
    } else if (!assigned.has('imageUrl') && (norm.includes('image') || norm.includes('img') || norm.includes('photo') || norm.includes('url') || norm.includes('graphic') || norm.includes('picture') || norm.includes('thumb'))) {
      detected = 'imageUrl';
    } else if (!assigned.has('tags') && (norm.includes('tag') || norm.includes('keyword') || norm.includes('label'))) {
      detected = 'tags';
    } else if (!assigned.has('status') && (norm.includes('status') || norm.includes('state') || norm.includes('visibility') || norm.includes('active'))) {
      detected = 'status';
    }

    if (detected !== 'ignore') {
      assigned.add(detected);
    }
    mapping[header] = detected;
  });

  return mapping;
}

// Smart matching utility to map raw CSV categories to existing ones
function findBestCategoryMatch(rawCat: string, availableCats: string[]): string {
  const normalizedRaw = rawCat.trim().toLowerCase();
  if (!normalizedRaw) return 'Workspace';

  // 1. Exact match (case insensitive)
  const exactMatch = availableCats.find(c => c.toLowerCase() === normalizedRaw);
  if (exactMatch) return exactMatch;

  // 2. Substring or word match
  const rawWords = normalizedRaw.split(/\s+/);
  for (const cat of availableCats) {
    const catLower = cat.toLowerCase();
    if (catLower.includes(normalizedRaw) || normalizedRaw.includes(catLower)) {
      return cat;
    }
    const catWords = catLower.split(/\s+/);
    const hasOverlap = rawWords.some(rw => catWords.some(cw => cw.length > 2 && rw === cw));
    if (hasOverlap) {
      return cat;
    }
  }

  // 3. Edit distance for fuzzy matching
  let bestMatch = 'Workspace';
  let minDistance = Infinity;

  const getEditDistance = (a: string, b: string): number => {
    const matrix: number[][] = [];
    for (let i = 0; i <= a.length; i++) matrix[i] = [i];
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        if (a[i - 1] === b[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    return matrix[a.length][b.length];
  };

  for (const cat of availableCats) {
    const distance = getEditDistance(normalizedRaw, cat.toLowerCase());
    if (distance < minDistance) {
      minDistance = distance;
      bestMatch = cat;
    }
  }

  if (minDistance < Math.max(3, normalizedRaw.length / 2)) {
    return bestMatch;
  }

  return availableCats[0] || 'Workspace';
}

interface BulkProductUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProduct: (newProduct: Product) => void;
  products: Product[];
  onUpdateProductDetails?: (id: string, updatedFields: Partial<Product>) => void;
  availableCategories: string[];
  onAddCategory?: (category: string) => void;
}

interface ParsedRow {
  index: number;
  raw: Record<string, string>;
  product: Partial<Product>;
  warnings: string[];
  errors: string[];
  isValid: boolean;
}

export default function BulkProductUploadModal({
  isOpen,
  onClose,
  onAddProduct,
  products,
  onUpdateProductDetails,
  availableCategories,
  onAddCategory
}: BulkProductUploadModalProps) {
  if (!isOpen) return null;

  const [dragActive, setDragActive] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<'create_new' | 'update_existing'>('update_existing');
  const [rawLines, setRawLines] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, ProductAttributeKey>>({});
  const [activeStepTab, setActiveStepTab] = useState<'mapping' | 'categories' | 'preview'>('mapping');
  const [rowFilter, setRowFilter] = useState<'all' | 'ready' | 'warnings' | 'blockers'>('all');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  const [categoryMapping, setCategoryMapping] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reactive CSV Headers computed from parsed rawLines
  const headers = useMemo(() => {
    if (rawLines.length === 0) return [];
    return rawLines[0].map(h => h.trim());
  }, [rawLines]);

  // When rawLines changes, auto-detect column mapping
  useEffect(() => {
    if (headers.length > 0) {
      setColumnMapping(autoDetectColumnMapping(headers));
    } else {
      setColumnMapping({});
    }
  }, [headers]);

  // Parse raw categories and counts from the CSV data according to current category column mapping
  const rawCategoryCounts = useMemo(() => {
    if (rawLines.length < 2) return {};
    const fileHeaders = rawLines[0].map(h => h.trim());
    const dataRows = rawLines.slice(1);

    const categoryHeaders = fileHeaders.filter(h => columnMapping[h] === 'category');
    
    const counts: Record<string, number> = {};
    dataRows.forEach((rowCells) => {
      let cat = '';
      for (const h of categoryHeaders) {
        const idx = fileHeaders.indexOf(h);
        if (idx !== -1 && rowCells[idx] !== undefined && rowCells[idx].trim() !== '') {
          cat = rowCells[idx].trim();
          break;
        }
      }
      if (!cat) {
        // Fallback to searching for category variant if column mapping hasn't set one
        const fallbackIdx = fileHeaders.findIndex(h => h.toLowerCase().includes('cat'));
        if (fallbackIdx !== -1 && rowCells[fallbackIdx]) {
          cat = rowCells[fallbackIdx].trim();
        }
      }
      const finalCat = cat || 'Workspace';
      counts[finalCat] = (counts[finalCat] || 0) + 1;
    });
    return counts;
  }, [rawLines, columnMapping]);

  // Set up automatic category mappings whenever rawCategoryCounts or availableCategories change
  useEffect(() => {
    if (rawLines.length < 2) {
      setCategoryMapping({});
      return;
    }

    const initialMapping: Record<string, string> = {};
    Object.keys(rawCategoryCounts).forEach((rawCat) => {
      const bestMatch = findBestCategoryMatch(rawCat, availableCategories);
      initialMapping[rawCat] = bestMatch;
    });
    setCategoryMapping(initialMapping);
  }, [rawLines, availableCategories, rawCategoryCounts]);

  // CSV Template download
  const handleDownloadTemplate = () => {
    const csvContent = [
      ["SKU", "Name", "Type", "Price (KSh)", "Stock Level", "Reorder Threshold", "Category", "Description", "Image URL", "Tags", "Status"].join(','),
      ["VEL-CHR-OAK", "Oak Ergonomic Desk Chair", "physical", "24500", "15", "5", "Furniture", "Hand-crafted American white oak ergonomic office desk chair.", "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&q=80&w=800", "chair,office,wood,furniture", "Active"],
      ["VEL-DSK-MAT", "Matte Slate Desk Pad", "physical", "4500", "42", "10", "Workspace", "Premium double-sided vegan leather desktop writing mat.", "", "workspace,desk-pad", "Active"],
      ["VEL-TMP-DSG", "Minimalist Design Grid Template", "digital", "1200", "", "", "Digital Assets", "High-fidelity modular responsive wireframing templates.", "", "templates,wireframe,design", "Active"],
      ["VEL-SVC-CON", "1-Hour Ergonomic Consult", "service", "8500", "", "", "Publications", "Tailored physical and spatial optimization consultancy session.", "", "consulting,wellness", "Draft"]
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'veloce_product_upload_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Robust CSV Parser
  const parseCSV = (text: string): string[][] => {
    const lines: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let currentVal = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentVal += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(currentVal);
        currentVal = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        row.push(currentVal);
        lines.push(row);
        row = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    if (currentVal || row.length > 0) {
      row.push(currentVal);
      lines.push(row);
    }
    return lines.filter(r => r.some(cell => cell.trim() !== ''));
  };

  const processFileContents = (text: string) => {
    const rawLinesParsed = parseCSV(text);
    if (rawLinesParsed.length < 2) {
      alert("Invalid CSV format. The file must include a header row and at least one product row.");
      return;
    }
    setRawLines(rawLinesParsed);
    setActiveStepTab('mapping');
  };

  // Helper to extract sample value from uploaded CSV rows for a given column header index
  const getSampleValue = (cellIndex: number): string => {
    if (rawLines.length < 2) return '';
    for (let r = 1; r < Math.min(6, rawLines.length); r++) {
      const cellVal = rawLines[r][cellIndex];
      if (cellVal && cellVal.trim()) {
        return cellVal.trim();
      }
    }
    return '';
  };

  // Reactive ParsedRows computed from rawLines, columnMapping, and importMode selection
  const parsedRows = useMemo(() => {
    if (rawLines.length < 2) return [];

    const fileHeaders = rawLines[0].map(h => h.trim());
    const dataRows = rawLines.slice(1);

    return dataRows.map((rowCells, rowIndex) => {
      // Build raw object map for reference
      const rawRecord: Record<string, string> = {};
      fileHeaders.forEach((header, cellIndex) => {
        rawRecord[header] = rowCells[cellIndex] !== undefined ? rowCells[cellIndex].trim() : '';
      });

      // Helper to extract field value according to current columnMapping
      const getAttrVal = (targetAttr: ProductAttributeKey): string => {
        const matchingHeaders = fileHeaders.filter(h => columnMapping[h] === targetAttr);
        for (const h of matchingHeaders) {
          const idx = fileHeaders.indexOf(h);
          if (idx !== -1 && rowCells[idx] !== undefined && rowCells[idx].trim() !== '') {
            return rowCells[idx].trim();
          }
        }
        return '';
      };

      const rawSku = getAttrVal('sku');
      const rawName = getAttrVal('name');
      const rawType = getAttrVal('type').toLowerCase();
      const rawPrice = getAttrVal('price');
      const rawStock = getAttrVal('stock');
      const rawThreshold = getAttrVal('lowStockThreshold');
      const rawCategory = getAttrVal('category');
      const rawDesc = getAttrVal('description');
      const rawImgUrl = getAttrVal('imageUrl');
      const rawTags = getAttrVal('tags');
      const rawStatus = getAttrVal('status');

      const errors: string[] = [];
      const warnings: string[] = [];

      // Validate Type
      let parsedType: 'physical' | 'digital' | 'service' = 'physical';
      if (rawType === 'digital') {
        parsedType = 'digital';
      } else if (rawType === 'service') {
        parsedType = 'service';
      } else if (rawType && rawType !== 'physical') {
        warnings.push(`Unrecognized product type "${rawType}". Defaulting to "physical".`);
      }

      // Validate Required Field: Name
      if (!rawName) {
        errors.push("Missing required attribute: Product Name.");
      }

      // Validate Required Field: Price
      const parsedPrice = parseFloat(rawPrice.replace(/[^\d.]/g, ''));
      if (isNaN(parsedPrice)) {
        errors.push("Missing or invalid numeric price.");
      } else if (parsedPrice <= 0) {
        errors.push("Price must be a positive number.");
      }

      // Validate Stock
      let parsedStock: number | null = null;
      if (parsedType === 'physical') {
        const stockNum = parseInt(rawStock, 10);
        if (isNaN(stockNum)) {
          parsedStock = 0;
          warnings.push("Physical item missing Stock Level. Defaulting stock to 0.");
        } else {
          parsedStock = Math.max(0, stockNum);
        }
      }

      // Validate SKU and duplicate checks
      let generatedSku = rawSku;
      if (!generatedSku) {
        generatedSku = generateSku(rawCategory || 'Workspace', rawName || 'Item', products);
        warnings.push(`Missing SKU. Auto-generated SKU Code: "${generatedSku}".`);
      } else {
        const existingProduct = products.find(p => p.sku && p.sku.toLowerCase() === generatedSku.toLowerCase());
        if (existingProduct) {
          if (importMode === 'update_existing') {
            warnings.push(`SKU "${generatedSku}" exists in database. Product will be UPDATED/MERGED.`);
          } else {
            warnings.push(`SKU "${generatedSku}" already exists. Importing will create a duplicate code.`);
          }
        }
      }

      // Validate Reorder Threshold
      let parsedThreshold = 5;
      if (parsedType === 'physical') {
        const thresholdNum = parseInt(rawThreshold, 10);
        if (!isNaN(thresholdNum)) {
          parsedThreshold = Math.max(0, thresholdNum);
        }
      }

      // Validate Status
      let parsedStatus: 'Active' | 'Inactive' | 'Draft' | 'Archived' = 'Active';
      const normStatus = rawStatus.trim().toLowerCase();
      if (normStatus === 'inactive') {
        parsedStatus = 'Inactive';
      } else if (normStatus === 'draft') {
        parsedStatus = 'Draft';
      } else if (normStatus === 'archived') {
        parsedStatus = 'Archived';
      } else if (rawStatus && normStatus !== 'active') {
        warnings.push(`Status "${rawStatus}" not recognized. Defaulting to "Active".`);
      }

      // Resolve category using smart mapping
      const rawCatStr = rawCategory.trim() || 'Workspace';
      let resolvedCategory = 'Workspace';
      if (categoryMapping[rawCatStr]) {
        if (categoryMapping[rawCatStr] === '__create_new__') {
          resolvedCategory = rawCatStr;
        } else {
          resolvedCategory = categoryMapping[rawCatStr];
        }
      } else {
        resolvedCategory = findBestCategoryMatch(rawCatStr, availableCategories);
      }

      // Build product partial
      const product: Partial<Product> = {
        id: `prod-bulk-${Date.now()}-${rowIndex}-${Math.floor(Math.random() * 1000)}`,
        sku: generatedSku,
        name: rawName,
        type: parsedType,
        price: parsedPrice,
        stock: parsedStock,
        lowStockThreshold: parsedType === 'physical' ? parsedThreshold : undefined,
        category: resolvedCategory,
        description: rawDesc || `High-quality design item for modern workflow configurations. Specially crafted for spatial ergonomics.`,
        imageUrl: rawImgUrl || 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&q=80&w=800',
        tags: rawTags ? rawTags.split(',').map(t => t.trim()).filter(Boolean) : [resolvedCategory.toLowerCase() || 'workspace'],
        status: parsedStatus,
        rating: 5.0,
        reviewsCount: 0,
        reviews: []
      };

      return {
        index: rowIndex,
        raw: rawRecord,
        product,
        warnings,
        errors,
        isValid: errors.length === 0
      };
    });
  }, [rawLines, columnMapping, products, importMode, categoryMapping, availableCategories]);

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv')) {
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target && typeof event.target.result === 'string') {
            processFileContents(event.target.result);
          }
        };
        reader.readAsText(file);
      } else {
        alert('Invalid file format. Please drop a valid .csv spreadsheet file.');
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && typeof event.target.result === 'string') {
          processFileContents(event.target.result);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleTriggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Import products to main memory
  const handleExecuteImport = () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      alert("No valid products to import. Please check column mappings and resolve required validation errors.");
      return;
    }

    setIsImporting(true);
    
    setTimeout(() => {
      let addedCount = 0;
      let updatedCount = 0;
      const uniqueNewCategories = new Set<string>();

      validRows.forEach((row) => {
        const rowSku = row.product.sku;
        const existingProduct = rowSku ? products.find(p => p.sku && p.sku.toLowerCase() === rowSku.toLowerCase()) : null;

        if (row.product.category) {
          uniqueNewCategories.add(row.product.category);
        }

        if (existingProduct && importMode === 'update_existing' && onUpdateProductDetails) {
          const updatedFields: Partial<Product> = {
            name: row.product.name,
            type: row.product.type,
            price: row.product.price,
            category: row.product.category,
            description: row.product.description,
            imageUrl: row.product.imageUrl,
            tags: row.product.tags,
            status: row.product.status,
          };
          if (row.product.type === 'physical') {
            updatedFields.stock = row.product.stock;
            updatedFields.lowStockThreshold = row.product.lowStockThreshold;
          } else {
            updatedFields.stock = null;
          }
          
          onUpdateProductDetails(existingProduct.id, updatedFields);
          updatedCount++;
        } else {
          onAddProduct(row.product as Product);
          addedCount++;
        }
      });

      if (onAddCategory) {
        uniqueNewCategories.forEach(cat => {
          onAddCategory(cat);
        });
      }

      setIsImporting(false);
      let successString = '';
      if (addedCount > 0 && updatedCount > 0) {
        successString = `Bulk import complete! Successfully added ${addedCount} new products and updated ${updatedCount} existing items.`;
      } else if (updatedCount > 0) {
        successString = `Bulk import complete! Successfully updated ${updatedCount} existing catalog items.`;
      } else {
        successString = `Bulk import complete! Successfully registered ${addedCount} new products in catalog.`;
      }
      setSuccessMsg(successString);
      
      setTimeout(() => {
        setSuccessMsg('');
        setRawLines([]);
        setFileName('');
        onClose();
      }, 3000);
    }, 1000);
  };

  // Metrics calculation
  const totalCount = parsedRows.length;
  const validCount = parsedRows.filter(r => r.isValid).length;
  const errorCount = parsedRows.filter(r => !r.isValid).length;
  const warningCount = parsedRows.filter(r => r.warnings.length > 0 && r.isValid).length;

  const isNameMapped = Object.values(columnMapping).includes('name');
  const isPriceMapped = Object.values(columnMapping).includes('price');
  const isRequiredAttributesMapped = isNameMapped && isPriceMapped;

  // Filtered rows for audit preview table
  const filteredRowsForPreview = useMemo(() => {
    if (rowFilter === 'ready') return parsedRows.filter(r => r.isValid && r.warnings.length === 0);
    if (rowFilter === 'warnings') return parsedRows.filter(r => r.warnings.length > 0 && r.isValid);
    if (rowFilter === 'blockers') return parsedRows.filter(r => !r.isValid);
    return parsedRows;
  }, [parsedRows, rowFilter]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 font-sans overflow-y-auto">
      <div className="relative bg-white dark:bg-gray-950 rounded-2xl border border-gray-150 dark:border-gray-850 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col my-4">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-850 p-5 shrink-0 bg-slate-900 text-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm text-white uppercase tracking-wider flex items-center gap-2">
                Bulk CSV Product Import & Column Mapping
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5 font-light">
                Upload CSV catalog spreadsheets, map custom column attributes, align categories, and batch register inventory.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            id="btn-close-csv-bulk-modal"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Modal Content Container */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6 text-left">
          
          {successMsg && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 p-4 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-400 flex items-center gap-2.5 animate-in slide-in-from-top duration-200">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Intro Guidance / Upload View */}
          {totalCount === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="md:col-span-2 flex flex-col gap-3">
                <span className="text-[11px] font-black font-mono text-gray-400 uppercase tracking-wider">CSV Upload & Attribute Mapping Overview</span>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-light">
                  Upload any CSV catalog file. Our intelligent mapper automatically parses column headers, maps required attributes like <strong>Name</strong> and <strong>Price</strong>, resolves stock quantities, and matches categories.
                </p>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="rounded-xl border border-gray-150 bg-gray-50/50 p-3.5">
                    <span className="block font-bold text-[11px] text-gray-800 dark:text-gray-200 mb-1">Required Product Fields:</span>
                    <ul className="text-[10px] space-y-1 text-gray-500 font-mono">
                      <li>• <strong className="text-indigo-600 font-semibold">Name / Title</strong> (Text name)</li>
                      <li>• <strong className="text-indigo-600 font-semibold">Price</strong> (Numeric price in KSh)</li>
                    </ul>
                  </div>
                  <div className="rounded-xl border border-gray-150 bg-gray-50/50 p-3.5">
                    <span className="block font-bold text-[11px] text-gray-800 dark:text-gray-200 mb-1">Optional Mapped Fields:</span>
                    <ul className="text-[10px] space-y-0.5 text-gray-500 font-mono">
                      <li>• <strong className="text-gray-700 dark:text-gray-300">SKU Code</strong> & Product Type</li>
                      <li>• <strong className="text-gray-700 dark:text-gray-300">Stock Level</strong> & Threshold</li>
                      <li>• <strong className="text-gray-700 dark:text-gray-300">Category</strong> & Description</li>
                      <li>• <strong className="text-gray-700 dark:text-gray-300">Image URL</strong>, Tags & Status</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="md:col-span-1 rounded-2xl border border-indigo-100 bg-indigo-50/20 p-5 flex flex-col justify-between">
                <div>
                  <span className="block text-[10px] font-black font-mono text-indigo-600 uppercase tracking-widest mb-2">Verified CSV Template</span>
                  <p className="text-[11px] text-gray-500 font-light leading-relaxed">
                    Download our sample CSV spreadsheet prefilled with example products, SKUs, prices, stock levels, and tags.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="mt-4 w-full h-9.5 rounded-lg border border-indigo-300 bg-white text-indigo-700 hover:bg-indigo-50 font-semibold text-xs cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                  id="btn-download-csv-template"
                >
                  <Download className="h-4 w-4 text-indigo-600" /> Download CSV Template
                </button>
              </div>

            </div>
          )}

          {/* Upload Drop Zone */}
          {totalCount === 0 ? (
            <div
              className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                dragActive
                  ? "border-indigo-500 bg-indigo-50/20 shadow-inner"
                  : "border-gray-200 dark:border-gray-800 hover:border-indigo-400 bg-gray-50/30"
              }`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={handleTriggerFileInput}
              id="csv-drop-zone-area"
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".csv"
                onChange={handleFileChange}
              />
              <div className="h-12 w-12 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Upload className="h-6 w-6" />
              </div>
              <div className="text-center">
                <span className="block font-bold text-xs text-gray-800 dark:text-gray-200">
                  Drag and drop your CSV spreadsheet file here
                </span>
                <span className="block text-[10px] text-gray-400 mt-1 font-mono">
                  Supports standard CSV files (.csv). Header row will be auto-mapped in the next step.
                </span>
              </div>
            </div>
          ) : (
            /* Parsed File Navigation & Step Workspaces */
            <div className="flex flex-col gap-5">
              
              {/* File Summary Bar & Statistics */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-gray-150 bg-slate-50/80 dark:bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-200">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-gray-900 dark:text-white truncate max-w-xs">{fileName}</span>
                      <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
                        {headers.length} CSV Columns
                      </span>
                    </div>
                    <span className="block text-[10px] font-mono text-gray-400 mt-0.5">
                      Headers: {headers.join(', ')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-center shrink-0">
                  <div className="px-3 py-1 bg-white border border-gray-200 rounded-lg shadow-3xs">
                    <span className="block text-xs font-black font-mono text-gray-800">{totalCount}</span>
                    <span className="block text-[8px] font-mono text-gray-400 uppercase tracking-widest font-bold">Total Rows</span>
                  </div>
                  <div className="px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-lg shadow-3xs">
                    <span className="block text-xs font-black font-mono text-emerald-700">{validCount}</span>
                    <span className="block text-[8px] font-mono text-emerald-600 uppercase tracking-widest font-bold">Ready</span>
                  </div>
                  {warningCount > 0 && (
                    <div className="px-3 py-1 bg-amber-50 border border-amber-200 rounded-lg shadow-3xs">
                      <span className="block text-xs font-black font-mono text-amber-700">{warningCount}</span>
                      <span className="block text-[8px] font-mono text-amber-600 uppercase tracking-widest font-bold">Warnings</span>
                    </div>
                  )}
                  {errorCount > 0 && (
                    <div className="px-3 py-1 bg-rose-50 border border-rose-200 rounded-lg shadow-3xs">
                      <span className="block text-xs font-black font-mono text-rose-700">{errorCount}</span>
                      <span className="block text-[8px] font-mono text-rose-600 uppercase tracking-widest font-bold">Blockers</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setRawLines([]);
                      setFileName('');
                    }}
                    className="ml-2 px-3 py-1.5 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold rounded-lg cursor-pointer transition-colors flex items-center gap-1 shrink-0"
                    title="Clear uploaded spreadsheet and upload another file"
                    id="btn-reset-csv-upload"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Reset File
                  </button>
                </div>
              </div>

              {/* Workflow Steps Tabs */}
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveStepTab('mapping')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      activeStepTab === 'mapping'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                    id="tab-csv-column-mapping"
                  >
                    <Columns className="h-3.5 w-3.5" /> 1. Column Mapping Studio
                    {!isRequiredAttributesMapped && (
                      <span className="h-2 w-2 rounded-full bg-rose-400 animate-ping" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveStepTab('categories')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      activeStepTab === 'categories'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                    id="tab-csv-category-mapping"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> 2. Category Alignment ({Object.keys(rawCategoryCounts).length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveStepTab('preview')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      activeStepTab === 'preview'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                    id="tab-csv-preview-audit"
                  >
                    <Table className="h-3.5 w-3.5" /> 3. Data Preview & Audit ({validCount} Valid)
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-gray-400">Behavior:</span>
                  <select
                    value={importMode}
                    onChange={(e) => setImportMode(e.target.value as any)}
                    className="text-[11px] font-bold bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-2.5 py-1 text-gray-800 dark:text-gray-200 cursor-pointer focus:outline-hidden"
                  >
                    <option value="update_existing">Update Existing SKU & Add New</option>
                    <option value="create_new">Create New / Duplicates</option>
                  </select>
                </div>
              </div>

              {/* STEP 1: COLUMN MAPPING STUDIO */}
              {activeStepTab === 'mapping' && (
                <div className="p-5 rounded-2xl border border-indigo-100 dark:border-indigo-950 bg-slate-50 dark:bg-slate-900 shadow-xs flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-150 dark:border-gray-850">
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <SlidersHorizontal className="h-4 w-4 text-indigo-600" /> CSV Header to Product Attribute Column Mapping
                      </h4>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                        Match each detected column header from <strong>"{fileName}"</strong> to its corresponding product attribute.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setColumnMapping(autoDetectColumnMapping(headers))}
                        className="px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                        title="Re-run intelligent auto-detection on headers"
                      >
                        <RefreshCw className="h-3 w-3" /> Auto-Map Headers
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const resetObj: Record<string, ProductAttributeKey> = {};
                          headers.forEach(h => { resetObj[h] = 'ignore'; });
                          setColumnMapping(resetObj);
                        }}
                        className="px-2.5 py-1 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 text-[10px] font-semibold transition cursor-pointer"
                        title="Set all columns to ignore"
                      >
                        Clear Mappings
                      </button>
                    </div>
                  </div>

                  {/* Required Field Check Banner */}
                  {!isRequiredAttributesMapped ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                      <AlertTriangle className="h-4.5 w-4.5 text-amber-600 shrink-0" />
                      <span>
                        <strong>Action Required:</strong> Please ensure at least one CSV column is mapped to <strong className="underline">Product Name / Title</strong> and <strong className="underline">Price (KSh)</strong>.
                      </span>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2 font-mono">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>
                        ✅ Required attributes mapped! Name and Price columns are assigned.
                      </span>
                    </div>
                  )}

                  {/* Column Mapping Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[360px] overflow-y-auto pr-1">
                    {headers.map((header, colIndex) => {
                      const currentAttr = columnMapping[header] || 'ignore';
                      const sampleVal = getSampleValue(colIndex);
                      const isReq = currentAttr === 'name' || currentAttr === 'price';

                      return (
                        <div
                          key={header}
                          className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                            currentAttr !== 'ignore'
                              ? isReq
                                ? "bg-indigo-50/30 border-indigo-300 dark:border-indigo-900"
                                : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800"
                              : "bg-gray-50/40 border-gray-150 dark:border-gray-850 opacity-80"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5 font-mono">
                                <span className="h-5 w-5 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] flex items-center justify-center font-bold text-slate-700 dark:text-slate-300">
                                  {colIndex + 1}
                                </span>
                                {header}
                              </span>
                              {sampleVal ? (
                                <span className="text-[10px] text-gray-500 font-mono truncate max-w-[220px]" title={`Sample: "${sampleVal}"`}>
                                  Sample: <strong className="text-gray-700 dark:text-gray-300">"{sampleVal}"</strong>
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-400 font-mono italic">No sample value</span>
                              )}
                            </div>

                            <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${
                              currentAttr === 'name' || currentAttr === 'price'
                                ? 'bg-indigo-600 text-white'
                                : currentAttr !== 'ignore'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                                : 'bg-gray-200 dark:bg-gray-800 text-gray-500'
                            }`}>
                              {currentAttr === 'ignore' ? 'Ignored' : PRODUCT_ATTRIBUTES.find(a => a.key === currentAttr)?.label || currentAttr}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-850">
                            <ArrowRight className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                            <select
                              value={currentAttr}
                              onChange={(e) => {
                                setColumnMapping(prev => ({
                                  ...prev,
                                  [header]: e.target.value as ProductAttributeKey
                                }));
                              }}
                              className="w-full text-xs font-semibold bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-hidden focus:border-indigo-500 cursor-pointer shadow-3xs"
                            >
                              <optgroup label="Required Product Attributes">
                                <option value="name">Product Name / Title (Required)</option>
                                <option value="price">Price in KSh (Required)</option>
                              </optgroup>
                              <optgroup label="Optional Catalog Attributes">
                                <option value="sku">SKU Code</option>
                                <option value="type">Product Type (physical/digital/service)</option>
                                <option value="stock">Stock Level / Quantity</option>
                                <option value="lowStockThreshold">Reorder Threshold</option>
                                <option value="category">Category / Department</option>
                                <option value="description">Description</option>
                                <option value="imageUrl">Image URL</option>
                                <option value="tags">Tags / Keywords</option>
                                <option value="status">Status (Active/Draft/Inactive)</option>
                              </optgroup>
                              <optgroup label="Skip Column">
                                <option value="ignore">-- Do Not Import (Ignore Column) --</option>
                              </optgroup>
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 2: CATEGORY ALIGNMENT */}
              {activeStepTab === 'categories' && (
                <div className="p-5 rounded-2xl border border-indigo-100 dark:border-indigo-950 bg-slate-50 dark:bg-slate-900 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-4">
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" /> Intelligent Category Auto-Mapping
                      </h4>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-light mt-0.5">
                        Automatically mapped raw CSV categories to your catalog's existing categories. Review or adjust mapping definitions below.
                      </p>
                    </div>
                    <span className="text-[9px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-900 self-start">
                      {Object.keys(rawCategoryCounts).length} Raw Categories Detected
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[280px] overflow-y-auto pr-1">
                    {Object.entries(rawCategoryCounts).map(([rawCat, count]) => {
                      const currentMapped = categoryMapping[rawCat] || '';
                      
                      return (
                        <div key={rawCat} className="flex items-center justify-between p-3 rounded-xl border border-gray-150 dark:border-gray-850 bg-white dark:bg-gray-950 hover:shadow-xs transition-shadow">
                          <div className="flex flex-col gap-0.5 max-w-[45%]">
                            <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate" title={rawCat}>
                              {rawCat}
                            </span>
                            <span className="text-[9px] font-mono text-gray-400">
                              {count} {count === 1 ? 'item' : 'items'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 grow justify-center px-1">
                            <ArrowRight className="h-3.5 w-3.5 text-gray-300 dark:text-gray-700 shrink-0" />
                          </div>

                          <div className="w-[50%] shrink-0">
                            <select
                              value={currentMapped}
                              onChange={(e) => {
                                setCategoryMapping(prev => ({
                                  ...prev,
                                  [rawCat]: e.target.value
                                }));
                              }}
                              className="w-full text-[11px] font-semibold bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-2.5 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-hidden focus:border-indigo-500 transition-colors cursor-pointer"
                            >
                              <optgroup label="Map to Existing Category">
                                {availableCategories.map(existingCat => (
                                  <option key={existingCat} value={existingCat}>
                                    {existingCat}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Custom Options">
                                <option value="__create_new__">
                                  + Keep original (Create new: "{rawCat}")
                                </option>
                              </optgroup>
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 3: DATA PREVIEW & AUDIT TABLE */}
              {activeStepTab === 'preview' && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/50 p-2.5 rounded-xl border border-gray-150">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-200">Filter Rows:</span>
                      <div className="flex bg-white dark:bg-gray-900 p-0.5 rounded-lg border border-gray-200 dark:border-gray-800">
                        <button
                          type="button"
                          onClick={() => setRowFilter('all')}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded cursor-pointer ${
                            rowFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          All Rows ({parsedRows.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setRowFilter('ready')}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded cursor-pointer ${
                            rowFilter === 'ready' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          Ready ({parsedRows.filter(r => r.isValid && r.warnings.length === 0).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setRowFilter('warnings')}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded cursor-pointer ${
                            rowFilter === 'warnings' ? 'bg-amber-600 text-white' : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          Warnings ({parsedRows.filter(r => r.warnings.length > 0 && r.isValid).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setRowFilter('blockers')}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded cursor-pointer ${
                            rowFilter === 'blockers' ? 'bg-rose-600 text-white' : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          Blockers ({errorCount})
                        </button>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono text-gray-400">
                      Showing {filteredRowsForPreview.length} of {parsedRows.length} parsed items
                    </span>
                  </div>

                  {errorCount > 0 && (
                    <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />
                      <div>
                        <strong className="font-bold">Notice:</strong> {errorCount} row(s) contain missing required fields (Name or Price). Rows marked with blockers will be skipped automatically during execution.
                      </div>
                    </div>
                  )}

                  <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-gray-950">
                    <div className="max-h-[340px] overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b border-gray-200 text-[10px] font-mono text-gray-600 font-bold uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs">
                            <th className="py-2.5 px-3 w-10 text-center">Row</th>
                            <th className="py-2.5 px-3">SKU Code</th>
                            <th className="py-2.5 px-3">Product Name</th>
                            <th className="py-2.5 px-3">Type</th>
                            <th className="py-2.5 px-3 text-right">Price (KSh)</th>
                            <th className="py-2.5 px-3 text-center">Stock</th>
                            <th className="py-2.5 px-3">Category</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Validation Audit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-150 text-[11px]">
                          {filteredRowsForPreview.map((row) => {
                            const hasErrors = row.errors.length > 0;
                            const hasWarnings = row.warnings.length > 0;
                            return (
                              <tr
                                key={row.index}
                                className={`transition-colors ${
                                  hasErrors
                                    ? "bg-rose-50/20 hover:bg-rose-50/30"
                                    : hasWarnings
                                    ? "bg-amber-50/15 hover:bg-amber-50/25"
                                    : "hover:bg-slate-50/40"
                                }`}
                              >
                                <td className="py-2 px-3 text-center font-mono text-gray-400 font-bold">{row.index + 1}</td>
                                <td className="py-2 px-3 font-mono font-bold text-gray-800 dark:text-gray-200">
                                  {row.product.sku || 'N/A'}
                                </td>
                                <td className="py-2 px-3 font-semibold text-gray-900 dark:text-white max-w-[150px] truncate">
                                  {row.product.name || <span className="text-rose-500 font-mono font-bold">[Missing Name]</span>}
                                </td>
                                <td className="py-2 px-3">
                                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold font-mono uppercase ${
                                    row.product.type === 'digital' ? 'bg-purple-100 text-purple-800' :
                                    row.product.type === 'service' ? 'bg-violet-100 text-violet-800' :
                                    'bg-indigo-100 text-indigo-800'
                                  }`}>
                                    {row.product.type || 'physical'}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                                  {hasErrors && !row.product.price ? (
                                    <span className="text-rose-500 font-bold">[Missing]</span>
                                  ) : (
                                    `KSh ${(row.product.price || 0).toLocaleString('en-KE')}`
                                  )}
                                </td>
                                <td className="py-2 px-3 text-center font-mono">
                                  {row.product.type === 'physical' ? (
                                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                                      {row.product.stock}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 text-[10px]">∞</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-gray-700 dark:text-gray-300 truncate max-w-[110px]">
                                  {row.product.category || 'Workspace'}
                                </td>
                                <td className="py-2 px-3">
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    row.product.status === 'Active' ? 'bg-emerald-100 text-emerald-800' :
                                    row.product.status === 'Inactive' ? 'bg-rose-100 text-rose-800' :
                                    row.product.status === 'Draft' ? 'bg-amber-100 text-amber-800' :
                                    'bg-slate-200 text-slate-800'
                                  }`}>
                                    {row.product.status || 'Active'}
                                  </span>
                                </td>
                                <td className="py-2 px-3">
                                  {hasErrors ? (
                                    <div className="flex flex-col gap-0.5 text-rose-600 text-[10px]">
                                      {row.errors.map((e, idx) => (
                                        <span key={idx} className="flex items-center gap-1 font-semibold">
                                          <span className="h-1 w-1 bg-rose-500 rounded-full shrink-0" />
                                          {e}
                                        </span>
                                      ))}
                                    </div>
                                  ) : hasWarnings ? (
                                    <div className="flex flex-col gap-0.5 text-amber-700 text-[10px]">
                                      {row.warnings.map((w, idx) => (
                                        <span key={idx} className="flex items-center gap-1">
                                          <span className="h-1 w-1 bg-amber-500 rounded-full shrink-0" />
                                          {w}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-emerald-700 font-bold flex items-center gap-1 font-mono text-[9px] uppercase tracking-wide">
                                      <Check className="h-3.5 w-3.5 stroke-[3]" /> Perfect
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="border-t border-gray-150 dark:border-gray-850 p-5 shrink-0 flex flex-col sm:flex-row justify-between items-center gap-3 bg-gray-50 dark:bg-gray-900 rounded-b-2xl">
          <div className="text-[11px] text-gray-500 font-light text-center sm:text-left font-mono">
            {totalCount > 0 ? (
              <span>Import queue: <strong className="text-emerald-700 font-bold">{validCount} products ready</strong> ({errorCount} blocked rows will be skipped).</span>
            ) : (
              <span>Veloce CSV loader supports any standard CSV export from Excel, Google Sheets, or Shopify.</span>
            )}
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 h-9.5 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer text-center"
              id="btn-cancel-csv-modal"
            >
              Cancel
            </button>
            {totalCount > 0 && (
              <button
                type="button"
                disabled={isImporting || validCount === 0 || !isRequiredAttributesMapped}
                onClick={handleExecuteImport}
                className={`w-full sm:w-auto px-6 h-9.5 rounded-lg font-display text-xs font-bold text-white transition-colors shadow-xs text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                  validCount === 0 || !isRequiredAttributesMapped
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed border border-gray-250" 
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
                id="btn-execute-csv-import"
              >
                {isImporting ? (
                  <>
                    <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                    Registering Products...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" /> Import {validCount} Products
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
