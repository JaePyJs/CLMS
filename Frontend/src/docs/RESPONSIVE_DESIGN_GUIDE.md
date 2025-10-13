# CLMS Responsive Design Guide

## Overview

This guide outlines the mobile-first responsive design principles and implementation patterns for the CLMS (Comprehensive Library Management System). Our approach ensures optimal user experience across all device sizes, from mobile phones to large desktop screens.

## Breakpoint System

### Standard Breakpoints (Tailwind CSS v3)
- **xs**: 475px - Extra small screens (large phones in landscape)
- **sm**: 640px - Small screens (tablets in portrait, large phones)
- **md**: 768px - Medium screens (tablets in landscape, small desktops)
- **lg**: 1024px - Large screens (desktops)
- **xl**: 1280px - Extra large screens (large desktops)
- **2xl**: 1400px - Extra extra large screens (very large desktops)
- **3xl**: 1600px - Ultra wide screens

### Mobile-First Approach
We follow a mobile-first design philosophy:
- Base styles apply to mobile (default, no prefix)
- Use breakpoint prefixes for larger screens: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`
- Progressive enhancement: add features as screen size increases

## Responsive Components

### 1. ResponsiveContainer
Use for consistent layout and spacing across screen sizes.

```tsx
import { ResponsiveContainer } from '@/components/ui/responsive-utils';

<ResponsiveContainer size="lg" className="my-component">
  <p>Content adapts padding and max-width automatically</p>
</ResponsiveContainer>
```

**Sizes:**
- `sm`: max-w-2xl (small content areas)
- `md`: max-w-4xl (medium content areas)
- `lg`: max-w-6xl (large content areas - default)
- `xl`: max-w-7xl (extra large content areas)
- `full`: max-w-full (full width)

### 2. ResponsiveGrid
Automatically adjusts grid columns based on screen size.

```tsx
import { ResponsiveGrid } from '@/components/ui/responsive-utils';

<ResponsiveGrid
  cols={{ mobile: 1, tablet: 2, desktop: 3, large: 4 }}
  gap={{ mobile: 'gap-3', tablet: 'gap-4' }}
>
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</ResponsiveGrid>
```

### 3. ResponsiveFlex
Flexbox that adapts direction and spacing.

```tsx
import { ResponsiveFlex } from '@/components/ui/responsive-utils';

<ResponsiveFlex
  direction={{ mobile: 'col', tablet: 'row' }}
  justify="between"
  align="center"
  gap="gap-4"
>
  <div>Left content</div>
  <div>Right content</div>
</ResponsiveFlex>
```

### 4. ResponsiveButton
Touch-friendly buttons that adapt size for different screens.

```tsx
import { ResponsiveButton } from '@/components/ui/responsive-utils';

<ResponsiveButton
  size={{ mobile: 'md', tablet: 'lg' }}
  variant="primary"
  onClick={handleClick}
>
  Touch-friendly button
</ResponsiveButton>
```

**Minimum touch target sizes:**
- Mobile: 44px minimum height (Apple HIG compliant)
- Tablet/Desktop: 36px minimum height
- Large screens: 48px for better accessibility

## Mobile Optimization Hook

### useMobileOptimization
Provides device detection and responsive utilities.

```tsx
import { useMobileOptimization } from '@/hooks/useMobileOptimization';

const {
  isMobile,
  isTablet,
  isDesktop,
  isLarge,
  isExtraLarge,
  width,
  height,
  orientation
} = useMobileOptimization();
```

### Performance Optimization
Device-specific performance settings.

```tsx
import { usePerformanceOptimization } from '@/hooks/useMobileOptimization';

const {
  tier,           // 'mobile' | 'tablet' | 'desktop' | 'large' | 'extra-large'
  debounceMs,     // Device-appropriate debounce timing
  enableAnimations, // Reduced animations on mobile
  itemsPerPage,   // Paginated content limits
  lazyLoadingEnabled // Progressive image loading
} = usePerformanceOptimization();
```

## Design Patterns

### 1. Navigation
- **Mobile**: Bottom tab bar or hamburger menu
- **Tablet**: Side navigation or top tabs
- **Desktop**: Full sidebar navigation

```tsx
// Mobile-first navigation
<nav className="lg:hidden">
  <BottomTabBar />
