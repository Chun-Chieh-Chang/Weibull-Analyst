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
            {/* 1. Header (Slim) */}
            <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 h-14 flex-none z-30 shadow-sm flex items-center justify-between px-4 transition-colors duration-200">
                <div className="flex items-center space-x-2">
                    <div className="bg-indigo-600 p-1.5 rounded-md shadow-sm">
                        <ChartPieIcon className="w-5 h-5 text-white" />
                    </div>
                    <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                        {t('app.title', lang)} <span className="text-indigo-600 dark:text-indigo-400">{t('app.titleSuffix', lang)}</span>
                    </h1>
                </div>

                <div className="flex items-center space-x-3">
                    {/* Controls Group */}
                    <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg border border-slate-200 dark:border-slate-600">
                        <button
                            onClick={() => { setMode('SINGLE'); setResult2(null); }}
                            className={`px-4 py-1.5 text-sm font-semibold uppercase tracking-wide rounded-md transition-all ${mode === 'SINGLE'
                                ? 'bg-white dark:bg-slate-600 shadow text-indigo-700 dark:text-indigo-300'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                        >
                            {t('app.single', lang)}
                        </button>
                        <button
                            onClick={() => setMode('DUAL')}
                            className={`px-4 py-1.5 text-sm font-semibold uppercase tracking-wide rounded-md transition-all ${mode === 'DUAL'
                                ? 'bg-white dark:bg-slate-600 shadow text-indigo-700 dark:text-indigo-300'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                        >
                            {t('app.compare', lang)}
                        </button>
                    </div>

                    <div className="h-4 w-px bg-slate-200 dark:bg-slate-600"></div>

                    {/* Language & Theme */}
                    <button
                        onClick={toggleLanguage}
                        className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center space-x-1.5"
                        title="Switch Language"
                    >
                        <LanguageIcon className="w-5 h-5" />
                        <span className="text-sm font-bold">{lang.toUpperCase()}</span>
                    </button>

                    <button
                        onClick={toggleTheme}
                        className="text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                    >
                        {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
                    </button>



                    <div className="h-4 w-px bg-slate-200 dark:bg-slate-600"></div>

                    {/* Actions */}
                    <button onClick={handleExport} className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" title={t('app.export', lang)}>
                        <ArrowDownTrayIcon className="w-5 h-5" />
                    </button>
                    <button onClick={handleClear} className="text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" title={t('app.clear', lang)}>
                        <TrashIcon className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* 2. Workspace Layout */}
            <div className="flex-1 flex overflow-hidden">

                {/* LEFT COLUMN: Data Input */}
                <aside className="w-64 flex-none bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-white/10 flex flex-col z-20 transition-colors duration-200">
                    <div className="flex-1 overflow-y-auto p-3 space-y-4">
                        {/* Format Info Box */}
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-md border border-indigo-100 dark:border-indigo-800 flex gap-3">
                            <InformationCircleIcon className="w-6 h-6 text-indigo-500 dark:text-indigo-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-indigo-700 dark:text-indigo-300 leading-normal">
                                {t('input.formatInfo', lang)}
                            </p>
                        </div>

                        {/* Input Group 1 */}
                        <div className="flex flex-col h-[45%] min-h-[150px]">
                            <div className="flex justify-between items-center mb-2">
                                <label className={`text-base font-bold uppercase tracking-wider ${mode === 'DUAL' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {mode === 'DUAL' ? t('input.groupA', lang) : t('input.failureData', lang)}
                                </label>
                                <span className="text-sm text-slate-400 dark:text-slate-500 font-mono bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                                    n={parseInputData(text1).length}
                                </span>
                            </div>
                            <textarea
                                className="flex-1 w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-md resize-none font-mono text-base outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 dark:text-slate-200 transition-all leading-normal"
                                placeholder={t('input.placeholderSingle', lang)}
                                value={text1}
                                onChange={(e) => setText1(e.target.value)}
                            />
                        </div>

                        {/* Input Group 2 */}
                        {mode === 'DUAL' && (
                            <div className="flex flex-col h-[45%] min-h-[150px] animate-fadeIn">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-base font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                                        {t('input.groupB', lang)}
                                    </label>
                                    <span className="text-sm text-red-400 dark:text-red-300 font-mono bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">
                                        n={parseInputData(text2).length}
                                    </span>
                                </div>
                                <textarea
                                    className="flex-1 w-full p-3 bg-red-50/20 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-md resize-none font-mono text-base outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-400 dark:text-slate-200 transition-all leading-normal"
                                    placeholder={t('input.placeholderDual', lang)}
                                    value={text2}
                                    onChange={(e) => setText2(e.target.value)}
                                />
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-900/50">
                        <button
                            onClick={handleCalculate}
                            className="w-full bg-slate-800 dark:bg-indigo-600 hover:bg-slate-700 dark:hover:bg-indigo-500 text-white text-base font-bold py-3 rounded-lg shadow-lg dark:shadow-indigo-500/20 transition-all flex items-center justify-center space-x-2 active:scale-95"
                        >
                            <ArrowPathIcon className="w-5 h-5" />
                            <span>{t('input.calculate', lang)}</span>
                        </button>
                    </div>
                </aside>

                {/* CENTER COLUMN: Chart (Main Stage) */}
                <main className="flex-1 min-w-0 bg-white dark:bg-slate-900/50 relative transition-colors duration-200">
                    <WeibullChart
                        result1={result1}
                        result2={result2}
                        lang={lang}
                        theme={theme}
                    />
                </main>

                {/* RIGHT COLUMN: Analysis & Theory Sidebar */}
                <aside className="w-[400px] flex-none bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-white/10 flex flex-col z-20 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] transition-colors duration-200">
                    <ResultsPanel
                        result1={result1}
                        result2={result2}
                        isDualMode={mode === 'DUAL'}
                        onTogglePoint={handleTogglePoint}
                        lang={lang}
                        theme={theme}
                    />
                </aside>

            </div>
            {/* Footer */}
            <div className="flex-none px-4 py-2 text-[10px] text-slate-400 dark:text-slate-500 text-right bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 uppercase tracking-widest font-bold">
                Developed by Wesley Chang @ Mouldex, Jan-2026. All rights reserved.
            </div>
        </div>
    );
};

export default App;