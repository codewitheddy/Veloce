# Real-Time Product Synchronization - Testing Guide

## Overview
The application now has automatic real-time product synchronization implemented. This means:
- Admin product updates appear instantly for all users without page refresh
- New products added by admin appear immediately in customer catalogs
- Product deletions are reflected instantly
- Changes sync across multiple browser tabs automatically
- Polling happens every 10 seconds with intelligent pausing when page is hidden

## Architecture

### Components
1. **ProductSync Service** (`src/services/productSync.ts`)
   - Polls backend for product changes every 10 seconds
   - Detects additions, updates, and deletions by comparing product snapshots
   - Notifies subscribers about changes
   - Broadcasts events to other browser tabs via localStorage

2. **useProductSync Hook** (`src/hooks/useProductSync.ts`)
   - Integrates ProductSync with React Query cache
   - Automatically invalidates product list queries on changes
   - Updates individual product cache entries
   - Subscribes to sync events

3. **QueryProvider** (`src/providers/QueryProvider.tsx`)
   - Activates ProductSync on app startup
   - Runs ProductSync polling for entire app lifecycle
   - Automatically updates UI when cache is invalidated

4. **Product Mutations** (`src/queries/useProducts.ts`)
   - Notify other tabs immediately when products are created/updated/deleted
   - Trigger cache invalidation
   - Enable instant cross-tab synchronization

## Testing Steps

### Test 1: Basic Product Update (Single Tab)
1. Open admin dashboard in one tab
2. Add a new product or update an existing product's price/name
3. **Expected**: Product list updates automatically within 10 seconds, no refresh needed
4. **Verification**: Check browser console for `[useProductSync]` logs showing cache invalidation

### Test 2: Cross-Tab Synchronization
1. Open two browser tabs to the same application
2. In Tab 1: Navigate to admin dashboard
3. In Tab 2: Stay on product catalog/home page
4. In Tab 1: Create a new product
5. **Expected**: Tab 2 automatically shows the new product within 10 seconds
6. **Verification**: Console logs in Tab 2 show cache invalidation events

### Test 3: Multiple Admin Operations
1. Open admin dashboard
2. Perform these operations in sequence:
   - Update a product price
   - Change product stock
   - Update product category
   - Delete a product
3. **Expected**: Each change reflects instantly in the UI
4. **Verification**: Product list re-renders without manual refresh

### Test 4: Product Addition Detection
1. Open product catalog
2. In separate tab/window, add a new product as admin
3. **Expected**: New product appears in catalog within 10 seconds
4. **Verification**: No page refresh required, product appears in list with proper data

### Test 5: Offline Handling
1. Open product catalog
2. Open DevTools Network tab, set to "Offline"
3. Admin adds a product (on different device/tab)
4. Go back online
5. **Expected**: App detects reconnection and fetches latest products
6. **Verification**: New products appear after reconnection

### Test 6: Performance - Large Catalog
1. Ensure you have 100+ products in catalog
2. Open product catalog
3. Admin updates a product
4. **Expected**: Update reflects quickly (within 10 seconds), no UI lag
5. **Verification**: Console shows reasonable memory usage, no significant lag

### Test 7: Hidden Tab Behavior
1. Open product catalog in Tab 1
2. Switch to Tab 2 (other application/tab)
3. In Tab 3, admin adds a product
4. Switch back to Tab 1
5. **Expected**: Product appears immediately (polling resumes from hidden state)
6. **Verification**: See "Page visible, resuming polling" in console logs

### Test 8: Cross-Tab Event Broadcasting
1. Open two tabs
2. In Tab 1: Admin dashboard
3. In Tab 2: Product catalog
4. In Tab 1: Add/update/delete product
5. **Expected**: Tab 2 shows changes instantly
6. **Verification**: Check localStorage for `ropenix_product_sync_event` key changes

## Console Debugging

### Enable Console Logging
In development mode, ProductSync will log to console. Look for messages like:
```
[ProductSync] Starting product sync polling
[ProductSync] Changes detected: +1 products added, ~0 updated, -0 deleted
[ProductSync] Notifying 1 subscribers about event: products-added
[useProductSync] Received sync event: products-added (1 products)
```

### Monitor Cache Invalidation
React Query DevTools (bottom right corner) shows:
- Which queries are being invalidated
- Cache hit/miss rates
- Query stale times

### Check Polling Status
```javascript
// In browser console
const syncService = window.__productSyncService;
syncService.isActive(); // Should return true
```

## Configuration

### Adjust Polling Interval
In `src/providers/QueryProvider.tsx`, modify:
```javascript
pollIntervalMs: 10000, // Change from 10 seconds to desired interval
```

### Disable Console Logging
In `src/providers/QueryProvider.tsx`, modify:
```javascript
enableConsoleLogging: false, // Change from import.meta.env.DEV
```

### Disable Cross-Tab Sync
In `src/services/productSync.ts`, pass options:
```javascript
enableCrossTabSync: false,
```

## Performance Considerations

- **Polling**: 10 seconds is a good balance between real-time and server load
- **Memory**: Tracks only last 500 products for change detection (configurable)
- **Hidden Tabs**: Pauses polling when tab is hidden, saves resources
- **Failures**: Stops polling after 5 consecutive failures to prevent spam
- **Cache**: Leverages React Query's 5-minute stale time to avoid excessive refetches

## Known Limitations

1. **Initial Product Load**: First sync takes 10 seconds. For immediate updates, use cache invalidation in mutations (already implemented)
2. **Large Catalogs**: 1000+ products may take longer to poll. Consider pagination in backend if needed
3. **Network Latency**: Real-time depends on network speed. Slower connections = slower sync
4. **Polling Only**: This implementation uses polling, not WebSocket. For high-frequency updates, consider WebSocket upgrade

## Troubleshooting

### Products Not Updating
1. Check browser console for errors
2. Verify polling is active: `getProductSyncService().isActive()`
3. Check Network tab for failed API requests
4. Verify backend is returning products correctly

### High CPU Usage
1. Reduce polling interval
2. Check for browser extensions interfering
3. Verify no infinite loops in change detection

### Cache Not Invalidating
1. Check if useProductSync hook is being used
2. Verify QueryProvider is wrapping the app
3. Check React Query DevTools for cache status

### Cross-Tab Sync Not Working
1. Verify localStorage is enabled
2. Check localStorage for `ropenix_product_sync_event` key
3. Ensure both tabs are on same domain

## Deployment Notes

- Real-time sync works on cPanel hosting without WebSocket support
- No additional backend changes required
- Works with existing REST API
- Should be deployed as-is without modifications
- Monitor polling requests in server logs (~6 requests/minute per user)

## Success Criteria

✓ Admin creates product → appears in catalog within 10 seconds without refresh
✓ Admin updates product price → customers see new price without refresh
✓ Admin deletes product → product disappears from catalog without refresh
✓ Multiple browser tabs stay synchronized
✓ New features work on both development and production environments