</nav>

<nav className="hidden lg:block">
  <SidebarNavigation />
</nav>
```

### 2. Tables
- **Mobile**: Card-based layout using `MobileCardList`
- **Tablet**: Stacked cards with better spacing
- **Desktop**: Traditional table layout

```tsx
import { MobileCardList, MobileTable } from '@/components/ui/mobile-card-list';

<MobileCardList
  data={students}
  renderCard={(student, isMobile) => (
    <StudentCard student={student} compact={isMobile} />
  )}
  renderTable={(students) => <StudentsTable data={students} />}
/>
```

### 3. Forms
- **Mobile**: Single column, large touch targets
- **Tablet**: Two-column layout where appropriate
- **Desktop**: Multi-column with better spacing

```tsx
<form className="space-y-4 sm:space-y-6">
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <Input placeholder="First Name" />
    <Input placeholder="Last Name" />
  </div>
  <Input placeholder="Email" className="w-full sm:w-auto" />
</form>
```

### 4. Cards and Content
- **Mobile**: Full-width cards with minimal padding
- **Tablet**: Two-column grid with moderate padding
- **Desktop**: Multi-column with generous spacing

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
  {items.map(item => (
    <Card key={item.id} className="p-4 md:p-6">
      {item.content}
    </Card>
  ))}
</div>
```

## Touch Optimization

### Touch Targets
- **Minimum size**: 44px × 44px (Apple HIG)
- **Recommended**: 48px × 48px for better accessibility
- **Spacing**: Minimum 8px between touch targets

```css
/* Tailwind classes */
.touch-target {
  min-height: 44px; /* Mobile minimum */
  min-width: 44px;
  padding: 12px 16px; /* Comfortable touch area */
}

@media (min-width: 768px) {
  .touch-target {
    min-height: 36px; /* Desktop can be smaller */
    min-width: 36px;
  }
}
```

### Gesture Support
Implement swipe gestures for mobile navigation:

```tsx
import { useTouchOptimization } from '@/hooks/useMobileOptimization';

const { handleTouchStart, handleTouchEnd, gesture } = useTouchOptimization();

useEffect(() => {
  if (gesture === 'swipe-left') {
    // Navigate to next tab
  } else if (gesture === 'swipe-right') {
    // Navigate to previous tab
  }
}, [gesture]);
```

## Safe Area Support

Account for device notches and rounded corners:

```css
/* Tailwind custom classes */
.safe-padding {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

## Responsive Images

### Performance Optimization
- Use appropriate image sizes for each breakpoint
- Implement lazy loading for mobile
- Consider WebP format for better compression

```tsx
import { getOptimalImageSize } from '@/hooks/useMobileOptimization';

const { width, height } = useMobileOptimization();
const imageSize = getOptimalImageSize({ width, height }, 800, 600);

<img
  src={`${imageUrl}?w=${imageSize.width}&h=${imageSize.height}`}
  alt="Responsive image"
  loading="lazy"
/>
```

## Typography

### Responsive Text Scaling
Ensure readability across all devices:

```tsx
import { ResponsiveText } from '@/components/ui/responsive-utils';

<ResponsiveText
  size={{
    mobile: 'text-sm',
    tablet: 'text-base',
    desktop: 'text-lg',
    large: 'text-xl'
  }}
  weight="medium"
>
  Responsive text that scales with screen size
</ResponsiveText>
```

### Line Height and Spacing
- **Mobile**: Generous line height (1.6-1.8) for readability
- **Desktop**: Standard line height (1.5-1.6)

```css
.text-responsive {
  font-size: clamp(1rem, 2.5vw, 1.25rem);
  line-height: clamp(1.5, 3vw, 1.6);
}
```

## Testing Strategy

### Device Testing
1. **Mobile First**: Test on smallest screens first
2. **Progressive Enhancement**: Ensure larger screens enhance, not break
3. **Real Devices**: Test on actual phones and tablets when possible

### Browser Testing
- Chrome DevTools device emulation
- Safari Responsive Design Mode
- Firefox Responsive Design Mode

### Accessibility Testing
- Ensure touch targets meet minimum size requirements
- Test with screen readers on mobile devices
- Verify keyboard navigation works on touch devices

## Best Practices

### 1. Mobile-First CSS
```css
/* ✅ Good - Mobile-first */
.component {
  padding: 1rem;
  font-size: 1rem;
}

