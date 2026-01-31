import React, { useState, useEffect } from 'react';
import { WeibullResult, Language, Theme, AIProvider } from '../types';
import { analyzeWithAI } from '../services/aiService';
import TheoreticalGuide from './TheoreticalGuide';
import { t } from '../utils/locales';
import {
    SparklesIcon,
    BeakerIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon,
    TableCellsIcon,
    ChartBarIcon,
    BookOpenIcon,
    KeyIcon,
    XMarkIcon,
    ChevronDownIcon
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';

interface ResultsPanelProps {
    result1: WeibullResult | null;
    result2: WeibullResult | null;
    isDualMode: boolean;
    label1?: string;
    label2?: string;
    onTogglePoint?: (groupIndex: 1 | 2, pointId: number, currentStatus: 'F' | 'S') => void;
    lang: Language;
    theme: Theme;
}

const MetricCard = ({
    label,
    value,
    subtext,
    colorClass,
    warning = false,
    tooltip
}: {
    label: string,
    value: string,
    subtext?: string,
    colorClass: string,
    warning?: boolean,
    tooltip?: string
}) => (
    <div className={`relative group p-4 rounded-xl border flex flex-col transition-all duration-200 ${warning
        ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-900/20'
        : 'border-slate-200 dark:border-white/5 bg-white dark:bg-slate-800/50 hover:border-indigo-200 dark:hover:border-indigo-500/30 hover:shadow-lg dark:hover:shadow-indigo-500/10'}`}>
        <div className="flex justify-between items-start">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                {label}
                {warning && <ExclamationTriangleIcon className="w-3.5 h-3.5 text-amber-500" />}
            </span>
            {tooltip && (
                <div className="relative ml-1">
                    <InformationCircleIcon className="w-4 h-4 text-slate-400 dark:text-slate-500 hover:text-slate-500 dark:hover:text-slate-400 cursor-help" />
                    <div className="absolute bottom-full right-0 mb-2 w-48 bg-slate-800 text-white text-xs p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 hidden group-hover:block">
                        {tooltip}
                        <div className="absolute top-full right-1 transform -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                    </div>
                </div>
            )}
        </div>
        <div className={`text-2xl font-black tracking-tight text-slate-900 dark:text-white ${colorClass}`}>{value}</div>
        {subtext && <div className={`text-sm mt-1 font-medium ${warning ? 'text-amber-600 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}`}>{subtext}</div>}
    </div>
);

type TabType = 'INSIGHTS' | 'DATA' | 'THEORY';

const ResultsPanel: React.FC<ResultsPanelProps> = ({
    result1,
    result2,
    isDualMode,
    label1 = "Group A",
    label2 = "Group B",
    onTogglePoint,
    lang,
    theme
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('INSIGHTS');
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // AI Provider & API KEY Logic
    const [showKeyModal, setShowKeyModal] = useState(false);
    const [activeProvider, setActiveProvider] = useState<AIProvider>((localStorage.getItem('ai_provider') as AIProvider) || 'GEMINI');
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [geminiKey, setGeminiKey] = useState<string | null>(localStorage.getItem('gemini_api_key'));
    const [openaiKey, setOpenaiKey] = useState<string | null>(localStorage.getItem('openai_api_key'));

    useEffect(() => {
        if (activeProvider === 'GEMINI') setApiKeyInput(geminiKey || '');
        else setApiKeyInput(openaiKey || '');
    }, [activeProvider, geminiKey, openaiKey]);

    if (lang === 'zh') {
        label1 = "A 組";
        label2 = "B 組";
    }

    const handleAIAnalyze = async (keyToUse?: string, providerToUse?: AIProvider) => {
        const prov = providerToUse || activeProvider;
        const key = keyToUse || (prov === 'GEMINI' ? geminiKey : openaiKey);

        if (!key) {
            setShowKeyModal(true);
            return;
        }

        if (!result1) return;
        setLoading(true);
        setError(null);
        try {
            const text = await analyzeWithAI(result1, result2, isDualMode, lang, key, prov);
            setAiAnalysis(text || "No analysis returned.");
        } catch (e: any) {
            setError(e.message || "An error occurred.");
            if (e.message?.includes("API Key") || e.message?.includes("401")) {
                setShowKeyModal(true);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSaveKey = () => {
        if (apiKeyInput.trim()) {
            const key = apiKeyInput.trim();
            if (activeProvider === 'GEMINI') {
                localStorage.setItem('gemini_api_key', key);
                setGeminiKey(key);
            } else {
                localStorage.setItem('openai_api_key', key);
                setOpenaiKey(key);
            }
            localStorage.setItem('ai_provider', activeProvider);
            setShowKeyModal(false);
            handleAIAnalyze(key, activeProvider);
        }
    };

    const formatAIResponse = (text: string) => {
        if (!text) return '';
        let clean = text;
        clean = clean.replace(/\\\[(.*?)\\\]/g, '$1');
        clean = clean.replace(/\$\$(.*?)\$\$/g, '$1');
        clean = clean.replace(/\\\((.*?)\\\)/g, '$1');
        clean = clean.replace(/\$(.*?)\$/g, '$1');
        clean = clean.replace(/\\beta/gi, 'Beta');
        clean = clean.replace(/\\eta/gi, 'Eta');
        clean = clean.replace(/\\alpha/gi, 'Alpha');
        clean = clean.replace(/\\times/gi, '×');
        clean = clean.replace(/\\approx/gi, '≈');
        clean = clean.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        clean = clean.replace(/\n/g, '<br/>');
        return clean;
    };

    if (!result1) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-8 bg-slate-50 dark:bg-slate-900/50">
                <BeakerIcon className="w-16 h-16 mb-4 text-slate-300 dark:text-slate-600 stroke-1" />
                <p className="text-sm font-medium">{t('results.ai.awaiting', lang)}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 text-center max-w-[200px]">{t('results.ai.awaitingSub', lang)}</p>
            </div>
        );
    }

    const isLowR2 = result1.rSquared < 0.9;
    const getFailureModeLabel = (beta: number) => {
        if (beta < 0.9) return t('results.metrics.infant', lang);
        if (beta <= 1.1) return t('results.metrics.random', lang);
        return t('results.metrics.wearout', lang);
    };

    const maxRows = Math.max(result1.dataPoints.length, result2?.dataPoints.length || 0);
    const dataRows = Array.from({ length: maxRows }, (_, i) => ({
        id: i + 1,
        p1: result1.dataPoints[i] || null,
        p2: result2?.dataPoints[i] || null,
    }));

    return (
        <div className="flex flex-col h-full w-full bg-slate-50 dark:bg-slate-900 transition-colors relative">
            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition-colors">
                {[
                    { id: 'INSIGHTS', label: t('results.tabs.insights', lang), icon: ChartBarIcon },
                    { id: 'DATA', label: t('results.tabs.data', lang), icon: TableCellsIcon },
                    { id: 'THEORY', label: t('results.tabs.guide', lang), icon: BookOpenIcon }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 border-b-2 transition-all
                        ${activeTab === tab.id
                                ? 'border-indigo-600 dark:border-indigo-500 text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-900/20'
                                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                    >
                        <tab.icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'THEORY' && <TheoreticalGuide lang={lang} />}

                {activeTab === 'DATA' && (
                    <div className="flex flex-col h-full bg-white dark:bg-slate-900 transition-colors">
                        <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-3 border-b border-slate-200 dark:border-white/5 flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-slate-800 dark:text-white text-sm flex items-center">
                                <TableCellsIcon className="w-4 h-4 mr-2 text-indigo-500" />
                                {t('results.table.dataPoints', lang)}
                            </h3>
                            <span className="text-[10px] uppercase font-black tracking-widest text-slate-500 dark:text-slate-400 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 px-3 py-1 rounded-full shadow-sm">
                                {isDualMode ? t('results.table.comparative', lang) : t('results.table.single', lang)}
                            </span>
                        </div>
                        <div className="overflow-auto flex-1">
                            <table className="w-full text-base text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-white/10 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-3 py-2 w-10 bg-slate-100 dark:bg-slate-800/80 font-mono">#</th>
                                        <th className="px-3 py-2 text-indigo-700 dark:text-sky-400 bg-indigo-50/30 dark:bg-sky-900/10 border-l border-slate-100 dark:border-white/5">
                                            {label1} <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">({t('results.table.time', lang)})</span>
                                        </th>
                                        <th className="px-2 py-2 text-indigo-700 dark:text-sky-400 bg-indigo-50/30 dark:bg-sky-900/10 text-center w-16">
                                            {t('results.table.status', lang)}
                                        </th>
                                        {isDualMode && (
                                            <>
                                                <th className="px-3 py-2 text-rose-700 dark:text-yellow-400 bg-rose-50/30 dark:bg-yellow-900/10 border-l border-slate-100 dark:border-white/5">
                                                    {label2} <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">({t('results.table.time', lang)})</span>
                                                </th>
                                                <th className="px-2 py-2 text-rose-700 dark:text-yellow-400 bg-rose-50/30 dark:bg-yellow-900/10 text-center w-16">
                                                    {t('results.table.status', lang)}
                                                </th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                                    {dataRows.map((row) => (
                                        <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                            <td className="px-3 py-1.5 text-slate-400 dark:text-slate-500">{row.id}</td>
                                            <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 border-l border-slate-50 dark:border-white/5">
                                                {row.p1 ? row.p1.time.toFixed(2) : '-'}
                                            </td>
                                            <td className="px-3 py-2 text-center text-base">
                                                {row.p1 ? (
                                                    <button
                                                        onClick={() => onTogglePoint && onTogglePoint(1, row.p1!.id, row.p1!.status)}
                                                        className={`px-2 py-1 w-full inline-flex items-center justify-center rounded text-[10px] font-black uppercase tracking-tighter cursor-pointer transition-all
                                                       ${row.p1.status === 'F'
                                                                ? 'bg-indigo-50 dark:bg-sky-900/40 text-indigo-600 dark:text-sky-400 border border-indigo-100 dark:border-sky-500/30'
                                                                : 'bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-500/30'}`}
                                                    >
                                                        {row.p1.status === 'F' ? t('results.table.fail', lang) : t('results.table.susp', lang)}
                                                    </button>
                                                ) : '-'}
                                            </td>
                                            {isDualMode && (
                                                <>
                                                    <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 border-l border-slate-50 dark:border-white/5">
                                                        {row.p2 ? row.p2.time.toFixed(2) : '-'}
                                                    </td>
                                                    <td className="px-3 py-2 text-center text-base">
                                                        {row.p2 ? (
                                                            <button
                                                                onClick={() => onTogglePoint && onTogglePoint(2, row.p2!.id, row.p2!.status)}
                                                                className={`px-2 py-1 w-full inline-flex items-center justify-center rounded text-[10px] font-black uppercase tracking-tighter cursor-pointer transition-all
                                                               ${row.p2.status === 'F'
                                                                        ? 'bg-rose-50 dark:bg-yellow-900/40 text-rose-600 dark:text-yellow-400 border border-rose-100 dark:border-yellow-500/30'
                                                                        : 'bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-500/30'}`}
                                                            >
                                                                {row.p2.status === 'F' ? t('results.table.fail', lang) : t('results.table.susp', lang)}
                                                            </button>
                                                        ) : '-'}
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'INSIGHTS' && (
                    <div className="h-full overflow-y-auto p-4 space-y-6">
                        {!isDualMode ? (
                            <div className="space-y-3">
                                <MetricCard label={t('results.metrics.shape', lang)} value={result1.beta.toFixed(3)} subtext={getFailureModeLabel(result1.beta)} colorClass="text-indigo-600 dark:text-sky-400" />
                                <MetricCard label={t('results.metrics.scale', lang)} value={result1.eta.toFixed(2)} subtext={t('results.metrics.charLife', lang)} colorClass="text-emerald-600 dark:text-emerald-400" />
                                <MetricCard label={t('results.metrics.mttf', lang)} value={result1.mttf.toFixed(2)} subtext={t('results.metrics.mttfSub', lang)} colorClass="text-blue-600 dark:text-blue-400" />
                                <MetricCard label={t('results.metrics.r2', lang)} value={result1.rSquared.toFixed(4)} subtext={isLowR2 ? t('results.metrics.poorFit', lang) : t('results.metrics.excellentFit', lang)} colorClass={isLowR2 ? "text-amber-600 dark:text-amber-400" : "text-purple-600 dark:text-purple-400"} warning={isLowR2} tooltip={t('results.metrics.r2Tooltip', lang)} />
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-lg">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-white/5">
                                        <tr>
                                            <th className="px-4 py-3">Metric</th>
                                            <th className="px-4 py-3 text-indigo-600 dark:text-sky-400 bg-indigo-50/10 dark:bg-transparent">{label1}</th>
                                            <th className="px-4 py-3 text-rose-600 dark:text-yellow-400 bg-rose-50/10 dark:bg-transparent">{label2}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                        {[
                                            { l: 'Beta (β)', v1: result1.beta.toFixed(3), v2: result2?.beta.toFixed(3) },
                                            { l: 'Eta (η)', v1: result1.eta.toFixed(1), v2: result2?.eta.toFixed(1) },
                                            { l: 'MTTF', v1: result1.mttf.toFixed(1), v2: result2?.mttf.toFixed(1) },
                                            { l: 'R²', v1: result1.rSquared.toFixed(4), v2: result2?.rSquared.toFixed(4) }
                                        ].map((row, idx) => (
                                            <tr key={idx} className="transition-colors hover:bg-slate-50/50 dark:hover:bg-white/5">
                                                <td className="px-4 py-4 font-semibold text-slate-600 dark:text-slate-300">{row.l}</td>
                                                <td className="px-4 py-4 font-mono font-bold text-lg text-slate-800 dark:text-slate-200">{row.v1}</td>
                                                <td className="px-4 py-4 font-mono font-bold text-lg text-slate-800 dark:text-slate-200">{row.v2 || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="bg-indigo-50/50 dark:bg-slate-800/40 border border-indigo-100 dark:border-indigo-500/20 rounded-xl p-5 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-200 flex items-center tracking-tight uppercase">
                                    <SparklesIcon className="w-4 h-4 mr-2 text-indigo-500 dark:text-indigo-400" />
                                    {t('results.ai.title', lang)}
                                </h3>
                                {(geminiKey || openaiKey) && (
                                    <button
                                        onClick={() => setShowKeyModal(true)}
                                        className="text-[10px] text-indigo-500 hover:text-indigo-600 flex items-center gap-1 font-bold uppercase tracking-tighter"
                                        title="Change API Key"
                                    >
                                        <KeyIcon className="w-3 h-3" />
                                        Settings
                                    </button>
                                )}
                            </div>
                            {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs rounded border border-red-100 dark:border-red-900/30 mb-2">{error}</div>}
                            {!aiAnalysis ? (
                                <div className="text-center py-4">
                                    <p className="text-xs text-indigo-400/60 dark:text-indigo-300/60 mb-4 font-medium italic">{t('results.ai.prompt', lang)}</p>
                                    <button
                                        onClick={() => handleAIAnalyze()}
                                        disabled={loading || (isDualMode && !result2)}
                                        className={`w-full py-3 rounded-xl text-sm font-black uppercase tracking-widest text-white shadow-lg transition-all flex items-center justify-center space-x-2
                                 ${loading ? 'bg-indigo-300 dark:bg-indigo-900/50 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 dark:hover:bg-indigo-500 hover:shadow-indigo-500/20 active:scale-95'}`}
                                    >
                                        {loading ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>{t('results.ai.analyzing', lang)}</> : <><StarIcon className="w-4 h-4 mr-1" /><span>{t('results.ai.generate', lang)}</span></>}
                                    </button>
                                </div>
                            ) : (
                                <div className="animate-fadeIn">
                                    <div className="prose prose-xs dark:prose-invert max-w-none bg-white dark:bg-black/20 p-4 rounded-lg border border-indigo-50 dark:border-white/5 text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                                        <div dangerouslySetInnerHTML={{ __html: formatAIResponse(aiAnalysis) }} />
                                    </div>
                                    <button onClick={() => setAiAnalysis(null)} className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400 block w-full text-center transition-colors">
                                        {t('results.ai.reset', lang)}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* API KEY MODAL */}
            {showKeyModal && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                                    <KeyIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight uppercase">AI Settings</h3>
                            </div>
                            <button onClick={() => setShowKeyModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Provider Selector */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Select AI Provider</label>
                                <div className="relative group">
                                    <select
                                        value={activeProvider}
                                        onChange={(e) => setActiveProvider(e.target.value as AIProvider)}
                                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white appearance-none focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer font-bold"
                                    >
                                        <option value="GEMINI">Google Gemini (Default)</option>
                                        <option value="OPENAI">OpenAI (ChatGPT)</option>
                                    </select>
                                    <ChevronDownIcon className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-indigo-500 transition-colors" />
                                </div>
                            </div>

                            {/* API Key Input */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
                                    {activeProvider} API Key
                                </label>
                                <input
                                    type="password"
                                    value={apiKeyInput}
                                    onChange={(e) => setApiKeyInput(e.target.value)}
                                    placeholder={`Enter your ${activeProvider} API Key...`}
                                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 font-mono text-sm"
                                />
                            </div>

                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-900/30 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50 italic">
                                {lang === 'zh'
                                    ? "您的 Key 將加密儲存於當前瀏覽器中，不會傳送至我們的伺服器。"
                                    : "Your key is stored locally in your browser and is never sent to our servers."}
                            </p>

                            <div className="flex flex-col gap-3 pt-2">
                                <button
                                    onClick={handleSaveKey}
                                    disabled={!apiKeyInput.trim()}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest py-3 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {lang === 'zh' ? "储存配置並分析" : "Save & Analyze"}
                                </button>
                                <a
                                    href={activeProvider === 'GEMINI' ? "https://aistudio.google.com/app/apikey" : "https://platform.openai.com/api-keys"}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[10px] text-center text-indigo-500 hover:underline font-bold"
                                >
                                    {lang === 'zh' ? `獲取 ${activeProvider} Key ？` : `Get ${activeProvider} Key ?`}
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResultsPanel;