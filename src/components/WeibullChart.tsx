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
import { WeibullResult, ChartType, Language } from '../types';
import { t } from '../utils/locales';

interface WeibullChartProps {
    result1: WeibullResult | null;
    result2: WeibullResult | null;
    label1?: string;
    label2?: string;
    lang: Language;
    aiAnalysis?: string | null;
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
    aiAnalysis
}) => {
    const plotRef = useRef<HTMLDivElement>(null);
    const [chartType, setChartType] = useState<ChartType>('PROBABILITY');
    const [modalData, setModalData] = useState<{ time: number } | null>(null);
    const [visibleGroups, setVisibleGroups] = useState<{ g1: boolean, g2: boolean }>({ g1: true, g2: true });
    const [interactionMode, setInteractionMode] = useState<'ZOOM' | 'PAN'>('ZOOM');

    // --- Draggable label refs (zero React state during drag) ---
    const graphRef = useRef<any>(null);
    const labelOffsetsRef = useRef<Map<string, {x: number; y: number}>>(new Map());
    const dragRef = useRef<{active: boolean; id: string; startMX: number; startMY: number; baseLeft: number; baseTop: number} | null>(null);

    const gridColor = 'rgba(0,0,0,0.06)';
    const axisColor = '#94a3b8';
    const axisTextColor = '#6B7280';
    const bgColor = '#ffffff';
    const plotBgColor = 'transparent';

    const colorA = '#4f46e5';
    const colorB = '#e11d48';

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

    // --- Draggable HTML overlay labels (Reliability chart: R=0.95 + Eta markers) ---
    const labelDefs = useMemo(() => {
        const defs: { id: string; dataX: number; dataY: number; text: string; color: string }[] = [];
        if (chartType !== 'RELIABILITY') return defs;
        const rEta = Math.exp(-1);
        if (visibleGroups.g1 && result1) {
            const t_095 = result1.eta * Math.pow(-Math.log(0.95), 1 / result1.beta);
            defs.push({ id: 'r095-1', dataX: t_095, dataY: 0.95, text: `R=0.95 @ t=${t_095.toFixed(2)}`, color: colorA });
            defs.push({ id: 'eta-1', dataX: result1.eta, dataY: rEta, text: `R(η)=e⁻¹≈${rEta.toFixed(4)} @ η=${result1.eta.toFixed(2)}`, color: colorA });
        }
        if (visibleGroups.g2 && result2) {
            const t_095 = result2.eta * Math.pow(-Math.log(0.95), 1 / result2.beta);
            defs.push({ id: 'r095-2', dataX: t_095, dataY: 0.95, text: `R=0.95 @ t=${t_095.toFixed(2)}`, color: colorB });
            defs.push({ id: 'eta-2', dataX: result2.eta, dataY: rEta, text: `R(η)=e⁻¹≈${rEta.toFixed(4)} @ η=${result2.eta.toFixed(2)}`, color: colorB });
        }
        return defs;
    }, [chartType, result1, result2, visibleGroups, colorA, colorB]);

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

        // R(0.95) coordinate markers for Reliability chart (text removed → HTML overlay)
        if (chartType === 'RELIABILITY') {
            if (visibleGroups.g1 && result1) {
                const t_095 = result1.eta * Math.pow(-Math.log(0.95), 1 / result1.beta);
                traces.push({
                    x: [t_095], y: [0.95],
                    mode: 'markers',
                    marker: { color: 'white', size: 14, line: { color: colorA, width: 2.5 }, symbol: 'circle' },
                    showlegend: false, hoverinfo: 'none'
                });
            }
            if (visibleGroups.g2 && result2) {
                const t_095 = result2.eta * Math.pow(-Math.log(0.95), 1 / result2.beta);
                traces.push({
                    x: [t_095], y: [0.95],
                    mode: 'markers',
                    marker: { color: 'white', size: 14, line: { color: colorB, width: 2.5 }, symbol: 'circle' },
                    showlegend: false, hoverinfo: 'none'
                });
            }

            const rEta = Math.exp(-1);
            if (visibleGroups.g1 && result1) {
                const eta = result1.eta;
                traces.push({
                    x: [eta], y: [rEta],
                    mode: 'markers',
                    marker: { color: 'white', size: 14, line: { color: colorA, width: 2.5 }, symbol: 'diamond' },
                    showlegend: false, hoverinfo: 'none'
                });
            }
            if (visibleGroups.g2 && result2) {
                const eta = result2.eta;
                traces.push({
                    x: [eta], y: [rEta],
                    mode: 'markers',
                    marker: { color: 'white', size: 14, line: { color: colorB, width: 2.5 }, symbol: 'diamond' },
                    showlegend: false, hoverinfo: 'none'
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
            font: { family: 'Inter, sans-serif', size: 13, color: axisTextColor },
            hovermode: 'closest',
            dragmode: interactionMode === 'ZOOM' ? 'zoom' : 'pan',
            xaxis: {
                title: { text: 'Time-to-Failure (t)', font: { size: 13, weight: 800 } },
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
            layout.yaxis.title = { text: 'Unreliability F(t) %', font: { size: 13, weight: 800 } };
            layout.yaxis.ticktext = probTicks.map(p => p < 1 ? p.toFixed(1) + '%' : p + '%');
            layout.yaxis.tickvals = probTicks.map(p => Math.log(-Math.log(1 - p / 100)));
        } else {
            layout.yaxis.title = { text: chartType === 'RELIABILITY' ? 'Reliability R(t)' : 'Probability Density f(t)', font: { size: 13, weight: 800 } };
            if (chartType === 'RELIABILITY') layout.yaxis.range = [0, 1.05];
        }

        // R(0.95) dashed reference lines for Reliability chart
        layout.shapes = [];
        layout.annotations = [];
        if (chartType === 'RELIABILITY') {
            if (visibleGroups.g1 && result1) {
                const t_095 = result1.eta * Math.pow(-Math.log(0.95), 1 / result1.beta);
                layout.shapes.push(
                    { type: 'line', xref: 'x', yref: 'y', x0: 0, y0: 0.95, x1: t_095, y1: 0.95, line: { color: `${colorA}80`, width: 1.5, dash: 'dash' } },
                    { type: 'line', xref: 'x', yref: 'y', x0: t_095, y0: 0, x1: t_095, y1: 0.95, line: { color: `${colorA}80`, width: 1.5, dash: 'dash' } }
                );
            }
            if (visibleGroups.g2 && result2) {
                const t_095 = result2.eta * Math.pow(-Math.log(0.95), 1 / result2.beta);
                layout.shapes.push(
                    { type: 'line', xref: 'x', yref: 'y', x0: 0, y0: 0.95, x1: t_095, y1: 0.95, line: { color: `${colorB}80`, width: 1.5, dash: 'dash' } },
                    { type: 'line', xref: 'x', yref: 'y', x0: t_095, y0: 0, x1: t_095, y1: 0.95, line: { color: `${colorB}80`, width: 1.5, dash: 'dash' } }
                );
            }

            // Eta reference lines
            const rEta = Math.exp(-1);
            if (visibleGroups.g1 && result1) {
                const eta = result1.eta;
                layout.shapes.push(
                    { type: 'line', xref: 'x', yref: 'y', x0: 0, y0: rEta, x1: eta, y1: rEta, line: { color: `${colorA}80`, width: 1.5, dash: 'dot' } },
                    { type: 'line', xref: 'x', yref: 'y', x0: eta, y0: 0, x1: eta, y1: rEta, line: { color: `${colorA}80`, width: 1.5, dash: 'dot' } }
                );
            }
            if (visibleGroups.g2 && result2) {
                const eta = result2.eta;
                layout.shapes.push(
                    { type: 'line', xref: 'x', yref: 'y', x0: 0, y0: rEta, x1: eta, y1: rEta, line: { color: `${colorB}80`, width: 1.5, dash: 'dot' } },
                    { type: 'line', xref: 'x', yref: 'y', x0: eta, y0: 0, x1: eta, y1: rEta, line: { color: `${colorB}80`, width: 1.5, dash: 'dot' } }
                );
            }

            // Weibull formula annotation with actual values
            const formulaLines: string[] = [];
            if (result1) {
                formulaLines.push(`${name1}: R(t) = e<sup>-(t/${result1.eta.toFixed(2)})<sup>${result1.beta.toFixed(4)}</sup></sup>`);
            }
            if (result2) {
                formulaLines.push(`${name2}: R(t) = e<sup>-(t/${result2.eta.toFixed(2)})<sup>${result2.beta.toFixed(4)}</sup></sup>`);
            }
            if (formulaLines.length > 0) {
                layout.annotations.push({
                    text: formulaLines.join('<br>'),
                    xref: 'paper', yref: 'paper',
                    x: 0.98, y: 0.98,
                    showarrow: false,
                    font: { size: 18, color: axisTextColor, weight: 'bold' },
                    align: 'left',
                    bgcolor: 'rgba(255,255,255,0.85)',
                    bordercolor: axisColor,
                    borderwidth: 1,
                    borderpad: 6
                });
            }
        }

        return layout;
    }, [chartType, interactionMode, gridColor, axisColor, axisTextColor, plotBgColor, result1, result2, visibleGroups, colorA, colorB]);

    const generateHTMLReport = async () => {
        if (!result1) return;
        const isDualMode = !!result1 && !!result2;
        const bg = '#ffffff', gridC = 'rgba(0,0,0,0.1)', axisC = '#475569';

        const captureChart = async (type: ChartType): Promise<string> => {
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
                        hovertemplate: `<b>${nm}</b><br>Time: %{x:.2f}<br>Unreliability: %{customdata:.2f}%<extra></extra>`,
                        customdata: failPts.map(p => p.rank * 100)
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
            if (result1) addGroupTraces(result1, colorA, name1);
            if (result2) addGroupTraces(result2, colorB, name2);

            // R(0.95) reference markers for Reliability chart
            if (type === 'RELIABILITY') {
                const addR095 = (r: WeibullResult, clr: string, nm: string) => {
                    const t_095 = r.eta * Math.pow(-Math.log(0.95), 1 / r.beta);
                    traces.push({
                        x: [t_095], y: [0.95], mode: 'markers+text',
                        marker: { color: bg, size: 16, line: { color: clr, width: 2.5 }, symbol: 'circle' },
                        text: `R=0.95 @ t=${t_095.toFixed(2)}`,
                        textfont: { color: clr, size: 22, weight: 'bold' }, textposition: 'middle right',
                        showlegend: false, hoverinfo: 'none'
                    });
                };
                if (result1) addR095(result1, colorA, name1);
                if (result2) addR095(result2, colorB, name2);

                // Eta markers
                const rEta = Math.exp(-1);
                const addEtaMarker = (r: WeibullResult, clr: string) => {
                    traces.push({
                        x: [r.eta], y: [rEta], mode: 'markers+text',
                        marker: { color: bg, size: 16, line: { color: clr, width: 2.5 }, symbol: 'diamond' },
                        text: `R(η)=e⁻¹≈${rEta.toFixed(4)} @ η=${r.eta.toFixed(2)}`,
                        textfont: { color: clr, size: 22, weight: 'bold' }, textposition: 'middle right',
                        showlegend: false, hoverinfo: 'none'
                    });
                };
                if (result1) addEtaMarker(result1, colorA);
                if (result2) addEtaMarker(result2, colorB);
            }

            const layout: any = {
                paper_bgcolor: bg, plot_bgcolor: 'transparent',
                font: { family: 'Inter, sans-serif', size: 21, color: axisC },
                hovermode: 'closest', margin: { l: 80, r: 55, t: 65, b: 80 }, showlegend: false,
                xaxis: { title: { text: 'Time-to-Failure (t)', font: { size: 22, weight: 700 } }, gridcolor: gridC, linecolor: axisC, zeroline: false, tickfont: { size: 18, weight: 700 } },
                yaxis: { title: { font: { size: 22, weight: 700 } }, gridcolor: gridC, linecolor: axisC, zeroline: false, tickfont: { size: 18, weight: 700 } }
            };
            if (type === 'PROBABILITY') {
                const probTicks = [0.1, 0.5, 1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99];
                layout.yaxis.title = { text: 'Unreliability F(t) %' };
                layout.yaxis.ticktext = probTicks.map(p => p < 1 ? p.toFixed(1) + '%' : p + '%');
                layout.yaxis.tickvals = probTicks.map(p => Math.log(-Math.log(1 - p / 100)));
                layout.xaxis.type = 'log';
            } else if (type === 'RELIABILITY') {
                layout.yaxis.title = { text: 'Reliability R(t)' };
                layout.yaxis.range = [0, 1.05];
                layout.shapes = [];
                layout.annotations = [];
                const addRefLine = (r: WeibullResult, clr: string) => {
                    const t_095 = r.eta * Math.pow(-Math.log(0.95), 1 / r.beta);
                    layout.shapes.push(
                        { type: 'line', xref: 'x', yref: 'y', x0: 0, y0: 0.95, x1: t_095, y1: 0.95, line: { color: `${clr}80`, width: 1.5, dash: 'dash' } },
                        { type: 'line', xref: 'x', yref: 'y', x0: t_095, y0: 0, x1: t_095, y1: 0.95, line: { color: `${clr}80`, width: 1.5, dash: 'dash' } }
                    );
                    // Eta reference lines
                    const rEta = Math.exp(-1);
                    layout.shapes.push(
                        { type: 'line', xref: 'x', yref: 'y', x0: 0, y0: rEta, x1: r.eta, y1: rEta, line: { color: `${clr}80`, width: 1.5, dash: 'dot' } },
                        { type: 'line', xref: 'x', yref: 'y', x0: r.eta, y0: 0, x1: r.eta, y1: rEta, line: { color: `${clr}80`, width: 1.5, dash: 'dot' } }
                    );
                };
                if (result1) addRefLine(result1, colorA);
                if (result2) addRefLine(result2, colorB);

                // Formula annotation
                const formulaLines: string[] = [];
                if (result1) {
                    formulaLines.push(`${name1}: R(t) = e<sup>-(t/${result1.eta.toFixed(2)})<sup>${result1.beta.toFixed(4)}</sup></sup>`);
                }
                if (result2) {
                    formulaLines.push(`${name2}: R(t) = e<sup>-(t/${result2.eta.toFixed(2)})<sup>${result2.beta.toFixed(4)}</sup></sup>`);
                }
                if (formulaLines.length > 0) {
                    layout.annotations.push({
                        text: formulaLines.join('<br>'),
                        xref: 'paper', yref: 'paper',
                    x: 0.98, y: 0.98,
                        showarrow: false,
                        font: { size: 28, color: axisC, weight: 'bold' },
                        align: 'left',
                        bgcolor: 'rgba(255,255,255,0.85)',
                        bordercolor: '#475569',
                        borderwidth: 1,
                        borderpad: 6
                    });
                }
            } else {
                layout.yaxis.title = { text: 'Probability Density f(t)' };
            }

            const div = document.createElement('div');
            div.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:900px;height:600px';
            document.body.appendChild(div);
            await Plotly.newPlot(div, traces, layout, { responsive: false });
            await new Promise(r => setTimeout(r, 200));
            const url = await Plotly.toImage(div, { format: 'png', width: 900, height: 600, scale: 2 });
            Plotly.purge(div);
            document.body.removeChild(div);
            return url;
        };

        const [probImg, relImg, pdfImg] = await Promise.all([
            captureChart('PROBABILITY').catch(() => ''),
            captureChart('RELIABILITY').catch(() => ''),
            captureChart('PDF').catch(() => '')
        ]);

        const ts = new Date().toLocaleString('zh-TW', { dateStyle: 'long', timeStyle: 'short' });
        const n1 = name1, n2 = name2;
        const r1 = result1, r2 = result2;
        const getFM = (b: number) => b < 0.9 ? 'Infant Mortality 早夭期' : b <= 1.1 ? 'Random Failures 隨機失效' : 'Wear-out 耗損期';
        const getFMShort = (b: number) => b < 0.9 ? 'infant' : b <= 1.1 ? 'random' : 'wear';

        const buildDataRows = (r: WeibullResult) => {
            const weibullTrans = (p: number) => Math.log(-Math.log(1 - p / 100));
            return r.dataPoints.map(p => {
                const rankStr = p.status === 'F' ? (p.rank * 100).toFixed(4) + '%' : '-';
                const xStr = p.x.toFixed(4);
                const yStr = p.status === 'F' ? p.y.toFixed(4) : '-';
                return `<tr><td>${p.id + 1}</td><td>${p.time.toFixed(2)}</td><td>${p.status}</td><td>${rankStr}</td><td class="mono">${xStr}</td><td class="mono">${yStr}</td></tr>`;
            }).join('');
        };
        const rows1 = buildDataRows(r1);
        const rows2 = r2 ? buildDataRows(r2) : '';

        const colorizeText = (txt: string) =>
            txt.replace(/([\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]+)/g, '<span class="zh">$1</span>');
        const aiHtml = aiAnalysis ? `<div class="section"><h2>AI 分析 &bull; AI Analysis</h2><div class="ai-box">${colorizeText(aiAnalysis.replace(/\n/g, '<br>'))}</div></div>` : '';
        const modeLabel = isDualMode ? '雙組比較 Comparative' : '單組分析 Single';
        const metricCard = (lbl: string, enLbl: string, val: string, sub: string, fm?: number) =>
            `<div class="metric-card"><div class="label">${lbl}<br>${enLbl}</div><div class="value">${val}</div><div class="sub">${fm !== undefined ? sub : sub}</div></div>`;

        const reportHTML = `<!DOCTYPE html>
<html lang="zh-TW">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Weibull Analysis Report 韋伯分析報告</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans TC',sans-serif;color:#111827;background:#F9FAFB;padding:16px 20px;max-width:100%;margin:0;-webkit-font-smoothing:antialiased}
h1{font-size:24px;font-weight:800;color:#111827;margin-bottom:2px;letter-spacing:-.02em}
.sub{color:#6B7280;font-size:13px;margin-bottom:20px}
.section{margin-bottom:24px}
.section h2{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6B7280;border-bottom:1.5px solid #E5E7EB;padding-bottom:5px;margin-bottom:12px}
.chart-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.chart-cell{display:flex;flex-direction:column}
.chart-caption{font-size:13px;font-weight:600;color:#6B7280;margin-top:6px;letter-spacing:.02em;text-align:center}
.chart-img{width:100%;border-radius:8px;border:1px solid #E5E7EB;box-shadow:0 2px 8px rgba(0,0,0,.05)}
table{width:100%;border-collapse:collapse;font-size:13px}
th{background:#F3F4F6;color:#6B7280;font-weight:700;text-align:left;padding:6px 10px;border-bottom:1.5px solid #D1D5DB;white-space:nowrap;text-transform:uppercase;letter-spacing:.03em;font-size:13px}
td{padding:5px 10px;border-bottom:1px solid #E5E7EB;color:#374151}
tbody tr:nth-child(even){background:#F9FAFB}
.mono{font-family:'SF Mono',Consolas,'Noto Sans Mono',monospace;font-size:13px;font-weight:600;color:#6B7280}
.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.metric-card{background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;padding:10px 12px}
.metric-card .label{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:#6B7280;margin-bottom:3px;line-height:1.3}
.metric-card .value{font-size:20px;font-weight:800;color:#111827;font-family:'SF Mono',Consolas,'Noto Sans TC',monospace;letter-spacing:-.02em}
.metric-card .sub{font-size:13px;font-weight:500;color:#6B7280;margin-top:3px;line-height:1.3}
.ai-box{background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:14px 16px;font-size:13px;line-height:1.7;color:#374151}
.ai-box .zh{color:#1D4ED8;font-weight:500}
.summary-box{background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;padding:12px 14px;font-size:13px;line-height:1.7}
.summary-box strong{color:#111827;font-size:14px}
.summary-box .val{font-family:'SF Mono',Consolas,'Noto Sans Mono',monospace;font-weight:700;color:#3B82F6}
.dual-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.table-wrap{overflow-x:auto;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden}
.table-wrap table{border:none}
.section-footer{margin-top:20px;padding-top:16px;border-top:1.5px solid #E5E7EB;font-size:13px;color:#9CA3AF;text-align:center;letter-spacing:.02em}
/* dense horizontal layout: rows merge into columns where possible */
.info-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}
.info-row .left,.info-row .right{min-width:0}
.info-row.full{grid-template-columns:1fr}
@media(max-width:900px){body{padding:12px}.chart-grid{grid-template-columns:1fr;gap:10px}.metrics{grid-template-columns:repeat(2,1fr)}.info-row{grid-template-columns:1fr}.dual-grid{grid-template-columns:1fr;gap:10px}}
</style>
</head>
<body>
<h1>韋伯分析報告 &bull; Weibull Analysis Report</h1>
<p class="sub">產生時間 Generated: ${ts} &nbsp;|&nbsp; 分析模式 Mode: ${modeLabel}</p>

<!-- Charts: 3-up dense -->
<div class="section"><h2>圖表 &bull; Charts</h2><div class="chart-grid">
${probImg ? `<div class="chart-cell"><img class="chart-img" src="${probImg}" alt="Probability Plot"><span class="chart-caption">機率圖 Probability Plot</span></div>` : ''}
${relImg ? `<div class="chart-cell"><img class="chart-img" src="${relImg}" alt="Reliability Curve"><span class="chart-caption">可靠度曲線 Reliability Curve</span></div>` : ''}
${pdfImg ? `<div class="chart-cell"><img class="chart-img" src="${pdfImg}" alt="Probability Density"><span class="chart-caption">機率密度 Probability Density</span></div>` : ''}
</div></div>

<!-- Metrics + Summary side-by-side -->
<div class="info-row">
<div class="left">
<div class="section"><h2>指標 &bull; Metrics</h2>
${isDualMode && r1 && r2 ? `<div style="margin-bottom:12px"><div style="display:flex;gap:16px;margin-bottom:8px"><span style="font-size:12px;font-weight:700;color:#3B82F6">${n1}</span><span style="font-size:12px;font-weight:700;color:#EF4444">${n2}</span></div><div class="metrics" style="grid-template-columns:repeat(4,1fr)">
${metricCard('形狀 Shape β', '', r1.beta.toFixed(4) + ' / ' + r2.beta.toFixed(4), '', (r1.beta + r2.beta) / 2)}
${metricCard('尺度 Scale η', '', r1.eta.toFixed(2) + ' / ' + r2.eta.toFixed(2), '特徵壽命 Char. Life')}
${metricCard('平均 MTTF', '', r1.mttf.toFixed(2) + ' / ' + r2.mttf.toFixed(2), 'Mean Time To Failure')}
${metricCard('適配 R²', '', r1.rSquared.toFixed(4) + ' / ' + r2.rSquared.toFixed(4), r1.rSquared >= 0.9 && r2.rSquared >= 0.9 ? '良好 Good Fit' : '偏低 Poor Fit')}
</div></div>` : r1 ? `<div class="metrics">
${metricCard('形狀參數', 'Shape β', r1.beta.toFixed(4), '', r1.beta)}
${metricCard('尺度參數', 'Scale η', r1.eta.toFixed(4), '特徵壽命 Char. Life')}
${metricCard('平均壽命', 'MTTF', r1.mttf.toFixed(4), 'Mean Time To Failure')}
${metricCard('適配度', 'R²', r1.rSquared.toFixed(4), r1.rSquared >= 0.9 ? '適配良好 Good Fit' : '適配偏低 Poor Fit')}
</div>` : ''}
</div>
</div>
<div class="right">
<div class="section"><h2>摘要 &bull; Summary</h2>
${isDualMode && r1 && r2 ? `<div class="dual-grid" style="gap:10px"><div class="summary-box"><strong>${n1}<br></strong>
N: <span class="val">${r1.dataPoints.length}</span> &nbsp; F: <span class="val">${r1.dataPoints.filter(p => p.status === 'F').length}</span> &nbsp; S: <span class="val">${r1.dataPoints.filter(p => p.status === 'S').length}</span><br>
失效模式: <span class="val">${getFM(r1.beta)}</span> &nbsp; R²: <span class="val">${r1.rSquared.toFixed(4)}</span>
</div><div class="summary-box"><strong>${n2}<br></strong>
N: <span class="val">${r2.dataPoints.length}</span> &nbsp; F: <span class="val">${r2.dataPoints.filter(p => p.status === 'F').length}</span> &nbsp; S: <span class="val">${r2.dataPoints.filter(p => p.status === 'S').length}</span><br>
失效模式: <span class="val">${getFM(r2.beta)}</span> &nbsp; R²: <span class="val">${r2.rSquared.toFixed(4)}</span>
</div></div>` : r1 ? `<div class="summary-box"><strong>${n1}<br></strong>
N: <span class="val">${r1.dataPoints.length}</span> &nbsp; F: <span class="val">${r1.dataPoints.filter(p => p.status === 'F').length}</span> &nbsp; S: <span class="val">${r1.dataPoints.filter(p => p.status === 'S').length}</span><br>
失效模式: <span class="val">${getFM(r1.beta)}</span> &nbsp; R²: <span class="val">${r1.rSquared.toFixed(4)}</span>
</div>` : ''}
</div>
</div>
</div>

<!-- AI Analysis + Raw Data side-by-side -->
<div class="info-row${!aiAnalysis ? ' full' : ''}">
${aiAnalysis ? `<div class="left">
<div class="section"><h2>AI 分析 &bull; AI Analysis</h2><div class="ai-box">${colorizeText(aiAnalysis.replace(/\n/g, '<br>'))}</div></div>
</div>` : ''}
<div class="${aiAnalysis ? 'right' : 'left'}">
<div class="section"><h2>原始數據 &bull; Raw Data</h2>
${isDualMode && r1 && r2 ? `<div class="dual-grid" style="gap:10px"><div class="table-wrap"><table><thead><tr><th>#</th><th>Time</th><th>St</th><th>Median Rank</th><th>ln(t)</th><th>Y</th></tr></thead><tbody>${rows1}</tbody></table></div><div class="table-wrap"><table><thead><tr><th>#</th><th>Time</th><th>St</th><th>Median Rank</th><th>ln(t)</th><th>Y</th></tr></thead><tbody>${rows2}</tbody></table></div></div>` : `<div class="table-wrap"><table><thead><tr><th>#</th><th>Time</th><th>Status</th><th>Median Rank</th><th>ln(t)</th><th>Y</th></tr></thead><tbody>${rows1}</tbody></table></div>`}
</div>
</div>
</div>

<div class="section-footer">
本報告由凱益品管部產出 This Report is Generated by Mouldex QC Department
</div>
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
        <div className="absolute top-4 left-0 right-0 flex justify-center items-center space-x-12 z-10 pointer-events-none select-none">
            {visibleGroups.g1 && result1 && (
                <div className="flex items-center space-x-3 px-3 py-1 rounded-full backdrop-blur-sm shadow-sm" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-surface) 60%, transparent)', border: '1px solid var(--border)' }}>
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorA }}></div>
                    <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{name1}</span>
                    <span className="text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 rounded-full" style={{ color: 'var(--text-secondary)', border: '1px solid color-mix(in srgb, var(--border) 60%, transparent)' }}>
                        {getFailureModeBadge(result1.beta)}
                    </span>
                </div>
            )}
            {visibleGroups.g2 && result2 && (
                <div className="flex items-center space-x-3 px-3 py-1 rounded-full backdrop-blur-sm shadow-sm" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-surface) 60%, transparent)', border: '1px solid var(--border)' }}>
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorB }}></div>
                    <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{name2}</span>
                    <span className="text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 rounded-full" style={{ color: 'var(--text-secondary)', border: '1px solid color-mix(in srgb, var(--border) 60%, transparent)' }}>
                        {getFailureModeBadge(result2.beta)}
                    </span>
                </div>
            )}
        </div>
    );

    const StatRow = ({ label, val1, val2, unit = '' }: { label: string, val1: number, val2?: number, unit?: string }) => (
        <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
            <div className="flex space-x-6">
                <span className="font-mono font-semibold" style={{ color: 'var(--accent)' }}>{val1.toExponential(3)} {unit}</span>
                {val2 !== undefined && <span className="font-mono font-semibold" style={{ color: 'var(--error)' }}>{val2.toExponential(3)} {unit}</span>}
            </div>
        </div>
    );

    if (!result1) return (
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
            <div className="flex items-center justify-between px-6 py-4 z-20 transition-colors duration-200" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                <div className="flex items-center space-x-8">
                    <h3 className="text-lg font-bold tracking-tight shrink-0" style={{ color: 'var(--text-primary)' }}>
                        {chartType === 'PROBABILITY' ? 'Probability Plot' : (chartType === 'RELIABILITY' ? 'Reliability Curve' : 'Probability Density')}
                    </h3>

                    <div className="flex p-1 rounded-lg border" style={{ backgroundColor: 'var(--bg-app)', borderColor: 'var(--border)' }}>
                        {[
                            { id: 'PROBABILITY', label: 'Probability' },
                            { id: 'RELIABILITY', label: 'Reliability' },
                            { id: 'PDF', label: 'PDF' }
                        ].map(type => (
                            <button
                                key={type.id}
                                onClick={() => setChartType(type.id as ChartType)}
                                className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${chartType === type.id
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

                <div className="flex items-center space-x-4">
                    <div className="flex items-center rounded-lg p-1 border" style={{ backgroundColor: 'var(--bg-app)', borderColor: 'var(--border)' }}>
                        <button
                            onClick={() => setInteractionMode('ZOOM')}
                            className={`p-1.5 rounded-md transition-all ${interactionMode === 'ZOOM' ? 'shadow-sm' : ''}`}
                            style={interactionMode === 'ZOOM' ? { backgroundColor: 'var(--bg-surface)', color: 'var(--accent)' } : { color: 'var(--text-secondary)' }}
                        >
                            <MagnifyingGlassPlusIcon className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setInteractionMode('PAN')}
                            className={`p-1.5 rounded-md transition-all ${interactionMode === 'PAN' ? 'shadow-sm' : ''}`}
                            style={interactionMode === 'PAN' ? { backgroundColor: 'var(--bg-surface)', color: 'var(--accent)' } : { color: 'var(--text-secondary)' }}
                        >
                            <HandRaisedIcon className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex items-center space-x-1 text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                        <ArrowPathIcon className="w-3.5 h-3.5" />
                        <span>Interactive Plotly</span>
                    </div>

                    <button
                        onClick={generateHTMLReport}
                        disabled={!result1}
                        className="flex items-center space-x-1.5 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        style={{ color: 'var(--accent)' }}
                        title={lang === 'zh' ? '生成 HTML 報告' : 'Generate HTML Report'}
                    >
                        <DocumentTextIcon className="w-3.5 h-3.5" />
                        <span>Report</span>
                    </button>
                </div>
            </div>

            <div ref={plotRef} className="flex-1 w-full relative transition-colors duration-200 overflow-hidden">
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
                    onInitialized={(fig, gd) => { graphRef.current = gd; }}
                />
                {chartType === 'RELIABILITY' && labelDefs.map(def => (
                    <div key={def.id} id={def.id}
                        className="absolute px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap cursor-grab select-none"
                        style={{
                            color: def.color,
                            backgroundColor: 'rgba(255,255,255,0.92)',
                            border: `1px solid ${def.color}`,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                            pointerEvents: 'auto',
                            zIndex: 10,
                            fontSize: 13,
                            left: 0, top: 0
                        }}
                        onMouseDown={(e) => handleLabelMouseDown(e, def.id)}
                    >
                        {def.text}
                    </div>
                ))}
            </div>

            <div className="flex-none px-4 py-1.5 text-[9px] text-right uppercase tracking-widest font-bold" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
                Developed by Wesley Chang @ Mouldex, Jan-2026. All rights reserved.
            </div>

            {modalData && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-4 animate-scaleIn" style={{ backgroundColor: 'color-mix(in srgb, #0F172A 50%, transparent)' }}>
                    <div className="absolute inset-0" onClick={() => setModalData(null)}></div>
                    <div className="relative rounded-xl shadow-2xl p-6 w-full max-w-lg animate-slideUp" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                        <button onClick={() => setModalData(null)} className="absolute top-4 right-4 p-1 rounded-full transition-colors" style={{ color: 'var(--text-secondary)' }}><XMarkIcon className="w-5 h-5" /></button>
                        <h4 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Point Statistics</h4>
                        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>At Time t = <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{modalData.time.toFixed(2)}</span></p>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm font-bold uppercase tracking-widest pb-3" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                                <span>Metric</span>
                                <div className="flex space-x-10">
                                    <span style={{ color: 'var(--accent)' }}>{name1}</span>
                                    {result2 && <span style={{ color: 'var(--error)' }}>{name2}</span>}
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