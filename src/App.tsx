import React, { useState, useEffect } from 'react';
import { WeibullResult, AnalysisMode, Language, GroupDataset } from './types';
import { parseInputData, calculateWeibull } from './services/weibullMath';
import WeibullChart from './components/WeibullChart';
import ResultsPanel from './components/ResultsPanel';
import PwaPrompt from './components/PwaPrompt';
import { t } from './utils/locales';
import {
    ChartPieIcon,
    ArrowPathIcon,
    ArrowDownTrayIcon,
    TrashIcon,
    LanguageIcon,
    InformationCircleIcon,
    PencilSquareIcon,
    PlusIcon,
    XMarkIcon,
    WifiIcon
} from '@heroicons/react/24/outline';

const PALETTE = ['#1E3A5F', '#e11d48', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

const App: React.FC = () => {
    const [mode, setMode] = useState<AnalysisMode>('SINGLE');
    const [lang, setLang] = useState<Language>('en');

    // Multi-Group Dataset state
    const [groups, setGroups] = useState<GroupDataset[]>([
        { id: 'g1', label: 'Group A', text: '100\n120\n135\n150\n210\n240\n300\n350\n400', color: PALETTE[0], result: null, visible: true },
        { id: 'g2', label: 'Group B', text: '150\n180\n220\n260\n320\n350\n420\n480', color: PALETTE[1], result: null, visible: true },
    ]);

    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [activeMobileView, setActiveMobileView] = useState<'INPUT' | 'CHART' | 'RESULTS'>('CHART');
    
    // PWA & Network State
    const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
    const [needRefresh, setNeedRefresh] = useState<boolean>(false);
    const [updateSWFn, setUpdateSWFn] = useState<(() => void) | null>(null);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        const handlePwaRefresh = (e: Event) => {
            const customEvt = e as CustomEvent;
            setNeedRefresh(true);
            if (typeof customEvt.detail === 'function') {
                setUpdateSWFn(() => customEvt.detail);
            }
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('pwa-need-refresh', handlePwaRefresh);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('pwa-need-refresh', handlePwaRefresh);
        };
    }, []);

    const handleCalculate = () => {
        setGroups(prev => prev.map((g, idx) => {
            if (mode === 'SINGLE' && idx > 0) return { ...g, result: null };
            const data = parseInputData(g.text);
            const res = data.length > 0 ? calculateWeibull(data) : null;
            return { ...g, result: res };
        }));

        if (window.innerWidth < 1024) {
            setActiveMobileView('CHART');
        }
    };

    useEffect(() => {
        handleCalculate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);

    const toggleLanguage = () => {
        const nextLang = lang === 'en' ? 'zh' : 'en';
        setLang(nextLang);
    };

    const handleAddGroup = () => {
        const nextIdx = groups.length + 1;
        const defaultLabel = lang === 'zh' ? `${String.fromCharCode(64 + nextIdx)} 組` : `Group ${String.fromCharCode(64 + nextIdx)}`;
        const newColor = PALETTE[groups.length % PALETTE.length];
        const newGroup: GroupDataset = {
            id: `g_${Date.now()}`,
            label: defaultLabel,
            text: '',
            color: newColor,
            result: null,
            visible: true
        };
        setGroups(prev => [...prev, newGroup]);
    };

    const handleRemoveGroup = (id: string) => {
        if (groups.length <= 1) return;
        setGroups(prev => prev.filter(g => g.id !== id));
    };

    const handleGroupFieldChange = (id: string, field: 'label' | 'text' | 'color', value: string) => {
        setGroups(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
    };

    const handleToggleVisibility = (id: string) => {
        setGroups(prev => prev.map(g => g.id === id ? { ...g, visible: !g.visible } : g));
    };

    const handleTogglePoint = (groupIndex: number, pointId: number, currentStatus: 'F' | 'S') => {
        setGroups(prev => {
            const targetGroup = prev[groupIndex - 1];
            if (!targetGroup || !targetGroup.result || !targetGroup.result.dataPoints[pointId]) return prev;
            const newStatus = currentStatus === 'F' ? 'S' : 'F';
            const updatedLines = targetGroup.result.dataPoints.map((p, index) => {
                if (index === pointId) return `${p.time} ${newStatus}`;
                return `${p.time} ${p.status}`;
            });
            const newText = updatedLines.join('\n');
            const data = parseInputData(newText);
            return prev.map((g, i) => {
                if (i === groupIndex - 1) {
                    return {
                        ...g,
                        text: newText,
                        result: data.length > 0 ? calculateWeibull(data) : null
                    };
                }
                return g;
            });
        });
    };

    const handleClear = () => {
        setGroups(prev => prev.map(g => ({ ...g, text: '', result: null })));
    };

    const handleExport = () => {
        const timestamp = new Date().toLocaleString();
        let content = `WEIBULL ANALYSIS REPORT\n`;
        content += `Generated: ${timestamp}\n`;
        content += `Mode: ${mode === 'SINGLE' ? 'Single Analysis' : 'Multi-Group Comparative Analysis'}\n\n`;

        const getFailureMode = (beta: number) => {
            if (beta < 0.9) return "Infant Mortality";
            if (beta <= 1.1) return "Random Failures";
            return "Wear-out Failures";
        };

        const activeGroups = mode === 'SINGLE' ? groups.slice(0, 1) : groups;

        activeGroups.forEach((g) => {
            if (!g.result) return;
            const res = g.result;
            content += `========================================\n`;
            content += `DATASET: ${g.label.toUpperCase()}\n`;
            content += `========================================\n`;
            content += `Beta (Shape Parameter) : ${res.beta.toFixed(4)} (${getFailureMode(res.beta)})\n`;
            content += `Eta (Scale Parameter)  : ${res.eta.toFixed(4)}\n`;
            content += `MTTF                   : ${res.mttf.toFixed(4)}\n`;
            content += `R-Squared (Fit Quality): ${res.rSquared.toFixed(4)}\n\n`;

            content += `Data Points (Total: ${res.dataPoints.length}):\n`;
            content += `Time\tStatus\tRank (%)\n`;
            res.dataPoints.forEach(p => {
                content += `${p.time.toFixed(2)}\t${p.status === 'F' ? 'Failure' : 'Suspension'}\t${(p.rank * 100).toFixed(2)}%\n`;
            });
            content += `\n`;
        });

        if (aiAnalysis) {
            content += `========================================\n`;
            content += `AI RELIABILITY ANALYSIS REPORT\n`;
            content += `========================================\n`;
            content += `${aiAnalysis}\n`;
        }

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Weibull_Analysis_${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleUpdateServiceWorker = () => {
        if (updateSWFn) {
            updateSWFn();
        } else {
            window.location.reload();
        }
    };

    const displayedGroups = mode === 'SINGLE' ? groups.slice(0, 1) : groups;

    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden font-sans select-none transition-colors duration-300" style={{ backgroundColor: 'var(--bg-app)' }}>
            {/* 1. Header Bar */}
            <header className="flex-none flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 sm:py-3 z-30 transition-colors duration-200" style={{ backgroundColor: 'var(--bg-sidebar)' }}>
                <div className="flex items-center justify-between sm:justify-start space-x-3 mb-2 sm:mb-0">
                    <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent)', boxShadow: 'var(--shadow-accent)' }}>
                            <ChartPieIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </div>
                        <h1 className="fs-body sm:fs-title font-bold tracking-tight whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                            {t('app.title', lang)} <span className="text-[var(--accent-interactive)]">{t('app.titleSuffix', lang)}</span>
                        </h1>
                    </div>

                    {!isOnline && (
                        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 fs-micro font-bold">
                            <WifiIcon className="w-3.5 h-3.5" />
                            <span>{lang === 'zh' ? '離線模式' : 'Offline'}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between sm:justify-end px-2 py-1.5 sm:py-0 space-x-2 sm:space-x-3">
                    {/* Mode Toggle */}
                    <div className="flex p-1 rounded-xl soft-inset">
                        <button
                            onClick={() => setMode('SINGLE')}
                            className={`px-3 sm:px-4 py-2 sm:py-1.5 fs-small sm:fs-body font-bold uppercase tracking-wide rounded-lg transition-all min-h-[40px] sm:min-h-0 cursor-pointer ${mode === 'SINGLE'
                                ? 'text-white'
                                : 'hover:opacity-70 transition-opacity'
                                }`}
                            style={mode === 'SINGLE' ? { backgroundColor: 'var(--accent)', boxShadow: 'var(--shadow-accent)' } : { color: 'var(--text-secondary)' }}
                        >
                            {t('app.single', lang)}
                        </button>
                        <button
                            onClick={() => setMode('MULTI')}
                            className={`px-3 sm:px-4 py-2 sm:py-1.5 fs-small sm:fs-body font-bold uppercase tracking-wide rounded-lg transition-all min-h-[40px] sm:min-h-0 cursor-pointer ${mode === 'MULTI'
                                ? 'text-white'
                                : 'hover:opacity-70 transition-opacity'
                                }`}
                            style={mode === 'MULTI' ? { backgroundColor: 'var(--accent)', boxShadow: 'var(--shadow-accent)' } : { color: 'var(--text-secondary)' }}
                        >
                            {lang === 'zh' ? '多組比較' : 'Multi-Group'}
                        </button>
                    </div>

                    {/* Language */}
                    <div className="flex items-center space-x-1">
                        <button
                            onClick={toggleLanguage}
                            className="p-2 rounded-xl soft-btn flex items-center space-x-1 min-h-[44px] min-w-[44px] justify-center cursor-pointer"
                            style={{ color: 'var(--text-secondary)' }}
                            title="Switch Language"
                        >
                            <LanguageIcon className="w-5 h-5" />
                            <span className="fs-small sm:fs-body font-bold">{lang.toUpperCase()}</span>
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-1.5">
                        <button onClick={handleExport} className="p-2 sm:p-1.5 rounded-xl soft-btn min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer" style={{ color: 'var(--text-secondary)' }} title={t('app.export', lang)}>
                            <ArrowDownTrayIcon className="w-5 h-5" />
                        </button>
                        <button onClick={handleClear} className="p-2 sm:p-1.5 rounded-xl soft-btn min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer" style={{ color: 'var(--text-secondary)' }} title={t('app.clear', lang)}>
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* 2. Workspace Layout */}
            <div className="flex-1 flex flex-col lg:flex-row lg:justify-center overflow-hidden relative">

                {/* Mobile Tab Switcher */}
                <div className="lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 rounded-xl flex items-center p-1.5 z-50 transition-all duration-300 mb-safe soft-raised">
                    {[
                        { id: 'INPUT', label: lang === 'zh' ? '數據' : 'Data', icon: ArrowPathIcon },
                        { id: 'CHART', label: lang === 'zh' ? '圖表' : 'Plot', icon: ChartPieIcon },
                        { id: 'RESULTS', label: lang === 'zh' ? '分析' : 'Analysis', icon: InformationCircleIcon }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveMobileView(tab.id as any)}
                            className={`flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg fs-small font-bold uppercase tracking-wider transition-all min-h-[44px] cursor-pointer ${activeMobileView === tab.id
                                ? 'text-white'
                                : ''
                                }`}
                            style={activeMobileView === tab.id ? { backgroundColor: 'var(--accent)', boxShadow: 'var(--shadow-accent)' } : { color: 'var(--text-secondary)' }}
                        >
                            <tab.icon className="w-4 h-4" />
                            <span className={activeMobileView === tab.id ? 'block' : 'hidden'}>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* LEFT COLUMN: Data Input Sidebar */}
                <aside className={`${activeMobileView === 'INPUT' ? 'flex' : 'hidden'} lg:flex w-full lg:w-80 flex-none flex-col z-20 transition-all duration-300`} style={{ backgroundColor: 'var(--bg-sidebar)' }}>
                    <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 pb-28 lg:pb-4">
                        {/* Format Info Box */}
                        <div className="p-3.5 rounded-2xl flex gap-3 animate-fadeIn soft-inset">
                            <InformationCircleIcon className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
                            <p className="fs-small leading-normal font-medium" style={{ color: 'var(--text-secondary)' }}>
                                {t('input.formatInfo', lang)}
                            </p>
                        </div>

                        {/* Input Groups List */}
                        {displayedGroups.map((g) => (
                            <div key={g.id} className="flex flex-col min-h-[170px] p-4 rounded-3xl soft-raised transition-all duration-200">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center space-x-2 flex-1 mr-2 min-w-0">
                                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: g.color }}></div>
                                        <PencilSquareIcon className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                                        <input
                                            type="text"
                                            value={g.label}
                                            onChange={(e) => handleGroupFieldChange(g.id, 'label', e.target.value)}
                                            placeholder={lang === 'zh' ? '組別名稱' : 'Group Name'}
                                            className="fs-small sm:fs-body font-bold uppercase tracking-wider bg-transparent outline-none border-b border-transparent hover:border-[var(--border)] focus:border-[var(--accent-interactive)] transition-colors w-full truncate"
                                            style={{ color: g.color }}
                                        />
                                    </div>
                                    <div className="flex items-center space-x-2 shrink-0">
                                        <span className="fs-micro font-bold px-2.5 py-1 rounded-lg soft-inset-sm" style={{ color: 'var(--text-secondary)' }}>
                                            N={parseInputData(g.text).length}
                                        </span>
                                        {mode === 'MULTI' && groups.length > 2 && (
                                            <button
                                                onClick={() => handleRemoveGroup(g.id)}
                                                className="p-2 text-gray-400 hover:text-red-500 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                                                title={lang === 'zh' ? '刪除此數據組' : 'Delete Dataset'}
                                            >
                                                <XMarkIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <textarea
                                    className="flex-1 w-full p-3 rounded-xl resize-none font-mono fs-small sm:fs-body outline-none transition-all leading-relaxed soft-inset"
                                    style={{ color: 'var(--text-primary)' }}
                                    placeholder={t('input.placeholderSingle', lang)}
                                    value={g.text}
                                    onChange={(e) => handleGroupFieldChange(g.id, 'text', e.target.value)}
                                    onFocus={(e) => e.target.style.boxShadow = 'var(--shadow-inset-focus)'}
                                    onBlur={(e) => e.target.style.boxShadow = ''}
                                />
                            </div>
                        ))}

                        {/* Add Group Button in Multi Mode */}
                        {mode === 'MULTI' && (
                            <button
                                onClick={handleAddGroup}
                                className="w-full py-3 px-4 rounded-xl soft-btn flex items-center justify-center space-x-2 font-bold fs-small uppercase tracking-wider cursor-pointer min-h-[44px]"
                                style={{ color: 'var(--accent)' }}
                            >
                                <PlusIcon className="w-4 h-4" />
                                <span>{lang === 'zh' ? '+ 新增數據組' : '+ Add Dataset'}</span>
                            </button>
                        )}
                    </div>

                    <div className="p-4 sticky bottom-0 z-30 pb-28 lg:pb-4" style={{ backgroundColor: 'var(--bg-sidebar)' }}>
                        <button
                            onClick={handleCalculate}
                            className="w-full text-white fs-body font-bold uppercase tracking-widest py-3.5 rounded-xl soft-accent-btn flex items-center justify-center space-x-2 cursor-pointer min-h-[44px]"
                        >
                            <ArrowPathIcon className="w-5 h-5" />
                            <span>{t('input.calculate', lang)}</span>
                        </button>
                    </div>
                </aside>

                {/* CENTER COLUMN: Chart — `.chart-column` caps its width to what the
                    fixed-aspect frame needs (see index.css), so extra viewport width
                    becomes outer whitespace and the side panels move inward. */}
                <main className={`${activeMobileView === 'CHART' ? 'flex' : 'hidden'} lg:flex flex-1 chart-column min-w-0 relative transition-all duration-300`} style={{ backgroundColor: 'var(--bg-surface)' }}>
                    <div className="absolute inset-0 flex flex-col pt-2 lg:pt-0 pb-20 lg:pb-0">
                        <WeibullChart
                            groups={displayedGroups}
                            lang={lang}
                            aiAnalysis={aiAnalysis}
                            onToggleVisibility={handleToggleVisibility}
                        />
                    </div>
                </main>

                {/* RIGHT COLUMN: Analysis Panel */}
                <aside className={`${activeMobileView === 'RESULTS' ? 'flex' : 'hidden'} lg:flex w-full lg:w-[450px] flex-none flex flex-col z-20 transition-all duration-300`} style={{ backgroundColor: 'var(--bg-surface)' }}>
                    <div className="flex-1 overflow-hidden relative pb-24 lg:pb-0">
                        <ResultsPanel
                            groups={displayedGroups}
                            isMultiMode={mode === 'MULTI'}
                            onTogglePoint={handleTogglePoint}
                            lang={lang}
                            onAiAnalysisChange={setAiAnalysis}
                        />
                    </div>
                </aside>

            </div>

            {/* PWA Prompts & Notifications */}
            <PwaPrompt lang={lang} needRefresh={needRefresh} onUpdateServiceWorker={handleUpdateServiceWorker} />

            {/* Footer */}
            <div className="hidden sm:block flex-none px-4 py-1.5 fs-micro text-right uppercase tracking-widest font-bold" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-app)' }}>
                Developed by Wesley Chang @ Mouldex, Jan-2026. All rights reserved.
            </div>
        </div>
    );
};

export default App;