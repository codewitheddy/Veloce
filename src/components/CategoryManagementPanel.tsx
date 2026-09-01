import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Check,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Search,
  Eye,
  History,
  FolderTree,
  Image as ImageIcon,
  ArrowRight,
  CheckSquare,
  Square,
  RefreshCw,
  X,
  FileText,
  ShieldAlert,
  Wand2,
  Link,
  Link2,
  CornerDownRight,
  CheckCircle2,
  ExternalLink,
  Upload,
} from 'lucide-react';
import { Category, CategoryAuditLog, Product } from '../types';
import { generateSlug } from './ProductFormEditor';
import {
  loadCategoriesFromStorage,
  fetchCategoriesFromBackend,
  saveCategoriesToStorage,
  loadCategoryAuditLogs,
  addCategoryAuditLog,
  isDescendant,
  getCategoryDepth,
  getAllDescendantCategoryIds,
  validateCategoryUniqueness,
  generateCategorySlug,
  findCategoryBySlugOrRedirect,
  getAllCategoryRedirectMappings,
  removePreviousSlugRedirect,
  CategoryRedirectMapping,
} from '../utils/categoryUtils';

interface CategoryManagementPanelProps {
  products: Product[];
  onUpdateProductDetails?: (productId: string, updates: Partial<Product>) => void;
  onRefreshProducts?: () => void;
}

