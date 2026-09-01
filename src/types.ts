/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ReviewStatus = 'Published' | 'Pending Moderation' | 'Hidden' | 'Removed';

export interface Review {
  id: string;
  productId?: string;
  orderId?: string;
  userId?: string | number;
  userEmail?: string;
  userName: string;
  reviewerDisplayName?: string;
  rating: number;
  title?: string;
  comment: string;
  mediaUrls?: string[];
  verifiedPurchase?: boolean;
  status?: ReviewStatus;
  date: string;
  createdAt?: string;
  updatedAt?: string;
  isEdited?: boolean;
  helpfulVotes?: number;
  helpfulUserIds?: string[];
  purchasedVariant?: string;
}

export interface ReviewEligibilityCheck {
  eligible: boolean;
  orderId?: string;
  reason?: 'NOT_LOGGED_IN' | 'NOT_PURCHASED' | 'ORDER_NOT_DELIVERED' | 'ALREADY_REVIEWED' | 'ELIGIBLE';
  message: string;
  existingReview?: Review;
  purchasedVariant?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  description?: string;
  imageUrl?: string;
  status: 'Active' | 'Inactive';
  displayOrder?: number;
  productCount?: number;
  createdAt?: string;
  updatedAt?: string;
  editedBy?: string;
  previousSlugs?: string[];
  fieldOverrides?: {
    typeOverride?: 'clothes' | 'food' | 'beauty' | 'electronics' | 'general';
    customAttributes?: string[];
  };
}

export interface CategoryAuditLog {
  id: string;
  categoryId: string;
  categoryName: string;
  action: 'create' | 'update' | 'reparent' | 'status_change' | 'delete' | 'bulk_action';
  changedBy: string;
  changes: string;
  timestamp: string;
}

export interface ProductVariant {
  id: string;
  sku: string;
  attributes: Record<string, string>; // e.g. { size: "42", color: "Black" }
  priceOverride?: number | null;
  price?: number | null;
  stockQty: number;
  imageIndex?: number;
}

export interface Product {
  id: string;
  sku: string;
  slug?: string;
  name: string;
  brand?: string;
  description: string;
  shortDescription?: string;
  detailedDescription?: string;
  price: number;
  basePrice?: number;
  salePrice?: number | null;
  saleStartAt?: string;
  saleEndAt?: string;
  saleEndDate?: string;
  costPrice?: number;
  cost_price?: number;
  taxStatus?: 'taxable' | 'zero_rated' | 'exempt';
  taxRate?: number; // e.g. 16% VAT
  taxClass?: string; // 'standard' | 'reduced' | 'zero_rated' | 'exempt'
  currency?: string;
  category: string;
  subcategoryId?: string;
  tags: string[];
  type: 'physical' | 'digital' | 'service';
  imageUrl: string;
  images?: string[];
  gallery_images?: string[];
  imageAltTexts?: Record<number, string>;
  videoUrl?: string;
  images360?: string[];
  stock: number | null; // null for digital or service
  lowStockThreshold?: number;
  trackInventory?: boolean;
  hasVariants?: boolean;
  variantAttributes?: string[]; // e.g. ['size', 'color']
  variantMatrix?: ProductVariant[];
  variations?: { name: string; options: string[] }[];
  rating: number;
  reviewsCount: number;
  reviews: Review[];
  digitalFileUrl?: string;
  previousPrice?: number;
  originalPrice?: number;
  original_price?: number;
  backInStockAlert?: boolean;
  taxId?: string;
  status?: 'Active' | 'Inactive' | 'Draft' | 'Archived' | 'scheduled' | 'published' | 'draft' | 'archived';
  publishAt?: string;
  paymentRestriction?: 'prepaid' | 'cod' | 'both';
  features?: string[];
  specifications?: { key: string; value: string }[];
  specs?: { label: string; value: string }[];
  whatsInTheBox?: string;
  
  // Category-Specific Fields: Clothes & Wearables
  sizeGuide?: string;
  availableSizes?: string[];
  material?: string;
  colorOptions?: string[];
  careInstructions?: string;

  // Category-Specific Fields: Food & Beverages
  ingredients?: string;
  manufacturer?: string;
  countryOfOrigin?: string;
  allergyInfo?: string[];
  allergyTracesNotes?: string;
  nutritionalInfo?: string;
  storageInstructions?: string;

  // Category-Specific Fields: Perfumes & Beauty Products
  beautyIngredients?: string;
  howToUse?: string;
  beautyManufacturer?: string;
  beautyCountryOfOrigin?: string;
  beautyAllergyInfo?: string[];
  volumeNetWeight?: string;

  // Expiry Date Tracking (Perishable / Dated Products)
  hasExpiryDate?: boolean;
  expiryDate?: string; // YYYY-MM-DD
  batchLotNumber?: string;

  // SEO & Social
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  // Shipping & Logistics
  weightKg?: number;
  dimensionsCm?: { length: number; width: number; height: number };
  shippingClass?: 'standard' | 'fragile' | 'oversized';
  deliveryZones?: string[];
  relatedProducts?: string[];
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedVariations: Record<string, string>;
}

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  readTime: string;
  date: string;
  author: string;
  imageUrl: string;
}

