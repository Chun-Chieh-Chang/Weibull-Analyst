import React, { useState, useEffect } from 'react';
import { Language } from '../types';
import { ArrowDownTrayIcon, XMarkIcon, ArrowPathIcon, ShareIcon, PlusIcon } from '@heroicons/react/24/outline';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaPromptProps {
  lang: Language;
  needRefresh?: boolean;
  onUpdateServiceWorker?: () => void;
}

const PwaPrompt: React.FC<PwaPromptProps> = ({ lang, needRefresh = false, onUpdateServiceWorker }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(false);
  const [showIosGuide, setShowIosGuide] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);

  useEffect(() => {
    // Check if already running as standalone PWA
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);

    if (isStandaloneMode) return;

    // Handle Chrome / Android beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Check if user dismissed prompt recently
      const dismissed = localStorage.getItem('weibull_pwa_dismissed');
      if (!dismissed) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Detect iOS Safari
    const ua = window.navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios|android/i.test(ua);
    
    if (isIos && isSafari && !isStandaloneMode) {
      const iosDismissed = localStorage.getItem('weibull_pwa_ios_dismissed');
      if (!iosDismissed) {
        setShowInstallBanner(true);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setShowInstallBanner(false);
      }
      setDeferredPrompt(null);
    } else {
      // iOS Safari guide
      setShowIosGuide(true);
    }
  };

  const handleDismissInstall = () => {
    setShowInstallBanner(false);
    localStorage.setItem('weibull_pwa_dismissed', 'true');
    localStorage.setItem('weibull_pwa_ios_dismissed', 'true');
  };

  if (isStandalone && !needRefresh) return null;

  return (
    <>
      {/* 1. Service Worker Update Banner */}
      {needRefresh && (
        <div className="fixed top-4 right-4 left-4 sm:left-auto sm:max-w-md z-50 animate-slideUp bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex items-center justify-between space-x-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 flex items-center justify-center text-blue-400 shrink-0">
              <ArrowPathIcon className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <p className="text-xs font-bold">{lang === 'zh' ? '發現新版本 Weibull AI Analyst' : 'New Version Available'}</p>
              <p className="text-[11px] text-slate-300">{lang === 'zh' ? '點擊即可即時更新至最新版' : 'Click to refresh and apply the update'}</p>
            </div>
          </div>
          <button
            onClick={onUpdateServiceWorker}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0 shadow-md"
          >
            {lang === 'zh' ? '立即更新' : 'Update Now'}
          </button>
        </div>
      )}

      {/* 2. PWA Install Top Floating Banner */}
      {showInstallBanner && !needRefresh && (
        <div className="fixed top-16 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-40 animate-slideUp bg-white border border-slate-200 rounded-2xl shadow-2xl p-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img src={`${import.meta.env.BASE_URL}pwa-192x192.png`} alt="App Icon" className="w-11 h-11 rounded-xl shadow-sm border border-slate-100 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-slate-900">{lang === 'zh' ? '安裝 Weibull AI 應用程式' : 'Install Weibull AI App'}</h4>
              <p className="text-[11px] text-slate-500 leading-tight">
                {lang === 'zh' ? '支援全螢幕與離線分析模式' : 'Offline support & native app mode'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0 ml-2">
            <button
              onClick={handleInstallClick}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 flex items-center space-x-1 cursor-pointer"
            >
              <ArrowDownTrayIcon className="w-3.5 h-3.5" />
              <span>{lang === 'zh' ? '安裝' : 'Install'}</span>
            </button>
            <button
              onClick={handleDismissInstall}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
              title={lang === 'zh' ? '關閉' : 'Close'}
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3. iOS Safari Add to Home Screen Instructions Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4 animate-scaleIn mb-safe">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <img src={`${import.meta.env.BASE_URL}pwa-192x192.png`} alt="App Icon" className="w-8 h-8 rounded-lg" />
                <h3 className="text-sm font-bold text-slate-900">{lang === 'zh' ? 'iOS 安裝至主畫面' : 'Install on iOS'}</h3>
              </div>
              <button
                onClick={() => setShowIosGuide(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex items-start space-x-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[11px] shrink-0">1</span>
                <p>{lang === 'zh' ? '點擊 Safari 下方工具列的「分享」按鈕' : 'Tap the "Share" button in Safari toolbar'}</p>
                <ShareIcon className="w-5 h-5 text-blue-600 shrink-0" />
              </div>

              <div className="flex items-start space-x-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[11px] shrink-0">2</span>
                <p>{lang === 'zh' ? '向下滾動並選擇「加入主畫面」' : 'Scroll down and select "Add to Home Screen"'}</p>
                <PlusIcon className="w-5 h-5 text-blue-600 shrink-0" />
              </div>

              <div className="flex items-start space-x-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[11px] shrink-0">3</span>
                <p>{lang === 'zh' ? '點擊右上角「新增」即可開啟獨立 APP 模式' : 'Tap "Add" in top right corner to enjoy full PWA'}</p>
              </div>
            </div>

            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
            >
              {lang === 'zh' ? '我知道了' : 'Got it'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default PwaPrompt;
