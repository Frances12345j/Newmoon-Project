## Goal
- Build complete order management flow (Customer → Staff → Rider) with real-time status tracking, map navigation, direction routes, and rider live-tracking.

## Constraints & Preferences
- Mobile app: Expo Router (file-based routing), React Native, TypeScript
- Backend: Laravel 11 (PHP), Sanctum auth, SQLite/MySQL
- Maps: Leaflet via WebView (react-native-webview), react-native-maps installed
- GPS: expo-location installed
- Icons: @expo/vector-icons
- API base URL: `http://192.168.254.119:8000/api`
- Staff manages orders: pending → confirmed → preparing → ready
- Rider manages orders: ready → picked_up → out_for_delivery → delivered (with photo proof)
- Customer sees timeline: pending → confirmed → preparing → ready → picked_up → out_for_delivery → delivered
- Real-time polling: OrderDetail polls every 10s, Staff Orders polls every 15s

## Progress
### Done
- Added Staff Orders tab (`Staff/Orders.tsx` + `Staff/_layout.tsx`)
- Added `staffIndex()` and `staffUpdateStatus()` to `OrderController.php`
- Added `GET /staff/orders` and `POST /staff/orders/{id}/status` routes (moved BEFORE `apiResource('staff', ...)` to fix route conflict)
- Fixed Carbon `toISOString()` → `toIso8601String()` bug causing 500 error
- Added `riderIndex()` and `riderUpdateStatus()` to `OrderController.php`
- Added `GET /rider/orders` and `POST /rider/orders/{id}/status` routes
- Created migration `2026_07_04_200002_add_delivery_proof_to_orders_table.php` (delivery_notes, customer_confirmed, delivery_photo, delivered_at)
- Created migration `2026_07_04_200003_add_delivery_coordinates_to_orders_table.php` (delivery_latitude, delivery_longitude)
- Created migration `2026_07_03_200001_add_rider_tracking_to_orders_table.php` (rider_latitude, rider_longitude, rider_location_updated_at)
- Updated Order model `$fillable` with all new columns
- Updated Checkout.tsx to capture GPS location (expo-location) and send `delivery_latitude`/`delivery_longitude` with order
- Updated `OrderController@store` to accept and save delivery coordinates
- Added coordinates (customer + branch) to staffIndex and riderIndex response transforms
- Changed navigate buttons in `Rider/Orders.tsx` from `openNavigation()` (Google Maps) to `router.push('/Rider/Maps')`
- Changed action modal "Navigate"/"To Branch" buttons to single "View on Map" button → Maps screen
- Fixed Maps.tsx: added `setOrders` setter, added `loadOrders()` calling `GET /rider/orders`, replaced hardcoded location sending with loaded orders
- Updated Maps.tsx DeliveryOrder interface, STATUS_MAP, STATUS_COLORS, STATUS_ICONS to cover all rider statuses
- Updated Maps.tsx `toPickup`/`toDeliver` filters to include rider statuses
- Replaced letter-based markers (R/P/O) with SVG teardrop pin + person silhouette in Maps.tsx
- Added `picked_up` step to Customer OrderDetail STATUS_FLOW (step 4), shifted later steps
- Fixed hardcoded connecting line `< 5` → `< 6` in OrderDetail.tsx
- Added pull-to-refresh (RefreshControl) to OrderDetail.tsx
- Added `updateLocation()` and `trackRider()` methods to `OrderController.php`
- Added `POST /rider/orders/{id}/location` and `GET /customer/orders/{id}/track` routes
- Rider's Maps.tsx: location sending filter changed from `status === 'Ready'` to `status === 'Picked Up' || status === 'Out for Delivery'`
- Maps.tsx: added 5s polling for `loadOrders()` and `useFocusEffect` to refresh on tab focus
- Maps.tsx: location sending interval bug fixed — was re-creating interval every 5s (due to `[riderLocation, orders]` deps) so it **never fired**. Changed to empty deps with refs storing latest riderLocation/orders.
- Maps.tsx: added fallback one-time GPS fetch via `getCurrentPositionAsync` if watcher hasn't returned position
- Maps.tsx: `activeOrderData` filter changed from React JS level (filters orders passed to `GENERATE_MAP_HTML` to only `Picked Up`/`Out for Delivery`)
- Customer `OrderDetail.tsx`: "Track Rider" button now shows for both `picked_up` and `out_for_delivery` statuses
- Customer `OrderDetail.tsx`: fixed invalid icon `cooking-outline` → `flame-outline`
- Customer `Profile.tsx`: created with editable fields (firstname, lastname, email, phone, address), save via `PUT /me`, sign out with confirmation, light theme matching Customer app
- Customer `RiderTracking.tsx`: destination marker now uses customer's `delivery_latitude`/`delivery_longitude` instead of branch location
- RiderTracking.tsx: map re-centers on rider with each poll via `animateToRegion`
- RiderTracking.tsx: fixed "Text strings must be rendered within a <Text> component" by changing all `&&` patterns to ternaries and fixing `toLat`/`toLng` to return `null` instead of `0` for null/NaN inputs
- RiderTracking.tsx: map always renders (with "Waiting" overlay instead of hiding map), `onMapReady` guards `animateToRegion`
- Customer `_layout.tsx`: added collapsible `AnimatedTabBar` component (slide down + fade, chevron toggle, floating restore button)

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- Staff order routes placed BEFORE `apiResource('staff', ...)` to prevent `{staff}` route catching "/orders" as a resource ID
- Customer checkout silently captures GPS (silent catch on permission denial) — no map picker UI
- Maps screen shows all rider orders, not single-order directions; Leaflet map via WebView
- Person pin uses inline SVG teardrop/pin shape + person silhouette instead of emoji or library
- Location sending interval uses refs with empty deps `[]` to prevent re-creation on every GPS update (was causing interval to never fire)
- `toLat`/`toLng` return `null` instead of `0` for null/NaN input to avoid falsy `0` rendering via `&&` patterns
- Rider location sent for `Picked Up` and `Out for Delivery` only (not `Ready` or `Delivered`)
- Customer tab bar collapse uses same approach as Rider: `AnimatedTabBar` component with `Animated.timing`, `useNativeDriver: true`, chevron toggle + floating restore button

