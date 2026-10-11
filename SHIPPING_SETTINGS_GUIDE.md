# Simplified Shipping & Delivery Settings

## Overview

A streamlined, user-friendly interface for managing delivery zones, pricing, promotional discounts, and free shipping thresholds. Includes a live simulator for testing delivery fee calculations.

**Component**: `SimplifiedShippingSettings.tsx`
**Location**: `src/components/SimplifiedShippingSettings.tsx`
**Status**: ✅ Production Ready

---

## Features

### 1. **Delivery Zones Management**
Configure regional delivery zones with:
- **Zone Name**: Custom region identifier (e.g., "Inner City", "Suburbs")
- **Distance Range**: Min and max delivery distance in km
- **Base Fee**: Fixed fee applied to all orders in the zone
- **Per-Km Rate**: Variable cost per kilometer traveled
- **Active/Inactive Toggle**: Enable/disable zones without deleting

**Example Zones** (Pre-configured):
```
Inner City: 0-5km | Base: KSh 0 | Per km: KSh 25
Suburbs: 5-15km | Base: KSh 150 | Per km: KSh 20
Outskirts: 15-50km | Base: KSh 300 | Per km: KSh 15
```

**Use Case**: Different pricing for urban vs rural areas, highways vs residential streets

---

### 2. **Happy Hour Windows (Promotional Discounts)**
Create time-based promotional windows with:
- **Window Name**: Promotional name (e.g., "Afternoon Rush", "Weekend Brunch")
- **Time Range**: Start and end times (24-hour format)
- **Days of Week**: Select which days the promotion applies
- **Discount %**: Percentage off delivery fee (0-100%)
- **Active Toggle**: Turn on/off without deleting

**Example Windows** (Pre-configured):
```
Afternoon Rush: Mon-Fri 14:00-16:00 | 50% OFF
Weekend Brunch: Sat-Sun 10:00-12:00 | 30% OFF
```

**Use Case**: Incentivize orders during slow periods, drive traffic during specific hours

---

### 3. **Global Delivery Settings**
Configure store-wide delivery parameters:

**Free Shipping Threshold**
- Order amount that qualifies for free delivery
- Default: KSh 5,000
- Example: Orders ≥ KSh 5,000 get free delivery

**Express Surcharge**
- Extra charge for same-day/premium delivery
- Default: KSh 150
- Applied on top of standard zone fees

**Max Delivery Radius**
- Maximum distance for any delivery (km)
- Default: 50km
- Prevents orders outside service area

---

### 4. **Live Delivery Fee Simulator**
Test delivery fee calculations in real-time:

**How It Works**:
1. Enter a test distance (km)
2. System automatically:
   - Identifies the matching zone
   - Calculates base fee + distance charge
   - Applies Happy Hour discount (if current time is in a window)
   - Applies free shipping threshold (if applicable)
3. Shows breakdown of all charges

**Example Calculation**:
```
Input: 10 km distance
Zone: Suburbs (5-15km range)
Base Fee: KSh 150
Distance Charge: 10 km × KSh 20/km = KSh 200
Subtotal: KSh 350

Happy Hour Active (50% OFF)?
- YES: Final = KSh 175
- NO: Final = KSh 350
```

---

## UI Components

### Tab Navigation
- **🎯 Zones**: Delivery zone management
- **⚡ Happy Hours**: Promotional discount windows
- **💰 Global**: Store-wide settings
- **🧭 Simulator**: Live fee calculation tool

### Actions
- **Add**: Create new zones or happy hours
- **Edit**: Modify existing entries (pencil icon)
- **Delete**: Remove entries (trash icon)
- **Save**: Persist changes to localStorage

---

## Data Persistence

All settings are stored in browser **localStorage** with keys:
- `veloce_delivery_settings` - Main configuration object

**Stored Data Structure**:
```json
{
  "zones": [
    {
      "id": "1",
      "name": "Inner City",
      "minDistanceKm": 0,
      "maxDistanceKm": 5,
      "baseFee": 0,
      "perKmRate": 25,
      "isActive": true
    }
  ],
  "happyHours": [
    {
      "id": "1",
      "name": "Afternoon Rush",
      "startTime": "14:00",
      "endTime": "16:00",
      "daysOfWeek": [1, 2, 3, 4, 5],
      "discountPercentage": 50,
      "isActive": true
    }
  ],
  "freeShippingThreshold": 5000,
  "expressSurcharge": 150,
  "maxDeliveryRadius": 50
}
```

---

## Usage Example

### Import Component
```tsx
import { SimplifiedShippingSettings } from '@/components/SimplifiedShippingSettings';

export function AdminPanel() {
  return (
    <div>
      <SimplifiedShippingSettings />
    </div>
  );
}
```

