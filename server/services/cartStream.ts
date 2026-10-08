/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response } from 'express';
import { EventEmitter } from 'events';

export interface CartStreamEvent {
  type?: 'product:updated' | 'product:deleted' | 'inventory:updated' | 'price:updated' | 'cart:invalidated' | string;
  productId: string;
  productName?: string;
  price?: number;
  original_price?: number | null;
  stock?: number;
  oldPrice?: number;
  newPrice?: number;
  oldStock?: number;
  newStock?: number;
  status?: string;
  deleted?: boolean;
  hasVariants?: boolean;
  options?: any[];
  variants?: any[];
  variant_matrix?: any[];
  images?: string[];
  image_url?: string;
  imageUrl?: string;
  name?: string;
  timestamp?: string;
  data?: any;
  [key: string]: any;
}

interface SseClient {
  id: string;
  res: Response;
  productIds: Set<string>;
  connectedAt: Date;
  lastHeartbeat: Date;
}

class CartStreamManager extends EventEmitter {
  private clients: Map<string, SseClient> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startHeartbeat();
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      const now = new Date();
      for (const [id, client] of this.clients.entries()) {
        try {
          client.res.write(`: heartbeat ${now.toISOString()}\n\n`);
          client.lastHeartbeat = now;
        } catch {
          this.removeClient(id);
        }
      }
    }, 20000); // 20s heartbeat
  }

  /**
   * Registers a new SSE client connection
   */
  public addClient(req: Request, res: Response, initialProductIds: string[] = []): string {
    const clientId = `sse-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable proxy buffering for Nginx
    });

    res.flushHeaders?.();

    const productSet = new Set<string>(initialProductIds.filter(Boolean));
    const client: SseClient = {
      id: clientId,
      res,
      productIds: productSet,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
    };

    this.clients.set(clientId, client);

    // Send initial connected acknowledgement
    res.write(`event: connected\ndata: ${JSON.stringify({ clientId, subscribedCount: productSet.size })}\n\n`);

    req.on('close', () => {
      this.removeClient(clientId);
    });

    return clientId;
  }

  /**
   * Updates the set of product IDs a client is listening to
   */
  public updateSubscriptions(clientId: string, productIds: string[]): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;
    client.productIds = new Set(productIds.filter(Boolean));
    return true;
  }

  /**
   * Removes an SSE client
   */
  public removeClient(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.res.end();
      } catch (_) {}
      this.clients.delete(clientId);
    }
  }

  /**
   * Broadcasts product changes to clients holding the product in their cart
   */
  public broadcastProductChange(productId: string, eventData: Partial<CartStreamEvent>) {
    const payload: CartStreamEvent = {
      type: eventData.type || 'product:updated',
      productId,
      productName: eventData.productName,
      oldPrice: eventData.oldPrice,
      newPrice: eventData.newPrice,
      oldStock: eventData.oldStock,
      newStock: eventData.newStock,
      status: eventData.status,
      timestamp: new Date().toISOString(),
      data: eventData.data,
    };

    const message = `event: product:updated\ndata: ${JSON.stringify(payload)}\n\n`;

    for (const [id, client] of this.clients.entries()) {
      // If client has subscribed to this productId, or if subscribed to 'all'
      if (client.productIds.has(productId) || client.productIds.has('*') || client.productIds.size === 0) {
        try {
          client.res.write(message);
        } catch {
          this.removeClient(id);
        }
      }
    }

    this.emit('broadcast', payload);
  }

  /**
   * Returns current active client count
   */
  public getClientCount(): number {
    return this.clients.size;
  }
}

export const cartStreamManager = new CartStreamManager();
