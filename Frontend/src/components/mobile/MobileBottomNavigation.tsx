import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMobileOptimization } from '@/hooks/useMobileOptimization';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useAppStore } from '@/store/useAppStore';
import { useTouchOptimization } from '@/hooks/useMobileOptimization';
import { Wifi, WifiOff, AlertCircle, ChevronUp, X } from 'lucide-react';

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  activeIcon?: React.ComponentType<{ className?: string }>;
  badge?: number;
  shortcut?: string;
  color?: string;
}

const mobileNavigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Home',
    icon: Home,
    shortcut: '1',
    color: 'text-blue-500',
  },
  {
    id: 'scan',
    label: 'Scan',
    icon: Camera,
    shortcut: '2',
    color: 'text-green-500',
  },
  {
    id: 'checkout',
    label: 'Checkout',
    icon: Library,
    shortcut: '3',
    color: 'text-purple-500',
  },
  {
    id: 'students',
    label: 'Students',
    icon: Users,
    shortcut: '4',
    color: 'text-orange-500',
  },
  {
    id: 'books',
    label: 'Books',
    icon: BookOpen,
    shortcut: '5',
    color: 'text-indigo-500',
  },
];

const moreNavigationItems: NavigationItem[] = [
  {
    id: 'equipment',
    label: 'Equipment',
    icon: Laptop,
    shortcut: '6',
    color: 'text-teal-500',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart,
    shortcut: '7',
    color: 'text-pink-500',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    shortcut: '8',
    color: 'text-gray-500',
  },
];

interface MobileBottomNavigationProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export const MobileBottomNavigation: React.FC<MobileBottomNavigationProps> = ({
  activeTab,
  onTabChange,
}) => {
  const { isMobile, isTablet } = useMobileOptimization();
  const { isOnline, queueCount } = useOfflineSync();
  const { notifications } = useAppStore();
  const [showMore, setShowMore] = useState(false);
  const { handleTouchStart, handleTouchEnd } = useTouchOptimization();

  // Only show on mobile devices
  if (!isMobile && !isTablet) {
    return null;
  }

  // Find current navigation item
  const getCurrentItem = () => {
    const allItems = [...mobileNavigationItems, ...moreNavigationItems];
    return allItems.find(item => item.id === activeTab) || mobileNavigationItems[0];
  };

  const currentItem = getCurrentItem();

  // Handle navigation
  const handleNavigation = (item: NavigationItem) => {
    onTabChange(item.id);
    setShowMore(false);

    // Haptic feedback if available
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  };

  // Handle swipe gestures
  const handleSwipe = (direction: string) => {
    const allItems = [...mobileNavigationItems, ...moreNavigationItems];
    const currentIndex = allItems.findIndex(item => item.id === activeTab);

    if (direction === 'swipe-left' && currentIndex < allItems.length - 1) {
      handleNavigation(allItems[currentIndex + 1]);
    } else if (direction === 'swipe-right' && currentIndex > 0) {
      handleNavigation(allItems[currentIndex - 1]);
    }
  };

  return (
    <>
      {/* Main Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 z-50 safe-area-inset-bottom">
        {/* Status Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="h-3 w-3 text-green-500" />
            ) : (
              <WifiOff className="h-3 w-3 text-red-500" />
            )}
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          {queueCount > 0 && (
            <div className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-amber-500" />
              <span className="text-xs text-amber-600 dark:text-amber-400">
                {queueCount} pending
              </span>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <div className="flex items-center justify-around py-2">
          {mobileNavigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <Button
                key={item.id}
                variant="ghost"
                size="sm"
                className={`flex flex-col items-center gap-1 h-auto py-2 px-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-primary/10 text-primary dark:bg-primary/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
                onClick={() => handleNavigation(item)}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                <div className="relative">
                  <Icon className={`h-5 w-5 ${isActive ? item.color : ''}`} />
                  {notifications?.some(n => n.type === item.id) && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full" />
                  )}
                </div>
                <span className="text-xs font-medium">
                  {item.label}
                </span>
                {item.shortcut && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {item.shortcut}
                  </span>
                )}
              </Button>
            );
          })}

          {/* More Button */}
          <Button
            variant="ghost"
            size="sm"
            className={`flex flex-col items-center gap-1 h-auto py-2 px-3 rounded-lg transition-all ${
              showMore
                ? 'bg-primary/10 text-primary dark:bg-primary/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
            onClick={() => setShowMore(!showMore)}
          >
            <ChevronUp
              className={`h-5 w-5 transition-transform ${showMore ? 'rotate-180' : ''}`}
            />
            <span className="text-xs font-medium">More</span>
          </Button>
        </div>
      </div>

      {/* More Options Overlay */}
      {showMore && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowMore(false)}>
          <div
            className="absolute bottom-20 left-4 right-4 bg-white dark:bg-slate-900 rounded-t-2xl shadow-2xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                More Options
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMore(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {moreNavigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <Button
                    key={item.id}
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    className={`flex flex-col items-center gap-2 h-auto py-3 rounded-lg transition-all ${
                      isActive ? item.color : 'text-slate-600 dark:text-slate-400'
                    }`}
                    onClick={() => handleNavigation(item)}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{item.label}</span>
                    {item.shortcut && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {item.shortcut}
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>

            {/* Current Tab Info */}
            <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg">
              <div className="flex items-center gap-2">
                {currentItem && <currentItem.icon className={`h-4 w-4 ${currentItem.color}`} />}
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Currently: {currentItem?.label || 'Dashboard'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add padding for bottom navigation */}
      <div className="h-20 lg:hidden" />

      {/* Add extra padding for tablets with smaller bottom nav */}
      {isTablet && <div className="h-4 md:hidden" />}
    </>
  );
};

export default MobileBottomNavigation;