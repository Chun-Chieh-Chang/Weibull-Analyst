import React, { useState, useEffect, useMemo } from 'react';
import { WeibullResult, Language, AIProvider, GeminiModel, OpenAIModel, ClaudeModel } from '../types';
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
    groups?: GroupDataset[];
    result1?: WeibullResult | null;
    result2?: WeibullResult | null;
    isDualMode?: boolean;
    isMultiMode?: boolean;
    label1?: string;
    label2?: string;
    onTogglePoint?: (groupIndex: number, pointId: number, currentStatus: 'F' | 'S') => void;
    lang: Language;
    onAiAnalysisChange?: (text: string | null) => void;
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
        ? 'border-amber-200'
        : 'hover:shadow-lg'}`}
        style={warning
            ? { backgroundColor: 'color-mix(in srgb, #F59E0B 8%, transparent)', borderColor: 'color-mix(in srgb, #F59E0B 30%, transparent)' }
            : { backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
    >
        <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                {label}
                {warning && <ExclamationTriangleIcon className="w-3.5 h-3.5 text-amber-500" />}
            </span>
            {tooltip && (
                <div className="relative ml-1">
                    <InformationCircleIcon className="w-4 h-4 cursor-help" style={{ color: 'var(--text-secondary)' }} />
                    <div className="absolute bottom-full right-0 mb-2 w-48 text-white text-xs p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 hidden group-hover:block" style={{ backgroundColor: 'var(--text-primary)' }}>
                        {tooltip}
                        <div className="absolute top-full right-1 -translate-x-1/2 border-4 border-transparent" style={{ borderTopColor: 'var(--text-primary)' }}></div>
                    </div>
                </div>
            )}
        </div>
        <div className={`text-2xl font-black tracking-tight ${colorClass}`} style={{ color: warning ? undefined : 'var(--text-primary)' }}>{value}</div>
        {subtext && <div className={`text-sm mt-1 font-medium ${warning ? 'text-amber-600' : ''}`} style={{ color: warning ? undefined : 'var(--text-secondary)' }}>{subtext}</div>}
    </div>
);

type TabType = 'INSIGHTS' | 'DATA' | 'THEORY';

const ResultsPanel: React.FC<ResultsPanelProps> = ({
    groups,
    result1,
    result2,
    isDualMode = false,
    isMultiMode = false,
    label1 = "Group A",
    label2 = "Group B",
    onTogglePoint,
    lang,
    onAiAnalysisChange
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('INSIGHTS');
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const handleSetAiAnalysis = (text: string | null) => {
        setAiAnalysis(text);
        onAiAnalysisChange?.(text);
    };
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // AI Provider & API KEY Logic
    const [showKeyModal, setShowKeyModal] = useState(false);
    const [activeProvider, setActiveProvider] = useState<AIProvider>((localStorage.getItem('ai_provider') as AIProvider) || 'GEMINI');
    const [geminiModel, setGeminiModel] = useState<GeminiModel>((localStorage.getItem('gemini_model') as GeminiModel) || 'gemini-3.6-flash');
    const [openaiModel, setOpenaiModel] = useState<OpenAIModel>((localStorage.getItem('openai_model') as OpenAIModel) || 'gpt-4o-mini');
    const [claudeModel, setClaudeModel] = useState<ClaudeModel>((localStorage.getItem('claude_model') as ClaudeModel) || 'claude-sonnet-4-6');
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [geminiKey, setGeminiKey] = useState<string | null>(localStorage.getItem('gemini_api_key'));
    const [openaiKey, setOpenaiKey] = useState<string | null>(localStorage.getItem('openai_api_key'));
    const [agnesKey, setAgnesKey] = useState<string | null>(localStorage.getItem('agnes_api_key'));
    const [claudeKey, setClaudeKey] = useState<string | null>(localStorage.getItem('claude_api_key'));

    useEffect(() => {
        if (activeProvider === 'GEMINI') setApiKeyInput(geminiKey || '');
        else if (activeProvider === 'OPENAI') setApiKeyInput(openaiKey || '');
        else if (activeProvider === 'AGNES') setApiKeyInput(agnesKey || '');
        else setApiKeyInput(claudeKey || '');
    }, [activeProvider, geminiKey, openaiKey, agnesKey, claudeKey]);

    const effectiveGroups = useMemo(() => {
        if (groups && groups.length > 0) return groups;
        const res: GroupDataset[] = [];
        if (result1) res.push({ id: 'g1', label: label1 || (lang === 'zh' ? 'A 組' : 'Group A'), text: '', color: '#4f46e5', result: result1, visible: true });
        if (result2) res.push({ id: 'g2', label: label2 || (lang === 'zh' ? 'B 組' : 'Group B'), text: '', color: '#e11d48', result: result2, visible: true });
        return res;
    }, [groups, result1, result2, label1, label2, lang]);

    const validGroups = useMemo(() => effectiveGroups.filter(g => g.result !== null), [effectiveGroups]);
    const isMultiple = validGroups.length > 1;

    const handleAIAnalyze = async (keyToUse?: string, providerToUse?: AIProvider) => {
        const prov = providerToUse || activeProvider;
        const key = keyToUse || (prov === 'GEMINI' ? geminiKey : prov === 'AGNES' ? agnesKey : prov === 'CLAUDE' ? claudeKey : openaiKey);

        if (!key) {
            setShowKeyModal(true);
            return;
        }

        if (validGroups.length === 0) return;
        setLoading(true);
        setError(null);
        try {
            const text = await analyzeWithAI(effectiveGroups, null, isMultiple, lang, key, prov, geminiModel, openaiModel, claudeModel);
            handleSetAiAnalysis(text || "No analysis returned.");
            handleSetAiAnalysis(text || "No analysis returned.");
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
            } else if (activeProvider === 'AGNES') {
                localStorage.setItem('agnes_api_key', key);
                setAgnesKey(key);
            } else if (activeProvider === 'CLAUDE') {
                localStorage.setItem('claude_api_key', key);
                setClaudeKey(key);
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
        clean = clean.replace(/([\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]+)/g, '<span style="color:#1D4ED8;font-weight:500">$1</span>');
        return clean;
    };

    if (validGroups.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8" style={{ color: 'var(--text-secondary)', backgroundColor: 'color-mix(in srgb, var(--bg-app) 50%, var(--bg-surface))' }}>
                <BeakerIcon className="w-16 h-16 mb-4 opacity-30" style={{ color: 'var(--text-secondary)' }} />
                <p className="text-sm font-medium">{t('results.ai.awaiting', lang)}</p>
                <p className="text-xs mt-2 text-center max-w-[200px]" style={{ color: 'var(--text-secondary)' }}>{t('results.ai.awaitingSub', lang)}</p>
            </div>
        );
    }

    const isLowR2 = validGroups.some(g => g.result && g.result.rSquared < 0.9);
    const getFailureModeLabel = (beta: number) => {
        if (beta < 0.9) return t('results.metrics.infant', lang);
        if (beta <= 1.1) return t('results.metrics.random', lang);
        return t('results.metrics.wearout', lang);
    };

    const maxRows = Math.max(...validGroups.map(g => g.result?.dataPoints.length || 0), 0);
    const dataRows = Array.from({ length: maxRows }, (_, i) => i);

    return (
        <div className="flex flex-col h-full w-full transition-colors relative" style={{ backgroundColor: 'var(--bg-app)' }}>
            {/* Tabs */}
            <div className="flex border-b transition-colors" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                {[
                    { id: 'INSIGHTS', label: t('results.tabs.insights', lang), icon: ChartBarIcon },
                    { id: 'DATA', label: t('results.tabs.data', lang), icon: TableCellsIcon },
                    { id: 'THEORY', label: t('results.tabs.guide', lang), icon: BookOpenIcon }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider flex items-center justify-center space-x-2 border-b-2 transition-all`}
                        style={{
                            borderColor: activeTab === tab.id ? 'var(--accent)' : 'transparent',
                            color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                            backgroundColor: activeTab === tab.id ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent'
                        }}
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
                    <div className="flex flex-col h-full transition-colors" style={{ backgroundColor: 'var(--bg-surface)' }}>
                        <div className="px-4 py-3 flex justify-between items-center shrink-0" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'color-mix(in srgb, var(--bg-app) 50%, var(--bg-surface))' }}>
                            <h3 className="font-bold text-sm flex items-center">
                                <TableCellsIcon className="w-4 h-4 mr-2" style={{ color: 'var(--accent)' }} />
                                <span style={{ color: 'var(--text-primary)' }}>{t('results.table.dataPoints', lang)}</span>
                            </h3>
                            <span className="text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                                {isDualMode ? t('results.table.comparative', lang) : t('results.table.single', lang)}
                            </span>
                        </div>
                        <div className="overflow-auto flex-1 pb-28 lg:pb-6">
                            <table className="w-full text-sm text-left">
                                <thead className="font-bold sticky top-0 z-10" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                                    <tr>
                                        <th className="px-3 py-2 w-10 font-mono" style={{ backgroundColor: 'var(--bg-app)' }}>#</th>
                                        {validGroups.map((g) => (
                                            <React.Fragment key={g.id}>
                                                <th className="px-3 py-2 border-l" style={{ backgroundColor: `color-mix(in srgb, ${g.color} 8%, transparent)`, borderColor: 'var(--border)', color: g.color }}>
                                                    {g.label} <span className="font-normal ml-1" style={{ color: 'var(--text-secondary)' }}>({t('results.table.time', lang)})</span>
                                                </th>
                                                <th className="px-2 py-2 text-center w-16" style={{ backgroundColor: `color-mix(in srgb, ${g.color} 8%, transparent)`, color: g.color }}>
                                                    {t('results.table.status', lang)}
                                                </th>
                                            </React.Fragment>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="font-mono" style={{ color: 'var(--text-primary)' }}>
                                    {dataRows.map((rowIndex) => (
                                        <tr key={rowIndex + 1} className="transition-colors" style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td className="px-3 py-1.5" style={{ color: 'var(--text-secondary)' }}>{rowIndex + 1}</td>
                                            {validGroups.map((g) => {
                                                const pt = g.result?.dataPoints[rowIndex];
                                                const groupIndexInAll = effectiveGroups.findIndex(eg => eg.id === g.id) + 1;
                                                return (
                                                    <React.Fragment key={g.id}>
                                                        <td className="px-3 py-1.5 border-l" style={{ borderColor: 'var(--border)' }}>
                                                            {pt ? pt.time.toFixed(2) : '-'}
                                                        </td>
                                                        <td className="px-3 py-2 text-center">
                                                            {pt ? (
                                                                <button
                                                                    onClick={() => onTogglePoint && onTogglePoint(groupIndexInAll, pt.id, pt.status)}
                                                                    className={`px-2 py-1 w-full inline-flex items-center justify-center rounded text-[10px] font-bold uppercase tracking-tighter cursor-pointer transition-all`}
                                                                    style={{
                                                                        backgroundColor: pt.status === 'F' ? `color-mix(in srgb, ${g.color} 12%, transparent)` : 'color-mix(in srgb, #F59E0B 12%, transparent)',
                                                                        color: pt.status === 'F' ? g.color : '#D97706',
                                                                        border: pt.status === 'F' ? `1px solid color-mix(in srgb, ${g.color} 25%, transparent)` : '1px solid color-mix(in srgb, #F59E0B 25%, transparent)'
                                                                    }}
                                                                >
                                                                    {pt.status === 'F' ? t('results.table.fail', lang) : t('results.table.susp', lang)}
                                                                </button>
                                                            ) : '-'}
                                                        </td>
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'INSIGHTS' && (
                    <div className="h-full overflow-y-auto p-4 space-y-6 pb-28 lg:pb-6">
                        {!isMultiple && validGroups[0]?.result ? (
                            <div className="space-y-3">
                                <MetricCard label={t('results.metrics.shape', lang)} value={validGroups[0].result.beta.toFixed(3)} subtext={getFailureModeLabel(validGroups[0].result.beta)} colorClass="text-indigo-600" />
                                <MetricCard label={t('results.metrics.scale', lang)} value={validGroups[0].result.eta.toFixed(2)} subtext={t('results.metrics.charLife', lang)} colorClass="text-emerald-600" />
                                <MetricCard label={t('results.metrics.mttf', lang)} value={validGroups[0].result.mttf.toFixed(2)} subtext={t('results.metrics.mttfSub', lang)} colorClass="text-blue-600" />
                                <MetricCard label={t('results.metrics.r2', lang)} value={validGroups[0].result.rSquared.toFixed(4)} subtext={validGroups[0].result.rSquared < 0.9 ? t('results.metrics.poorFit', lang) : t('results.metrics.excellentFit', lang)} colorClass={validGroups[0].result.rSquared < 0.9 ? "text-amber-600" : "text-purple-600"} warning={validGroups[0].result.rSquared < 0.9} tooltip={t('results.metrics.r2Tooltip', lang)} />
                            </div>
                        ) : (
                            <div className="rounded-xl border overflow-x-auto" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                                <table className="w-full text-sm text-left">
                                    <thead className="font-bold" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-app)' }}>
                                        <tr>
                                            <th className="px-4 py-3">Metric</th>
                                            {validGroups.map(g => (
                                                <th key={g.id} className="px-4 py-3" style={{ color: g.color }}>{g.label}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            { l: 'Beta (β)', getV: (r: WeibullResult) => r.beta.toFixed(3) },
                                            { l: 'Eta (η)', getV: (r: WeibullResult) => r.eta.toFixed(1) },
                                            { l: 'MTTF', getV: (r: WeibullResult) => r.mttf.toFixed(1) },
                                            { l: 'R²', getV: (r: WeibullResult) => r.rSquared.toFixed(4) }
                                        ].map((row, idx) => (
                                            <tr key={idx} className="transition-colors" style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td className="px-4 py-4 font-semibold" style={{ color: 'var(--text-secondary)' }}>{row.l}</td>
                                                {validGroups.map(g => (
                                                    <td key={g.id} className="px-4 py-4 font-mono font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                                                        {g.result ? row.getV(g.result) : '-'}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="rounded-xl p-5" style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 15%, transparent)' }}>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-sm font-bold flex items-center tracking-tight uppercase" style={{ color: 'color-mix(in srgb, var(--accent) 70%, var(--text-primary))' }}>
                                    <SparklesIcon className="w-4 h-4 mr-2" style={{ color: 'var(--accent)' }} />
                                    {t('results.ai.title', lang)}
                                </h3>
                                {(geminiKey || openaiKey || agnesKey || claudeKey) && (
                                    <button
                                        onClick={() => setShowKeyModal(true)}
                                        className="text-[10px] flex items-center gap-1 font-bold uppercase tracking-tighter transition-colors"
                                        style={{ color: 'var(--accent)' }}
                                        title="Change API Key"
                                    >
                                        <KeyIcon className="w-3 h-3" />
                                        Settings
                                    </button>
                                )}
                            </div>
                            {error && <div className="p-3 text-xs rounded mb-2" style={{ backgroundColor: 'color-mix(in srgb, var(--error) 12%, transparent)', color: 'var(--error)', border: '1px solid color-mix(in srgb, var(--error) 20%, transparent)' }}>{error}</div>}
                            {!aiAnalysis ? (
                                <div className="text-center py-4">
                                    <p className="text-xs mb-4 font-medium italic" style={{ color: 'color-mix(in srgb, var(--accent) 40%, var(--text-secondary))' }}>{t('results.ai.prompt', lang)}</p>
                                    <button
                                        onClick={() => handleAIAnalyze()}
                                        disabled={loading || validGroups.length === 0}
                                        className={`w-full py-3 rounded-xl text-sm font-bold uppercase tracking-widest text-white shadow-lg transition-all flex items-center justify-center space-x-2 ${loading ? 'cursor-wait' : 'active:scale-[0.97]'}`}
                                        style={{ backgroundColor: loading ? 'color-mix(in srgb, var(--accent) 50%, transparent)' : 'var(--accent)' }}
                                    >
                                        {loading ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>{t('results.ai.analyzing', lang)}</> : <><StarIcon className="w-4 h-4 mr-1" /><span>{t('results.ai.generate', lang)}</span></>}
                                    </button>
                                </div>
                            ) : (
                                <div className="animate-scaleIn">
                                    <div className="p-4 rounded-lg border text-sm leading-relaxed" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--text-primary)' }}>
                                        <div dangerouslySetInnerHTML={{ __html: formatAIResponse(aiAnalysis) }} />
                                    </div>
                                    <button onClick={() => handleSetAiAnalysis(null)} className="mt-4 text-[10px] font-bold uppercase tracking-widest block w-full text-center transition-colors animate-fadeIn" style={{ color: 'var(--text-secondary)' }}>
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
                <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 animate-scaleIn" style={{ backgroundColor: 'color-mix(in srgb, #0F172A 60%, transparent)' }}>
                    <div className="rounded-2xl shadow-2xl p-6 w-full max-w-md border animate-slideUp" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)' }}>
                                    <KeyIcon className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                                </div>
                                <h3 className="text-lg font-bold tracking-tight uppercase" style={{ color: 'var(--text-primary)' }}>AI Settings</h3>
                            </div>
                            <button onClick={() => setShowKeyModal(false)} className="p-1 transition-colors" style={{ color: 'var(--text-secondary)' }}>
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Provider Selector */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>Select AI Provider</label>
                                <div className="relative group">
                                    <select
                                        value={activeProvider}
                                        onChange={(e) => setActiveProvider(e.target.value as AIProvider)}
                                        className="w-full rounded-xl px-4 py-3 appearance-none outline-none transition-all cursor-pointer font-bold"
                                        style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                    >
                                        <option value="GEMINI">Google Gemini (Default)</option>
                                        <option value="OPENAI">OpenAI (ChatGPT)</option>
                                        <option value="AGNES">Agnes (agnes-2.5-flash)</option>
                                        <option value="CLAUDE">Anthropic Claude</option>
                                    </select>
                                    <ChevronDownIcon className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors" style={{ color: 'var(--text-secondary)' }} />
                                </div>
                            </div>

                            {/* Gemini Model Selector */}
                            {activeProvider === 'GEMINI' && (
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>Gemini Model</label>
                                    <div className="relative group">
                                        <select
                                            value={geminiModel}
                                            onChange={(e) => { setGeminiModel(e.target.value as GeminiModel); localStorage.setItem('gemini_model', e.target.value); }}
                                            className="w-full rounded-xl px-4 py-3 appearance-none outline-none transition-all cursor-pointer font-bold"
                                            style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                        >
                                            <option value="gemini-3.6-flash">Gemini 3.6 Flash (最新 Latest)</option>
                                            <option value="gemini-3.5-flash">Gemini 3.5 Flash (穩定 Stable)</option>
                                            <option value="gemini-2.5-flash">Gemini 2.5 Flash (經濟 Legacy)</option>
                                        </select>
                                        <ChevronDownIcon className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors" style={{ color: 'var(--text-secondary)' }} />
                                    </div>
                                </div>
                            )}

                            {/* OpenAI Model Selector */}
                            {activeProvider === 'OPENAI' && (
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>OpenAI Model</label>
                                    <div className="relative group">
                                        <select
                                            value={openaiModel}
                                            onChange={(e) => { setOpenaiModel(e.target.value as OpenAIModel); localStorage.setItem('openai_model', e.target.value); }}
                                            className="w-full rounded-xl px-4 py-3 appearance-none outline-none transition-all cursor-pointer font-bold"
                                            style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                        >
                                            <option value="gpt-4o-mini">GPT-4o Mini (快速便宜 Fast & Cheap)</option>
                                        </select>
                                        <ChevronDownIcon className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors" style={{ color: 'var(--text-secondary)' }} />
                                    </div>
                                </div>
                            )}

                            {/* Claude Model Selector */}
                            {activeProvider === 'CLAUDE' && (
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>Claude Model</label>
                                    <div className="relative group">
                                        <select
                                            value={claudeModel}
                                            onChange={(e) => { setClaudeModel(e.target.value as ClaudeModel); localStorage.setItem('claude_model', e.target.value); }}
                                            className="w-full rounded-xl px-4 py-3 appearance-none outline-none transition-all cursor-pointer font-bold"
                                            style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                        >
                                            <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (平衡 Balanced)</option>
                                            <option value="claude-haiku-4-5">Claude Haiku 4.5 (快速便宜 Fast & Cheap)</option>
                                        </select>
                                        <ChevronDownIcon className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors" style={{ color: 'var(--text-secondary)' }} />
                                    </div>
                                </div>
                            )}

                            {/* API Key Input */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>
                                    {activeProvider} API Key
                                </label>
                                <input
                                    type="password"
                                    value={apiKeyInput}
                                    onChange={(e) => setApiKeyInput(e.target.value)}
                                    placeholder={`Enter your ${activeProvider} API Key...`}
                                    className="w-full rounded-xl px-4 py-3 outline-none transition-all font-mono text-sm"
                                    style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                />
                            </div>

                            <p className="text-[11px] leading-relaxed p-3 rounded-lg border italic" style={{ color: 'var(--text-secondary)', backgroundColor: 'color-mix(in srgb, var(--bg-app) 50%, transparent)', borderColor: 'var(--border)' }}>
                                {lang === 'zh'
                                    ? "您的 Key 將加密儲存於當前瀏覽器中，不會傳送至我們的伺服器。"
                                    : "Your key is stored locally in your browser and is never sent to our servers."}
                            </p>

                            <div className="flex flex-col gap-3 pt-2">
                                <button
                                    onClick={handleSaveKey}
                                    disabled={!apiKeyInput.trim()}
                                    className="w-full text-white font-bold uppercase tracking-widest py-3 rounded-xl shadow-lg transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                                    style={{ backgroundColor: 'var(--accent)' }}
                                >
                                    {lang === 'zh' ? "储存配置並分析" : "Save & Analyze"}
                                </button>
                                <a
                                    href={activeProvider === 'GEMINI' ? "https://aistudio.google.com/app/apikey" : activeProvider === 'AGNES' ? "https://apihub.agnes-ai.com" : activeProvider === 'CLAUDE' ? "https://console.anthropic.com/settings/keys" : "https://platform.openai.com/api-keys"}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[10px] text-center font-bold transition-colors"
                                    style={{ color: 'var(--accent)' }}
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