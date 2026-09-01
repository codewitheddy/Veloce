/**
 * Centralized Toast Notification Dispatcher
 * Provides an event-driven, reactive toast notification manager for UI feedback across the app.
 */

export type ToastType = 'error' | 'warning' | 'info' | 'success';

export interface ToastAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  details?: string[];
  statusCode?: number;
  duration?: number; // Duration in milliseconds. Set to 0 or null for persistent.
  action?: ToastAction;
  timestamp: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

class ToastManager {
  private toasts: ToastItem[] = [];
  private listeners: Set<ToastListener> = new Set();
  private maxToasts = 5;

  private notify() {
    const list = [...this.toasts];
    this.listeners.forEach((listener) => {
      try {
        listener(list);
      } catch (err) {
        console.error('Toast listener error:', err);
      }
    });
  }

  public subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    listener([...this.toasts]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public show(options: {
    type?: ToastType;
    title: string;
    message: string;
    details?: string[];
    statusCode?: number;
    duration?: number;
    action?: ToastAction;
  }): string {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const duration = options.duration !== undefined ? options.duration : options.type === 'error' ? 7000 : 5000;

    const newToast: ToastItem = {
      id,
      type: options.type || 'info',
      title: options.title,
      message: options.message,
      details: options.details && options.details.length > 0 ? options.details : undefined,
      statusCode: options.statusCode,
      duration,
      action: options.action,
      timestamp: Date.now(),
    };

    // Avoid duplicate error toasts with the exact same title & message within 2 seconds
    const isDuplicate = this.toasts.some(
      (t) =>
        t.title === newToast.title &&
        t.message === newToast.message &&
        Date.now() - t.timestamp < 2000
    );

    if (isDuplicate) {
      return id;
    }

    // Keep list bounded to maxToasts
    this.toasts = [newToast, ...this.toasts.slice(0, this.maxToasts - 1)];
    this.notify();

    return id;
  }

  public error(title: string, message: string, options?: Partial<Omit<ToastItem, 'id' | 'type' | 'title' | 'message' | 'timestamp'>>) {
    return this.show({
      type: 'error',
      title,
      message,
      ...options,
    });
  }

  public warning(title: string, message: string, options?: Partial<Omit<ToastItem, 'id' | 'type' | 'title' | 'message' | 'timestamp'>>) {
    return this.show({
      type: 'warning',
      title,
      message,
      ...options,
    });
  }

  public info(title: string, message: string, options?: Partial<Omit<ToastItem, 'id' | 'type' | 'title' | 'message' | 'timestamp'>>) {
    return this.show({
      type: 'info',
      title,
      message,
      ...options,
    });
  }

  public success(title: string, message: string, options?: Partial<Omit<ToastItem, 'id' | 'type' | 'title' | 'message' | 'timestamp'>>) {
    return this.show({
      type: 'success',
      title,
      message,
      ...options,
    });
  }

  public dismiss(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  public clearAll() {
    this.toasts = [];
    this.notify();
  }

  public getToasts(): ToastItem[] {
    return [...this.toasts];
  }
}

export const toast = new ToastManager();
