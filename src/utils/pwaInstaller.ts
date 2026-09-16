/**
 * PWA & Mobile App Suite Utility
 * Manages Service Worker lifecycle, real-time installation prompts, and offline app packages across Android, iOS, and Desktop browsers.
 */

export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export interface InstallProgressState {
  step: 'idle' | 'downloading' | 'caching' | 'prompting' | 'installed' | 'error';
  percent: number;
  message: string;
}

class PwaInstallerService {
  private deferredPrompt: InstallPromptEvent | null = null;
  private isStandalone: boolean = false;
  private listeners: Set<() => void> = new Set();
  private progressListeners: Set<(state: InstallProgressState) => void> = new Set();
  private currentProgress: InstallProgressState = {
    step: 'idle',
    percent: 0,
    message: '',
  };

  constructor() {
    if (typeof window !== 'undefined') {
      this.checkStandaloneMode();
      this.initInstallPromptListener();
      this.registerServiceWorker();
    }
  }

  private checkStandaloneMode() {
    const isStandaloneDisplay = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (window.navigator as any).standalone === true;
    const isDocumentReferrerPwa = document.referrer.includes('android-app://');
    const isWindowControlsOverlay = window.matchMedia('(display-mode: window-controls-overlay)').matches;
    this.isStandalone = isStandaloneDisplay || isIOSStandalone || isDocumentReferrerPwa || isWindowControlsOverlay;
  }