export const CategoryManagementPanel: React.FC<CategoryManagementPanelProps> = ({
  products,
  onUpdateProductDetails,
  onRefreshProducts,
}) => {
  // Categories State
  const [categories, setCategories] = useState<Category[]>(() => loadCategoriesFromStorage());
  const [auditLogs, setAuditLogs] = useState<CategoryAuditLog[]>(() => loadCategoryAuditLogs());

  useEffect(() => {
    fetchCategoriesFromBackend().then((cats) => {
      if (cats && Array.isArray(cats)) {
        setCategories(cats);
      }
    });

    const handleCategoriesChanged = (e?: Event) => {
      const customEvent = e as CustomEvent<Category[]>;
      if (customEvent && customEvent.detail && Array.isArray(customEvent.detail)) {
        setCategories(customEvent.detail);
      } else {
        fetchCategoriesFromBackend().then((cats) => {
          if (cats && Array.isArray(cats)) {
            setCategories(cats);
          }
        });
      }
    };

    window.addEventListener('storage', handleCategoriesChanged);
    window.addEventListener('veloce_categories_updated', handleCategoriesChanged);
    return () => {
      window.removeEventListener('storage', handleCategoriesChanged);
      window.removeEventListener('veloce_categories_updated', handleCategoriesChanged);
    };
  }, []);

  // View Navigation Tabs
  const [activeViewTab, setActiveViewTab] = useState<'tree' | 'redirects'>('tree');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  // Redirect Mappings Search & Simulator State
  const [redirectSearchQuery, setRedirectSearchQuery] = useState('');
  const [testSlugInput, setTestSlugInput] = useState('');

  // Selection for Bulk Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Form Modal State (Create / Edit)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Form Fields & Auto-slug generator toggle
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [isAutoSlug, setIsAutoSlug] = useState(true);
  const [formParentId, setFormParentId] = useState<string>('');
  const [formDescription, setFormDescription] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formStatus, setFormStatus] = useState<'Active' | 'Inactive'>('Active');
  const [formDisplayOrder, setFormDisplayOrder] = useState<number>(1);
  const [formKeepOldSlugRedirect, setFormKeepOldSlugRedirect] = useState(true);

  // Form Error / Success feedback
  const [formError, setFormError] = useState('');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Audit Log Modal State
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Dependency Guard Modal State (Deactivation or Deletion of Parent Category)
  const [guardModalState, setGuardModalState] = useState<{
    isOpen: boolean;
    actionType: 'delete' | 'deactivate';
    category: Category | null;
    childSubcategories: Category[];
    affectedProducts: Product[];
    resolutionMode: 'reassign' | 'cascade' | 'block';
    targetParentId: string;
  }>({
    isOpen: false,
    actionType: 'delete',
    category: null,
    childSubcategories: [],
    affectedProducts: [],
    resolutionMode: 'reassign',
    targetParentId: '',
  });

  // Bulk Action Modals State
  const [isBulkReparentOpen, setIsBulkReparentOpen] = useState(false);
  const [bulkTargetParentId, setBulkTargetParentId] = useState('');
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [bulkDeleteResolutionMode, setBulkDeleteResolutionMode] = useState<'reassign' | 'cascade'>('reassign');
  const [bulkDeleteTargetParentId, setBulkDeleteTargetParentId] = useState('');

  // Toast Helper
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Helper to persist categories and trigger audit log reload
  const updateCategoriesAndPersist = (newCategories: Category[]) => {
    setCategories(newCategories);
    saveCategoriesToStorage(newCategories);
    setAuditLogs(loadCategoryAuditLogs());
    if (onRefreshProducts) onRefreshProducts();
  };

  // Category Image Upload States & Ref
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [isDragOverImage, setIsDragOverImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCategoryFile = (file: File) => {
    setImageUploadError(null);
    if (!file.type.startsWith('image/')) {
      setImageUploadError('Please select a valid image file (PNG, JPG, WEBP, SVG, GIF)');
      return;
    }

    // 2.5MB max size
    if (file.size > 2.5 * 1024 * 1024) {
      setImageUploadError('File size exceeds 2.5MB. Please upload a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const rawData = reader.result;
        const img = new Image();
        img.onload = () => {
          const maxDim = 300;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const optimizedData = canvas.toDataURL('image/jpeg', 0.85);
            setFormImageUrl(optimizedData);
          } else {
            setFormImageUrl(rawData);
          }
        };
        img.onerror = () => {
          setFormImageUrl(rawData);
        };
        img.src = rawData;
      }
    };
    reader.onerror = () => {
      setImageUploadError('Failed to read image file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleCategoryFile(e.target.files[0]);
    }
  };

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverImage(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleCategoryFile(e.dataTransfer.files[0]);
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = (presetParentId?: string) => {
    setEditingCategory(null);
    setFormName('');
    setFormSlug('');
    setIsAutoSlug(true);
    setFormParentId(presetParentId || '');
    setFormDescription('');
    setFormImageUrl('');
    setImageUploadError(null);
    setIsDragOverImage(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setFormStatus('Active');
    setFormDisplayOrder(categories.length + 1);
    setFormKeepOldSlugRedirect(true);
    setFormError('');
    setIsFormOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormSlug(cat.slug);
    setIsAutoSlug(false);
    setFormParentId(cat.parentId || '');
    setFormDescription(cat.description || '');
    setFormImageUrl(cat.imageUrl || '');
    setImageUploadError(null);
    setIsDragOverImage(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setFormStatus(cat.status);
    setFormDisplayOrder(cat.displayOrder || 1);
    setFormKeepOldSlugRedirect(true);
    setFormError('');
    setIsFormOpen(true);
  };

  // Name change auto-slug generator
  const handleNameChange = (val: string) => {
    setFormName(val);
    if (isAutoSlug) {
      setFormSlug(generateCategorySlug(val));
    }
  };

  // Regenerate slug manually
  const handleForceRegenerateSlug = () => {
    const fresh = generateCategorySlug(formName);
    setFormSlug(fresh);
    setIsAutoSlug(true);
    showToast(`Slug regenerated from category name: "${fresh}"`);
  };

  // Delete individual old slug redirect mapping
  const handleRemoveOldSlugRedirect = (catId: string, oldSlug: string) => {
    const updated = removePreviousSlugRedirect(categories, catId, oldSlug);
    updateCategoriesAndPersist(updated);
    if (editingCategory && editingCategory.id === catId) {
      setEditingCategory({
        ...editingCategory,
        previousSlugs: (editingCategory.previousSlugs || []).filter((s) => s.toLowerCase() !== oldSlug.toLowerCase()),
      });
    }
    showToast(`Removed redirect mapping for /${oldSlug}`);
  };


  // Submit Category Form (Create or Edit)
  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const trimmedName = formName.trim();
    if (!trimmedName) {
      setFormError('Category name is required.');
      return;
    }

    const trimmedSlug = (formSlug || generateSlug(trimmedName)).trim();
    const parentIdVal = formParentId ? formParentId : null;

    // 1. Validation: Uniqueness check at parent level
    const validation = validateCategoryUniqueness(
      categories,
      trimmedName,
      parentIdVal,
      editingCategory?.id
    );
    if (!validation.isValid) {
      setFormError(validation.errorMessage || 'Invalid category name.');
      return;
    }

    // 2. Validation: Prevent Circular Reference during reparenting
    if (editingCategory && parentIdVal) {
      if (parentIdVal === editingCategory.id) {
        setFormError('A category cannot be set as its own parent.');
        return;
      }
      if (isDescendant(categories, editingCategory.id, parentIdVal)) {
        setFormError('Cannot set a descendant category as the parent (circular reference).');
        return;
      }
    }

    // Check if status is changed to Inactive and it has children/products
    if (editingCategory && editingCategory.status === 'Active' && formStatus === 'Inactive') {
      const children = categories.filter((c) => c.parentId === editingCategory.id);
      const assignedProducts = products.filter(
        (p) => p.category === editingCategory.name || p.subcategoryId === editingCategory.name
      );
      if (children.length > 0 || assignedProducts.length > 0) {
        // Trigger Guard Modal for deactivation!
        setIsFormOpen(false);
        setGuardModalState({
          isOpen: true,
          actionType: 'deactivate',
          category: editingCategory,
          childSubcategories: children,
          affectedProducts: assignedProducts,
          resolutionMode: 'reassign',
          targetParentId: '',
        });
        return;
      }
    }

    const now = new Date().toISOString();

    if (editingCategory) {
      // UPDATE EXISTING CATEGORY
      const slugChanged = editingCategory.slug !== trimmedSlug;
      const previousSlugs = [...(editingCategory.previousSlugs || [])];
      if (slugChanged && formKeepOldSlugRedirect && editingCategory.slug) {
        if (!previousSlugs.includes(editingCategory.slug)) {
          previousSlugs.push(editingCategory.slug);
        }
      }

      const updatedCategory: Category = {
        ...editingCategory,
        name: trimmedName,
        slug: trimmedSlug,
        parentId: parentIdVal,
        description: formDescription.trim() || undefined,
        imageUrl: formImageUrl.trim() || undefined,
        status: formStatus,
        displayOrder: formDisplayOrder,
        updatedAt: now,
        editedBy: 'Admin',
        previousSlugs,
      };

      const updatedList = categories.map((c) => (c.id === editingCategory.id ? updatedCategory : c));

      // If category name changed, update products referencing the old category name
      if (editingCategory.name !== trimmedName && onUpdateProductDetails) {
        products.forEach((p) => {
          if (p.category === editingCategory.name) {
            onUpdateProductDetails(p.id, { category: trimmedName });
          }
          if (p.subcategoryId === editingCategory.name) {
            onUpdateProductDetails(p.id, { subcategoryId: trimmedName });
          }
        });
      }

      updateCategoriesAndPersist(updatedList);
      addCategoryAuditLog(
        editingCategory.id,
        trimmedName,
        'update',
        `Updated category fields. Name: "${trimmedName}", Parent: "${parentIdVal || 'Root'}", Status: "${formStatus}"`,
        'Admin'
      );

      showToast(`Category "${trimmedName}" updated successfully.`);
    } else {
      // CREATE NEW CATEGORY
      const newCategory: Category = {
        id: `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: trimmedName,
        slug: trimmedSlug,
        parentId: parentIdVal,
        description: formDescription.trim() || undefined,
        imageUrl: formImageUrl.trim() || undefined,
        status: formStatus,
        displayOrder: formDisplayOrder,
        createdAt: now,
        updatedAt: now,
        editedBy: 'Admin',
        previousSlugs: [],
      };

      const updatedList = [...categories, newCategory];
      updateCategoriesAndPersist(updatedList);
      addCategoryAuditLog(
        newCategory.id,
        trimmedName,
        'create',
        `Created category "${trimmedName}" under parent "${parentIdVal || 'Root'}"`,
        'Admin'
      );

      showToast(`Category "${trimmedName}" created successfully.`);
    }

    setIsFormOpen(false);
  };

  // Trigger Category Deletion with Dependency Guard Check
  const handleDeleteCategoryClick = (cat: Category) => {
    const children = categories.filter((c) => c.parentId === cat.id);
    const assignedProducts = products.filter(
      (p) => p.category === cat.name || p.subcategoryId === cat.name
    );

    if (children.length > 0 || assignedProducts.length > 0) {
      setGuardModalState({
        isOpen: true,
        actionType: 'delete',
        category: cat,
        childSubcategories: children,
        affectedProducts: assignedProducts,
        resolutionMode: 'reassign',
        targetParentId: '',
      });
    } else {
      // Simple direct deletion
      performDirectDeletion(cat.id, cat.name);
    }
  };

  const performDirectDeletion = (catId: string, catName: string) => {
    const updatedList = categories.filter((c) => c.id !== catId);
    updateCategoriesAndPersist(updatedList);
    addCategoryAuditLog(catId, catName, 'delete', `Deleted category "${catName}"`, 'Admin');
    showToast(`Deleted category "${catName}".`);
  };

  // Resolve Guard Modal (Reassign, Cascade, or Block)
  const handleConfirmGuardResolution = () => {
    const { actionType, category, childSubcategories, affectedProducts, resolutionMode, targetParentId } =
      guardModalState;
    if (!category) return;

    if (resolutionMode === 'block') {
      setGuardModalState((prev) => ({ ...prev, isOpen: false }));
      return;
    }

    if (resolutionMode === 'reassign') {
      const targetCat = categories.find((c) => c.id === targetParentId);
      const targetName = targetCat ? targetCat.name : 'Uncategorized';

      // 1. Reassign child subcategories to target parent
      let updatedCategories = categories.map((c) => {
        if (c.parentId === category.id) {
          return { ...c, parentId: targetParentId || null, updatedAt: new Date().toISOString() };
        }
        return c;
      });

      // 2. Reassign affected products
      if (onUpdateProductDetails) {
        affectedProducts.forEach((p) => {
          if (p.category === category.name) {
            onUpdateProductDetails(p.id, { category: targetName });
          }
          if (p.subcategoryId === category.name) {
            onUpdateProductDetails(p.id, { subcategoryId: targetName });
          }
        });
      }

      if (actionType === 'delete') {
        updatedCategories = updatedCategories.filter((c) => c.id !== category.id);
        addCategoryAuditLog(
          category.id,
          category.name,
          'delete',
          `Deleted "${category.name}". Reassigned ${childSubcategories.length} subcategories and ${affectedProducts.length} products to "${targetName}".`,
          'Admin'
        );
        showToast(`Deleted category "${category.name}" and reassigned items to "${targetName}".`);
      } else {
        // Deactivate
        updatedCategories = updatedCategories.map((c) =>
          c.id === category.id ? { ...c, status: 'Inactive', updatedAt: new Date().toISOString() } : c
        );
        addCategoryAuditLog(
          category.id,
          category.name,
          'status_change',
          `Deactivated "${category.name}". Reassigned items to "${targetName}".`,
          'Admin'
        );
        showToast(`Deactivated "${category.name}" and reassigned dependent items to "${targetName}".`);
      }

      updateCategoriesAndPersist(updatedCategories);
    } else if (resolutionMode === 'cascade') {
      const descendantIds = [category.id, ...getAllDescendantCategoryIds(categories, category.id)];

      if (actionType === 'delete') {
        const updatedCategories = categories.filter((c) => !descendantIds.includes(c.id));
        if (onUpdateProductDetails) {
          affectedProducts.forEach((p) => {
            onUpdateProductDetails(p.id, { category: 'Uncategorized', subcategoryId: undefined });
          });
        }
        updateCategoriesAndPersist(updatedCategories);
        addCategoryAuditLog(
          category.id,
          category.name,
          'delete',
          `Cascade deleted "${category.name}" and ${descendantIds.length - 1} subcategories.`,
          'Admin'
        );
        showToast(`Cascade deleted "${category.name}" and its subcategories.`);
      } else {
        // Cascade Deactivate
        const updatedCategories = categories.map((c) =>
          descendantIds.includes(c.id)
            ? { ...c, status: 'Inactive' as const, updatedAt: new Date().toISOString() }
            : c
        );
        if (onUpdateProductDetails) {
          affectedProducts.forEach((p) => {
            onUpdateProductDetails(p.id, { status: 'Inactive' });
          });
        }
        updateCategoriesAndPersist(updatedCategories);
        addCategoryAuditLog(
          category.id,
          category.name,
          'status_change',
          `Cascade deactivated "${category.name}", ${descendantIds.length - 1} subcategories, and ${affectedProducts.length} products.`,
          'Admin'
        );
        showToast(`Cascade deactivated "${category.name}" and all descendants.`);
      }
    }

    setGuardModalState((prev) => ({ ...prev, isOpen: false }));
  };

  // Toggle tree node expansion
  const toggleExpand = (catId: string) => {
    setExpandedIds((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  // Toggle Selection for Bulk Actions
  const toggleSelectRow = (catId: string) => {
    setSelectedIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === categories.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(categories.map((c) => c.id));
    }
  };

  // Bulk Status Change
  const handleBulkStatusChange = (newStatus: 'Active' | 'Inactive') => {
    if (selectedIds.length === 0) return;
    const updated = categories.map((c) =>
      selectedIds.includes(c.id) ? { ...c, status: newStatus, updatedAt: new Date().toISOString() } : c
    );
    updateCategoriesAndPersist(updated);
    addCategoryAuditLog(
      'bulk',
      'Multiple Categories',
      'bulk_action',
      `Bulk updated status to "${newStatus}" for ${selectedIds.length} categories`,
      'Admin'
    );
    showToast(`Updated status for ${selectedIds.length} categories to "${newStatus}".`);
    setSelectedIds([]);
  };

  // Bulk Reparent
  const handleConfirmBulkReparent = () => {
    if (selectedIds.length === 0) return;
    const parentVal = bulkTargetParentId ? bulkTargetParentId : null;

    // Validate circular references for selected categories
    for (const catId of selectedIds) {
      if (parentVal && (catId === parentVal || isDescendant(categories, catId, parentVal))) {
        showToast('Cannot reparent: includes a category that would create a circular reference.', 'error');
        return;
      }
    }

    const updated = categories.map((c) =>
      selectedIds.includes(c.id) ? { ...c, parentId: parentVal, updatedAt: new Date().toISOString() } : c
    );
    updateCategoriesAndPersist(updated);
    addCategoryAuditLog(
      'bulk',
      'Multiple Categories',
      'bulk_action',
      `Bulk reparented ${selectedIds.length} categories under parent ID "${parentVal || 'Root'}"`,
      'Admin'
    );
    showToast(`Reparented ${selectedIds.length} categories.`);
    setIsBulkReparentOpen(false);
    setSelectedIds([]);
  };

  // Open Bulk Delete Modal with Cascade Warning analysis
  const handleOpenBulkDeleteModal = () => {
    if (selectedIds.length === 0) return;
    setBulkDeleteResolutionMode('reassign');
    setBulkDeleteTargetParentId('');
    setIsBulkDeleteModalOpen(true);
  };

  // Confirm Bulk Deletion with Cascade or Reassign Resolution
  const handleConfirmBulkDelete = () => {
    if (selectedIds.length === 0) return;

    const selectedCategories = categories.filter((c) => selectedIds.includes(c.id));
    const selectedNames = selectedCategories.map((c) => c.name);

    if (bulkDeleteResolutionMode === 'reassign') {
      const targetCat = categories.find((c) => c.id === bulkDeleteTargetParentId);
      const targetName = targetCat ? targetCat.name : 'Uncategorized';
      const targetParentVal = bulkDeleteTargetParentId || null;

      // 1. Reassign child subcategories whose parents are being deleted (if they are not also selected)
      let updatedCategories = categories.map((c) => {
        if (c.parentId && selectedIds.includes(c.parentId) && !selectedIds.includes(c.id)) {
          return { ...c, parentId: targetParentVal, updatedAt: new Date().toISOString() };
        }
        return c;
      });

      // 2. Remove the selected categories
      updatedCategories = updatedCategories.filter((c) => !selectedIds.includes(c.id));

      // 3. Reassign affected products
      if (onUpdateProductDetails) {
        products.forEach((p) => {
          if (selectedNames.includes(p.category)) {
            onUpdateProductDetails(p.id, { category: targetName });
          }
          if (p.subcategoryId && selectedNames.includes(p.subcategoryId)) {
            onUpdateProductDetails(p.id, { subcategoryId: targetName === 'Uncategorized' ? undefined : targetName });
          }
        });
      }

      updateCategoriesAndPersist(updatedCategories);
      addCategoryAuditLog(
        'bulk',
        `${selectedIds.length} Categories`,
        'bulk_action',
        `Bulk deleted ${selectedIds.length} categories. Reassigned dependent subcategories and products to "${targetName}".`,
        'Admin'
      );
      showToast(`Bulk deleted ${selectedIds.length} category(ies) and reassigned items to "${targetName}".`);
    } else if (bulkDeleteResolutionMode === 'cascade') {
      // Collect all descendant category IDs for each selected category recursively
      const allToDeleteIds = new Set<string>(selectedIds);
      selectedIds.forEach((id) => {
        const descendants = getAllDescendantCategoryIds(categories, id);
        descendants.forEach((dId) => allToDeleteIds.add(dId));
      });

      const toDeleteArray = Array.from(allToDeleteIds);
      const toDeleteCategoryObjects = categories.filter((c) => toDeleteArray.includes(c.id));
      const toDeleteNames = toDeleteCategoryObjects.map((c) => c.name);

      const updatedCategories = categories.filter((c) => !allToDeleteIds.has(c.id));

      if (onUpdateProductDetails) {
        products.forEach((p) => {
          if (toDeleteNames.includes(p.category) || (p.subcategoryId && toDeleteNames.includes(p.subcategoryId))) {
            onUpdateProductDetails(p.id, { category: 'Uncategorized', subcategoryId: undefined });
          }
        });
      }

      updateCategoriesAndPersist(updatedCategories);
      addCategoryAuditLog(
        'bulk',
        `${toDeleteArray.length} Categories`,
        'bulk_action',
        `Cascade bulk deleted ${selectedIds.length} selected root categories and ${toDeleteArray.length - selectedIds.length} descendant subcategories.`,
        'Admin'
      );
      showToast(`Cascade deleted ${toDeleteArray.length} categories (including all descendant subcategories).`);
    }

    setIsBulkDeleteModalOpen(false);
    setSelectedIds([]);
  };

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      const matchesSearch =
        !searchQuery ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.slug.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [categories, searchQuery, statusFilter]);

  // Root level categories sorted by display order
  const rootCategories = useMemo(() => {
    return filteredCategories
      .filter((c) => !c.parentId)
      .sort((a, b) => (a.displayOrder || 1) - (b.displayOrder || 1));
  }, [filteredCategories]);

  // Recursively render tree row
  const renderCategoryTreeRow = (cat: Category, depth: number = 0) => {
    const children = categories
      .filter((c) => c.parentId === cat.id)
      .sort((a, b) => (a.displayOrder || 1) - (b.displayOrder || 1));
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds[cat.id] ?? true; // default expanded
    const isSelected = selectedIds.includes(cat.id);

    const propCount = products.filter(
      (p) => p.category === cat.name || p.subcategoryId === cat.name
    ).length;

    return (
      <React.Fragment key={cat.id}>
        <tr
          className={`hover:bg-slate-50/80 transition-colors ${
            cat.status === 'Inactive' ? 'bg-slate-50/60 text-slate-400' : ''
          }`}
        >
          {/* Checkbox */}
          <td className="py-3 px-4 text-center w-10">
            <button
              type="button"
              onClick={() => toggleSelectRow(cat.id)}
              className="text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
            >
              {isSelected ? (
                <CheckSquare className="h-4 w-4 text-indigo-600" />
              ) : (
                <Square className="h-4 w-4" />
              )}
            </button>
          </td>

          {/* Category Name & Hierarchy Indentation */}
          <td className="py-3 px-4 font-medium text-slate-900 text-xs">
            <div className="flex items-center gap-1.5" style={{ paddingLeft: `${depth * 20}px` }}>
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggleExpand(cat.id)}
                  className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors cursor-pointer"
                >
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
              ) : (
                <span className="w-5" />
              )}

              {cat.imageUrl ? (
                <img
                  src={cat.imageUrl}
                  alt={cat.name}
                  className="w-7 h-7 rounded-md object-cover border border-slate-200 shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <FolderTree className="h-3.5 w-3.5" />
                </div>
              )}

              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${cat.status === 'Inactive' ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                    {cat.name}
                  </span>
                  {depth > 0 && (
                    <span className="px-1.5 py-0.2 rounded bg-slate-150 text-slate-700 font-mono text-[9px] uppercase font-bold border border-slate-200">
                      L{depth + 1}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-slate-600 font-bold">
                  /{cat.slug}
                </span>
              </div>
            </div>
          </td>

          {/* Parent Name */}
          <td className="py-3 px-4 text-slate-700 font-medium text-xs">
            {cat.parentId ? (
              <span className="px-2 py-0.5 rounded bg-slate-150 text-slate-800 font-mono text-[10.5px] font-bold border border-slate-200">
                {categories.find((c) => c.id === cat.parentId)?.name || 'Parent'}
              </span>
            ) : (
              <span className="text-slate-500 italic font-mono text-[10px] font-medium">&mdash; Top Level &mdash;</span>
            )}
          </td>

          {/* Status */}
          <td className="py-3 px-4 text-center">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${
                cat.status === 'Active'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                  : 'bg-slate-150 text-slate-700 border border-slate-300'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  cat.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-500'
                }`}
              />
              {cat.status}
            </span>
          </td>

          {/* Sort Order */}
          <td className="py-3 px-4 text-center font-mono text-slate-600 text-xs">
            {cat.displayOrder ?? 1}
          </td>

          {/* Items Count */}
          <td className="py-3 px-4 text-center font-mono">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] ${
                propCount > 0 ? 'bg-indigo-50 text-indigo-700 font-bold' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {propCount} items
            </span>
          </td>

          {/* Actions */}
          <td className="py-3 px-4 text-right">
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={() => handleOpenCreateModal(cat.id)}
                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                title={`Add Subcategory under ${cat.name}`}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleOpenEditModal(cat)}
                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                title={`Edit ${cat.name}`}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCategoryClick(cat)}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                title={`Delete ${cat.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </td>
        </tr>

        {/* Render child subcategories recursively if expanded */}
        {hasChildren && isExpanded && children.map((child) => renderCategoryTreeRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* Toast Banner */}
      {toastMessage && (
        <div
          className={`rounded-xl border p-4 text-xs font-semibold flex items-center justify-between gap-2 shadow-xs animate-in fade-in duration-200 ${
            toastMessage.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? (
              <Check className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Top Header & Quick Actions */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 tracking-tight">
                Category Architecture & Taxonomy
              </h2>
              <p className="text-xs text-slate-500">
                Manage multi-level category structures, subcategories, custom slugs, and product rules.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsAuditModalOpen(true)}
            className="h-10 px-4 rounded-xl border border-slate-200/90 text-slate-700 bg-white hover:bg-slate-50 font-semibold text-xs transition-all cursor-pointer inline-flex items-center gap-2 shadow-2xs"
          >
            <History className="h-4 w-4 text-slate-500" />
            <span>Audit Trail ({auditLogs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenCreateModal()}
            className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all cursor-pointer inline-flex items-center gap-2 shadow-2xs"
          >
            <Plus className="h-4 w-4" />
            <span>Create New Category</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation View Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-1 font-mono text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveViewTab('tree')}
          className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeViewTab === 'tree'
              ? 'bg-indigo-600 text-white shadow-2xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FolderTree className="h-4 w-4" />
          <span>Category Hierarchy</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeViewTab === 'tree' ? 'bg-indigo-700/80 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {categories.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveViewTab('redirects')}
          className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeViewTab === 'redirects'
              ? 'bg-indigo-600 text-white shadow-2xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Link className="h-4 w-4" />
          <span>Slug Redirect Mappings</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeViewTab === 'redirects'
                ? 'bg-indigo-700/80 text-white'
                : 'bg-indigo-50 text-indigo-700 font-bold'
            }`}
          >
            {getAllCategoryRedirectMappings(categories).length}
          </span>
        </button>
      </div>

      {/* VIEW TAB 1: CATEGORY HIERARCHY */}
      {activeViewTab === 'tree' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-150 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Box */}
            <div className="relative flex-1 max-w-md">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search category name or slug..."
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-300 text-xs font-medium bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 font-mono uppercase">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="h-9 px-3 rounded-xl border border-slate-300 text-xs font-semibold bg-white cursor-pointer focus:ring-2 focus:ring-indigo-500"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active Only</option>
                <option value="Inactive">Inactive Only</option>
              </select>
            </div>
          </div>

          {/* Bulk Actions Banner */}
          {selectedIds.length > 0 && (
            <div className="px-6 py-3 bg-indigo-50/90 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150">
              <span className="text-xs font-bold text-indigo-900 font-mono">
                ⚡ {selectedIds.length} category(ies) selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleBulkStatusChange('Active')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-2xs"
                >
                  Mark Active
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkStatusChange('Inactive')}
                  className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-2xs"
                >
                  Mark Inactive
                </button>
                <button
                  type="button"
                  onClick={() => setIsBulkReparentOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer shadow-2xs"
                >
                  Move Parent
                </button>
                <button
                  type="button"
                  onClick={handleOpenBulkDeleteModal}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer shadow-2xs"
                >
                  Delete Selected
                </button>
              </div>
            </div>
          )}

          {/* Category Directory Tree Table */}
          <div className="overflow-x-auto custom-table-scroll">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono font-bold text-[9.5px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 text-center w-10">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                    >
                      {selectedIds.length === categories.length && categories.length > 0 ? (
                        <CheckSquare className="h-4 w-4 text-indigo-600" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">Category Name & Slug</th>
                  <th className="py-3 px-4">Parent Category</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Order</th>
                  <th className="py-3 px-4 text-center">Assigned Items</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 font-sans text-slate-700">
                {rootCategories.length > 0 ? (
                  rootCategories.map((cat) => renderCategoryTreeRow(cat, 0))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                      No categories found matching your search parameters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW TAB 2: URL SLUG REDIRECT MAPPINGS */}
      {activeViewTab === 'redirects' && (() => {
        const allRedirects = getAllCategoryRedirectMappings(categories);
        const filteredRedirects = allRedirects.filter(
          (r) =>
            !redirectSearchQuery ||
            r.oldSlug.toLowerCase().includes(redirectSearchQuery.toLowerCase()) ||
            r.categoryName.toLowerCase().includes(redirectSearchQuery.toLowerCase()) ||
            r.currentSlug.toLowerCase().includes(redirectSearchQuery.toLowerCase())
        );

        const testResult = testSlugInput.trim()
          ? findCategoryBySlugOrRedirect(categories, testSlugInput)
          : null;

        return (
          <div className="flex flex-col gap-6 font-sans animate-in fade-in duration-150">
            {/* Top Info Metric Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between">
                <div>
                  <p className="text-[10.5px] font-bold font-mono text-slate-400 uppercase">Active Slug Redirects</p>
                  <p className="font-display text-xl font-bold text-slate-900 mt-0.5">{allRedirects.length}</p>
                </div>
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Link className="h-5 w-5" />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between">
                <div>
                  <p className="text-[10.5px] font-bold font-mono text-slate-400 uppercase">Redirect-Protected Categories</p>
                  <p className="font-display text-xl font-bold text-slate-900 mt-0.5">
                    {categories.filter((c) => c.previousSlugs && c.previousSlugs.length > 0).length}
                  </p>
                </div>
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                  <FolderTree className="h-5 w-5" />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between">
                <div>
                  <p className="text-[10.5px] font-bold font-mono text-slate-400 uppercase">301 URL Resolution Status</p>
                  <p className="text-xs font-bold text-emerald-600 mt-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Automatic Storefront Engine Active
                  </p>
                </div>
                <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Live Redirect Simulator Tool */}
            <div className="p-5 rounded-2xl bg-slate-900 text-white shadow-md space-y-4">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-indigo-400" />
                  <span>Interactive URL Slug Redirect Simulator</span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Test any legacy or current category URL slug to inspect how incoming traffic resolves.
                </p>
              </div>

              <div className="relative max-w-lg">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs font-bold">
                  /
                </span>
                <input
                  type="text"
                  value={testSlugInput}
                  onChange={(e) => setTestSlugInput(e.target.value)}
                  placeholder="Type an old slug e.g. dry-food or food-beverages"
                  className="w-full h-10 pl-8 pr-4 rounded-xl bg-slate-800/90 border border-slate-700 text-white font-mono text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              {testSlugInput.trim() && (
                <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs font-sans space-y-1.5 animate-in fade-in duration-150">
                  {testResult ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-mono text-emerald-400 font-bold">
                        {testResult.isRedirect ? (
                          <>
                            <CornerDownRight className="h-4 w-4 shrink-0 text-amber-400" />
                            <span>HTTP 301 Redirect Resolved</span>
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                            <span>Primary Slug Direct Match</span>
                          </>
                        )}
                      </div>
                      <div className="text-slate-200 font-medium pl-6">
                        Requested: <code className="bg-slate-900 px-1.5 py-0.5 rounded text-amber-300 font-mono">/{testResult.matchedSlug}</code> ➔ Target Category: <strong className="text-white">{testResult.category.name}</strong> (<code className="bg-slate-900 px-1.5 py-0.5 rounded text-emerald-300 font-mono">/{testResult.primarySlug}</code>)
                      </div>
                    </div>
                  ) : (
                    <div className="text-rose-400 font-medium font-mono flex items-center gap-2">
                      <X className="h-4 w-4 text-rose-400 shrink-0" />
                      <span>No active category or redirect mapping found for /{testSlugInput.trim()}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Redirect Mappings Directory Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden space-y-0">
              <div className="p-4 border-b border-slate-150 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={redirectSearchQuery}
                    onChange={(e) => setRedirectSearchQuery(e.target.value)}
                    placeholder="Search previous slug or category name..."
                    className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-300 text-xs font-medium bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <span className="text-xs font-mono text-slate-500 font-semibold">
                  Showing {filteredRedirects.length} of {allRedirects.length} redirect mapping(s)
                </span>
              </div>

              <div className="overflow-x-auto custom-table-scroll">
                <table className="w-full text-left text-xs min-w-[650px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono font-bold text-[9.5px] uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Legacy / Old URL Slug</th>
                      <th className="py-3 px-4">Destination Category</th>
                      <th className="py-3 px-4">Target Primary Slug</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 font-sans text-slate-700">
                    {filteredRedirects.length > 0 ? (
                      filteredRedirects.map((red) => {
                        const targetCat = categories.find((c) => c.id === red.categoryId);
                        return (
                          <tr key={`${red.categoryId}-${red.oldSlug}`} className="hover:bg-slate-50/60">
                            <td className="py-3 px-4 font-mono font-bold text-amber-700 bg-amber-50/30">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-100/80 border border-amber-200">
                                <CornerDownRight className="h-3 w-3 text-amber-600" />
                                /{red.oldSlug}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-900">
                              {red.categoryName}
                            </td>
                            <td className="py-3 px-4 font-mono text-indigo-700 font-semibold">
                              /{red.currentSlug}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  red.status === 'Active'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                                }`}
                              >
                                {red.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {targetCat && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditModal(targetCat)}
                                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                    title="Edit Category"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOldSlugRedirect(red.categoryId, red.oldSlug)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title={`Delete Redirect Mapping for /${red.oldSlug}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                          {allRedirects.length === 0
                            ? 'No URL slug redirect mappings created yet. When you rename a category slug, you can choose to preserve its old slug as an automatic 301 redirect.'
                            : 'No redirect mappings matching your search filter.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CREATE / EDIT CATEGORY MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-5 my-8 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-display font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <FolderTree className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <span>{editingCategory ? 'Edit Category' : 'Create New Category'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCategory} className="space-y-4 text-xs font-sans">
              {/* Category Name */}
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase font-mono mb-1">
                  Category Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Dry Food & Staples"
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none shadow-2xs"
                />
              </div>

              {/* Category Slug */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase font-mono">
                    Category Slug / URL Identifier
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold ${
                        isAutoSlug
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      }`}
                    >
                      {isAutoSlug ? '⚡ Auto-Synced' : '✏️ Custom Slug'}
                    </span>
                    <button
                      type="button"
                      onClick={handleForceRegenerateSlug}
                      className="px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10.5px] font-bold flex items-center gap-1 transition-colors cursor-pointer border border-indigo-200 dark:border-indigo-800"
                      title="Regenerate clean URL slug from category name"
                    >
                      <Wand2 className="h-3 w-3" />
                      <span>Regenerate</span>
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-mono text-xs font-bold">
                    /
                  </span>
                  <input
                    type="text"
                    required
                    value={formSlug}
                    onChange={(e) => {
                      setFormSlug(e.target.value);
                      setIsAutoSlug(false);
                    }}
                    placeholder="dry-food-staples"
                    className="w-full h-10 pl-7 pr-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-mono text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none shadow-2xs"
                  />
                </div>

                {/* Option to create redirect mapping when slug is changed */}
                {editingCategory && formSlug !== editingCategory.slug && (
                  <div className="mt-2.5 p-3 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs">
                    <label className="flex items-start gap-2 text-amber-900 dark:text-amber-200 cursor-pointer font-medium">
                      <input
                        type="checkbox"
                        checked={formKeepOldSlugRedirect}
                        onChange={(e) => setFormKeepOldSlugRedirect(e.target.checked)}
                        className="mt-0.5 rounded border-amber-300 dark:border-amber-700 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold">Create 301 URL redirect mapping</span>
                        <p className="text-[11px] text-amber-800 dark:text-amber-300 font-mono mt-0.5">
                          Redirect incoming requests from <code className="bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded text-amber-900 dark:text-amber-200 font-bold">/{editingCategory.slug}</code> ➔ <code className="bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded text-amber-900 dark:text-amber-200 font-bold">/{formSlug}</code>
                        </p>
                      </div>
                    </label>
                  </div>
                )}

                {/* Display existing previous slug redirect mappings */}
                {editingCategory && editingCategory.previousSlugs && editingCategory.previousSlugs.length > 0 && (
                  <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                    <span className="text-[10.5px] font-bold font-mono text-slate-700 dark:text-slate-300 uppercase flex items-center gap-1.5">
                      <Link className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      Active Slug Redirect Mappings ({editingCategory.previousSlugs.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {editingCategory.previousSlugs.map((prevSlug) => (
                        <span
                          key={prevSlug}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono text-slate-700 dark:text-slate-300 shadow-2xs"
                        >
                          <CornerDownRight className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                          <span>/{prevSlug}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveOldSlugRedirect(editingCategory.id, prevSlug)}
                            className="p-0.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded transition-colors cursor-pointer ml-1"
                            title={`Remove redirect mapping for /${prevSlug}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Parent Category */}
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase font-mono mb-1">
                  Parent Category
                </label>
                <select
                  value={formParentId}
                  onChange={(e) => setFormParentId(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none cursor-pointer shadow-2xs"
                >
                  <option value="">-- None (Top-Level Category) --</option>
                  {categories.map((c) => {
                    const depth = getCategoryDepth(categories, c.id);
                    const prefix = '— '.repeat(depth);
                    const isSelf = editingCategory && c.id === editingCategory.id;
                    const isChild =
                      editingCategory && isDescendant(categories, editingCategory.id, c.id);
                    const disabled = isSelf || isChild;

                    return (
                      <option key={c.id} value={c.id} disabled={disabled} className="dark:bg-slate-800 text-slate-900 dark:text-white">
                        {prefix} {c.name} {disabled ? '(Invalid Parent)' : ''}
                      </option>
                    );
                  })}
                </select>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Select a parent category to create or move a subcategory.
                </p>
              </div>

              {/* Status & Display Order */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase font-mono mb-1">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none cursor-pointer shadow-2xs"
                  >
                    <option value="Active" className="dark:bg-slate-800 text-slate-900 dark:text-white">🟢 Active</option>
                    <option value="Inactive" className="dark:bg-slate-800 text-slate-900 dark:text-white">🔴 Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase font-mono mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formDisplayOrder}
                    onChange={(e) => setFormDisplayOrder(parseInt(e.target.value) || 1)}
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none shadow-2xs"
                  />
                </div>
              </div>

              {/* Category Image: Local File Upload & URL */}
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase font-mono mb-1.5 flex items-center justify-between">
                  <span>Category Image</span>
                  <span className="text-[10.5px] text-slate-400 dark:text-slate-500 font-normal font-sans">
                    PNG, JPG, WEBP, SVG (Max 2.5MB)
                  </span>
                </label>

                {imageUploadError && (
                  <div className="mb-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>{imageUploadError}</span>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                  id="category-file-input"
                />

                {formImageUrl ? (
                  <div className="relative group rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-3 flex items-center gap-3.5 shadow-2xs">
                    <div className="w-16 h-16 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                      <img
                        src={formImageUrl}
                        alt="Category preview"
                        className="w-full h-full object-contain rounded"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {formImageUrl.startsWith('data:image/') ? 'Custom Uploaded Image' : formImageUrl}
                      </p>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="h-3 w-3" /> Image Ready
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold transition-colors cursor-pointer border border-indigo-200 dark:border-indigo-800"
                        >
                          Change File
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFormImageUrl('');
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="px-2.5 py-1 rounded-md bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-600 dark:text-rose-400 text-[11px] font-bold transition-colors cursor-pointer border border-rose-200 dark:border-rose-800"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragOverImage(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDragOverImage(false); }}
                    onDrop={handleImageDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 ${
                      isDragOverImage
                        ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40'
                        : 'border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/80 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <div className="p-2.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                        <Upload className="h-5 w-5" />
                      </div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Click to upload category image <span className="font-normal text-slate-500 dark:text-slate-400">or drag & drop</span>
                      </p>
                      <p className="text-[10.5px] text-slate-400 dark:text-slate-500">
                        PNG, JPG, WEBP, SVG up to 2.5MB
                      </p>
                    </div>
                  </div>
                )}

                {/* Direct URL Input Fallback */}
                <div className="mt-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                      <Link className="h-3.5 w-3.5" />
                    </span>
                    <input
                      type="url"
                      value={formImageUrl.startsWith('data:image/') ? '' : formImageUrl}
                      onChange={(e) => {
                        setFormImageUrl(e.target.value);
                        setImageUploadError(null);
                      }}
                      placeholder="Or paste external image URL (https://...)"
                      className="w-full h-9 pl-8 pr-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-[11px] font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase font-mono mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief description of products in this category..."
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none shadow-2xs"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer shadow-2xs transition-colors"
                >
                  {editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEPENDENCY GUARD MODAL (Parent Deletion / Deactivation Warning) */}
      {guardModalState.isOpen && guardModalState.category && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-6 space-y-5 text-slate-900 dark:text-white">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/50 rounded-2xl border border-amber-200 dark:border-amber-800">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
                  {guardModalState.actionType === 'delete' ? 'Delete Parent Category' : 'Deactivate Category'} Warning
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Category "{guardModalState.category.name}" has dependent elements that require resolution.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs font-medium text-amber-900 dark:text-amber-200 space-y-2">
              <p>
                ⚠️ <strong>Dependencies Found:</strong>
              </p>
              <ul className="list-disc pl-5 space-y-1 font-mono text-[11px]">
                <li>{guardModalState.childSubcategories.length} child subcategory(ies)</li>
                <li>{guardModalState.affectedProducts.length} assigned product(s)</li>
              </ul>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block font-bold text-slate-800 dark:text-slate-200 uppercase font-mono">
                Choose Resolution Strategy:
              </label>

              {/* Option 1: Reassign */}
              <label
                className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  guardModalState.resolutionMode === 'reassign'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40'
                    : 'border-slate-200 dark:border-slate-750 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <input
                  type="radio"
                  name="resolutionMode"
                  checked={guardModalState.resolutionMode === 'reassign'}
                  onChange={() =>
                    setGuardModalState((prev) => ({ ...prev, resolutionMode: 'reassign' }))
                  }
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="space-y-1 flex-1">
                  <span className="font-bold text-slate-900 dark:text-white block">Reassign Subcategories & Products</span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Move all child subcategories and products to a designated target category.
                  </p>
                  {guardModalState.resolutionMode === 'reassign' && (
                    <select
                      value={guardModalState.targetParentId}
                      onChange={(e) =>
                        setGuardModalState((prev) => ({ ...prev, targetParentId: e.target.value }))
                      }
                      className="mt-2 w-full h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white cursor-pointer"
                    >
                      <option value="">-- Reassign to Root / Uncategorized --</option>
                      {categories
                        .filter((c) => c.id !== guardModalState.category?.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              </label>

              {/* Option 2: Cascade */}
              <label
                className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  guardModalState.resolutionMode === 'cascade'
                    ? 'border-rose-600 bg-rose-50/50 dark:bg-rose-950/40'
                    : 'border-slate-200 dark:border-slate-750 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <input
                  type="radio"
                  name="resolutionMode"
                  checked={guardModalState.resolutionMode === 'cascade'}
                  onChange={() =>
                    setGuardModalState((prev) => ({ ...prev, resolutionMode: 'cascade' }))
                  }
                  className="mt-0.5 text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">
                    Cascade {guardModalState.actionType === 'delete' ? 'Delete' : 'Deactivate'}
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {guardModalState.actionType === 'delete'
                      ? 'Delete this category and all subcategories. Unassign associated products.'
                      : 'Deactivate this category, all subcategories, and hide associated products from the storefront.'}
                  </p>
                </div>
              </label>

              {/* Option 3: Block */}
              <label
                className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  guardModalState.resolutionMode === 'block'
                    ? 'border-slate-600 bg-slate-100 dark:bg-slate-800'
                    : 'border-slate-200 dark:border-slate-750 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <input
                  type="radio"
                  name="resolutionMode"
                  checked={guardModalState.resolutionMode === 'block'}
                  onChange={() =>
                    setGuardModalState((prev) => ({ ...prev, resolutionMode: 'block' }))
                  }
                  className="mt-0.5 text-slate-600 focus:ring-slate-500"
                />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">Block Action</span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Cancel action and resolve dependencies manually before proceeding.
                  </p>
                </div>
              </label>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setGuardModalState((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmGuardResolution}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer shadow-2xs"
              >
                Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK REPARENT MODAL */}
      {isBulkReparentOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-md w-full p-6 space-y-4 text-slate-900 dark:text-white">
            <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
              Bulk Reparent {selectedIds.length} Categories
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select a new parent category for all currently selected items.
            </p>

            <select
              value={bulkTargetParentId}
              onChange={(e) => setBulkTargetParentId(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white cursor-pointer"
            >
              <option value="">-- None (Move to Top-Level) --</option>
              {categories
                .filter((c) => !selectedIds.includes(c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsBulkReparentOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkReparent}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer"
              >
                Confirm Move
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK DELETE MODAL WITH CASCADE WARNINGS */}
      {isBulkDeleteModalOpen && (() => {
        const selectedCategories = categories.filter((c) => selectedIds.includes(c.id));
        const selectedNames = selectedCategories.map((c) => c.name);

        // Calculate unselected descendant categories affected
        const unselectedDescendantIds = new Set<string>();
        selectedIds.forEach((id) => {
          getAllDescendantCategoryIds(categories, id).forEach((dId) => {
            if (!selectedIds.includes(dId)) {
              unselectedDescendantIds.add(dId);
            }
          });
        });

        // Calculate products affected
        const affectedProducts = products.filter(
          (p) => selectedNames.includes(p.category) || (p.subcategoryId && selectedNames.includes(p.subcategoryId))
        );

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-6 space-y-5 text-slate-900 dark:text-white">
              <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 rounded-2xl border border-rose-200 dark:border-rose-800">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
                    Bulk Category Deletion & Cascade Warning
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    You are about to delete <strong className="text-rose-700 dark:text-rose-300 font-bold">{selectedIds.length} selected category(ies)</strong>.
                  </p>
                </div>
              </div>

              {/* Cascade Impact Assessment Card */}
              <div className="p-4 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                <div className="flex items-center justify-between font-bold">
                  <span>⚠️ Dependency Impact Analysis:</span>
                  <span className="font-mono text-[10.5px] bg-amber-200/70 dark:bg-amber-900/60 px-2 py-0.5 rounded text-amber-950 dark:text-amber-200">
                    {selectedIds.length} Root Items
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                  <div className="p-2 rounded bg-white/80 dark:bg-slate-800/80 border border-amber-200/80 dark:border-amber-800/80">
                    <span className="block text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold">Unselected Child Subcategories</span>
                    <strong className="text-amber-900 dark:text-amber-200 text-sm">{unselectedDescendantIds.size}</strong> affected
                  </div>
                  <div className="p-2 rounded bg-white/80 dark:bg-slate-800/80 border border-amber-200/80 dark:border-amber-800/80">
                    <span className="block text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold">Assigned Products</span>
                    <strong className="text-amber-900 dark:text-amber-200 text-sm">{affectedProducts.length}</strong> products
                  </div>
                </div>
              </div>

              {/* Resolution Options */}
              <div className="space-y-3 text-xs">
                <label className="block font-bold text-slate-800 dark:text-slate-200 uppercase font-mono">
                  Select Resolution Action:
                </label>

                {/* Option 1: Reassign */}
                <label
                  className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    bulkDeleteResolutionMode === 'reassign'
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40'
                      : 'border-slate-200 dark:border-slate-750 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="bulkDeleteResolutionMode"
                    checked={bulkDeleteResolutionMode === 'reassign'}
                    onChange={() => setBulkDeleteResolutionMode('reassign')}
                    className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="space-y-1 flex-1">
                    <span className="font-bold text-slate-900 dark:text-white block">Reassign Subcategories & Products</span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Preserve child subcategories and move assigned products to a destination category.
                    </p>
                    {bulkDeleteResolutionMode === 'reassign' && (
                      <select
                        value={bulkDeleteTargetParentId}
                        onChange={(e) => setBulkDeleteTargetParentId(e.target.value)}
                        className="mt-2 w-full h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white cursor-pointer"
                      >
                        <option value="">-- Reassign to Root / Uncategorized --</option>
                        {categories
                          .filter((c) => !selectedIds.includes(c.id))
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                </label>

                {/* Option 2: Cascade Delete */}
                <label
                  className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    bulkDeleteResolutionMode === 'cascade'
                      ? 'border-rose-600 bg-rose-50/50 dark:bg-rose-950/40'
                      : 'border-slate-200 dark:border-slate-750 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="bulkDeleteResolutionMode"
                    checked={bulkDeleteResolutionMode === 'cascade'}
                    onChange={() => setBulkDeleteResolutionMode('cascade')}
                    className="mt-0.5 text-rose-600 focus:ring-rose-500"
                  />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">
                      Cascade Delete All Subcategories
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Permanently delete selected categories AND all {unselectedDescendantIds.size} child subcategories. Products will be unassigned to "Uncategorized".
                    </p>
                  </div>
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsBulkDeleteModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBulkDelete}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer shadow-2xs"
                >
                  Confirm Bulk Deletion
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* AUDIT LOG MODAL */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-3xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-150 pb-3">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-indigo-600" />
                <h3 className="font-display font-bold text-base text-slate-900">
                  Category Change Audit Logs
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAuditModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-x-auto max-h-[450px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono font-bold text-[9.5px] uppercase">
                  <tr>
                    <th className="py-2.5 px-4">Timestamp</th>
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4">Action</th>
                    <th className="py-2.5 px-4">Changes</th>
                    <th className="py-2.5 px-4">User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 font-sans">
                  {auditLogs.length > 0 ? (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 font-mono text-[10.5px] text-slate-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {log.categoryName}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono font-bold text-[10px] uppercase">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{log.changes}</td>
                        <td className="py-3 px-4 font-semibold text-slate-700">{log.changedBy}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No audit logs recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-150">
              <button
                type="button"
                onClick={() => setIsAuditModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs cursor-pointer"
              >
                Close Audit Logs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