export interface OrderStatusHistoryEntry {
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'pending-cancellation';
  timestamp: string;
  note?: string;
}

export interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  items: {
    productId: string;
    name: string;
    price: number;
    quantity: number;
    selectedVariations: Record<string, string>;
    type: 'physical' | 'digital' | 'service';
    taxStatus?: 'taxable' | 'zero_rated' | 'exempt';
    taxRate?: number;
    taxClass?: string;
    lineSubtotal?: number;
    lineTax?: number;
  }[];
  total: number;
  subtotal?: number;
  taxTotal?: number;
  shippingFee?: number;
  shippingTaxAmount?: number;
  discountAmount?: number;
  discount?: number;
  tax?: number;
  phone?: string;
  trackingNumber?: string;
  notes?: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'pending-cancellation' | 'shipped';
  date: string;
  couponCode?: string;
  customNote?: string;
  shippingAddress?: string;
  fulfillmentType?: 'delivery' | 'pickup';
  pickupLocation?: string;
  pickupContactPhone?: string;
  pickupEstimatedTime?: string;
  notesHistory?: { id: string; text: string; timestamp: string }[];
  statusHistory?: OrderStatusHistoryEntry[];
  isGuest?: boolean;
  paymentMethod?: 'mpesa' | 'cod' | string;
  paymentStatus?: 'unpaid' | 'paid' | 'pending' | 'refunded';
  paymentReference?: string;
  mpesaPhone?: string;
  paidAt?: string;
  review_request_sent_at?: string | null;
  review_request_status?: 'pending_delay' | 'sent' | 'opted_out' | 'already_reviewed' | 'cancelled';
}

export interface ReviewRequestLog {
  id: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  sentAt: string;
  delayDays: number;
  status: 'sent' | 'opened' | 'clicked' | 'reviewed';
  itemsCount: number;
  clickedProductId?: string;
  reviewedProductId?: string;
}

export interface ReviewRequestSettings {
  enabled: boolean;
  delayDays: number; // Configurable delay (0 for instant/test mode, 3-7 days default 3)
  autoTriggerOnDelivery: boolean;
  incentiveDiscountPercent?: number;
}

export interface CouponItem {
  percent: number;
  expiryDate?: string; // YYYY-MM-DD format or ISO string (e.g. "2027-12-31")
  desc?: string;
  minSpend?: number;
  maxDiscount?: number;
  active?: boolean;
  isActive?: boolean;
}

export type CouponRecord = Record<string, number | CouponItem>;

export interface InventoryAuditLog {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  timestamp: string;
  changeQuantity: number; // e.g., -5, +20
  newStock: number;
  reason: 'manual-update' | 'order-placement' | 'restock' | 'system-init';
  details?: string; // e.g., "Order #1002" or "Manual restock"
}

export type ReturnStatus = 
  | 'pending_review' 
  | 'approved' 
  | 'rejected' 
  | 'request_info' 
  | 'awaiting_shipment' 
  | 'in_transit' 
  | 'received' 
  | 'inspecting' 
  | 'refund_processing' 
  | 'completed' 
  | 'cancelled' 
  | 'pending' 
  | 'resolved';

export type ResolutionType = 'refund' | 'replacement' | 'store_credit' | 'none';
export type RefundMethod = 'original_payment' | 'mpesa' | 'store_credit' | 'bank_transfer';
export type ReturnReason = 
  | 'damaged_defective' 
  | 'wrong_item' 
  | 'not_as_described' 
  | 'size_fit_issue' 
  | 'changed_mind' 
  | 'better_price' 
  | 'defective' 
  | 'bad_fit' 
  | 'other';

export type ConditionReported = 'unopened' | 'opened_unused' | 'used' | 'damaged';
export type InspectionOutcome = 'approved' | 'partially_approved' | 'rejected' | 'pending';

export interface ReturnItem {
  id?: string;
  orderItemId?: string;
  productId: string;
  name: string;
  quantity: number;
  price: number;
  selectedVariations?: Record<string, string>;
  reason?: ReturnReason;
  reasonDetail?: string;
  conditionReported?: ConditionReported;
  evidenceImages?: string[];
  inspectionOutcome?: InspectionOutcome;
  inspectionNotes?: string;
  refundLineAmount?: number;
  restockAction?: 'restock_sellable' | 'write_off_damaged' | 'pending';
}

export interface ReturnStatusHistoryEntry {
  id: string;
  returnRequestId: string;
  fromStatus: ReturnStatus;
  toStatus: ReturnStatus;
  changedBy: string;
  note?: string;
  timestamp: string;
}

export interface ReturnPolicy {
  returnWindowDays: number;
  excludedCategories: string[];
  freeReturnReasons: ReturnReason[];
  requiresPhotoEvidence: boolean;
  autoApproveThresholdKes?: number;
  customerPaysReturnShippingOnMindChange: boolean;
}