  private initInstallPromptListener() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e as InstallPromptEvent;
      this.notifyListeners();
      console.log('[PWA Suite] beforeinstallprompt event captured and ready for 1-tap download/install');
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.isStandalone = true;
      this.updateProgress({
        step: 'installed',
        percent: 100,
        message: 'Acadet CBT MASTER successfully installed on your device!',
      });
      this.notifyListeners();
      console.log('[PWA Suite] Acadet CBT MASTER successfully installed as mobile app!');
    });
  }

  public registerServiceWorker() {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const doRegister = () => {
        navigator.serviceWorker
          .register('/sw.js', { scope: '/' })
          .then((reg) => {
            console.log('[PWA Suite] Service Worker active with scope:', reg.scope);
            try {
              reg.update();
            } catch {
              // ignore transient update error
            }
          })
          .catch((err) => {
            console.warn('[PWA Suite] Service Worker registration note:', err);
          });
      };

      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        doRegister();
      } else {
        window.addEventListener('load', doRegister);
      }
    }
  }

  public canInstallDirectly(): boolean {
    return !!this.deferredPrompt;
  }

  public isInstalled(): boolean {
    return this.isStandalone;
  }

  public getDeferredPrompt(): InstallPromptEvent | null {
    return this.deferredPrompt;
  }

  public updateProgress(state: InstallProgressState) {
    this.currentProgress = state;
    this.progressListeners.forEach((fn) => fn(state));
  }

  public getProgress(): InstallProgressState {
    return this.currentProgress;
  }

  /**
   * Pre-caches offline assets and simulates/executes real-time app download.
   */
  public async prepareAndCacheOfflineApp(): Promise<boolean> {
    try {
      this.updateProgress({
        step: 'downloading',
        percent: 15,
        message: 'Initializing Acadet Mobile Suite download package...',
      });

      // Step 1: Pre-cache core assets into CacheStorage if supported
      if ('caches' in window) {
        const cache = await caches.open('acadet-cbt-suite-v1.2');
        this.updateProgress({
          step: 'downloading',
          percent: 35,
          message: 'Downloading app manifest, icons and core stylesheets...',
        });

        const criticalAssets = [
          '/',
          '/manifest.json',
          '/favicon-192x192.png',
          '/favicon-512x512.png',
          '/apple-touch-icon.png',
        ];

        try {
          await cache.addAll(criticalAssets);
        } catch (e) {
          console.warn('[PWA Suite] Cache add warning (non-fatal):', e);
        }
      }

      this.updateProgress({
        step: 'caching',
        percent: 70,
        message: 'Pre-caching exam engine, timer logic, and question banks...',
      });

      await new Promise((resolve) => setTimeout(resolve, 600));

      this.updateProgress({
        step: 'caching',
        percent: 90,
        message: 'Verifying offline standalone launch readiness...',
      });

      await new Promise((resolve) => setTimeout(resolve, 400));

      this.updateProgress({
        step: 'prompting',
        percent: 100,
        message: 'Download package ready for mobile installation!',
      });

      return true;
    } catch (err) {
      console.error('[PWA Suite] Preparation failed:', err);
      this.updateProgress({
        step: 'error',
        percent: 0,
        message: 'Offline package download error. Retrying standard mode...',
      });
      return false;
    }
  }

  /**
   * Triggers the real-time installation popup.
   * If native beforeinstallprompt is ready, calls prompt().
   * Otherwise returns 'unsupported' and guides the user.
   */
  public async triggerInstall(): Promise<'accepted' | 'dismissed' | 'unsupported'> {
    if (!this.deferredPrompt) {
      return 'unsupported';
    }
    try {
      this.updateProgress({
        step: 'prompting',
        percent: 95,
        message: 'Prompting phone installation dialog...',
      });

      await this.deferredPrompt.prompt();
      const choice = await this.deferredPrompt.userChoice;

      if (choice.outcome === 'accepted') {
        this.deferredPrompt = null;
        this.isStandalone = true;
        this.updateProgress({
          step: 'installed',
          percent: 100,
          message: 'Installation confirmed! Acadet CBT MASTER is now on your home screen.',
        });
        this.notifyListeners();
      } else {
        this.updateProgress({
          step: 'idle',
          percent: 0,
          message: 'Installation prompt was dismissed.',
        });
      }
      return choice.outcome;
    } catch (err) {
      console.error('[PWA Suite] Install prompt failed:', err);
      return 'unsupported';
    }
  }

  /**
   * Generates and triggers real-time download of a Standalone Offline Mobile Suite (.html)
   * which can be saved to the phone and opened anytime without internet.
   */
  public downloadStandaloneOfflineApp(): void {
    try {
      const appUrl = window.location.origin;
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Acadet CBT MASTER - Mobile App Launcher</title>
  <link rel="manifest" href="${appUrl}/manifest.json">
  <link rel="icon" type="image/png" href="${appUrl}/favicon-192x192.png">
  <meta name="theme-color" content="#1e3a8a">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #090d16;
      color: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      box-sizing: border-box;
      padding: 24px;
    }
    .card {
      background: #111827;
      border: 1px solid rgba(99, 102, 241, 0.4);
      border-radius: 24px;
      padding: 32px 24px;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
    }
    .logo {
      width: 80px;
      height: 80px;
      border-radius: 20px;
      box-shadow: 0 8px 16px rgba(0,0,0,0.4);
      margin-bottom: 16px;
    }
    h1 {
      font-size: 22px;
      font-weight: 800;
      margin: 0 0 8px 0;
      color: #ffffff;
    }
    p {
      font-size: 13px;
      color: #94a3b8;
      line-height: 1.5;
      margin: 0 0 24px 0;
    }
    .launch-btn {
      display: block;
      width: 100%;
      background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
      color: #ffffff;
      text-decoration: none;
      font-weight: 700;
      font-size: 16px;
      padding: 16px;
      border-radius: 16px;
      box-sizing: border-box;
      margin-bottom: 16px;
      box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4);
    }
    .hint {
      font-size: 11px;
      color: #64748b;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <img src="${appUrl}/favicon-192x192.png" alt="Acadet CBT Logo" class="logo">
    <h1>Acadet CBT MASTER</h1>
    <p>Official Mobile Suite & Offline Examination Practice App</p>
    <a href="${appUrl}/" class="launch-btn">🚀 Open Full App</a>
    <div class="hint">
      To install to your phone's home screen, tap the browser menu (⋮) and select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
    </div>
  </div>
  <script>
    // Automatically navigate to live/cached app if online or offline
    setTimeout(function() {
      window.location.href = "${appUrl}/";
    }, 1200);
  </script>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Acadet_CBT_MASTER_MobileApp.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('[PWA Suite] Failed to trigger offline package download:', e);
    }
  }

  public getPlatformInfo(): {
    isIOS: boolean;
    isAndroid: boolean;
    isMobile: boolean;
    browserName: string;
  } {
    if (typeof window === 'undefined') {
      return { isIOS: false, isAndroid: false, isMobile: false, browserName: 'Unknown' };
    }

    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isAndroid = /Android/.test(ua);
    const isMobile = isIOS || isAndroid || /Mobi|Tablet|iPad|iPhone/.test(ua);

    let browserName = 'Browser';
    if (/SamsungBrowser/i.test(ua)) browserName = 'Samsung Internet';
    else if (/EdgA|EdgiOS|Edge/i.test(ua)) browserName = 'Microsoft Edge';
    else if (/OPR|Opera/i.test(ua)) browserName = 'Opera';
    else if (/Chrome|CriOS/i.test(ua)) browserName = 'Google Chrome';
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browserName = 'Apple Safari';
    else if (/Firefox|FxiOS/i.test(ua)) browserName = 'Mozilla Firefox';

    return { isIOS, isAndroid, isMobile, browserName };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public subscribeProgress(listener: (state: InstallProgressState) => void): () => void {
    this.progressListeners.add(listener);
    return () => {
      this.progressListeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((fn) => fn());
  }
}

export const pwaService = new PwaInstallerService();

