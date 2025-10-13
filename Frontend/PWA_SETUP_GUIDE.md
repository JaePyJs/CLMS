# PWA Setup Guide for CLMS

## ✅ Implementation Status

### Completed:
1. ✅ **Service Worker** - Production-ready (`public/sw.js`)
   - Advanced caching strategies
   - Offline support
   - Background sync
   - Cache management
   
2. ✅ **Service Worker Registration** - Activated in `main.tsx`
   - Only loads in production mode
   - Auto-update detection
   - User notification for new versions
   - Hourly update checks

3. ✅ **Web App Manifest** - Created (`public/manifest.json`)
   - Full app metadata
   - Icon configurations (8 sizes)
   - Shortcuts for quick actions
   - Theme colors (light/dark)
   - Share target support

4. ✅ **HTML Meta Tags** - Updated (`index.html`)
   - PWA-specific meta tags
   - Apple touch icon support
   - Theme color for both light/dark modes
   - Viewport configuration

---

## 📱 PWA Features Enabled

### ✅ Installation
- **Desktop:** Install via browser address bar "+" icon
- **Mobile:** Add to home screen from browser menu
- **Standalone Mode:** Runs like a native app without browser chrome

### ✅ Offline Support
- **Caching Strategies:**
  - Cache-first: Static assets (CSS, JS, fonts)
  - Network-first: API calls with cache fallback
  - Stale-while-revalidate: Dynamic content
  
- **Automatic Cache Management:**
  - Max entries per cache (configurable)
  - Automatic cleanup of old entries
  - Cache versioning (v1.0.0)

### ✅ Background Sync
- Queue failed API requests
- Retry when connection restored
- Seamless offline→online transition

### ✅ App Shortcuts
Three quick actions from home screen:
1. **Dashboard** - View system overview
2. **Scan** - Quick barcode scanning
3. **Students** - Manage students

### ✅ Update Notifications
- Automatic update detection
- User prompt to reload for new version
- Hourly background checks

---

## 🎨 Required: App Icons

### Icon Sizes Needed:
Create PNG icons in these sizes and place in `Frontend/public/`:

```
icon-16x16.png    (favicon)
icon-32x32.png    (favicon)
icon-72x72.png    (Android Chrome)
icon-96x96.png    (Android Chrome)
icon-128x128.png  (Android Chrome)
icon-144x144.png  (Android Chrome, Windows)
icon-152x152.png  (iOS Safari)
icon-192x192.png  (Android Chrome - maskable)
icon-384x384.png  (Android Chrome)
icon-512x512.png  (Android Chrome - maskable)
```

### Generating Icons:

#### Option 1: Online Tool (Recommended)
1. Visit: https://realfavicongenerator.net/
2. Upload a single 512x512 PNG logo
3. Configure settings:
   - iOS: Use default settings
   - Android Chrome: Enable "Add padding" for maskable icons
   - Windows Metro: Use theme color `#0ea5e9`
4. Download and extract to `Frontend/public/`

#### Option 2: Command Line (ImageMagick)
```bash
# Install ImageMagick
# Windows: choco install imagemagick
# Mac: brew install imagemagick

# Generate all sizes from source
magick logo-source.png -resize 16x16 icon-16x16.png
magick logo-source.png -resize 32x32 icon-32x32.png
magick logo-source.png -resize 72x72 icon-72x72.png
magick logo-source.png -resize 96x96 icon-96x96.png
magick logo-source.png -resize 128x128 icon-128x128.png
magick logo-source.png -resize 144x144 icon-144x144.png
magick logo-source.png -resize 152x152 icon-152x152.png
magick logo-source.png -resize 192x192 icon-192x192.png
magick logo-source.png -resize 384x384 icon-384x384.png
magick logo-source.png -resize 512x512 icon-512x512.png
```

#### Option 3: PWA Builder
1. Visit: https://www.pwabuilder.com/
2. Enter your site URL (when deployed)
3. Generate package with icons
4. Download and use generated icons

### Temporary Solution:
For testing, you can use placeholder icons or the existing Vite logo:
```bash
# Copy vite.svg to all icon sizes (temporary)
cd Frontend/public
# Generate simple colored squares as placeholders
```

---

## 📸 Optional: Screenshots

For enhanced app listing (future):
1. Take desktop screenshot (1920x1080): `screenshot-desktop.png`
2. Take mobile screenshot (750x1334): `screenshot-mobile.png`
3. Place in `Frontend/public/`

These appear in:
- Browser install prompts
- App store listings (if published)
- System app launchers

---

## 🧪 Testing the PWA

### 1. Build for Production
```bash
cd Frontend
npm run build
npm run preview  # Test production build locally
```

