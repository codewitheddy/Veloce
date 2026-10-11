/**
 * Product Synchronization Service
 * Provides real-time product updates through intelligent polling and cross-tab synchronization
 * Detects new/updated/deleted products and notifies subscribers automatically
 */

import { Product } from '../types';
import { productsApi, PaginatedProductsResponse } from '../api/products';

export interface ProductSyncOptions {
  pollIntervalMs?: number; // Default 10 seconds
  enableCrossTabSync?: boolean; // Default true
  enableConsoleLogging?: boolean; // Default false
}

export interface ProductSyncEvent {
  type: 'products-added' | 'products-updated' | 'products-deleted' | 'products-refreshed';
  productIds: string[];
  products?: Product[];
  timestamp: number;
}

type SyncEventHandler = (event: ProductSyncEvent) => void;

const STORAGE_KEY = 'ropenix_product_sync_state';
const STORAGE_EVENT_KEY = 'ropenix_product_sync_event';
const DEFAULT_POLL_INTERVAL_MS = 10000; // 10 seconds
const MAX_PRODUCTS_HISTORY = 500; // Track recent products for diff detection

/**
 * Singleton product sync service
 * Automatically detects product changes and notifies all subscribers
 */
class ProductSyncService {
  private subscribers: Map<string, SyncEventHandler> = new Map();
  private pollIntervalId: NodeJS.Timeout | null = null;
  private previousProductsMap: Map<string, Product> = new Map();
  private isPolling = false;
  private options: Required<ProductSyncOptions>;
  private lastPollTimestamp = 0;
  private consecutiveFailures = 0;
  private maxConsecutiveFailures = 5;
  private isInitialized = false;

  constructor(options: ProductSyncOptions = {}) {
    this.options = {
      pollIntervalMs: options.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS,
      enableCrossTabSync: options.enableCrossTabSync !== false,
      enableConsoleLogging: options.enableConsoleLogging || false,
    };

    // Listen for cross-tab sync events
    if (this.options.enableCrossTabSync) {
      window.addEventListener('storage', (event) => this.handleStorageEvent(event));
    }

    // Listen for page visibility changes to adjust polling
    document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
  }

  /**
   * Subscribe to product sync events
   */
  subscribe(handler: SyncEventHandler): string {
    const subscriptionId = `sub_${Date.now()}_${Math.random()}`;
    this.subscribers.set(subscriptionId, handler);
    this.log(`Subscriber added: ${subscriptionId}`);
    return subscriptionId;
  }

  /**
   * Unsubscribe from product sync events
   */
  unsubscribe(subscriptionId: string): void {
    this.subscribers.delete(subscriptionId);
    this.log(`Subscriber removed: ${subscriptionId}`);
  }

  /**
   * Start polling for product updates
   */
  startPolling(): void {
    if (this.isPolling) {
      this.log('Polling already active');
      return;
    }

    this.isPolling = true;
    this.log('Starting product sync polling');

    // Initial poll immediately
    this.poll();

    // Then poll at regular intervals
    this.pollIntervalId = setInterval(() => {
      // Skip polling if page is hidden (save resources)
      if (document.hidden) {
        return;
      }
      this.poll();
    }, this.options.pollIntervalMs);
  }

  /**
   * Stop polling for product updates
   */
  stopPolling(): void {
    if (!this.isPolling) {
      this.log('Polling not active');
      return;
    }

    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }

    this.isPolling = false;
    this.log('Stopped product sync polling');
  }

  /**
   * Force an immediate poll
   */
  async forcePoll(): Promise<void> {
    this.log('Force polling triggered');
    await this.poll();
  }

  /**
   * Get current polling status
   */
  isActive(): boolean {
    return this.isPolling;
  }

  /**
   * Single poll operation to fetch and compare products
   */
  private async poll(): Promise<void> {
    try {
      const now = Date.now();
      this.lastPollTimestamp = now;

      // Fetch current products from backend
      const response: PaginatedProductsResponse = await productsApi.getProducts({
        page_size: 1000, // Fetch more products at once
      });

      this.consecutiveFailures = 0;
      const currentProducts = response.results || [];

      // Establish baseline snapshot on first poll to prevent broadcasting all existing items as new
      if (!this.isInitialized) {
        this.updatePreviousProductsMap(currentProducts);
        this.isInitialized = true;
        this.log(`Initial baseline snapshot established with ${currentProducts.length} products`);
        return;
      }

      // Compare with previous state
      const changes = this.detectChanges(currentProducts);

      if (changes.added.length > 0 || changes.updated.length > 0 || changes.deleted.length > 0) {
        this.log(
          `Changes detected: +${changes.added.length} products added, ~${changes.updated.length} updated, -${changes.deleted.length} deleted`
        );

        // Notify about specific changes
        if (changes.added.length > 0) {
          this.notifySubscribers({
            type: 'products-added',
            productIds: changes.added.map((p) => p.id),
            products: changes.added,
            timestamp: now,
          });
          this.broadcastCrossTabEvent('added', changes.added);
        }

        if (changes.updated.length > 0) {
          this.notifySubscribers({
            type: 'products-updated',
            productIds: changes.updated.map((p) => p.id),
            products: changes.updated,
            timestamp: now,
          });
          this.broadcastCrossTabEvent('updated', changes.updated);
        }

        if (changes.deleted.length > 0) {
          this.notifySubscribers({
            type: 'products-deleted',
            productIds: changes.deleted,
            timestamp: now,
          });
          this.broadcastCrossTabEvent('deleted', changes.deleted);
        }
      }

      // Update previous state
      this.updatePreviousProductsMap(currentProducts);
    } catch (error) {
      this.consecutiveFailures++;
      this.log(`Poll failed (${this.consecutiveFailures}/${this.maxConsecutiveFailures}): ${error}`);

      // Stop polling after too many failures to avoid spam
      if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
        this.log('Too many consecutive failures, stopping polling');
        this.stopPolling();
      }
    }
  }

  /**
   * Detect changes between current and previous product states
   */
  private detectChanges(
    currentProducts: Product[]
  ): {
    added: Product[];
    updated: Product[];
    deleted: string[];
  } {
    const added: Product[] = [];
    const updated: Product[] = [];
    const deleted: string[] = [];

    const currentMap = new Map(currentProducts.map((p) => [p.id, p]));

    // Detect additions and updates
    for (const product of currentProducts) {
      const previous = this.previousProductsMap.get(product.id);
      if (!previous) {
        added.push(product);
      } else if (this.hasProductChanged(previous, product)) {
        updated.push(product);
      }
    }

    // Detect deletions
    for (const previousId of this.previousProductsMap.keys()) {
      if (!currentMap.has(previousId)) {
        deleted.push(previousId);
      }
    }

    return { added, updated, deleted };
  }

  /**
   * Check if a product has meaningfully changed
   */
  private hasProductChanged(previous: Product, current: Product): boolean {
    // Compare key fields that users care about
    const keysToCompare = [
      'name',
      'price',
      'basePrice',
      'stock',
      'category',
      'imageUrl',
      'status',
      'tags',
      'rating',
      'reviewsCount',
    ];

    for (const key of keysToCompare) {
      const prevValue = (previous as any)[key];
      const currValue = (current as any)[key];

      // Handle arrays and objects
      if (Array.isArray(prevValue) && Array.isArray(currValue)) {
        if (JSON.stringify(prevValue) !== JSON.stringify(currValue)) {
          return true;
        }
      } else if (prevValue !== currValue) {
        return true;
      }
    }

    return false;
  }

  /**
   * Update the map of previously seen products
   */
  private updatePreviousProductsMap(products: Product[]): void {
    this.previousProductsMap.clear();

    // Keep only recent products to avoid memory bloat
    const recentProducts = products.slice(0, MAX_PRODUCTS_HISTORY);
    for (const product of recentProducts) {
      this.previousProductsMap.set(product.id, product);
    }
  }

  /**
   * Notify all subscribers about a sync event
   */
  private notifySubscribers(event: ProductSyncEvent): void {
    this.log(`Notifying ${this.subscribers.size} subscribers about event: ${event.type}`);
    for (const handler of this.subscribers.values()) {
      try {
        handler(event);
      } catch (error) {
        console.error('[ProductSync] Error in subscriber handler:', error);
      }
    }
  }

  /**
   * Broadcast sync events to other tabs via localStorage
   */
  private broadcastCrossTabEvent(
    type: 'added' | 'updated' | 'deleted',
    data: Product[] | string[]
  ): void {
    if (!this.options.enableCrossTabSync) return;

    try {
      const event = {
        type,
        data,
        sourceTabId: this.getTabId(),
        timestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_EVENT_KEY, JSON.stringify(event));
    } catch (error) {
      this.log(`Failed to broadcast cross-tab event: ${error}`);
    }
  }

  /**
   * Handle storage events from other tabs
   */
  private handleStorageEvent(event: StorageEvent): void {
    if (event.key !== STORAGE_EVENT_KEY || !event.newValue) return;

    try {
      const syncEvent = JSON.parse(event.newValue);

      // Ignore events from this tab
      if (syncEvent.sourceTabId === this.getTabId()) {
        return;
      }

      this.log(`Received cross-tab sync event: ${syncEvent.type}`);

      // Notify subscribers about the cross-tab event
      const eventType = syncEvent.type as ProductSyncEvent['type'];
      const productIds = Array.isArray(syncEvent.data)
        ? syncEvent.data.map((item: any) => (typeof item === 'string' ? item : item.id))
        : [];

      this.notifySubscribers({
        type: eventType,
        productIds,
        products: Array.isArray(syncEvent.data) && syncEvent.data[0] && typeof syncEvent.data[0] === 'object' ? syncEvent.data : undefined,
        timestamp: syncEvent.timestamp,
      });
    } catch (error) {
      this.log(`Failed to parse cross-tab sync event: ${error}`);
    }
  }

  /**
   * Handle visibility changes (pause polling when tab is hidden)
   */
  private handleVisibilityChange(): void {
    if (document.hidden) {
      this.log('Page hidden, polling will pause');
    } else {
      this.log('Page visible, resuming polling');
      // Force immediate poll when page becomes visible
      this.forcePoll().catch(() => {
        /* ignore */
      });
    }
  }

  /**
   * Get unique tab identifier
   */
  private getTabId(): string {
    let tabId = sessionStorage.getItem('ropenix_tab_id');
    if (!tabId) {
      tabId = `tab_${Date.now()}_${Math.random()}`;
      sessionStorage.setItem('ropenix_tab_id', tabId);
    }
    return tabId;
  }

  /**
   * Log debug message
   */
  private log(message: string): void {
    if (this.options.enableConsoleLogging) {
      console.log(`[ProductSync] ${message}`);
    }
  }
}

// Create singleton instance
let syncServiceInstance: ProductSyncService | null = null;

/**
 * Get or create the singleton ProductSync service
 */
export function getProductSyncService(options?: ProductSyncOptions): ProductSyncService {
  if (!syncServiceInstance) {
    syncServiceInstance = new ProductSyncService(options);
  }
  return syncServiceInstance;
}

export default ProductSyncService;
