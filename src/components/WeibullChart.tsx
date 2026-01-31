import React, { useState, useEffect, useMemo } from 'react';
import Plot from 'react-plotly.js';
import {
    XMarkIcon,
    ArrowPathIcon,
    MagnifyingGlassPlusIcon,
    HandRaisedIcon
} from '@heroicons/react/24/outline';
import { WeibullResult, ChartType, Language, Theme } from '../types';
import { t } from '../utils/locales';

interface WeibullChartProps {
    result1: WeibullResult | null;
    result2: WeibullResult | null;
    label1?: string;
    label2?: string;
    lang: Language;
    theme: Theme;
}

const calculateMetrics = (t: number, beta: number, eta: number) => {
    if (t <= 0) return { pdf: 0, reliability: 1, cdf: 0, hazard: 0 };
    const t_eta = t / eta;
    const term = Math.pow(t_eta, beta);
    const reliability = Math.exp(-term);
    const cdf = 1 - reliability;
    const pdf = (beta / eta) * Math.pow(t_eta, beta - 1) * Math.exp(-term);
    const hazard = (beta / eta) * Math.pow(t_eta, beta - 1);
    return { pdf, reliability, cdf, hazard };
};

const WeibullChart: React.FC<WeibullChartProps> = ({
    result1,
    result2,
    label1 = "Group A",
    label2 = "Group B",
    lang,
    theme
}) => {
    const [chartType, setChartType] = useState<ChartType>('PROBABILITY');
    const [modalData, setModalData] = useState<{ time: number } | null>(null);
    const [visibleGroups, setVisibleGroups] = useState<{ g1: boolean, g2: boolean }>({ g1: true, g2: true });
    const [interactionMode, setInteractionMode] = useState<'ZOOM' | 'PAN'>('ZOOM');

    // Theme colors
    const isDark = theme === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const axisColor = isDark ? '#475569' : '#94a3b8';
    const axisTextColor = isDark ? '#94a3b8' : '#64748b';
    const bgColor = isDark ? '#020617' : '#ffffff';
    const plotBgColor = 'transparent';

    const colorA = isDark ? '#38bdf8' : '#4f46e5';
    const colorB = isDark ? '#fbbf24' : '#e11d48';

    const name1 = lang === 'zh' ? "A 組" : label1;
    const name2 = lang === 'zh' ? "B 組" : label2;

    // Reset visibility when result arrives
    useEffect(() => {
        if (result1) setVisibleGroups(v => ({ ...v, g1: true }));
        if (result2) setVisibleGroups(v => ({ ...v, g2: true }));
    }, [result1, result2]);

    const getFailureModeBadge = (beta: number) => {
        if (beta < 0.9) return "Infant";
        if (beta <= 1.1) return "Random";
        return "Wear-out";
    };

    const getFailureModeLabel = (beta: number) => {
        if (beta < 0.9) return t('results.metrics.infant', lang);
        if (beta <= 1.1) return t('results.metrics.random', lang);
        return t('results.metrics.wearout', lang);
    };

    // --- Plotly Data Preparation ---
    const plotData = useMemo(() => {
        if (!result1) return [];
        const traces: any[] = [];

        if (chartType === 'PROBABILITY') {
            const probTicks = [0.1, 0.5, 1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99];
            const weibullTrans = (p: number) => Math.log(-Math.log(1 - p / 100));

            // Group A
            if (visibleGroups.g1 && result1) {
                // Line
                traces.push({
                    x: result1.linePoints.map(p => Math.exp(p.x)),
                    y: result1.linePoints.map(p => p.y),
                    mode: 'lines',
                    name: `${name1} fit`,
                    line: { color: colorA, width: 2 },
                    hoverinfo: 'none'
                });
                // Points
                traces.push({
                    x: result1.dataPoints.filter(p => p.status === 'F').map(p => p.time),
                    y: result1.dataPoints.filter(p => p.status === 'F').map(p => weibullTrans(p.rank * 100)),
                    mode: 'markers',
                    name: name1,
                    marker: { color: bgColor, line: { color: colorA, width: 2 }, size: 8, symbol: 'circle' },
                    hovertemplate: `<b>${name1}</b><br>Time: %{x:.2f}<br>Unreliability: %{customdata:.2f}%<extra></extra>`,
                    customdata: result1.dataPoints.filter(p => p.status === 'F').map(p => p.rank * 100)
                });
            }

            // Group B
            if (visibleGroups.g2 && result2) {
                // Line
                traces.push({
                    x: result2.linePoints.map(p => Math.exp(p.x)),
                    y: result2.linePoints.map(p => p.y),
                    mode: 'lines',
                    name: `${name2} fit`,
                    line: { color: colorB, width: 2 },
                    hoverinfo: 'none'
                });
                // Points
                traces.push({
                    x: result2.dataPoints.filter(p => p.status === 'F').map(p => p.time),
                    y: result2.dataPoints.filter(p => p.status === 'F').map(p => weibullTrans(p.rank * 100)),
                    mode: 'markers',
                    name: name2,
                    marker: { color: bgColor, line: { color: colorB, width: 2 }, size: 9, symbol: 'triangle-up' },
                    hovertemplate: `<b>${name2}</b><br>Time: %{x:.2f}<br>Unreliability: %{customdata:.2f}%<extra></extra>`,
                    customdata: result2.dataPoints.filter(p => p.status === 'F').map(p => p.rank * 100)
                });
            }
        } else {
            // PDF or Reliability
            const maxT = Math.max(
                result1.dataPoints[result1.dataPoints.length - 1].time,
                result2 ? result2.dataPoints[result2.dataPoints.length - 1].time : 0
            ) * 1.3;
            const steps = 150;
            const step = maxT / steps;
            const xValues = Array.from({ length: steps + 1 }, (_, i) => i * step);

            if (visibleGroups.g1 && result1) {
                const yValues = xValues.map(x => {
                    const m = calculateMetrics(x, result1.beta, result1.eta);
                    return chartType === 'RELIABILITY' ? m.reliability : m.pdf;
                });
                traces.push({
                    x: xValues,
                    y: yValues,
                    mode: 'lines',
                    name: name1,
                    line: { color: colorA, width: 2.5, shape: 'spline' },
                    fill: 'tozeroy',
                    fillcolor: `${colorA}15`
                });

                // Failures marker overlay
                const failureTimes = result1.dataPoints.filter(p => p.status === 'F').map(p => p.time);
                const failureY = failureTimes.map(t => {
                    const m = calculateMetrics(t, result1.beta, result1.eta);
                    return chartType === 'RELIABILITY' ? m.reliability : m.pdf;
                });
                traces.push({
                    x: failureTimes,
                    y: failureY,
                    mode: 'markers',
                    marker: { color: bgColor, line: { color: colorA, width: 2 }, size: 7 },
                    name: `${name1} Failures`,
                    hoverinfo: 'none'
                });
            }

            if (visibleGroups.g2 && result2) {
                const yValues = xValues.map(x => {
                    const m = calculateMetrics(x, result2.beta, result2.eta);
                    return chartType === 'RELIABILITY' ? m.reliability : m.pdf;
                });
                traces.push({
                    x: xValues,
                    y: yValues,
                    mode: 'lines',
                    name: name2,
                    line: { color: colorB, width: 2.5, shape: 'spline' },
                    fill: 'tozeroy',
                    fillcolor: `${colorB}15`
                });

                // Failures marker overlay
                const failureTimes = result2.dataPoints.filter(p => p.status === 'F').map(p => p.time);
                const failureY = failureTimes.map(t => {
                    const m = calculateMetrics(t, result2.beta, result2.eta);
                    return chartType === 'RELIABILITY' ? m.reliability : m.pdf;
                });
                traces.push({
                    x: failureTimes,
                    y: failureY,
                    mode: 'markers',
                    marker: { color: bgColor, line: { color: colorB, width: 2 }, size: 8, symbol: 'triangle-up' },
                    name: `${name2} Failures`,
                    hoverinfo: 'none'
                });
            }
        }

        return traces;
    }, [chartType, result1, result2, visibleGroups, colorA, colorB, bgColor, name1, name2]);

    const plotLayout = useMemo(() => {
        const layout: any = {
            autosize: true,
            showlegend: false,
            margin: { l: 60, r: 40, t: 60, b: 60 },
            paper_bgcolor: plotBgColor,
            plot_bgcolor: plotBgColor,
            font: { family: 'Inter, sans-serif', size: 12, color: axisTextColor },
            hovermode: 'closest',
            dragmode: interactionMode === 'ZOOM' ? 'zoom' : 'pan',
            xaxis: {
                title: { text: 'Time-to-Failure (t)', font: { size: 12, weight: 800 } },
                gridcolor: gridColor,
                linecolor: axisColor,
                tickfont: { color: axisTextColor, weight: 700 },
                zeroline: false,
                type: chartType === 'PROBABILITY' ? 'log' : 'linear'
            },
            yaxis: {
                gridcolor: gridColor,
                linecolor: axisColor,
                tickfont: { color: axisTextColor, weight: 700 },
                zeroline: false
            }
        };

        if (chartType === 'PROBABILITY') {
            const probTicks = [0.1, 0.5, 1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99];
            layout.yaxis.title = { text: 'Unreliability F(t) %', font: { size: 12, weight: 800 } };
            layout.yaxis.ticktext = probTicks.map(p => p < 1 ? p.toFixed(1) + '%' : p + '%');
            layout.yaxis.tickvals = probTicks.map(p => Math.log(-Math.log(1 - p / 100)));
        } else {
            layout.yaxis.title = { text: chartType === 'RELIABILITY' ? 'Reliability R(t)' : 'Probability Density f(t)', font: { size: 12, weight: 800 } };
            if (chartType === 'RELIABILITY') layout.yaxis.range = [0, 1.05];
        }

        return layout;
    }, [chartType, interactionMode, gridColor, axisColor, axisTextColor, plotBgColor]);

    const CustomLegend = () => (
        <div className="absolute top-4 left-0 right-0 flex justify-center items-center space-x-12 z-10 pointer-events-none select-none">
            {visibleGroups.g1 && result1 && (
                <div className="flex items-center space-x-3 bg-white/50 dark:bg-slate-800/30 backdrop-blur-sm px-3 py-1 rounded-full border border-slate-200 dark:border-white/5 shadow-sm">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorA }}></div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{name1}</span>
                    <span className="text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full bg-slate-200/50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600">
                        {getFailureModeBadge(result1.beta)}
                    </span>
                </div>
            )}
            {visibleGroups.g2 && result2 && (
                <div className="flex items-center space-x-3 bg-white/50 dark:bg-slate-800/30 backdrop-blur-sm px-3 py-1 rounded-full border border-slate-200 dark:border-white/5 shadow-sm">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorB }}></div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{name2}</span>
                    <span className="text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full bg-slate-200/50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600">
                        {getFailureModeBadge(result2.beta)}
                    </span>
                </div>
            )}
        </div>
    );

    const StatRow = ({ label, val1, val2, unit = '' }: { label: string, val1: number, val2?: number, unit?: string }) => (
        <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
            <span className="text-slate-500 dark:text-slate-400 font-medium">{label}</span>
            <div className="flex space-x-6">
                <span className={`font-mono font-semibold ${theme === 'dark' ? 'text-sky-400' : 'text-indigo-600'}`}>{val1.toExponential(3)} {unit}</span>
                {val2 !== undefined && <span className={`font-mono font-semibold ${theme === 'dark' ? 'text-yellow-400' : 'text-rose-600'}`}>{val2.toExponential(3)} {unit}</span>}
            </div>
        </div>
    );

    if (!result1) return (
        <div className="w-full h-full bg-white dark:bg-slate-800 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-300 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
            </div>
            <p>{t('results.ai.awaitingSub', lang)}</p>
        </div>
    );

    return (
        <div className="w-full flex flex-col h-full relative bg-white dark:bg-slate-950 transition-colors duration-300">
            {/* Integrated Toolbar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 z-20 transition-colors duration-200">
                <div className="flex items-center space-x-8">
                    <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight shrink-0">
                        {chartType === 'PROBABILITY' ? 'Probability Plot' : (chartType === 'RELIABILITY' ? 'Reliability Curve' : 'Probability Density')}
                    </h3>

                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        {[
                            { id: 'PROBABILITY', label: 'Probability' },
                            { id: 'RELIABILITY', label: 'Reliability' },
                            { id: 'PDF', label: 'PDF' }
                        ].map(type => (
                            <button
                                key={type.id}
                                onClick={() => setChartType(type.id as ChartType)}
                                className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${chartType === type.id
                                    ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-indigo-300'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                            >
                                {type.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center space-x-4">
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                        <button
                            onClick={() => setInteractionMode('ZOOM')}
                            className={`p-1.5 rounded-md transition-all ${interactionMode === 'ZOOM' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-indigo-300' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <MagnifyingGlassPlusIcon className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setInteractionMode('PAN')}
                            className={`p-1.5 rounded-md transition-all ${interactionMode === 'PAN' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-indigo-300' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <HandRaisedIcon className="w-4 h-4" />
                        </button>
                    </div>

                    <button
                        onClick={() => {
                            setInteractionMode('ZOOM');
                        }}
                        className="flex items-center space-x-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                        <ArrowPathIcon className="w-3.5 h-3.5" />
                        <span>Interactive Plotly</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 w-full relative transition-colors duration-200 overflow-hidden">
                <CustomLegend />
                <Plot
                    data={plotData}
                    layout={plotLayout}
                    config={{
                        responsive: true,
                        displayModeBar: 'hover',
                        displaylogo: false,
                        modeBarButtonsToRemove: ['select2d', 'lasso2d']
                    }}
                    style={{ width: '100%', height: '100%' }}
                    onClick={(data) => {
                        if (data.points && data.points.length > 0) {
                            setModalData({ time: data.points[0].x as number });
                        }
                    }}
                />
            </div>

            <div className="flex-none px-4 py-2 text-xs text-slate-400 dark:text-slate-500 text-right bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
                Developed by Wesley Chang @ Mouldex, Jan-2026. All rights reserved.
            </div>

            {modalData && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-white/10 dark:bg-slate-900/30 backdrop-blur-[2px]">
                    <div className="absolute inset-0" onClick={() => setModalData(null)}></div>
                    <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl ring-1 ring-slate-200 dark:ring-slate-700 p-6 w-full max-w-lg animate-fadeIn">
                        <button onClick={() => setModalData(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"><XMarkIcon className="w-5 h-5" /></button>
                        <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Point Statistics</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">At Time t = <span className="font-mono text-slate-800 dark:text-slate-200">{modalData.time.toFixed(2)}</span></p>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-700 pb-3">
                                <span>Metric</span>
                                <div className="flex space-x-10">
                                    <span className={theme === 'dark' ? 'text-sky-400' : 'text-indigo-600'}>{name1}</span>
                                    {result2 && <span className={theme === 'dark' ? 'text-yellow-400' : 'text-rose-600'}>{name2}</span>}
                                </div>
                            </div>
                            {(() => {
                                const m1 = calculateMetrics(modalData.time, result1.beta, result1.eta);
                                const m2 = result2 ? calculateMetrics(modalData.time, result2.beta, result2.eta) : undefined;
                                return (
                                    <div className="text-sm space-y-1">
                                        {visibleGroups.g1 && <StatRow label={t('chart.tooltip.reliability', lang)} val1={m1.reliability} val2={visibleGroups.g2 ? m2?.reliability : undefined} />}
                                        {visibleGroups.g1 && <StatRow label={t('chart.tooltip.cdf', lang)} val1={m1.cdf} val2={visibleGroups.g2 ? m2?.cdf : undefined} />}
                                        {visibleGroups.g1 && <StatRow label={t('chart.tooltip.pdf', lang)} val1={m1.pdf} val2={visibleGroups.g2 ? m2?.pdf : undefined} />}
                                        {visibleGroups.g1 && <StatRow label={t('chart.tooltip.hazard', lang)} val1={m1.hazard} val2={visibleGroups.g2 ? m2?.hazard : undefined} />}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WeibullChart;