## Next Steps
- Run `php artisan migrate` to add new rider tracking columns to orders table
- Run `php artisan serve` to restart backend for new routes

## Critical Context
- Old orders (placed before delivery migration) have null `delivery_latitude`/`delivery_longitude` → customer pin won't show on map, fallback to branch pin
- Rider MUST have Maps tab mounted at least once for GPS watcher to start; if GPS permission denied, fallback `getCurrentPositionAsync` also won't work
- Location API `POST /rider/orders/{id}/location` silently catches errors (was `catch {}`); now logs to console for debugging
- `openNavigation()` function still exists in `Rider/Orders.tsx` but is no longer called from the new navigate buttons
- Customer MUST have GPS permission granted at checkout for rider directions to work; silently skips if denied
- Branch lat/lng already exist in `branches` table (migration `2026_06_25_000002`)

## Relevant Files
- `Backend/app/Http/Controllers/Api/OrderController.php`: All order endpoints (customer, staff, rider) + `updateLocation`/`trackRider`/`assignRider`
- `Backend/routes/api.php`: Route definitions (order-sensitive — staff routes before apiResource)
- `Backend/app/Models/Order.php`: Order model with fillable fields (rider_latitude, rider_longitude, rider_location_updated_at, delivery_proof columns)
- `Backend/database/migrations/2026_07_04_200002_add_delivery_proof_to_orders_table.php`: Delivery proof columns
- `Backend/database/migrations/2026_07_04_200003_add_delivery_coordinates_to_orders_table.php`: Delivery lat/lng columns
- `Backend/database/migrations/2026_07_03_200001_add_rider_tracking_to_orders_table.php`: Rider tracking columns
- `Newmoon-Mobile/src/app/Customer/Checkout.tsx`: GPS capture on order placement
- `Newmoon-Mobile/src/app/Customer/OrderDetail.tsx`: Real-time status timeline with pull-to-refresh, Track Rider button
- `Newmoon-Mobile/src/app/Customer/RiderTracking.tsx`: Live rider tracking map with real-time polling (MapView, Marker, Polyline)
- `Newmoon-Mobile/src/app/Customer/Profile.tsx`: Editable profile (PUT /me) with sign out
- `Newmoon-Mobile/src/app/Customer/_layout.tsx`: Customer tab bar with collapsible AnimatedTabBar
- `Newmoon-Mobile/src/app/Staff/Orders.tsx`: Staff order management with status transitions
- `Newmoon-Mobile/src/app/Staff/_layout.tsx`: Staff tab bar with Orders tab
- `Newmoon-Mobile/src/app/Rider/Orders.tsx`: Rider order cards with action buttons, map navigation
- `Newmoon-Mobile/src/app/Rider/Maps.tsx`: Leaflet map with branches, order pins, rider routes, GPS location sending (refs-based interval)
- `Newmoon-Mobile/src/app/Rider/ProofOfDelivery.tsx`: Camera + form for delivery photo proof
- `Newmoon-Mobile/src/app/Rider/_layout.tsx`: Rider tab bar with collapsible AnimatedTabBar
- `Newmoon-Mobile/lib/api.ts`: Axios config with base URL and token interceptor
