import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useMobileOptimization } from '@/hooks/useMobileOptimization';
import { toast } from 'sonner';
import { Download, X, Zap, Shield, Wifi, Check, Info } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}

interface PWAInstallPromptProps {
  onInstall?: () => void;
  onDismiss?: () => void;
}

export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({
  onInstall,
  onDismiss,
}) => {
  const { isMobile } = useMobileOptimization();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installStatus, setInstallStatus] = useState<'idle' | 'installing' | 'success' | 'error'>('idle');

  // Check if app is already installed
  const checkIfInstalled = useCallback(() => {
    // Check if running in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        (window.navigator as any).standalone === true ||
                        document.referrer.includes('android-app://');

    // Check if app is installed (different methods for different platforms)
    const isInInstalledState = isStandalone ||
                              localStorage.getItem('pwa-installed') === 'true';

    setIsInstalled(isInInstalledState);
    return isInInstalledState;
  }, []);

  // Handle beforeinstallprompt event
  const handleBeforeInstallPrompt = useCallback((e: Event) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();

    const promptEvent = e as BeforeInstallPromptEvent;
    setDeferredPrompt(promptEvent);

    // Only show prompt if not dismissed and not installed
    if (!dismissed && !checkIfInstalled()) {
      // Show prompt after a delay
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    }
  }, [dismissed, checkIfInstalled]);

  // Handle app installed event
  const handleAppInstalled = useCallback(() => {
    console.log('[PWAInstall] App was installed');
    setIsInstalled(true);
    localStorage.setItem('pwa-installed', 'true');
    setShowPrompt(false);
    setInstallStatus('success');
    toast.success('App installed successfully!');
    onInstall?.();

    // Hide success message after delay
    setTimeout(() => {
      setInstallStatus('idle');
    }, 3000);
  }, [onInstall]);

  // Install the PWA
  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) {
      // Fallback to manual instructions
      setShowPrompt(false);
      return;
    }

    try {
      setInstallStatus('installing');

      // Show the install prompt
      await deferredPrompt.prompt();

      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;

      console.log(`[PWAInstall] User ${outcome} the install prompt`);

      if (outcome === 'accepted') {
        setInstallStatus('success');
        toast.success('Installing app...');
        onInstall?.();
      } else {
        setInstallStatus('idle');
        toast.info('Install cancelled');
      }

      // Clear the deferred prompt
      setDeferredPrompt(null);
      setShowPrompt(false);

    } catch (error) {
      console.error('[PWAInstall] Install failed:', error);
      setInstallStatus('error');
      toast.error('Failed to install app');

      setTimeout(() => {
        setInstallStatus('idle');
      }, 3000);
    }
  }, [deferredPrompt, onInstall]);

  // Dismiss the prompt
  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', 'true');
    onDismiss?.();
  }, [onDismiss]);

  // Get platform-specific install instructions
  const getInstallInstructions = useCallback(() => {
    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
      return {
        title: 'Install on iOS',
        steps: [
          'Tap the Share button at the bottom',
          'Scroll down and tap "Add to Home Screen"',
          'Tap "Add" to install the app',
        ],
        icon: '🍎',
      };
    }

    if (userAgent.includes('android')) {
      return {
        title: 'Install on Android',
        steps: [
          'Tap the menu button (⋮) in Chrome',
          'Tap "Add to Home screen"',
          'Tap "Add" to install the app',
        ],
        icon: '🤖',
      };
    }

    return {
      title: 'Install App',
      steps: [
        'Look for the install icon in your browser',
        'Click to add to your device',
        'Launch from your home screen',
      ],
      icon: '📱',
    };
  }, []);

  // Check installation status on mount
  useEffect(() => {
    checkIfInstalled();

    // Check if user previously dismissed the prompt
    const wasDismissed = localStorage.getItem('pwa-install-dismissed') === 'true';
    setDismissed(wasDismissed);
  }, [checkIfInstalled]);

  // Set up event listeners
  useEffect(() => {
    if (!isMobile) return;

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isMobile, handleBeforeInstallPrompt, handleAppInstalled]);

  // Don't show if not mobile, already installed, or dismissed
  if (!isMobile || isInstalled || dismissed || !showPrompt) {
    return null;
  }

  const instructions = getInstallInstructions();

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 shadow-xl">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-full">
                <Download className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  Install CLMS App
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Get the full experience on your device
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Features */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center gap-1 p-2 bg-white/50 dark:bg-slate-800/50 rounded-lg">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-slate-600 dark:text-slate-400">Fast</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-2 bg-white/50 dark:bg-slate-800/50 rounded-lg">
              <Wifi className="h-4 w-4 text-green-500" />
              <span className="text-xs text-slate-600 dark:text-slate-400">Offline</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-2 bg-white/50 dark:bg-slate-800/50 rounded-lg">
              <Shield className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-slate-600 dark:text-slate-400">Secure</span>
            </div>
          </div>

          {/* Install Button */}
          {deferredPrompt ? (
            <Button
              onClick={handleInstall}
              disabled={installStatus === 'installing'}
              className="w-full"
              size="lg"
            >
              {installStatus === 'installing' ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Installing...
                </>
              ) : installStatus === 'success' ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Installed!
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Install App
                </>
              )}
            </Button>
          ) : (
            <div className="space-y-3">
              {/* Manual Instructions */}
              <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{instructions.icon}</span>
                  <h4 className="font-medium text-slate-900 dark:text-slate-100">
                    {instructions.title}
                  </h4>
                </div>
                <ol className="space-y-1">
                  {instructions.steps.map((step, index) => (
                    <li key={index} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
                      <span className="text-blue-500 font-medium">{index + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

              <Button
                variant="outline"
                onClick={handleDismiss}
                className="w-full"
              >
                Maybe Later
              </Button>
            </div>
          )}

          {/* Install Status Messages */}
          {installStatus === 'success' && (
            <div className="flex items-center gap-2 p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm text-green-800 dark:text-green-200">
                App installed successfully! Check your home screen.
              </span>
            </div>
          )}

          {installStatus === 'error' && (
            <div className="flex items-center gap-2 p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <Info className="h-4 w-4 text-red-600 dark:text-red-400" />
              <span className="text-sm text-red-800 dark:text-red-200">
                Installation failed. Please try again or follow the manual instructions.
              </span>
            </div>
          )}

          {/* Benefits */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Check className="h-3 w-3 text-green-500" />
              <span className="text-xs text-slate-600 dark:text-slate-400">Works offline</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-3 w-3 text-green-500" />
              <span className="text-xs text-slate-600 dark:text-slate-400">Full-screen mode</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-3 w-3 text-green-500" />
              <span className="text-xs text-slate-600 dark:text-slate-400">Push notifications</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-3 w-3 text-green-500" />
              <span className="text-xs text-slate-600 dark:text-slate-400">Faster loading</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PWAInstallPrompt;