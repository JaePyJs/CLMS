import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (_theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [resolvedTheme] = useState<ResolvedTheme>('dark');

  // Apply theme to document
  const applyTheme = () => {
    const root = document.documentElement;
    root.classList.add('dark');

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', '#141b2e');
    }
  };

  // Toggle between light and dark (Disabled - Permanent Dark Mode)
  const toggleTheme = () => {
    // No-op: Dark mode is permanent
    console.warn('Theme switching is disabled. Permanent dark mode enforced.');
  };

  // Initialize theme on mount
  useEffect(() => {
    applyTheme();
    // Ensure it stays dark even if something tries to change it
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'class'
        ) {
          if (!document.documentElement.classList.contains('dark')) {
            document.documentElement.classList.add('dark');
          }
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <ThemeContext.Provider
      value={{ theme: 'dark', resolvedTheme, setTheme: () => {}, toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
