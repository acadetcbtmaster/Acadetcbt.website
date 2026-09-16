import React, { useState, useEffect } from 'react';
import {
  Download,
  Smartphone,
  CheckCircle2,
  Sparkles,
  Share2,
  PlusSquare,
  ArrowLeft,
  X,
  Zap,
  WifiOff,
  ShieldCheck,
  Laptop,
  Check,
  Loader2,
  FileDown,
  Info
} from 'lucide-react';
import brandLogo from '../assets/images/exact_acadet_cbt_logo_1786225425882.jpg';
import { pwaService, InstallProgressState } from '../utils/pwaInstaller';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ isOpen, onClose }) => {
  const [platformInfo, setPlatformInfo] = useState(pwaService.getPlatformInfo());
  const [canInstall, setCanInstall] = useState(pwaService.canInstallDirectly());
  const [isInstalled, setIsInstalled] = useState(pwaService.isInstalled());
  const [installSuccess, setInstallSuccess] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progressState, setProgressState] = useState<InstallProgressState>(pwaService.getProgress());
  const [downloadedPackage, setDownloadedPackage] = useState(false);

  const [activeInstructionTab, setActiveInstructionTab] = useState<'android' | 'ios' | 'desktop'>(() => {
    const info = pwaService.getPlatformInfo();
    if (info.isIOS) return 'ios';
    if (info.isAndroid) return 'android';
    return 'android';
  });

  useEffect(() => {
    const unsubscribeState = pwaService.subscribe(() => {
      setCanInstall(pwaService.canInstallDirectly());
      setIsInstalled(pwaService.isInstalled());
      setPlatformInfo(pwaService.getPlatformInfo());
    });

    const unsubscribeProgress = pwaService.subscribeProgress((state) => {
      setProgressState(state);
      if (state.step === 'installed') {
        setInstallSuccess(true);
        setIsDownloading(false);
      }
    });

    return () => {
      unsubscribeState();
      unsubscribeProgress();
    };
  }, []);

  if (!isOpen) return null;

  const handleDownloadAndInstall = async () => {
    setIsDownloading(true);

    // Run real-time pre-caching and asset preparation
    await pwaService.prepareAndCacheOfflineApp();

    if (canInstall) {
      const result = await pwaService.triggerInstall();
      if (result === 'accepted') {
        setInstallSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2500);
      }
    } else {
      // If direct prompt is unavailable on this browser/OS, switch to relevant tab and guide user
      if (platformInfo.isIOS) {
        setActiveInstructionTab('ios');
      } else if (platformInfo.isAndroid) {
        setActiveInstructionTab('android');
      } else {
        setActiveInstructionTab('desktop');
      }
    }
    setIsDownloading(false);
  };

  const handleDownloadOfflineFile = () => {
    pwaService.downloadStandaloneOfflineApp();
    setDownloadedPackage(true);
    setTimeout(() => {
      setDownloadedPackage(false);
    }, 4000);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in"
      id="install-app-modal-overlay"
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-indigo-500/40 max-w-lg w-full rounded-3xl p-5 sm:p-7 shadow-2xl relative text-left flex flex-col space-y-4 max-h-[92vh] my-auto overflow-hidden text-slate-800 dark:text-slate-100"
        id="install-app-modal-content"
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <button
            onClick={onClose}
            className="py-1.5 px-3 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/80 transition-colors flex items-center gap-1.5 text-xs font-bold border border-slate-200 dark:border-slate-700 cursor-pointer shadow-xs"
            id="install-modal-back-btn"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4 text-blue-600 dark:text-indigo-400" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1e3a8a] dark:bg-indigo-600 text-white shadow-xs">
            <Smartphone className="w-3.5 h-3.5 text-white" />
            <span className="text-xs font-black tracking-wider uppercase">
              Download Phone App
            </span>
          </div>

          <button
            onClick={onClose}
            className="py-1.5 px-3 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/80 transition-colors flex items-center gap-1 text-xs font-bold border border-slate-200 dark:border-slate-700 cursor-pointer shadow-xs"
            id="install-modal-close-btn"
            title="Close"
          >
            <span>Close</span>
            <X className="w-4 h-4 text-rose-500 shrink-0" />
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="overflow-y-auto space-y-4 pr-1 custom-scrollbar">
          
          {/* Hero App Badge Card */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-gradient-to-br dark:from-indigo-950/70 dark:via-slate-900 dark:to-slate-950 border border-slate-200 dark:border-indigo-500/30 flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#1e3a8a] via-blue-600 to-indigo-600 p-0.5 shadow-md shrink-0 overflow-hidden">
              <img
                src={brandLogo}
                alt="Acadet CBT Master"
                className="w-full h-full object-cover rounded-2xl"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                  Acadet CBT MASTER
                </h3>
                <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-blue-700 text-white shadow-xs uppercase tracking-wider shrink-0">
                  Mobile App
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                Official University & Pre-JAMB CBT Simulator Suite
              </p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs">
                <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-[#1e3a8a] dark:bg-indigo-600 text-white flex items-center gap-1 shadow-xs">
                  <Zap className="w-3 h-3 text-amber-300" /> Real-Time PWA
                </span>
                <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-blue-800 text-white flex items-center gap-1 shadow-xs">
                  <WifiOff className="w-3 h-3 text-white" /> 100% Offline
                </span>
                <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-emerald-700 text-white flex items-center gap-1 shadow-xs">
                  <ShieldCheck className="w-3 h-3 text-white" /> Free Download
                </span>
              </div>
            </div>
          </div>

          {/* Real-time Download & Caching Progress Bar */}
          {isDownloading && (
            <div className="p-4 rounded-2xl bg-blue-50 dark:bg-slate-800/80 border border-blue-200 dark:border-indigo-500/40 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-blue-900 dark:text-blue-200">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-blue-600 dark:text-indigo-400 animate-spin" />
                  <span>{progressState.message || 'Downloading & preparing mobile app...'}</span>
                </span>
                <span className="font-extrabold">{progressState.percent}%</span>
              </div>
              <div className="w-full h-2.5 bg-blue-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300 rounded-full"
                  style={{ width: `${progressState.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Success State */}
          {installSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/50 text-emerald-900 dark:text-emerald-200 text-center space-y-1">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto animate-bounce" />
              <p className="text-sm font-bold text-slate-900 dark:text-white">App Downloaded & Installed on Phone!</p>
              <p className="text-xs text-emerald-800 dark:text-emerald-300">
                You can now launch Acadet CBT MASTER directly from your home screen anytime without data.
              </p>
            </div>
          )}

          {/* Standalone Installed Notification */}
          {isInstalled && !installSuccess && (
            <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-slate-800/80 border border-blue-300 dark:border-indigo-500/40 text-center space-y-1">
              <div className="inline-flex p-2 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 mb-1">
                <Check className="w-4 h-4" />
              </div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">App is Installed on This Phone / Device</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Running in high-speed Standalone Mobile Suite mode with offline caching active.
              </p>
            </div>
          )}

          {/* Primary Action: Download & Install App in Real Time */}
          {!installSuccess && !isInstalled && (
            <div className="space-y-2">
              <button
                onClick={handleDownloadAndInstall}
                disabled={isDownloading}
                className="w-full py-4 px-4 bg-gradient-to-r from-[#1e3a8a] via-blue-700 to-indigo-800 hover:from-[#172554] hover:to-blue-800 text-white font-extrabold text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2.5 transition-all transform active:scale-98 cursor-pointer disabled:opacity-75"
                id="direct-install-pwa-btn"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Downloading & Preparing Phone App...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 animate-bounce" />
                    <span>
                      {canInstall
                        ? `1-Tap Install App on ${platformInfo.isMobile ? 'Phone' : 'Device'}`
                        : `Download & Setup App on ${platformInfo.isMobile ? 'Phone' : 'Device'}`}
                    </span>
                  </>
                )}
              </button>

              {/* Direct Standalone Offline App File Download (.html) */}
              <button
                onClick={handleDownloadOfflineFile}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/90 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                id="download-offline-file-btn"
                title="Download standalone offline launcher file directly to your phone downloads"
              >
                <FileDown className="w-4 h-4 text-blue-600 dark:text-indigo-400" />
                <span>
                  {downloadedPackage
                    ? 'Saved to Downloads! Check your phone files'
                    : 'Download Offline App File (.html) to Phone'}
                </span>
              </button>
            </div>
          )}

          {/* Platform Guided Tabs */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-600 dark:text-indigo-400" />
                <span>Installation Guide for Your Phone:</span>
              </span>
              <span className="text-[10px] text-blue-600 dark:text-indigo-400 font-semibold">
                Detected: {platformInfo.browserName}
              </span>
            </div>

            {/* Platform Selector Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setActiveInstructionTab('android')}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  activeInstructionTab === 'android'
                    ? 'bg-[#1e3a8a] dark:bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Android</span>
              </button>
              <button
                onClick={() => setActiveInstructionTab('ios')}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  activeInstructionTab === 'ios'
                    ? 'bg-[#1e3a8a] dark:bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>iPhone / iPad</span>
              </button>
              <button
                onClick={() => setActiveInstructionTab('desktop')}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  activeInstructionTab === 'desktop'
                    ? 'bg-[#1e3a8a] dark:bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>PC / Laptop</span>
              </button>
            </div>

            {/* Android Guide */}
            {activeInstructionTab === 'android' && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-indigo-600/30 text-blue-700 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-blue-300 dark:border-indigo-500/40">
                    1
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">Open Phone Browser Menu (⋮)</p>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                      In Chrome, Samsung Internet, Edge, or Opera, tap the <strong>three dots (⋮)</strong> at the top right or bottom corner.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-indigo-600/30 text-blue-700 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-blue-300 dark:border-indigo-500/40">
                    2
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">Tap "Install app" or "Add to Home Screen"</p>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                      Select <span className="text-blue-700 dark:text-indigo-300 font-bold">"Install app"</span> (or <span className="text-blue-700 dark:text-indigo-300 font-bold">"Add to Home screen"</span>) from the list.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-indigo-600/30 text-blue-700 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-blue-300 dark:border-indigo-500/40">
                    3
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">Confirm Installation</p>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                      Tap <strong>"Install"</strong>. The Acadet CBT MASTER app icon will immediately appear on your phone home screen and app launcher!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* iOS Safari Guide */}
            {activeInstructionTab === 'ios' && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-indigo-600/30 text-blue-700 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-blue-300 dark:border-indigo-500/40">
                    1
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      Tap the Share Button <Share2 className="w-3.5 h-3.5 text-blue-600 dark:text-indigo-400 inline" />
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                      At the bottom of Safari on your iPhone (or top on iPad), tap the square <strong>Share button [↑]</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-indigo-600/30 text-blue-700 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-blue-300 dark:border-indigo-500/40">
                    2
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      Select "Add to Home Screen" <PlusSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 inline" />
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                      Scroll down through the share sheet options and tap <strong>"Add to Home Screen"</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-indigo-600/30 text-blue-700 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-blue-300 dark:border-indigo-500/40">
                    3
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">Tap "Add"</p>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                      Tap <strong>"Add"</strong> at the top right. The app will launch in a full-screen, native phone app mode.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Desktop Guide */}
            {activeInstructionTab === 'desktop' && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-indigo-600/30 text-blue-700 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-blue-300 dark:border-indigo-500/40">
                    1
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">Look for the Install Icon in URL Bar</p>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                      In Chrome or Edge, click the <strong>computer/install icon (⊕ or ⬇)</strong> on the right side of the address bar.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-indigo-600/30 text-blue-700 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-blue-300 dark:border-indigo-500/40">
                    2
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">Click "Install"</p>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                      The simulator will open in its own standalone window and create desktop & start menu shortcuts.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Key Advantages Checklist */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-2">
            <h4 className="text-xs font-extrabold text-[#1e3a8a] dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-indigo-400" />
              Why Install the Phone App?
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>Zero mobile data for cached practice</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>Full-screen realistic CBT exam simulation</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>1-Tap launch from your home screen</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>Works on all Android & iOS devices</span>
              </div>
            </div>
          </div>

          {/* Action Close / Done Button */}
          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs rounded-xl border border-slate-300 dark:border-slate-700 transition-all cursor-pointer"
            >
              Close & Return to Practice
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
