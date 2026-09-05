import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js-dist-min';
import {
    XMarkIcon,
    ArrowPathIcon,
    MagnifyingGlassPlusIcon,
    HandRaisedIcon,
    DocumentTextIcon
} from '@heroicons/react/24/outline';
import { WeibullResult, ChartType, Language, GroupDataset } from '../types';
import { t } from '../utils/locales';

interface WeibullChartProps {
    groups?: GroupDataset[];
    result1?: WeibullResult | null;
    result2?: WeibullResult | null;
    label1?: string;
    label2?: string;
    lang: Language;
    aiAnalysis?: string | null;
    onToggleVisibility?: (groupId: string) => void;
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
    groups,
    result1,
    result2,
    label1 = "Group A",
    label2 = "Group B",
    lang,
    aiAnalysis,
    onToggleVisibility
}) => {
    const plotRef = useRef<HTMLDivElement>(null);
    const [chartType, setChartType] = useState<ChartType>('PROBABILITY');
    const [modalData, setModalData] = useState<{ time: number } | null>(null);
    const [visibleGroups, setVisibleGroups] = useState<{ g1: boolean, g2: boolean }>({ g1: true, g2: true });
    const [interactionMode, setInteractionMode] = useState<'ZOOM' | 'PAN'>('ZOOM');

    // Effective groups calculation
    const effectiveGroups = useMemo(() => {
        if (groups && groups.length > 0) return groups;
        const res: GroupDataset[] = [];
        if (result1) res.push({ id: 'g1', label: label1 || (lang === 'zh' ? 'A 組' : 'Group A'), text: '', color: '#4f46e5', result: result1, visible: visibleGroups.g1 });
        if (result2) res.push({ id: 'g2', label: label2 || (lang === 'zh' ? 'B 組' : 'Group B'), text: '', color: '#e11d48', result: result2, visible: visibleGroups.g2 });
        return res;
    }, [groups, result1, result2, label1, label2, lang, visibleGroups]);

    // --- Draggable label refs (zero React state during drag) ---
    const graphRef = useRef<any>(null);
    const labelOffsetsRef = useRef<Map<string, {x: number; y: number}>>(new Map());
    const dragRef = useRef<{active: boolean; id: string; startMX: number; startMY: number; baseLeft: number; baseTop: number} | null>(null);

    const gridColor = 'rgba(0,0,0,0.06)';
    const axisColor = '#94a3b8';
    const axisTextColor = '#6B7280';
    const bgColor = '#ffffff';
    const plotBgColor = 'transparent';

    // Typography scale — single source of truth for the interactive chart.
    // Principle: content >= chrome. Axis titles and annotations carry the
    // analysis conclusion, so they rank at/above base; ticks/badges are chrome.
    const FS = {
        base: 13,         // plotly default (hover text, fallback)
        tick: 11.5,       // axis tick labels
        axis: 13.5,       // axis titles (units + meaning)
        annotation: 20,   // formula box (the analysis conclusion)
        label: 13,        // draggable overlay labels (R=0.95, eta markers)
        stat: 11.5,       // footer stat strip
    };

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

    // --- Draggable HTML overlay labels (Reliability chart: R=0.95 + Eta markers) ---
    const labelDefs = useMemo(() => {
        const defs: { id: string; dataX: number; dataY: number; text: string; color: string }[] = [];
        if (chartType !== 'RELIABILITY') return defs;
        const rEta = Math.exp(-1);
        effectiveGroups.forEach(g => {
            if (!g.visible || !g.result) return;
            const r = g.result;
            const t_095 = r.eta * Math.pow(-Math.log(0.95), 1 / r.beta);
            defs.push({ id: `r095-${g.id}`, dataX: t_095, dataY: 0.95, text: `R=0.95 @ t=${t_095.toFixed(2)}`, color: g.color });
            defs.push({ id: `eta-${g.id}`, dataX: r.eta, dataY: rEta, text: `R(η)=e⁻¹≈${rEta.toFixed(4)} @ η=${r.eta.toFixed(2)}`, color: g.color });
        });
        return defs;
    }, [chartType, effectiveGroups]);

    const labelDefsRef = useRef(labelDefs);
    labelDefsRef.current = labelDefs;

    const refreshLabelPositions = useCallback(() => {
        const gd = graphRef.current;
        if (!gd || !gd._fullLayout || !gd._fullLayout.xaxis) return;
        const xaxis = gd._fullLayout.xaxis;
        const yaxis = gd._fullLayout.yaxis;
        for (const def of labelDefsRef.current) {
            const el = document.getElementById(def.id);
            if (!el) continue;
            let px: number, py: number;
            try {
                px = xaxis._offset + xaxis.d2p(def.dataX);
                py = yaxis._offset + yaxis.d2p(def.dataY);
            } catch { continue; }
            if (!isFinite(px) || !isFinite(py)) continue;
            const off = labelOffsetsRef.current.get(def.id) || { x: 0, y: 0 };
            const baseX = px + 12;
            const baseY = py - 12;
            el.dataset.baseX = String(baseX);
            el.dataset.baseY = String(baseY);
            el.style.left = `${baseX + off.x}px`;
            el.style.top = `${baseY + off.y}px`;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        const drag = dragRef.current;
        if (!drag?.active) return;
        const el = document.getElementById(drag.id);
        if (!el) return;
        el.style.left = `${drag.baseLeft + e.clientX - drag.startMX}px`;
        el.style.top = `${drag.baseTop + e.clientY - drag.startMY}px`;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleMouseUp = useCallback(() => {
        const drag = dragRef.current;
        if (!drag?.active) { dragRef.current = null; return; }
        const el = document.getElementById(drag.id);
        if (el) {
            const baseX = parseFloat(el.dataset.baseX || '0');
            const baseY = parseFloat(el.dataset.baseY || '0');
            const cx = parseFloat(el.style.left) || 0;
            const cy = parseFloat(el.style.top) || 0;
            labelOffsetsRef.current.set(drag.id, { x: cx - baseX, y: cy - baseY });
        }
        dragRef.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleLabelMouseDown = useCallback((e: React.MouseEvent, id: string) => {
        e.preventDefault();
        const el = document.getElementById(id);
        if (!el) return;
        dragRef.current = {
            active: true, id,
            startMX: e.clientX, startMY: e.clientY,
            baseLeft: parseFloat(el.style.left) || 0,
            baseTop: parseFloat(el.style.top) || 0,
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (chartType !== 'RELIABILITY') return;
        const timer = setTimeout(() => refreshLabelPositions(), 60);
        const gd = graphRef.current;
        const onRelayout = () => refreshLabelPositions();
        if (gd) gd.on('plotly_relayout', onRelayout);
        return () => {
            clearTimeout(timer);
            if (gd) gd.removeListener('plotly_relayout', onRelayout);
            if (dragRef.current?.active) {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            }
        };
    }, [labelDefs, chartType]);

    // --- Plotly Data Preparation ---
    const plotData = useMemo(() => {
        const validGroups = effectiveGroups.filter(g => g.result !== null);
        if (validGroups.length === 0) return [];
        const traces: any[] = [];
        const symbols = ['circle', 'triangle-up', 'diamond', 'square', 'star', 'hexagon', 'pentagon', 'cross'];

        if (chartType === 'PROBABILITY') {
            const weibullTrans = (p: number) => Math.log(-Math.log(1 - p / 100));
            validGroups.forEach((g, idx) => {
                if (!g.visible || !g.result) return;
                const r = g.result;
                const symbol = symbols[idx % symbols.length];

                // Line
                traces.push({
                    x: r.linePoints.map(p => Math.exp(p.x)),
                    y: r.linePoints.map(p => p.y),
                    mode: 'lines',
                    name: `${g.label} fit`,
                    line: { color: g.color, width: 2 },
                    hoverinfo: 'none'
                });
                // Points
                const failPts = r.dataPoints.filter(p => p.status === 'F');
                traces.push({
                    x: failPts.map(p => p.time),
                    y: failPts.map(p => weibullTrans(p.rank * 100)),
                    mode: 'markers',
                    name: g.label,
                    marker: { color: bgColor, line: { color: g.color, width: 2 }, size: 8, symbol },
                    hovertemplate: `<b>${g.label}</b><br>${t('chart.tooltip.time', lang)}: %{x:.2f}<br>${t('chart.tooltip.medianRank', lang)}: %{customdata[0]:.2f}%<br>${lang === 'zh' ? '擬合不靠度 F(t)' : 'Fitted F(t)'}: %{customdata[1]:.2f}%<extra></extra>`,
                    customdata: failPts.map(p => [p.rank * 100, calculateMetrics(p.time, r.beta, r.eta).cdf * 100])
                });
            });
        } else {
            // PDF or RELIABILITY
            const maxTimes = validGroups.map(g => g.result!.dataPoints[g.result!.dataPoints.length - 1].time);
            const maxT = Math.max(...maxTimes, 1) * 1.3;
            const steps = 150;
            const step = maxT / steps;
            const xValues = Array.from({ length: steps + 1 }, (_, i) => i * step);

            validGroups.forEach((g, idx) => {
                if (!g.visible || !g.result) return;
                const r = g.result;
                const symbol = symbols[idx % symbols.length];
                const yValues = xValues.map(x => {
                    const m = calculateMetrics(x, r.beta, r.eta);
                    return chartType === 'RELIABILITY' ? m.reliability : m.pdf;
                });

                traces.push({
                    x: xValues,
                    y: yValues,
                    mode: 'lines',
                    name: g.label,
                    line: { color: g.color, width: 2.5, shape: 'spline' },
                    fill: 'tozeroy',
                    fillcolor: `${g.color}15`
                });

                const failureTimes = r.dataPoints.filter(p => p.status === 'F').map(p => p.time);
                const failureY = failureTimes.map(t => {
                    const m = calculateMetrics(t, r.beta, r.eta);
                    return chartType === 'RELIABILITY' ? m.reliability : m.pdf;
                });
                traces.push({
                    x: failureTimes,
                    y: failureY,
                    mode: 'markers',
                    marker: { color: bgColor, line: { color: g.color, width: 2 }, size: 8, symbol },
                    name: `${g.label} Failures`,
                    hoverinfo: 'none'
                });
            });
        }

        // Reliability coordinate markers
        if (chartType === 'RELIABILITY') {
            const rEta = Math.exp(-1);
            validGroups.forEach(g => {
                if (!g.visible || !g.result) return;
                const r = g.result;
                const t_095 = r.eta * Math.pow(-Math.log(0.95), 1 / r.beta);
                traces.push({
                    x: [t_095], y: [0.95],
                    mode: 'markers',
                    marker: { color: 'white', size: 14, line: { color: g.color, width: 2.5 }, symbol: 'circle' },
                    showlegend: false, hoverinfo: 'none'
                });
                traces.push({
                    x: [r.eta], y: [rEta],
                    mode: 'markers',
                    marker: { color: 'white', size: 14, line: { color: g.color, width: 2.5 }, symbol: 'diamond' },
                    showlegend: false, hoverinfo: 'none'
                });
            });
        }

        return traces;
    }, [chartType, effectiveGroups, bgColor, lang]);

    const plotLayout = useMemo(() => {
        const layout: any = {
            autosize: true,
            showlegend: false,
            margin: { l: 64, r: 28, t: 44, b: 56 },
            paper_bgcolor: plotBgColor,
            plot_bgcolor: plotBgColor,
            font: { family: 'Inter, sans-serif', size: FS.base, color: axisTextColor },
            hovermode: 'closest',
            dragmode: interactionMode === 'ZOOM' ? 'zoom' : 'pan',
            xaxis: {
                title: { text: t('chart.time', lang), font: { size: FS.axis, color: axisTextColor } },
                gridcolor: gridColor,
                linecolor: axisColor,
                tickfont: { size: FS.tick, color: axisTextColor },
                zeroline: false,
                type: chartType === 'PROBABILITY' ? 'log' : 'linear',
                rangemode: chartType === 'PROBABILITY' ? 'normal' : 'nonnegative'
            },
            yaxis: {
                gridcolor: gridColor,
                linecolor: axisColor,
                tickfont: { size: FS.tick, color: axisTextColor },
                zeroline: false,
                rangemode: chartType === 'PROBABILITY' ? 'normal' : 'nonnegative'
            }
        };

        if (chartType === 'PROBABILITY') {
            // Curated tick set: the full 15-tick paper grid collides on short
            // containers; the report keeps the full set on its larger canvas.
            const probTicks = [0.1, 0.5, 1, 5, 10, 30, 50, 70, 90, 95, 99];
            layout.yaxis.title = { text: t('chart.unreliability', lang), font: { size: FS.axis, color: axisTextColor } };
            layout.yaxis.ticktext = probTicks.map(p => p < 1 ? p.toFixed(1) + '%' : p + '%');
            layout.yaxis.tickvals = probTicks.map(p => Math.log(-Math.log(1 - p / 100)));
        } else {
            layout.yaxis.title = {
                text: chartType === 'RELIABILITY' ? t('chart.reliabilityAxis', lang) : t('chart.pdfAxis', lang),
                font: { size: FS.axis, color: axisTextColor }
            };
            if (chartType === 'RELIABILITY') layout.yaxis.range = [0, 1.05];

            const validGroups = effectiveGroups.filter(g => g.result !== null);
            const maxTimes = validGroups.map(g => g.result!.dataPoints[g.result!.dataPoints.length - 1].time);
            const maxT = Math.max(...maxTimes, 0) * 1.3;
            if (maxT > 0) layout.xaxis.range = [0, maxT];

            if (chartType === 'PDF') {
                const getPeakPdf = (res: WeibullResult) => {
                    const tPeak = res.beta > 1 ? res.eta * Math.pow((res.beta - 1) / res.beta, 1 / res.beta) : res.eta * 0.02;
                    return calculateMetrics(tPeak, res.beta, res.eta).pdf;
                };
                let maxPdf = 0;
                validGroups.forEach(g => {
                    if (g.visible && g.result) maxPdf = Math.max(maxPdf, getPeakPdf(g.result));
                });
                if (maxPdf > 0) layout.yaxis.range = [0, maxPdf * 1.15];
            }
        }

        // R(0.95) dashed reference lines for Reliability chart
        layout.shapes = [];
        layout.annotations = [];
        if (chartType === 'RELIABILITY') {
            const rEta = Math.exp(-1);
            effectiveGroups.forEach(g => {
                if (!g.visible || !g.result) return;
                const r = g.result;
                const t_095 = r.eta * Math.pow(-Math.log(0.95), 1 / r.beta);
                layout.shapes.push(
                    { type: 'line', xref: 'x', yref: 'y', x0: 0, y0: 0.95, x1: t_095, y1: 0.95, line: { color: `${g.color}80`, width: 1.5, dash: 'dash' } },
                    { type: 'line', xref: 'x', yref: 'y', x0: t_095, y0: 0, x1: t_095, y1: 0.95, line: { color: `${g.color}80`, width: 1.5, dash: 'dash' } },
                    { type: 'line', xref: 'x', yref: 'y', x0: 0, y0: rEta, x1: r.eta, y1: rEta, line: { color: `${g.color}80`, width: 1.5, dash: 'dot' } },
                    { type: 'line', xref: 'x', yref: 'y', x0: r.eta, y0: 0, x1: r.eta, y1: rEta, line: { color: `${g.color}80`, width: 1.5, dash: 'dot' } }
                );
            });

            // Weibull formula annotation with actual values and matching curve colors
            const formulaLines: string[] = [];
            effectiveGroups.forEach(g => {
                if (!g.visible || !g.result) return;
                formulaLines.push(`<span style="color:${g.color};">${g.label}:</span> <span style="color:${g.color}">R(t) = e<sup>-(t/${g.result.eta.toFixed(2)})<sup>${g.result.beta.toFixed(4)}</sup></sup></span>`);
            });
            if (formulaLines.length > 0) {
                const fontSize = formulaLines.length > 2 ? 16 : FS.annotation;
                layout.annotations.push({
                    text: formulaLines.join('<br>'),
                    xref: 'paper', yref: 'paper',
                    x: 0.98, y: 0.98,
                    xanchor: 'right', yanchor: 'top',
                    showarrow: false,
                    font: { size: fontSize, family: 'Inter, system-ui, sans-serif' },
                    align: 'left',
                    bgcolor: 'rgba(255,255,255,0.92)',
                    bordercolor: 'rgba(0,0,0,0.15)',
                    borderwidth: 1,
                    borderpad: 6
                });
            }
        }

        return layout;
    }, [chartType, interactionMode, gridColor, axisColor, axisTextColor, plotBgColor, effectiveGroups, lang]);

    const generateHTMLReport = async () => {
        const validGroups = effectiveGroups.filter(g => g.result !== null);
        if (validGroups.length === 0) return;
        const isDualMode = validGroups.length > 1;
        const bg = '#ffffff', gridC = 'rgba(0,0,0,0.1)', axisC = '#475569';

        const captureChart = async (type: ChartType, returnData?: boolean): Promise<{url: string, traces?: any[], layout?: any, labels?: {id: string, dataX: number, dataY: number, text: string, color: string}[]}> => {
            const traces: any[] = [];
            const addGroupTraces = (r: WeibullResult, clr: string, nm: string) => {
                if (type === 'PROBABILITY') {
                    const weibullTrans = (p: number) => Math.log(-Math.log(1 - p / 100));
                    traces.push({
                        x: r.linePoints.map(p => Math.exp(p.x)), y: r.linePoints.map(p => p.y),
                        mode: 'lines', name: `${nm} fit`, line: { color: clr, width: 3 }, hoverinfo: 'none'
                    });
                    const failPts = r.dataPoints.filter(p => p.status === 'F');
                    traces.push({
                        x: failPts.map(p => p.time), y: failPts.map(p => weibullTrans(p.rank * 100)),
                        mode: 'markers', name: nm, marker: { color: bg, line: { color: clr, width: 3 }, size: 11, symbol: 'circle' },
                        hovertemplate: `<b>${nm}</b><br>${t('chart.tooltip.time', lang)}: %{x:.2f}<br>${t('chart.tooltip.medianRank', lang)}: %{customdata[0]:.2f}%<br>${lang === 'zh' ? '擬合不靠度 F(t)' : 'Fitted F(t)'}: %{customdata[1]:.2f}%<extra></extra>`,
                        customdata: failPts.map(p => [p.rank * 100, calculateMetrics(p.time, r.beta, r.eta).cdf * 100])
                    });
                } else {
                    const pts = r.dataPoints;
                    const maxT = pts[pts.length - 1].time * 1.3;
                    const steps = 150;
                    const xVals = Array.from({ length: steps + 1 }, (_, i) => i * (maxT / steps));
                    const yVals = xVals.map(x => calculateMetrics(x, r.beta, r.eta)[type === 'RELIABILITY' ? 'reliability' : 'pdf']);
                    traces.push({
                        x: xVals, y: yVals, mode: 'lines', name: nm,
                        line: { color: clr, width: 3.5, shape: 'spline' }, fill: 'tozeroy', fillcolor: `${clr}25`
                    });
                    const failTimes = pts.filter(p => p.status === 'F').map(p => p.time);
                    const failY = failTimes.map(t => calculateMetrics(t, r.beta, r.eta)[type === 'RELIABILITY' ? 'reliability' : 'pdf']);
                    traces.push({
                        x: failTimes, y: failY, mode: 'markers',
                        marker: { color: bg, line: { color: clr, width: 3 }, size: 10 }, name: `${nm} Failures`, hoverinfo: 'none'
                    });
                }
            };
            validGroups.forEach(g => { if (g.result) addGroupTraces(g.result, g.color, g.label); });

            // R(0.95) reference markers for Reliability chart
            if (type === 'RELIABILITY') {
                const addR095 = (r: WeibullResult, clr: string, nm: string) => {
                    const t_095 = r.eta * Math.pow(-Math.log(0.95), 1 / r.beta);
                    traces.push({
                        x: [t_095], y: [0.95], mode: 'markers+text',
                        marker: { color: bg, size: 16, line: { color: clr, width: 2.5 }, symbol: 'circle' },
                        text: `R=0.95 @ t=${t_095.toFixed(2)}`,
                        textfont: { color: clr, size: 13 }, textposition: 'middle right',
                        showlegend: false, hoverinfo: 'none'
                    });
                };
                validGroups.forEach(g => { if (g.result) addR095(g.result, g.color, g.label); });

                // Eta markers
                const rEta = Math.exp(-1);
                const addEtaMarker = (r: WeibullResult, clr: string) => {
                    traces.push({
                        x: [r.eta], y: [rEta], mode: 'markers+text',
                        marker: { color: bg, size: 16, line: { color: clr, width: 2.5 }, symbol: 'diamond' },
                        text: `R(η)=e⁻¹≈${rEta.toFixed(4)} @ η=${r.eta.toFixed(2)}`,
                        textfont: { color: clr, size: 13 }, textposition: 'middle right',
                        showlegend: false, hoverinfo: 'none'
                    });
                };
                validGroups.forEach(g => { if (g.result) addEtaMarker(g.result, g.color); });
            }

            const layout: any = {
                paper_bgcolor: bg, plot_bgcolor: 'transparent',
                font: { family: 'Inter, sans-serif', size: 14, color: axisC },
                hovermode: 'closest', margin: { l: 84, r: 48, t: 60, b: 72 }, showlegend: false,
                xaxis: { title: { text: t('chart.time', lang), font: { size: 14, color: axisC } }, gridcolor: gridC, linecolor: axisC, zeroline: false, tickfont: { size: 13, color: axisC }, rangemode: type === 'PROBABILITY' ? 'normal' : 'nonnegative' },
                yaxis: { title: { font: { size: 14, color: axisC } }, gridcolor: gridC, linecolor: axisC, zeroline: false, tickfont: { size: 13, color: axisC }, rangemode: type === 'PROBABILITY' ? 'normal' : 'nonnegative' }
            };
            if (type === 'PROBABILITY') {
                const probTicks = [0.1, 0.5, 1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99];
                layout.yaxis.title = { text: t('chart.unreliability', lang), font: { size: 14, color: axisC } };
                layout.yaxis.ticktext = probTicks.map(p => p < 1 ? p.toFixed(1) + '%' : p + '%');
                layout.yaxis.tickvals = probTicks.map(p => Math.log(-Math.log(1 - p / 100)));
                layout.xaxis.type = 'log';
            } else if (type === 'RELIABILITY') {
                layout.yaxis.title = { text: t('chart.reliabilityAxis', lang), font: { size: 14, color: axisC } };
                layout.yaxis.range = [0, 1.05];
                const maxTimes = validGroups.map(g => g.result ? g.result.dataPoints[g.result.dataPoints.length - 1].time : 0);
                const maxT = Math.max(...maxTimes, 1) * 1.3;
                if (maxT > 0) layout.xaxis.range = [0, maxT];
                layout.shapes = [];
                layout.annotations = [];
                const addRefLine = (r: WeibullResult, clr: string) => {
                    const t_095 = r.eta * Math.pow(-Math.log(0.95), 1 / r.beta);
                    layout.shapes.push(
                        { type: 'line', xref: 'x', yref: 'y', x0: 0, y0: 0.95, x1: t_095, y1: 0.95, line: { color: `${clr}80`, width: 1.5, dash: 'dash' } },
                        { type: 'line', xref: 'x', yref: 'y', x0: t_095, y0: 0, x1: t_095, y1: 0.95, line: { color: `${clr}80`, width: 1.5, dash: 'dash' } }
                    );
                    const rEta = Math.exp(-1);
                    layout.shapes.push(
                        { type: 'line', xref: 'x', yref: 'y', x0: 0, y0: rEta, x1: r.eta, y1: rEta, line: { color: `${clr}80`, width: 1.5, dash: 'dot' } },
                        { type: 'line', xref: 'x', yref: 'y', x0: r.eta, y0: 0, x1: r.eta, y1: rEta, line: { color: `${clr}80`, width: 1.5, dash: 'dot' } }
                    );
                };
                validGroups.forEach(g => { if (g.result) addRefLine(g.result, g.color); });
                // No formula annotation inside the PNG: the draggable HTML overlay
                // labels already carry the per-group R=0.95 / η values (avoids duplication).
            } else {
                layout.yaxis.title = { text: t('chart.pdfAxis', lang), font: { size: 14, color: axisC } };
                const maxTimes = validGroups.map(g => g.result ? g.result.dataPoints[g.result.dataPoints.length - 1].time : 0);
                const maxT = Math.max(...maxTimes, 1) * 1.3;
                if (maxT > 0) layout.xaxis.range = [0, maxT];

                const getPeakPdf = (res: WeibullResult) => {
                    const tPeak = res.beta > 1 ? res.eta * Math.pow((res.beta - 1) / res.beta, 1 / res.beta) : res.eta * 0.02;
                    return calculateMetrics(tPeak, res.beta, res.eta).pdf;
                };
                let maxPdf = 0;
                validGroups.forEach(g => {
                    if (g.result) maxPdf = Math.max(maxPdf, getPeakPdf(g.result));
                });
                if (maxPdf > 0) layout.yaxis.range = [0, maxPdf * 1.15];
            }

            const div = document.createElement('div');
            div.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1200px;height:800px';
            document.body.appendChild(div);
            await Plotly.newPlot(div, traces, layout, { responsive: false });
            await new Promise(r => setTimeout(r, 200));
            const url = await Plotly.toImage(div, { format: 'png', width: 1200, height: 800, scale: 2 });

            let result: {url: string, traces?: any[], layout?: any, labels?: any[]} = { url };

            if (returnData) {
                const sf = (n: number) => Math.max(4, Math.round(n * 0.7));
                const sw = (n: number) => Math.max(1, Math.round(n * 0.7));
                const cleanTraces = traces.map((t: any) => {
                    const c: any = {};
                    for (const k in t) { if (k !== 'text' && k !== 'textfont' && k !== 'textposition') c[k] = t[k]; }
                    if (t.mode === 'markers+text') c.mode = 'markers';
                    if (c.marker) {
                        c.marker = { ...c.marker };
                        if (typeof c.marker.size === 'number') c.marker.size = sf(c.marker.size);
                        if (c.marker.line && typeof c.marker.line.width === 'number') {
                            c.marker.line = { ...c.marker.line, width: sw(c.marker.line.width) };
                        }
                    }
                    if (c.line && typeof c.line.width === 'number') c.line = { ...c.line, width: sw(c.line.width) };
                    return c;
                });
                const resultData: any = { url, traces: cleanTraces };
                // Build overlay labels only for Reliability
                if (type === 'RELIABILITY') {
                    const labels: any[] = [];
                    const rEta = Math.exp(-1);
                    validGroups.forEach(g => {
                        if (g.result) {
                            const t_095 = g.result.eta * Math.pow(-Math.log(0.95), 1 / g.result.beta);
                            labels.push({ id: `r095-${g.id}`, dataX: t_095, dataY: 0.95, text: `R=0.95 @ t=${t_095.toFixed(2)}`, color: g.color });
                            labels.push({ id: `eta-${g.id}`, dataX: g.result.eta, dataY: rEta, text: `R(η)=e⁻¹≈${rEta.toFixed(4)} @ η=${g.result.eta.toFixed(2)}`, color: g.color });
                        }
                    });
                    resultData.labels = labels;
                }
                // Re-target fonts/margins of the embedded interactive charts to the
                // in-app design scale (source capture is already weight-free).
                const interactiveLayout = JSON.parse(JSON.stringify(layout));
                interactiveLayout.margin = { l: 56, r: 24, t: 40, b: 52 };
                interactiveLayout.font = { ...interactiveLayout.font, size: FS.base };
                if (interactiveLayout.xaxis?.title?.font) interactiveLayout.xaxis.title.font.size = 13.5;
                if (interactiveLayout.xaxis?.tickfont) interactiveLayout.xaxis.tickfont.size = 11.5;
                if (interactiveLayout.yaxis?.title?.font) interactiveLayout.yaxis.title.font.size = 13.5;
                if (interactiveLayout.yaxis?.tickfont) interactiveLayout.yaxis.tickfont.size = 11.5;
                resultData.layout = interactiveLayout;
                result = resultData;
            }

            Plotly.purge(div);
            document.body.removeChild(div);
            return result;
        };

        const [probResult, relResult, pdfResult] = await Promise.all([
            captureChart('PROBABILITY', true).catch(() => ({ url: '', traces: [], layout: {} })),
            captureChart('RELIABILITY', true).catch(() => ({ url: '', traces: [], layout: {}, labels: [] })),
            captureChart('PDF', true).catch(() => ({ url: '', traces: [], layout: {} }))
        ]);
        const probImg = probResult.url, relImg = relResult.url, pdfImg = pdfResult.url;
        const chartTypes = [
            { id: 'PROBABILITY', label: lang === 'zh' ? '機率圖' : 'Probability Plot', img: probImg, data: JSON.stringify(probResult.traces || []), layout: JSON.stringify(probResult.layout || {}) },
            { id: 'RELIABILITY', label: lang === 'zh' ? '可靠度曲線' : 'Reliability Curve', img: relImg, data: JSON.stringify(relResult.traces || []), layout: JSON.stringify(relResult.layout || {}), labels: relResult.labels || [] },
            { id: 'PDF', label: lang === 'zh' ? '機率密度' : 'Probability Density', img: pdfImg, data: JSON.stringify(pdfResult.traces || []), layout: JSON.stringify(pdfResult.layout || {}) }
        ];

        const ts = new Date().toLocaleString(lang === 'zh' ? 'zh-TW' : 'en-US', { dateStyle: 'long', timeStyle: 'short' });
        const getFM = (b: number) => b < 0.9 ? t('results.metrics.infant', lang) : b <= 1.1 ? t('results.metrics.random', lang) : t('results.metrics.wearout', lang);
        // B10 life: time at which unreliability reaches 10% (uses only beta/eta)
        const b10 = (r: WeibullResult) => r.eta * Math.pow(-Math.log(0.9), 1 / r.beta);

        const buildDataRows = (r: WeibullResult) => {
            return r.dataPoints.map(p => {
                const rankStr = p.status === 'F' ? (p.rank * 100).toFixed(4) + '%' : '-';
                const xStr = p.x.toFixed(4);
                const yStr = p.status === 'F' ? p.y.toFixed(4) : '-';
                return `<tr><td>${p.id + 1}</td><td>${p.time.toFixed(2)}</td><td>${p.status}</td><td>${rankStr}</td><td class="mono">${xStr}</td><td class="mono">${yStr}</td></tr>`;
            }).join('');
        };

        const colorizeText = (txt: string) =>
            txt.replace(/([\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]+)/g, '<span class="zh">$1</span>');
        const modeLabel = isDualMode ? (lang === 'zh' ? '多組比較' : 'Comparative') : (lang === 'zh' ? '單組分析' : 'Single');

        const reportHTML = `<!DOCTYPE html>
<html lang="${lang === 'zh' ? 'zh-TW' : 'en'}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${lang === 'zh' ? '韋伯分析報告' : 'Weibull Analysis Report'}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans TC',sans-serif;color:#111827;background:#F9FAFB;padding:24px 28px;max-width:1280px;margin:0 auto;font-size:13.5px;-webkit-font-smoothing:antialiased}
h1{font-size:26px;font-weight:800;color:#111827;margin-bottom:4px;letter-spacing:-.02em}
.sub{color:#6B7280;font-size:13.5px;margin-bottom:24px}
.section{margin-bottom:28px}
.section h2{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#6B7280;border-bottom:1.5px solid #E5E7EB;padding-bottom:6px;margin-bottom:14px}
.chart-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px 20px}
.chart-cell{display:flex;flex-direction:column;min-width:0}
.chart-caption{font-size:13.5px;font-weight:700;color:#111827;margin-top:10px;letter-spacing:.01em;text-align:left}
.chart-caption .num{color:#3B82F6;margin-right:8px;font-family:'SF Mono',Consolas,monospace}
.chart-img{width:100%;border-radius:8px;border:1px solid #E5E7EB;box-shadow:0 2px 8px rgba(0,0,0,.05)}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th{background:#F3F4F6;color:#6B7280;font-weight:700;text-align:left;padding:6px 10px;border-bottom:1.5px solid #D1D5DB;white-space:nowrap;text-transform:uppercase;letter-spacing:.05em;font-size:11px}
td{padding:6px 10px;border-bottom:1px solid #E5E7EB;color:#374151}
tbody tr:nth-child(even){background:#F9FAFB}
.mono{font-family:'SF Mono',Consolas,'Noto Sans Mono',monospace;font-size:12.5px;font-weight:600;color:#6B7280}
.metrics-tile{background:#fff;border:1px solid #E5E7EB;border-radius:8px;padding:18px 20px;flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:12px}
.metrics-tile .grp{display:flex;flex-direction:column;gap:10px}
.metrics-tile .grp + .grp{border-top:1px solid #E5E7EB;padding-top:12px}
.metrics-tile .grp-h{font-size:13px;font-weight:700;color:#111827;display:flex;align-items:center;gap:7px}
.metrics-tile .dot{width:9px;height:9px;border-radius:50%;display:inline-block;flex:none}
.metrics-tile .stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 16px}
.metrics-tile .stat .k{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6B7280;margin-bottom:2px}
.metrics-tile .stat .k sub{font-size:8px}
.metrics-tile .stat .v{font-size:20px;font-weight:800;font-family:'SF Mono',Consolas,'Noto Sans TC',monospace;color:#111827;letter-spacing:-.02em}
.metrics-tile .grp-sub{font-size:11.5px;color:#6B7280}
.ai-box{background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:16px 18px;font-size:13.5px;line-height:1.75;color:#374151}
.ai-box .zh{color:#1D4ED8;font-weight:500}
.summary-box{background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;padding:14px 16px;font-size:13px;line-height:1.8}
.summary-box strong{color:#111827;font-size:13.5px}
.summary-box .val{font-family:'SF Mono',Consolas,'Noto Sans Mono',monospace;font-weight:700;color:#3B82F6}
.summary-box .ctx{font-size:12px;color:#6B7280}
.summary-box sub{font-size:9px}
.dual-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.table-wrap{overflow-x:auto;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden}
.table-wrap table{border:none}
.section-footer{margin-top:24px;padding-top:16px;border-top:1.5px solid #E5E7EB;font-size:12px;color:#9CA3AF;text-align:center;letter-spacing:.02em}
/* dense horizontal layout: rows merge into columns where possible */
.info-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;align-items:start}
.info-row .left,.info-row .right{min-width:0}
.info-row.full{grid-template-columns:1fr}
.chart-wrap{position:relative;width:100%;border-radius:8px;border:1px solid #E5E7EB;aspect-ratio:3/2;min-height:300px;background:#fff;break-inside:avoid}
.chart-wrap .plot{position:absolute;inset:0;pointer-events:auto;border-radius:8px;overflow:hidden}
.chart-wrap .fallback{width:100%;display:block}
.chart-label{position:absolute;padding:2px 6px;border-radius:4px;font-size:12px;font-weight:600;white-space:nowrap;cursor:grab;user-select:none;z-index:10;pointer-events:auto;background:rgba(255,255,255,0.92);box-shadow:0 1px 3px rgba(0,0,0,0.12)}
@media(max-width:900px){body{padding:16px}.chart-grid{grid-template-columns:1fr;gap:12px}.info-row{grid-template-columns:1fr}.dual-grid{grid-template-columns:1fr;gap:10px}}
</style>
</head>
<body>
<h1>${lang === 'zh' ? '韋伯分析報告' : 'Weibull Analysis Report'}</h1>
<p class="sub">${lang === 'zh' ? '產生時間' : 'Generated'}: ${ts} &nbsp;|&nbsp; ${lang === 'zh' ? '分析模式' : 'Mode'}: ${modeLabel}</p>

<!-- Charts: 2x2 grid — PDF row pairs with the key-parameters tile (no empty cell) -->
<div class="section"><h2>${lang === 'zh' ? '圖表' : 'Charts'}</h2><div class="chart-grid">
${chartTypes.map((c, idx) => {
  const id = c.id.toLowerCase();
  const labels = c.labels || [];
  return `<div class="chart-cell">
<div class="chart-wrap" id="${id}-chart-wrap">
<img id="${id}-fallback" class="chart-img fallback" src="${c.img}" alt="${c.label}">
<div id="${id}-chart" class="plot"></div>
${labels.map((l: any) => `<div id="ol-${l.id}" class="chart-label" style="color:${l.color};border:1px solid ${l.color}">${l.text}</div>`).join('')}
</div>
<span class="chart-caption"><span class="num">${String(idx + 1).padStart(2, '0')}</span>${c.label}${c.labels ? ` <span style="color:#6B7280;font-weight:400">(${lang === 'zh' ? '拖拽標籤' : 'Drag labels'})</span>` : ''}</span>
</div>`;
}).join('')}
<div class="chart-cell">
<div class="metrics-tile">
${validGroups.map(g => {
    if (!g.result) return '';
    const fCount = g.result.dataPoints.filter(p => p.status === 'F').length;
    const sCount = g.result.dataPoints.filter(p => p.status === 'S').length;
    const rMttf = calculateMetrics(g.result.mttf, g.result.beta, g.result.eta).reliability;
    return `<div class="grp">
        <div class="grp-h"><span class="dot" style="background:${g.color}"></span><span style="color:${g.color}">${g.label}</span></div>
        <div class="stat-grid">
            <div class="stat"><div class="k">${lang === 'zh' ? '形狀 β' : 'Shape β'}</div><div class="v" style="color:${g.color}">${g.result.beta.toFixed(3)}</div></div>
            <div class="stat"><div class="k">${lang === 'zh' ? '尺度 η' : 'Scale η'}</div><div class="v" style="color:${g.color}">${g.result.eta.toFixed(2)}</div></div>
            <div class="stat"><div class="k">MTTF</div><div class="v">${g.result.mttf.toFixed(1)}</div></div>
            <div class="stat"><div class="k">R²</div><div class="v">${g.result.rSquared.toFixed(4)}</div></div>
            <div class="stat"><div class="k">R(MTTF)</div><div class="v">${rMttf.toFixed(3)}</div></div>
            <div class="stat"><div class="k">B<sub>10</sub></div><div class="v">${b10(g.result).toFixed(1)}</div></div>
        </div>
        <div class="grp-sub">${lang === 'zh' ? '失效模式' : 'Failure Mode'}: ${getFM(g.result.beta)} · N=${g.result.dataPoints.length} (F${fCount}/S${sCount})</div>
    </div>`;
}).join('')}
</div>
<span class="chart-caption"><span class="num">04</span>${lang === 'zh' ? '參數指標' : 'Key Parameters'}</span>
</div>
</div></div>

<!-- Two-column: left (Summary) | right (Raw Data) -->
<div class="info-row">
<div class="left">
<div class="section"><h2>${lang === 'zh' ? '摘要' : 'Summary'}</h2>
<div class="dual-grid" style="display:grid; grid-template-columns: repeat(${Math.min(validGroups.length, 2)}, minmax(0,1fr)); gap:10px;">
${validGroups.map(g => {
    if (!g.result) return '';
    const fCount = g.result.dataPoints.filter(p => p.status === 'F').length;
    const sCount = g.result.dataPoints.filter(p => p.status === 'S').length;
    return `<div class="summary-box" style="border-top:3px solid ${g.color}">
        <strong style="color:${g.color}">${g.label}</strong><br>
        N: <span class="val">${g.result.dataPoints.length}</span> &nbsp;
        F: <span class="val">${fCount}</span> &nbsp;
        S: <span class="val">${sCount}</span><br>
        <span class="ctx">${lang === 'zh'
            ? `${fCount} 筆失效 / ${sCount} 筆暫緩，共 ${g.result.dataPoints.length} 筆`
            : `${fCount} failures / ${sCount} suspensions of ${g.result.dataPoints.length} total`}</span><br>
        ${lang === 'zh' ? '失效模式' : 'Failure Mode'}: <span class="val">${getFM(g.result.beta)}</span>
    </div>`;
}).join('')}
</div>
</div>
</div>
<div class="right">
<div class="section"><h2>${lang === 'zh' ? '原始數據' : 'Raw Data'}</h2>
<div class="dual-grid" style="display:grid; grid-template-columns: repeat(${Math.min(validGroups.length, 2)}, minmax(0,1fr)); gap:10px;">
${validGroups.map(g => {
    if (!g.result) return '';
    return `<div>
        <h4 style="color:${g.color}; margin-bottom:4px; font-size:13px; font-weight:700;">${g.label}</h4>
        <div class="table-wrap">
            <table>
                <thead><tr><th>#</th><th>${t('results.table.time', lang)}</th><th>${t('results.table.status', lang)}</th><th>${t('chart.tooltip.medianRank', lang)}</th><th>ln(t)</th><th>Y</th></tr></thead>
                <tbody>${buildDataRows(g.result)}</tbody>
            </table>
        </div>
    </div>`;
}).join('')}
</div>
</div>
</div>
</div>

${aiAnalysis ? `<div class="section"><h2>${lang === 'zh' ? 'AI 分析' : 'AI Analysis'}</h2><div class="ai-box">${colorizeText(aiAnalysis.replace(/\n/g, '<br>'))}</div></div>` : ''}

<div class="section-footer">
${lang === 'zh' ? '本報告由凱益品管部產出' : 'This Report is Generated by Mouldex QC Department'}
</div>
${chartTypes.map(c => `<script type="application/json" id="${c.id.toLowerCase()}-data">${c.data}</script>
<script type="application/json" id="${c.id.toLowerCase()}-layout">${c.layout}</script>
${c.labels ? `<script type="application/json" id="${c.id.toLowerCase()}-labels">${JSON.stringify(c.labels)}</script>` : ''}`).join('\n')}
<script>
(function(){var ids=${JSON.stringify(chartTypes.map(c => c.id.toLowerCase()))};
var charts={};ids.forEach(function(id){var data,layout;try{data=JSON.parse(document.getElementById(id+'-data').textContent)}catch(e){}
try{layout=JSON.parse(document.getElementById(id+'-layout').textContent)}catch(e){}
if(data&&data.length)charts[id]={data:data,layout:layout,labels:[]};
try{var lb=document.getElementById(id+'-labels');if(lb)charts[id].labels=JSON.parse(lb.textContent)}catch(e){}});
var gds={},drag=null,offsets={};
function posAll(){for(var id in gds){var gd=gds[id];if(!gd||!gd._fullLayout||!gd._fullLayout.xaxis)continue;
var xa=gd._fullLayout.xaxis,ya=gd._fullLayout.yaxis,lb=charts[id].labels;
for(var i=0;i<lb.length;i++){var d=lb[i],el=document.getElementById('ol-'+d.id);
if(!el)continue;var px,py;
try{px=xa._offset+xa.d2p(d.dataX);py=ya._offset+ya.d2p(d.dataY)}catch(e){continue}
if(!isFinite(px)||!isFinite(py))continue;
var o=offsets[d.id]||{x:0,y:0},bx=px+12,by=py-12;
el.dataset.baseX=bx;el.dataset.baseY=by;el.style.left=(bx+o.x)+'px';el.style.top=(by+o.y)+'px';}}}
function showFallback(id){var fb=document.getElementById(id+'-fallback');if(fb)fb.style.display='block';var cont=document.getElementById(id+'-chart');if(cont)cont.style.display='none';}
function initChart(id){var fb=document.getElementById(id+'-fallback');if(fb)fb.style.display='none';
var cont=document.getElementById(id+'-chart');if(!cont||!charts[id])return;
Plotly.newPlot(cont,charts[id].data,Object.assign({},charts[id].layout,{autosize:true}),{responsive:true,displayModeBar:false,displaylogo:false}).then(function(g){gds[id]=g;posAll();g.on('plotly_relayout',posAll);}).catch(function(){showFallback(id);});}
function tryInit(){if(typeof Plotly==='undefined')return;ids.forEach(initChart);}
if(typeof Plotly!=='undefined'){tryInit()}else{var s=document.createElement('script');s.src='https://cdn.plot.ly/plotly-3.3.1.min.js';s.async=true;s.onload=tryInit;s.onerror=function(){ids.forEach(showFallback);};document.head.appendChild(s);}
document.addEventListener('mousedown',function(e){var el=e.target.closest('.chart-label');if(!el)return;e.preventDefault();var id=el.id.replace('ol-','');
drag={id:id,startMX:e.clientX,startMY:e.clientY,baseLeft:parseFloat(el.style.left)||0,baseTop:parseFloat(el.style.top)||0};});
document.addEventListener('mousemove',function(e){if(!drag)return;var el=document.getElementById('ol-'+drag.id);if(!el)return;
el.style.left=(drag.baseLeft+e.clientX-drag.startMX)+'px';el.style.top=(drag.baseTop+e.clientY-drag.startMY)+'px';});
document.addEventListener('mouseup',function(){if(!drag)return;var el=document.getElementById('ol-'+drag.id);
if(el){var bx=parseFloat(el.dataset.baseX||'0'),by=parseFloat(el.dataset.baseY||'0');
var cx=parseFloat(el.style.left)||0,cy=parseFloat(el.style.top)||0;offsets[drag.id]={x:cx-bx,y:cy-by};}
drag=null;});})();
</script>
</body>
</html>`;
        const blob = new Blob([reportHTML], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Weibull_Report_${new Date().toISOString().slice(0, 10)}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const CustomLegend = () => (
        <div className="absolute top-4 left-0 right-0 flex flex-wrap justify-center items-center gap-3 z-10 pointer-events-none select-none px-4">
            {effectiveGroups.map((g) => {
                if (!g.result) return null;
                return (
                    <button
                        key={g.id}
                        onClick={() => {
                            if (onToggleVisibility) {
                                onToggleVisibility(g.id);
                            } else {
                                setVisibleGroups(v => g.id === 'g1' ? { ...v, g1: !v.g1 } : { ...v, g2: !v.g2 });
                            }
                        }}
                        className="pointer-events-auto flex items-center space-x-2 px-3 py-1 rounded-full backdrop-blur-sm shadow-sm transition-all cursor-pointer hover:scale-105"
                        style={{
                            backgroundColor: 'color-mix(in srgb, var(--bg-surface) 75%, transparent)',
                            border: `1.5px solid ${g.visible ? g.color : 'var(--border)'}`,
                            opacity: g.visible ? 1 : 0.4
                        }}
                    >
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: g.color }}></div>
                        <span className="text-xs font-bold truncate max-w-[120px]" style={{ color: 'var(--text-primary)' }}>{g.label}</span>
                        <span className="text-[9px] font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded-full shrink-0" style={{ color: 'var(--text-secondary)', border: '1px solid color-mix(in srgb, var(--border) 60%, transparent)' }}>
                            {getFailureModeBadge(g.result.beta)}
                        </span>
                    </button>
                );
            })}
        </div>
    );

    if (effectiveGroups.filter(g => g.result !== null).length === 0) return (
        <div className="w-full h-full flex flex-col items-center justify-center space-y-4" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-surface)' }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center opacity-40" style={{ backgroundColor: 'color-mix(in srgb, var(--text-secondary) 15%, transparent)' }}>
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
            </div>
            <p>{t('results.ai.awaitingSub', lang)}</p>
        </div>
    );

    return (
        <div className="w-full flex flex-col h-full relative transition-colors duration-300" style={{ backgroundColor: 'var(--bg-surface)' }}>
            {/* Integrated Toolbar */}
            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3.5 z-20 gap-2 transition-colors duration-200" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                <div className="flex items-center justify-between w-full sm:w-auto space-x-2 sm:space-x-6">
                    <h3 className="text-sm sm:text-lg font-bold tracking-tight shrink-0" style={{ color: 'var(--text-primary)' }}>
                        {chartType === 'PROBABILITY' ? (lang === 'zh' ? '機率圖' : 'Probability Plot') : (chartType === 'RELIABILITY' ? (lang === 'zh' ? '可靠度曲線' : 'Reliability Curve') : (lang === 'zh' ? '機率密度' : 'Probability Density'))}
                    </h3>

                    <div className="flex p-0.5 sm:p-1 rounded-lg border" style={{ backgroundColor: 'var(--bg-app)', borderColor: 'var(--border)' }}>
                        {[
                            { id: 'PROBABILITY', label: lang === 'zh' ? '機率' : 'Prob' },
                            { id: 'RELIABILITY', label: lang === 'zh' ? '可靠度' : 'Rel' },
                            { id: 'PDF', label: 'PDF' }
                        ].map(type => (
                            <button
                                key={type.id}
                                onClick={() => setChartType(type.id as ChartType)}
                                className={`px-2.5 sm:px-4 py-1 text-xs sm:text-sm font-bold rounded-md transition-all cursor-pointer min-h-[36px] sm:min-h-0 ${chartType === type.id
                                    ? 'shadow-sm'
                                    : ''
                                    }`}
                                style={chartType === type.id ? { backgroundColor: 'var(--bg-surface)', color: 'var(--accent)' } : { color: 'var(--text-secondary)' }}
                            >
                                {type.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-between w-full sm:w-auto space-x-2 sm:space-x-4 pt-1 sm:pt-0 border-t sm:border-t-0" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center rounded-lg p-0.5 border" style={{ backgroundColor: 'var(--bg-app)', borderColor: 'var(--border)' }}>
                        <button
                            onClick={() => setInteractionMode('ZOOM')}
                            className={`p-1.5 rounded-md transition-all cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center ${interactionMode === 'ZOOM' ? 'shadow-sm' : ''}`}
                            style={interactionMode === 'ZOOM' ? { backgroundColor: 'var(--bg-surface)', color: 'var(--accent)' } : { color: 'var(--text-secondary)' }}
                            title="Zoom Mode"
                        >
                            <MagnifyingGlassPlusIcon className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setInteractionMode('PAN')}
                            className={`p-1.5 rounded-md transition-all cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center ${interactionMode === 'PAN' ? 'shadow-sm' : ''}`}
                            style={interactionMode === 'PAN' ? { backgroundColor: 'var(--bg-surface)', color: 'var(--accent)' } : { color: 'var(--text-secondary)' }}
                            title="Pan Mode"
                        >
                            <HandRaisedIcon className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="hidden sm:flex items-center space-x-1 text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                        <ArrowPathIcon className="w-3.5 h-3.5" />
                        <span>Interactive Plotly</span>
                    </div>

                    <button
                        onClick={generateHTMLReport}
                        disabled={effectiveGroups.filter(g => g.result !== null).length === 0}
                        className="flex items-center space-x-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm active:scale-95"
                        style={{ color: 'var(--accent)', borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)', backgroundColor: 'color-mix(in srgb, var(--accent) 8%, transparent)' }}
                        title={lang === 'zh' ? '生成 HTML 報告' : 'Generate HTML Report'}
                    >
                        <DocumentTextIcon className="w-4 h-4" />
                        <span>{lang === 'zh' ? '導出報告' : 'Report'}</span>
                    </button>
                </div>
            </div>

            <div ref={plotRef} className="flex-1 w-full relative transition-colors duration-200 overflow-hidden flex items-center justify-center p-1 sm:p-2">
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
                    style={{ width: '100%', height: '100%', maxHeight: 'calc(100vh - 170px)' }}
                    onClick={(data) => {
                        if (data.points && data.points.length > 0) {
                            setModalData({ time: data.points[0].x as number });
                        }
                    }}
                    onInitialized={(fig, gd) => { graphRef.current = gd; }}
                />
                {chartType === 'RELIABILITY' && labelDefs.map(def => (
                    <div key={def.id} id={def.id}
                        className="absolute px-2 py-0.5 rounded font-semibold whitespace-nowrap cursor-grab select-none"
                        style={{
                            color: def.color,
                            backgroundColor: 'rgba(255,255,255,0.94)',
                            border: `1px solid ${def.color}`,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                            pointerEvents: 'auto',
                            zIndex: 10,
                            fontSize: FS.label,
                            left: 0, top: 0
                        }}
                        onMouseDown={(e) => handleLabelMouseDown(e, def.id)}
                    >
                        {def.text}
                    </div>
                ))}
            </div>

            <div className="flex-none px-3 sm:px-4 py-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1" style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-5 gap-y-0.5 min-w-0">
                    {effectiveGroups.filter(g => g.visible && g.result).map(g => {
                        const r = g.result!;
                        const fN = r.dataPoints.filter(p => p.status === 'F').length;
                        const sN = r.dataPoints.filter(p => p.status === 'S').length;
                        return (
                            <span key={g.id} className="flex items-center gap-1.5 whitespace-nowrap" style={{ color: 'var(--text-secondary)', fontSize: FS.stat }}>
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: g.color }}></span>
                                <span className="font-bold" style={{ color: g.color }}>{g.label}</span>
                                <span className="font-mono">β={r.beta.toFixed(3)}</span>
                                <span className="font-mono">η={r.eta.toFixed(2)}</span>
                                <span className="font-mono">MTTF={r.mttf.toFixed(1)}</span>
                                <span className="font-mono">R²={r.rSquared.toFixed(4)}</span>
                                <span className="font-mono">N={r.dataPoints.length} (F{fN}/S{sN})</span>
                            </span>
                        );
                    })}
                </div>
            </div>

            {modalData && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-4 animate-scaleIn" style={{ backgroundColor: 'color-mix(in srgb, #0F172A 50%, transparent)' }}>
                    <div className="absolute inset-0" onClick={() => setModalData(null)}></div>
                    <div className="relative rounded-xl shadow-2xl p-6 w-full max-w-lg animate-slideUp" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                        <button onClick={() => setModalData(null)} className="absolute top-4 right-4 p-1 rounded-full transition-colors" style={{ color: 'var(--text-secondary)' }}><XMarkIcon className="w-5 h-5" /></button>
                        <h4 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{t('results.pointStats', lang)}</h4>
                        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>{t('results.atTime', lang)} <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{modalData.time.toFixed(2)}</span></p>

                        <div className="space-y-4 overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="font-bold border-b" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                                    <tr>
                                        <th className="py-2">Metric</th>
                                        {effectiveGroups.map(g => g.visible && g.result && (
                                            <th key={g.id} className="py-2 px-3 text-right" style={{ color: g.color }}>{g.label}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="font-mono text-xs">
                                    {[
                                        { label: t('chart.tooltip.reliability', lang), key: 'reliability' as const, fmt: (v: number) => v.toFixed(4) },
                                        { label: t('chart.tooltip.cdf', lang), key: 'cdf' as const, fmt: (v: number) => (v * 100).toFixed(2) + '%' },
                                        { label: t('chart.tooltip.pdf', lang), key: 'pdf' as const, fmt: (v: number) => v.toExponential(3) },
                                        { label: t('chart.tooltip.hazard', lang), key: 'hazard' as const, fmt: (v: number) => v.toExponential(3) }
                                    ].map(row => (
                                        <tr key={row.key} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td className="py-2 font-sans font-medium" style={{ color: 'var(--text-secondary)' }}>{row.label}</td>
                                            {effectiveGroups.map(g => {
                                                if (!g.visible || !g.result) return null;
                                                const m = calculateMetrics(modalData.time, g.result.beta, g.result.eta);
                                                return (
                                                    <td key={g.id} className="py-2 px-3 text-right font-bold" style={{ color: g.color }}>
                                                        {row.fmt(m[row.key])}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WeibullChart;