### Add to Navigation
```tsx
const [activePanel, setActivePanel] = useState('shipping');

return activePanel === 'shipping' && <SimplifiedShippingSettings />;
```

---

## Configuration Workflow

### Step 1: Set Delivery Zones
1. Click **"Add Delivery Zone"**
2. Enter zone name (e.g., "CBD")
3. Set distance range (min/max km)
4. Configure base fee and per-km rate
5. Toggle active status
6. Click **Save**

### Step 2: Create Promotions
1. Click **"Add Happy Hour Window"**
2. Enter promotion name (e.g., "Friday Special")
3. Set start/end times
4. Select applicable days
5. Enter discount percentage
6. Click **Save**

### Step 3: Adjust Global Settings
1. Go to **Global** tab
2. Modify free shipping threshold
3. Adjust express surcharge
4. Set max delivery radius
5. Click **"Save Global Settings"**

### Step 4: Test Configuration
1. Go to **Simulator** tab
2. Enter a test distance
3. View calculated fee breakdown
4. Verify costs match expectations
5. Adjust zones/rates as needed

---

## Real-World Scenarios

### Scenario 1: Nairobi Multi-Zone Pricing
```
Zone 1 - CBD (0-5km):
  Base: KSh 0 | Per km: KSh 25 | ≈ KSh 50-125

Zone 2 - Metro (5-20km):
  Base: KSh 200 | Per km: KSh 20 | ≈ KSh 300-600

Zone 3 - Suburbs (20-50km):
  Base: KSh 500 | Per km: KSh 15 | ≈ KSh 800-1250
```

### Scenario 2: Peak Hour Incentives
```
Monday-Friday 14:00-16:00: 50% OFF (drive evening orders)
Saturday 11:00-13:00: 40% OFF (Saturday lunch rush)
Sunday 18:00-20:00: 30% OFF (Sunday dinner)
```

### Scenario 3: Threshold Strategy
```
Orders < KSh 2,000: Full delivery fee applies
Orders KSh 2,000-5,000: Standard delivery fee
Orders > KSh 5,000: FREE delivery
```

---

## API Integration

To connect to backend storage, replace localStorage calls:

### Before (localStorage):
```tsx
localStorage.setItem('veloce_delivery_settings', JSON.stringify(settings));
```

### After (API):
```tsx
await api.post('/admin/delivery-settings', settings);
```

**Recommended API Endpoints**:
- `GET /admin/delivery-settings` - Fetch all settings
- `POST /admin/delivery-settings` - Save settings
- `PATCH /admin/delivery-zones/:id` - Update zone
- `DELETE /admin/delivery-zones/:id` - Delete zone

---

## Performance Considerations

✅ **Optimized**:
- Minimal re-renders (useState hooks)
- localStorage caching
- Fast calculation algorithm
- No external API calls for simulation

⚡ **Future Enhancements**:
- OpenStreetMap integration for real distance calculation
- Google Maps API for live routing
- Database persistence
- Bulk zone import/export
- Advanced analytics (usage by zone/time)

---

## Accessibility Features

- ✅ Keyboard navigation (tab through form fields)
- ✅ Color-coded status indicators
- ✅ Clear icon + text labels
- ✅ Responsive design (mobile-friendly)
- ✅ High contrast dark mode support
- ✅ Form validation feedback

---

## Troubleshooting

### Issue: Settings not saving
**Solution**: Check browser console for localStorage errors. Clear cache and try again.

### Issue: Simulator shows no fee
**Solution**: Verify test distance falls within a zone's min/max range. Check zone is active.

### Issue: Happy Hour not applying
**Solution**: 
1. Verify current time is within window range
2. Confirm today's day is selected
3. Check promotion is marked "active"

### Issue: Delete not working
**Solution**: Refresh page. Try again. Check browser permissions for localStorage write access.

---

## Browser Support

✅ Chrome, Firefox, Safari, Edge (all modern versions)
✅ Mobile browsers (iOS Safari, Android Chrome)
✅ Dark mode support

---

## Code Statistics

- **File Size**: ~18 KB
- **Lines of Code**: ~700
- **Dependencies**: React, Lucide Icons
- **Build Time**: < 1s
- **Build Status**: ✅ Exit Code 0

---

## Future Roadmap

- [ ] OpenStreetMap integration for real routing
- [ ] Distance matrix caching
- [ ] Bulk import/export (CSV)
- [ ] Zone visualization on map
- [ ] Historical analytics
- [ ] A/B testing different pricing models
- [ ] Customer notifications on fee changes
- [ ] SMS/Email alerts for promo windows

---

## Support & Feedback

For questions or improvements, please check:
1. Component implementation
2. Types interface
3. Error messages in browser console
4. localStorage data structure

---

**Component Ready for Production** ✅