export interface StoreCreditTransaction {
  id: string;
  customerEmail: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  timestamp: string;
  returnRequestId?: string;
  orderId?: string;
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  items: ReturnItem[];
  type: 'refund' | 'exchange' | 'replacement' | 'store_credit';
  resolutionType?: ResolutionType;
  refundMethod?: RefundMethod;
  reason: ReturnReason;
  reasonDetails?: string;
  exchangeVariant?: string;
  status: ReturnStatus;
  dateSubmitted: string;
  requestedAt?: string;
  reviewedAt?: string;
  resolvedAt?: string;
  refundAmount?: number;
  adminNote?: string;
  adminNotes?: string;
  customerNotes?: string;
  userNotes?: string;
  trackingNumber?: string;
  evidenceImages?: string[];
  statusHistory?: ReturnStatusHistoryEntry[];
  mpesaPhoneNumber?: string;
  isFraudFlagged?: boolean;
  fraudFlagReason?: string;
}

export type HeroSlideTemplate = 
  | 'two_column'
  | 'bold_editorial' 
  | 'minimal_gradient' 
  | 'card_split' 
  | 'glass_overlay' 
  | 'flash_deal' 
  | 'dark_luxury';

export interface HeroBanner {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  badge_text?: string;
  badgeText?: string;
  primary_button_text?: string;
  primaryButtonText?: string;
  primary_button_url?: string;
  primaryButtonUrl?: string;
  secondary_button_text?: string;
  secondaryButtonText?: string;
  secondary_button_url?: string;
  secondaryButtonUrl?: string;
  hero_image?: string | null;
  hero_image_url?: string;
  hero_image_full_url?: string;
  heroImage?: string;
  imageUrl?: string;
  background_type?: 'color' | 'image' | 'gradient';
  backgroundType?: 'color' | 'image' | 'gradient';
  background_color?: string;
  backgroundColor?: string;
  bgColor?: string;
  background_image?: string | null;
  background_image_url?: string;
  background_image_full_url?: string;
  backgroundImage?: string;
  bgImageUrl?: string;
  background_position?: 'center' | 'top' | 'bottom' | 'left' | 'right' | string;
  backgroundPosition?: 'center' | 'top' | 'bottom' | 'left' | 'right' | string;
  overlay_enabled?: boolean;
  overlayEnabled?: boolean;
  overlay_color?: string;
  overlayColor?: string;
  bgOverlayColor?: string;
  overlay_opacity?: number;
  overlayOpacity?: number;
  bgOverlayOpacity?: number;
  text_color?: string;
  textColor?: string;
  is_active?: boolean;
  active?: boolean;
  display_order?: number;
  displayOrder?: number;
  start_date?: string | null;
  startDate?: string | null;
  end_date?: string | null;
  endDate?: string | null;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  // Legacy / styling props for backwards compatibility
  templateId?: HeroSlideTemplate;
  tagline?: string;
  ctaText?: string;
  ctaUrl?: string;
  secondaryCtaText?: string;
  secondaryCtaUrl?: string;
  promoCode?: string;
  discountBadge?: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
  columnLayout?: 'left-content' | 'right-content';
  priceTag?: string;
  priceTagLabel?: string;
}

export type HeroSlide = HeroBanner;

export interface FileAttachment {
  name: string;
  size: number;
  type: string;
  url: string;
}

export interface ClothingMeasurements {
  unit: 'cm' | 'inches';
  bust: number;
  waist: number;
  hips: number;
  shoulderWidth: number;
  sleeveLength: number;
  inseam: number;
  height: number;
  customNotes?: string;
}

export type CustomClothingStatus = 'New' | 'In Review' | 'Quoted' | 'In Progress' | 'Completed' | 'Cancelled';

export interface CustomClothingRequest {
  id: string;
  referenceNo: string;
  fullName: string;
  email: string;
  phone: string;
  garmentType: string;
  otherGarmentType?: string;
  materialSamples?: FileAttachment[];
  designImages?: FileAttachment[];
  designVideos?: FileAttachment[];
  designLinks?: string[];
  measurements: ClothingMeasurements;
  preferredDeadline: string;
  budgetRange?: string;
  additionalNotes?: string;
  deliveryLocation?: string;
  status: CustomClothingStatus;
  adminNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  firstName?: string;
  preferences?: string[];
  couponCode?: string;
  discountPercent?: number;
  source?: string;
  status: 'active' | 'unsubscribed';
  welcomeEmailSent: boolean;
  subscribedAt: string;
}

export interface NewsletterSubscribeResponse {
  success: boolean;
  message: string;
  subscriber?: NewsletterSubscriber;
  couponCode?: string;
  discountPercent?: number;
  welcomeEmailSent?: boolean;
  emailError?: string;
}

export interface AffiliateProduct {
  id: string;
  name: string;
  merchant: string;
  description: string;
  price: number;
  commissionRate: number;
  affiliateUrl: string;
  imageUrl: string;
  category: string;
  clicks?: number;
  conversions?: number;
  rating?: number;
  reviewsCount?: number;
}