@media (min-width: 768px) {
  .component {
    padding: 2rem;
    font-size: 1.125rem;
  }
}

/* ❌ Bad - Desktop-first */
.component {
  padding: 2rem;
  font-size: 1.125rem;
}

@media (max-width: 767px) {
  .component {
    padding: 1rem;
    font-size: 1rem;
  }
}
```

### 2. Responsive Units
- Use `rem` for typography and spacing
- Use `%` for widths and layout
- Use `vh`/`vw` sparingly for specific viewport-based sizing
- Avoid fixed `px` values except for borders

### 3. Flexible Layouts
```css
/* ✅ Good - Flexible */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

/* ❌ Bad - Fixed */
.grid {
  display: grid;
  grid-template-columns: 300px 300px 300px;
  gap: 1rem;
}
```

### 4. Performance Considerations
- Minimize DOM complexity on mobile
- Use CSS transforms instead of JavaScript animations
- Implement intersection observer for lazy loading
- Reduce JavaScript bundle size for mobile

## Common Responsive Patterns

### 1. Dashboard Layout
```tsx
<div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
  {/* Sidebar */}
  <aside className="xl:col-span-3">
    <Sidebar />
  </aside>

  {/* Main Content */}
  <main className="xl:col-span-9">
    <MainContent />
  </main>
</div>
```

### 2. Card Grid
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {cards.map(card => (
    <Card key={card.id} className="hover:shadow-lg transition-shadow">
      {card.content}
    </Card>
  ))}
</div>
```

### 3. Form Layout
```tsx
<form className="space-y-6">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <FormField label="First Name" />
    <FormField label="Last Name" />
  </div>
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
    <FormField label="City" />
    <FormField label="State" />
    <FormField label="ZIP Code" />
  </div>
</form>
```

## Troubleshooting

### Common Issues

1. **Horizontal Scroll on Mobile**
   - Check for fixed width elements
   - Ensure padding doesn't overflow viewport
   - Use `overflow-x-auto` only when necessary

2. **Text Too Small on Mobile**
   - Use minimum font size of 16px for body text
   - Implement responsive typography scaling
   - Check viewport meta tag: `<meta name="viewport" content="width=device-width, initial-scale=1">`

3. **Touch Targets Too Small**
   - Ensure minimum 44px touch targets
   - Add padding to increase touch area
   - Use `min-height` and `min-width` for buttons

4. **Performance Issues on Mobile**
   - Optimize images and assets
   - Reduce JavaScript bundle size
   - Implement code splitting and lazy loading

## Implementation Checklist

### Before Release
- [ ] Test on actual mobile devices (iPhone, Android)
- [ ] Test on tablets (iPad, Android tablets)
- [ ] Verify touch targets are at least 44px
- [ ] Check horizontal scrolling doesn't occur
- [ ] Test with different screen orientations
- [ ] Verify performance on slower connections
- [ ] Test accessibility features
- [ ] Check safe area handling on newer devices

### Development Workflow
1. Start with mobile design
2. Progressively enhance for larger screens
3. Test at each breakpoint
4. Optimize performance for mobile
5. Validate accessibility requirements

## Resources

### Tools
- [BrowserStack](https://www.browserstack.com/) - Cross-device testing
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/) - Device emulation
- [Responsively App](https://responsively.app/) - Multi-device testing

### Documentation
- [Tailwind CSS Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Material Design Guidelines](https://material.io/design/)

### Examples
- See `src/components/ui/responsive-utils.tsx` for implementation examples
- Check existing dashboard components for responsive patterns
- Review `src/hooks/useMobileOptimization.ts` for device detection utilities

---

**Remember**: The goal is not just to make things fit on different screen sizes, but to provide the best possible user experience for each device context. Focus on touch interactions, performance, and accessibility for mobile users.