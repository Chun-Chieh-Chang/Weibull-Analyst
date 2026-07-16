import React, { useState, useEffect } from 'react';
import { WeibullResult, AnalysisMode, Language, Theme } from './types';
import { parseInputData, calculateWeibull } from './services/weibullMath';
import WeibullChart from './components/WeibullChart';
import ResultsPanel from './components/ResultsPanel';
import { t } from './utils/locales';
import {
    ChartPieIcon,
    ArrowPathIcon,
    ArrowDownTrayIcon,
    TrashIcon,
    SunIcon,
    MoonIcon,
    LanguageIcon,
    InformationCircleIcon
} from '@heroicons/react/24/outline';

const App: React.FC = () => {
    const [mode, setMode] = useState<AnalysisMode>('SINGLE');
    const [lang, setLang] = useState<Language>('en');
    const [theme, setTheme] = useState<Theme>('dark');

    // Default Data
    const [text1, setText1] = useState<string>('100\n120\n135\n150\n210\n240\n300\n350\n400');
    const [text2, setText2] = useState<string>('150\n180\n220\n260\n320\n350\n420\n480');

    const [result1, setResult1] = useState<WeibullResult | null>(null);
    const [result2, setResult2] = useState<WeibullResult | null>(null);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

    useEffect(() => {
        handleCalculate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Theme Effect
    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            document.documentElement.style.colorScheme = 'dark';
        } else {
            document.documentElement.classList.remove('dark');
            document.documentElement.style.colorScheme = 'light';
        }
    }, [theme]);






    const [activeMobileView, setActiveMobileView] = useState<'INPUT' | 'CHART' | 'RESULTS'>('CHART');

    const handleCalculate = () => {
        const data1 = parseInputData(text1);
        const r1 = data1.length > 0 ? calculateWeibull(data1) : null;
        setResult1(r1);

        if (mode === 'DUAL') {
            const data2 = parseInputData(text2);
            const r2 = data2.length > 0 ? calculateWeibull(data2) : null;
            setResult2(r2);
        } else {
            setResult2(null);
        }
        
        // Auto switch to chart view on mobile after calculation
        if (window.innerWidth < 1024) {
            setActiveMobileView('CHART');
        }
    };

    const handleTogglePoint = (groupIndex: 1 | 2, pointId: number, currentStatus: 'F' | 'S') => {
        const targetResult = groupIndex === 1 ? result1 : result2;
        if (!targetResult || !targetResult.dataPoints[pointId]) return;

        const newStatus = currentStatus === 'F' ? 'S' : 'F';

        const updatedLines = targetResult.dataPoints.map((p, index) => {
            if (index === pointId) {
                return `${p.time} ${newStatus}`;
            }
            return `${p.time} ${p.status}`;
        });

        const newText = updatedLines.join('\n');

        if (groupIndex === 1) {
            setText1(newText);
            const data1 = parseInputData(newText);
            setResult1(data1.length > 0 ? calculateWeibull(data1) : null);
        } else {
            setText2(newText);
            const data2 = parseInputData(newText);
            setResult2(data2.length > 0 ? calculateWeibull(data2) : null);
        }
    };

    const handleClear = () => {
        setText1('');
        setText2('');
        setResult1(null);
        setResult2(null);
    };

    const handleExport = () => {
        const timestamp = new Date().toLocaleString();
        let content = `WEIBULL ANALYSIS REPORT\n`;
        content += `Generated: ${timestamp}\n`;
        content += `Mode: ${mode === 'SINGLE' ? 'Single Analysis' : 'Comparative Analysis'}\n\n`;

        const getFailureMode = (beta: number) => {
            if (beta < 0.9) return "Infant Mortality";
            if (beta <= 1.1) return "Random Failures";
            return "Wear-out";
        };

        const generateGroupReport = (name: string, result: WeibullResult | null, rawInput: string) => {
            let section = `================================================================================\n`;
            section += ` ${name.toUpperCase()} \n`;
            section += `================================================================================\n`;

            if (!result) {
                section += `No valid calculation results available.\n\n`;
                section += `[RAW INPUT]\n${rawInput}\n\n`;
                return section;
            }

            section += `[SUMMARY STATISTICS]\n`;
            section += `  Beta (Shape Parameter):       ${result.beta.toFixed(4)} (${getFailureMode(result.beta)})\n`;
            section += `  Eta (Characteristic Life):    ${result.eta.toFixed(4)}\n`;
            section += `  MTTF (Mean Time To Failure):  ${result.mttf.toFixed(4)}\n`;
            section += `  R-Squared (Goodness of Fit):  ${result.rSquared.toFixed(4)}\n`;
            section += `  Sample Size (N):              ${result.dataPoints.length}\n`;
            section += `  Failures (F):                 ${result.dataPoints.filter(p => p.status === 'F').length}\n`;
            section += `  Suspensions (S):              ${result.dataPoints.filter(p => p.status === 'S').length}\n\n`;

            section += `[CALCULATED DATA POINTS]\n`;
            // Header using explicit padding for alignment
            section += `  ${"No.".padEnd(6)} ${"Time".padEnd(12)} ${"Status".padEnd(8)} ${"Median Rank".padEnd(15)} ${"ln(t)".padEnd(12)} ${"ln(ln(1/(1-R)))".padEnd(16)}\n`;
            section += `  ${"-".repeat(75)}\n`;

            result.dataPoints.forEach(p => {
                const rankStr = p.status === 'F' ? (p.rank * 100).toFixed(4) + '%' : '-';
                const xStr = p.x.toFixed(4);
                const yStr = p.status === 'F' ? p.y.toFixed(4) : '-';

                section += `  ${(p.id + 1).toString().padEnd(6)} ${p.time.toFixed(2).padEnd(12)} ${p.status.padEnd(8)} ${rankStr.padEnd(15)} ${xStr.padEnd(12)} ${yStr.padEnd(16)}\n`;
            });
            section += `\n`;

            return section;
        };

        const name1 = mode === 'DUAL' ? (lang === 'zh' ? 'A 組數據 (Group A)' : 'Group A Data') : (lang === 'zh' ? '失效數據 (Failure Data)' : 'Failure Data');
        content += generateGroupReport(name1, result1, text1);

        if (mode === 'DUAL') {
            const name2 = lang === 'zh' ? 'B 組數據 (Group B)' : 'Group B Data';
            content += generateGroupReport(name2, result2, text2);
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

    const toggleLanguage = () => setLang(prev => prev === 'en' ? 'zh' : 'en');
    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');


    return (
        <div className="h-full flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden transition-colors duration-300">
            {/* 1. Header (Slim, Responsive) */}
            <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 flex-none z-30 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between transition-colors duration-200">
                <div className="flex items-center justify-between px-4 py-2 sm:py-0 h-12 sm:h-14">
                    <div className="flex items-center space-x-2">
                        <div className="bg-indigo-600 p-1 rounded-md sm:p-1.5 shadow-sm">
                            <ChartPieIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </div>
                        <h1 className="text-sm sm:text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight whitespace-nowrap">
                            {t('app.title', lang)} <span className="text-indigo-600 dark:text-indigo-400">{t('app.titleSuffix', lang)}</span>
                        </h1>
                    </div>
                    
                    {/* Mobile Quick Actions */}
                    <div className="flex sm:hidden items-center space-x-2">
                        <button onClick={toggleTheme} className="p-2 text-slate-500">
                            {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5 text-amber-400" />}
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end px-4 py-2 sm:py-0 space-x-2 sm:space-x-3 bg-slate-50/50 sm:bg-transparent dark:bg-white/5 sm:dark:bg-transparent border-t sm:border-t-0 border-slate-100 dark:border-white/5">
                    {/* Mode Toggle */}
                    <div className="flex bg-white dark:bg-slate-800 sm:bg-slate-100 sm:dark:bg-slate-700 p-0.5 sm:p-1 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm sm:shadow-none">
                        <button
                            onClick={() => { setMode('SINGLE'); setResult2(null); }}
                            className={`px-3 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-sm font-bold uppercase tracking-wide rounded-md transition-all ${mode === 'SINGLE'
                                ? 'bg-indigo-600 text-white sm:bg-white sm:dark:bg-slate-600 sm:shadow sm:text-indigo-700 sm:dark:text-indigo-300'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                        >
                            {t('app.single', lang)}
                        </button>
                        <button
                            onClick={() => setMode('DUAL')}
                            className={`px-3 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-sm font-bold uppercase tracking-wide rounded-md transition-all ${mode === 'DUAL'
                                ? 'bg-indigo-600 text-white sm:bg-white sm:dark:bg-slate-600 sm:shadow sm:text-indigo-700 sm:dark:text-indigo-300'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                        >
                            {t('app.compare', lang)}
                        </button>
                    </div>

                    <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-slate-600"></div>

                    {/* Language & Theme (Desktop) */}
                    <div className="flex items-center space-x-1">
                        <button
                            onClick={toggleLanguage}
                            className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center space-x-1"
                            title="Switch Language"
                        >
                            <LanguageIcon className="w-5 h-5 sm:w-5 sm:h-5 " />
                            <span className="text-xs sm:text-sm font-bold">{lang.toUpperCase()}</span>
                        </button>

                        <button
                            onClick={toggleTheme}
                            className="hidden sm:flex text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                        >
                            {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
                        </button>
                    </div>

                    <div className="h-4 w-px bg-slate-200 dark:bg-slate-600"></div>

                    {/* Action Buttons */}
                    <div className="flex items-center">
                        <button onClick={handleExport} className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-2 sm:p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" title={t('app.export', lang)}>
                            <ArrowDownTrayIcon className="w-5 h-5" />
                        </button>
                        <button onClick={handleClear} className="text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-2 sm:p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" title={t('app.clear', lang)}>
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* 2. Workspace Layout (Responsive Column/Row) */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
                
                {/* Mobile Tab Switcher (Floating Bottom) */}
                <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-full shadow-2xl flex items-center p-1.5 z-50 transition-all duration-300">
                    {[
                        { id: 'INPUT', label: 'Data', icon: ArrowPathIcon },
                        { id: 'CHART', label: 'Plot', icon: ChartPieIcon },
                        { id: 'RESULTS', label: 'Analysis', icon: InformationCircleIcon }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveMobileView(tab.id as any)}
                            className={`flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                                activeMobileView === tab.id 
                                ? 'bg-indigo-600 text-white shadow-lg' 
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            <span className={activeMobileView === tab.id ? 'block' : 'hidden'}>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* LEFT COLUMN: Data Input */}
                <aside className={`${activeMobileView === 'INPUT' ? 'flex' : 'hidden'} lg:flex w-full lg:w-72 flex-none bg-slate-50 dark:bg-slate-900 lg:border-r border-slate-200 dark:border-white/10 flex flex-col z-20 transition-all duration-300`}>
                    <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 pb-24 lg:pb-4">
                        {/* Format Info Box */}
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-md border border-indigo-100 dark:border-indigo-800 flex gap-3">
                            <InformationCircleIcon className="w-6 h-6 text-indigo-500 dark:text-indigo-400 shrink-0 mt-0.5" />
                            <p className="text-[11px] sm:text-xs text-indigo-700 dark:text-indigo-300 leading-normal font-medium">
                                {t('input.formatInfo', lang)}
                            </p>
                        </div>

                        {/* Input Group 1 */}
                        <div className="flex flex-col h-[200px] sm:h-[45%] lg:min-h-[250px]">
                            <div className="flex justify-between items-center mb-2">
                                <label className={`text-xs sm:text-sm font-black uppercase tracking-wider ${mode === 'DUAL' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {mode === 'DUAL' ? t('input.groupA', lang) : t('input.failureData', lang)}
                                </label>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-black bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                                    N={parseInputData(text1).length}
                                </span>
                            </div>
                            <textarea
                                className="flex-1 w-full p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl resize-none font-mono text-base outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 dark:text-slate-200 transition-all leading-normal shadow-inner"
                                placeholder={t('input.placeholderSingle', lang)}
                                value={text1}
                                onChange={(e) => setText1(e.target.value)}
                            />
                        </div>

                        {/* Input Group 2 */}
                        {mode === 'DUAL' && (
                            <div className="flex flex-col h-[200px] sm:h-[45%] lg:min-h-[250px] animate-fadeIn">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs sm:text-sm font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                                        {t('input.groupB', lang)}
                                    </label>
                                    <span className="text-[10px] text-rose-400 dark:text-rose-300 font-black bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 rounded">
                                        N={parseInputData(text2).length}
                                    </span>
                                </div>
                                <textarea
                                    className="flex-1 w-full p-3 bg-white dark:bg-slate-950 border border-rose-100 dark:border-rose-900/40 rounded-xl resize-none font-mono text-base outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-400 dark:text-slate-200 transition-all leading-normal shadow-inner"
                                    placeholder={t('input.placeholderDual', lang)}
                                    value={text2}
                                    onChange={(e) => setText2(e.target.value)}
                                />
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-100 lg:bg-slate-50 dark:bg-slate-900 sticky bottom-0 z-30 pb-24 lg:pb-4">
                        <button
                            onClick={handleCalculate}
                            className="w-full bg-slate-800 dark:bg-indigo-600 hover:bg-slate-700 dark:hover:bg-indigo-500 text-white text-sm font-black py-4 rounded-xl shadow-xl dark:shadow-indigo-500/20 transition-all flex items-center justify-center space-x-2 active:scale-95"
                        >
                            <ArrowPathIcon className="w-5 h-5" />
                            <span>{t('input.calculate', lang)}</span>
                        </button>
                    </div>
                </aside>

                {/* CENTER COLUMN: Chart (Main Stage) */}
                <main className={`${activeMobileView === 'CHART' ? 'flex' : 'hidden'} lg:flex flex-1 min-w-0 bg-white dark:bg-slate-950 relative transition-all duration-300`}>
                    <div className="absolute inset-0 flex flex-col pt-4 lg:pt-0">
                        <WeibullChart
                            result1={result1}
                            result2={result2}
                            lang={lang}
                            theme={theme}
                            aiAnalysis={aiAnalysis}
                        />
                    </div>
                </main>

                {/* RIGHT COLUMN: Analysis & Theory Sidebar */}
                <aside className={`${activeMobileView === 'RESULTS' ? 'flex' : 'hidden'} lg:flex w-full lg:w-[450px] flex-none bg-white dark:bg-slate-900 lg:border-l border-slate-200 dark:border-white/10 flex flex-col z-20 shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.1)] transition-all duration-300`}>
                    <div className="flex-1 overflow-hidden relative pb-24 lg:pb-0">
                        <ResultsPanel
                            result1={result1}
                            result2={result2}
                            isDualMode={mode === 'DUAL'}
                            onTogglePoint={handleTogglePoint}
                            lang={lang}
                            theme={theme}
                            onAiAnalysisChange={setAiAnalysis}
                        />
                    </div>
                </aside>

            </div>
            
            {/* Footer (Desktop Only) */}
            <div className="hidden sm:block flex-none px-4 py-2 text-[10px] text-slate-400 dark:text-slate-500 text-right bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 uppercase tracking-widest font-black">
                Developed by Wesley Chang @ Mouldex, Jan-2026. All rights reserved.
            </div>
        </div>
    );
};

export default App;