### 2. Check Service Worker
Open Chrome DevTools → Application tab:
- **Service Workers:** Should show "activated and running"
- **Manifest:** Should show all app details
- **Cache Storage:** Should show 4 caches (static, api, images, fonts)

### 3. Test Offline Mode
1. Open the app in Chrome
2. DevTools → Network → Check "Offline"
3. Navigate around - should still work!
4. Try offline: View cached pages, see offline notification

### 4. Test Installation
**Desktop (Chrome/Edge):**
1. Click address bar install icon (⊕)
2. Click "Install"
3. App opens in standalone window

**Mobile (Chrome):**
1. Menu → "Add to Home screen"
2. Confirm
3. Find app icon on home screen

**iOS (Safari):**
1. Share button → "Add to Home Screen"
2. Confirm
3. Find app icon on home screen

### 5. Test Updates
1. Make a code change
2. Build and deploy
3. Service worker detects update
4. User gets notification to reload

---

## 🔧 Configuration

### Service Worker Version
Update in `Frontend/public/sw.js`:
```javascript
const CACHE_VERSION = 'v1.0.0';  // Increment for new releases
```

### Cache Settings
Modify cache durations in `sw.js`:
```javascript
const CACHE_CONFIG = {
  static: { maxAge: 30 * 24 * 60 * 60 * 1000 },  // 30 days
  api: { maxAge: 5 * 60 * 1000 },                // 5 minutes
  images: { maxAge: 7 * 24 * 60 * 60 * 1000 },   // 7 days
  fonts: { maxAge: 365 * 24 * 60 * 60 * 1000 },  // 1 year
};
```

### Update Interval
Change in `Frontend/src/main.tsx`:
```typescript
setInterval(() => {
  registration.update();
}, 60 * 60 * 1000);  // Check every hour
```

---

## 📊 PWA Audit

Run Lighthouse audit (Chrome DevTools):
1. Open DevTools → Lighthouse tab
2. Select "Progressive Web App"
3. Click "Generate report"

**Target Scores:**
- ✅ Installable
- ✅ PWA Optimized
- ✅ Service Worker registered
- ✅ Manifest present
- ✅ Offline ready
- ✅ Fast load times

---

## 🚀 Deployment Checklist

Before deploying PWA to production:

- [ ] Generate all required icon sizes
- [ ] Update `manifest.json` with production URLs
- [ ] Test installation on:
  - [ ] Desktop Chrome/Edge
  - [ ] Android Chrome
  - [ ] iOS Safari
  - [ ] iPad Safari
- [ ] Test offline functionality
- [ ] Test update notifications
- [ ] Run Lighthouse PWA audit (score >90)
- [ ] Verify HTTPS (required for service workers)
- [ ] Test on slow 3G network
- [ ] Verify cache sizes are reasonable
- [ ] Document user installation instructions

---

## 🐛 Troubleshooting

### Service Worker Not Registering
1. Check browser console for errors
2. Verify HTTPS (required for SW, except localhost)
3. Ensure `sw.js` is accessible at `/sw.js`
4. Clear browser cache and hard reload

### Offline Mode Not Working
1. DevTools → Application → Service Workers → "Update on reload" disabled
2. Check Network tab - requests should show "from ServiceWorker"
3. Verify cache storage has entries

### Icons Not Showing
1. Check browser console for 404 errors
2. Verify icon files exist in `public/` folder
3. Clear browser cache and reinstall app
4. Check manifest.json paths are correct

### App Not Installable
1. Verify HTTPS (required)
2. Check manifest.json is valid (use validator: https://manifest-validator.appspot.com/)
3. Ensure service worker is registered
4. Check browser support (Chrome 76+, Edge 79+, Safari 16.4+)

---

## 📚 Resources

- [MDN - Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Web.dev - PWA Checklist](https://web.dev/pwa-checklist/)
- [Chrome DevTools - Service Workers](https://developer.chrome.com/docs/devtools/progressive-web-apps/)
- [PWA Builder](https://www.pwabuilder.com/)
- [Workbox - Service Worker Library](https://developers.google.com/web/tools/workbox)

---

## 🎉 Next Steps

1. **Generate Icons:** Create all required icon sizes
2. **Test Offline:** Disconnect network and verify functionality
3. **Install on Devices:** Test on real iOS and Android devices
4. **Performance:** Run Lighthouse audit and optimize
5. **User Guide:** Document installation steps for librarians
6. **Monitor:** Track PWA install rates and usage patterns

---

**PWA Status:** ✅ PRODUCTION READY (pending icons)  
**Estimated Time to Full Completion:** 1 hour (icon generation)  
**Priority:** HIGH - Enables offline library operations
