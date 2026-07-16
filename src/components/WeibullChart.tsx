import React, { useState, useEffect, useMemo, useRef } from 'react';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js-dist-min';
import {
    XMarkIcon,
    ArrowPathIcon,
    MagnifyingGlassPlusIcon,
    HandRaisedIcon,
    DocumentTextIcon
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
    theme,
    aiAnalysis
}) => {
    const plotRef = useRef<HTMLDivElement>(null);
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

        // R(0.95) coordinate markers for Reliability chart
        if (chartType === 'RELIABILITY') {
            if (visibleGroups.g1 && result1) {
                const t_095 = result1.eta * Math.pow(-Math.log(0.95), 1 / result1.beta);
                traces.push({
                    x: [t_095],
                    y: [0.95],
                    mode: 'markers+text',
                    marker: { color: 'white', size: 14, line: { color: colorA, width: 2.5 }, symbol: 'circle' },
                    text: `R(0.95) @ t=${t_095.toFixed(2)}`,
                    textfont: { color: colorA, size: 11, weight: 'bold' },
                    textposition: 'top center',
                    showlegend: false,
                    hoverinfo: 'none'
                });
            }
            if (visibleGroups.g2 && result2) {
                const t_095 = result2.eta * Math.pow(-Math.log(0.95), 1 / result2.beta);
                traces.push({
                    x: [t_095],
                    y: [0.95],
                    mode: 'markers+text',
                    marker: { color: 'white', size: 14, line: { color: colorB, width: 2.5 }, symbol: 'circle' },
                    text: `R(0.95) @ t=${t_095.toFixed(2)}`,
                    textfont: { color: colorB, size: 11, weight: 'bold' },
                    textposition: 'top center',
                    showlegend: false,
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

        // R(0.95) dashed reference lines for Reliability chart
        layout.shapes = [];
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
        }

        return layout;
    }, [chartType, interactionMode, gridColor, axisColor, axisTextColor, plotBgColor, result1, result2, visibleGroups, colorA, colorB]);

    const generateHTMLReport = async () => {
        if (!result1) return;
        const isDualMode = !!result1 && !!result2;
        const bg = '#ffffff', gridC = 'rgba(0,0,0,0.06)', axisC = '#94a3b8';

        const captureChart = async (type: ChartType): Promise<string> => {
            const traces: any[] = [];
            const addGroupTraces = (r: WeibullResult, clr: string, nm: string) => {
                if (type === 'PROBABILITY') {
                    const weibullTrans = (p: number) => Math.log(-Math.log(1 - p / 100));
                    traces.push({
                        x: r.linePoints.map(p => Math.exp(p.x)), y: r.linePoints.map(p => p.y),
                        mode: 'lines', name: `${nm} fit`, line: { color: clr, width: 2 }, hoverinfo: 'none'
                    });
                    const failPts = r.dataPoints.filter(p => p.status === 'F');
                    traces.push({
                        x: failPts.map(p => p.time), y: failPts.map(p => weibullTrans(p.rank * 100)),
                        mode: 'markers', name: nm, marker: { color: bg, line: { color: clr, width: 2 }, size: 8, symbol: 'circle' },
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
                        line: { color: clr, width: 2.5, shape: 'spline' }, fill: 'tozeroy', fillcolor: `${clr}20`
                    });
                    const failTimes = pts.filter(p => p.status === 'F').map(p => p.time);
                    const failY = failTimes.map(t => calculateMetrics(t, r.beta, r.eta)[type === 'RELIABILITY' ? 'reliability' : 'pdf']);
                    traces.push({
                        x: failTimes, y: failY, mode: 'markers',
                        marker: { color: bg, line: { color: clr, width: 2 }, size: 7 }, name: `${nm} Failures`, hoverinfo: 'none'
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
                        marker: { color: bg, size: 12, line: { color: clr, width: 2.5 }, symbol: 'circle' },
                        text: `R(0.95) @ t=${t_095.toFixed(2)}`,
                        textfont: { color: clr, size: 10, weight: 'bold' }, textposition: 'top center',
                        showlegend: false, hoverinfo: 'none'
                    });
                };
                if (result1) addR095(result1, colorA, name1);
                if (result2) addR095(result2, colorB, name2);
            }

            const layout: any = {
                paper_bgcolor: bg, plot_bgcolor: 'transparent',
                font: { family: 'Inter, sans-serif', size: 11, color: axisC },
                hovermode: 'closest', margin: { l: 55, r: 30, t: 40, b: 55 }, showlegend: false,
                xaxis: { title: { text: 'Time-to-Failure (t)' }, gridcolor: gridC, linecolor: axisC, zeroline: false },
                yaxis: { gridcolor: gridC, linecolor: axisC, zeroline: false, tickfont: { weight: 700 } }
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
                const addRefLine = (r: WeibullResult, clr: string) => {
                    const t_095 = r.eta * Math.pow(-Math.log(0.95), 1 / r.beta);
                    layout.shapes.push(
                        { type: 'line', xref: 'x', yref: 'y', x0: 0, y0: 0.95, x1: t_095, y1: 0.95, line: { color: `${clr}80`, width: 1.5, dash: 'dash' } },
                        { type: 'line', xref: 'x', yref: 'y', x0: t_095, y0: 0, x1: t_095, y1: 0.95, line: { color: `${clr}80`, width: 1.5, dash: 'dash' } }
                    );
                };
                if (result1) addRefLine(result1, colorA);
                if (result2) addRefLine(result2, colorB);
            } else {
                layout.yaxis.title = { text: 'Probability Density f(t)' };
            }

            const div = document.createElement('div');
            div.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1200px;height:800px';
            document.body.appendChild(div);
            await Plotly.newPlot(div, traces, layout, { responsive: false });
            await new Promise(r => setTimeout(r, 200));
            const url = await Plotly.toImage(div, { format: 'png', width: 1200, height: 800, scale: 2 });
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

        const aiHtml = aiAnalysis ? `<div class="section"><h2>AI 分析 &bull; AI Analysis</h2><div class="ai-box">${aiAnalysis.replace(/\n/g, '<br>')}</div></div>` : '';
        const modeLabel = isDualMode ? '雙組比較 Comparative' : '單組分析 Single';
        const metricCard = (lbl: string, enLbl: string, val: string, sub: string, fm?: number) =>
            `<div class="metric-card"><div class="label">${lbl}<br>${enLbl}</div><div class="value">${val}</div><div class="sub">${fm !== undefined ? sub : sub}</div></div>`;

        const reportHTML = `<!DOCTYPE html>
<html lang="zh-TW">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Weibull Analysis Report 韋伯分析報告</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans TC',sans-serif;color:#1e293b;background:#f8fafc;padding:32px;max-width:1200px;margin:auto}
h1{font-size:24px;font-weight:800;color:#0f172a;margin-bottom:2px}
.sub{color:#64748b;font-size:13px;margin-bottom:28px}
.section{margin-bottom:32px}
.section h2{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#475569;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin-bottom:14px}
.chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.chart-cell{display:flex;flex-direction:column;align-items:center}
.chart-caption{font-size:11px;color:#94a3b8;margin-top:6px;white-space:nowrap}
table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#f1f5f9;color:#475569;font-weight:700;text-align:left;padding:7px 10px;border-bottom:2px solid #cbd5e1;white-space:nowrap}
td{padding:5px 10px;border-bottom:1px solid #e2e8f0}
tr:hover td{background:#f8fafc}
.mono{font-family:'SF Mono',Consolas,monospace;font-size:11px}
.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}
.metric-card{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:12px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.metric-card .label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:#64748b;margin-bottom:2px;line-height:1.3}
.metric-card .value{font-size:20px;font-weight:800;color:#0f172a;font-family:'SF Mono',Consolas,'Noto Sans TC',monospace}
.metric-card .sub{font-size:11px;color:#64748b;margin-top:2px;line-height:1.3}
.chart-img{width:100%;border-radius:8px;border:1px solid #e2e8f0;box-shadow:0 3px 10px rgba(0,0,0,.05)}
.ai-box{background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;padding:16px;font-size:13px;line-height:1.6;color:#1e293b}
.summary-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;font-size:12px;line-height:1.7}
.summary-box strong{color:#0f172a}.summary-box .val{font-family:'SF Mono',Consolas,monospace;font-weight:700;color:#475569}
.dual-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.table-wrap{overflow-x:auto}
@media print{body{padding:20px}}@media(max-width:768px){.chart-grid{grid-template-columns:1fr}.dual-grid{grid-template-columns:1fr}.metrics{grid-template-columns:1fr 1fr}}
</style>
</head>
<body>
<h1>韋伯分析報告 &bull; Weibull Analysis Report</h1>
<p class="sub">產生時間 Generated: ${ts} &nbsp;|&nbsp; 分析模式 Mode: ${modeLabel}</p>

<div class="section"><h2>圖表 &bull; Charts</h2><div class="chart-grid">
${probImg ? `<div class="chart-cell"><img class="chart-img" src="${probImg}" alt="Probability Plot"><span class="chart-caption">機率圖 Probability Plot</span></div>` : ''}
${relImg ? `<div class="chart-cell"><img class="chart-img" src="${relImg}" alt="Reliability Curve"><span class="chart-caption">可靠度曲線 Reliability Curve</span></div>` : ''}
${pdfImg ? `<div class="chart-cell"><img class="chart-img" src="${pdfImg}" alt="Probability Density"><span class="chart-caption">機率密度 Probability Density</span></div>` : ''}
</div></div>

<div class="section"><h2>指標 &bull; Metrics</h2>
${isDualMode && r1 && r2 ? `<div class="dual-grid"><div><h3 style="font-size:13px;font-weight:700;color:#4f46e5;margin-bottom:10px">${n1}</h3><div class="metrics">
${metricCard('形狀參數', 'Shape β', r1.beta.toFixed(4), '', r1.beta)}
${metricCard('尺度參數', 'Scale η', r1.eta.toFixed(4), '特徵壽命 Char. Life')}
${metricCard('平均壽命', 'MTTF', r1.mttf.toFixed(4), 'Mean Time To Failure')}
${metricCard('適配度', 'R²', r1.rSquared.toFixed(4), r1.rSquared >= 0.9 ? '適配良好 Good Fit' : '適配偏低 Poor Fit')}
</div></div><div><h3 style="font-size:13px;font-weight:700;color:#e11d48;margin-bottom:10px">${n2}</h3><div class="metrics">
${metricCard('形狀參數', 'Shape β', r2.beta.toFixed(4), '', r2.beta)}
${metricCard('尺度參數', 'Scale η', r2.eta.toFixed(4), '特徵壽命 Char. Life')}
${metricCard('平均壽命', 'MTTF', r2.mttf.toFixed(4), 'Mean Time To Failure')}
${metricCard('適配度', 'R²', r2.rSquared.toFixed(4), r2.rSquared >= 0.9 ? '適配良好 Good Fit' : '適配偏低 Poor Fit')}
</div></div></div>` : r1 ? `<div class="metrics">
${metricCard('形狀參數', 'Shape β', r1.beta.toFixed(4), '', r1.beta)}
${metricCard('尺度參數', 'Scale η', r1.eta.toFixed(4), '特徵壽命 Char. Life')}
${metricCard('平均壽命', 'MTTF', r1.mttf.toFixed(4), 'Mean Time To Failure')}
${metricCard('適配度', 'R²', r1.rSquared.toFixed(4), r1.rSquared >= 0.9 ? '適配良好 Good Fit' : '適配偏低 Poor Fit')}
</div>` : ''}
</div>

<div class="section"><h2>摘要統計 &bull; Summary Statistics</h2>
${isDualMode && r1 && r2 ? `<div class="dual-grid"><div class="summary-box"><strong>${n1}</strong><br>
樣本數 Sample Size (N): <span class="val">${r1.dataPoints.length}</span><br>
失效 Failures (F): <span class="val">${r1.dataPoints.filter(p => p.status === 'F').length}</span><br>
右設限 Suspensions (S): <span class="val">${r1.dataPoints.filter(p => p.status === 'S').length}</span><br>
失效模式 Failure Mode: <span class="val">${getFM(r1.beta)}</span><br>
適配 Goodness of Fit (R²): <span class="val">${r1.rSquared.toFixed(4)}</span>
</div><div class="summary-box"><strong>${n2}</strong><br>
樣本數 Sample Size (N): <span class="val">${r2.dataPoints.length}</span><br>
失效 Failures (F): <span class="val">${r2.dataPoints.filter(p => p.status === 'F').length}</span><br>
右設限 Suspensions (S): <span class="val">${r2.dataPoints.filter(p => p.status === 'S').length}</span><br>
失效模式 Failure Mode: <span class="val">${getFM(r2.beta)}</span><br>
適配 Goodness of Fit (R²): <span class="val">${r2.rSquared.toFixed(4)}</span>
</div></div>` : r1 ? `<div class="summary-box">
樣本數 Sample Size (N): <span class="val">${r1.dataPoints.length}</span><br>
失效 Failures (F): <span class="val">${r1.dataPoints.filter(p => p.status === 'F').length}</span><br>
右設限 Suspensions (S): <span class="val">${r1.dataPoints.filter(p => p.status === 'S').length}</span><br>
失效模式 Failure Mode: <span class="val">${getFM(r1.beta)}</span><br>
適配 Goodness of Fit (R²): <span class="val">${r1.rSquared.toFixed(4)}</span>
</div>` : ''}
</div>

${aiHtml}

<div class="section"><h2>原始數據 &bull; Raw Data</h2>
${isDualMode && r1 && r2 ? `<div class="dual-grid"><div class="table-wrap"><table><thead><tr><th>#</th><th>時間<br>Time</th><th>狀態<br>Status</th><th>中位秩<br>Median Rank</th><th>ln(t)</th><th>Y</th></tr></thead><tbody>${rows1}</tbody></table></div><div class="table-wrap"><table><thead><tr><th>#</th><th>時間<br>Time</th><th>狀態<br>Status</th><th>中位秩<br>Median Rank</th><th>ln(t)</th><th>Y</th></tr></thead><tbody>${rows2}</tbody></table></div></div>` : `<div class="table-wrap"><table><thead><tr><th>#</th><th>時間 Time</th><th>狀態 Status</th><th>中位秩 Median Rank</th><th>ln(t)</th><th>Y</th></tr></thead><tbody>${rows1}</tbody></table></div>`}
</div>

<div class="section" style="margin-top:40px;padding-top:20px;border-top:2px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center">
Weibull Analyst &mdash; 由 Weibull-Analyst 產生 Generated &mdash; ${ts}
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
                                className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${chartType === type.id
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

                    <button
                        onClick={generateHTMLReport}
                        disabled={!result1}
                        className="flex items-center space-x-1.5 text-xs font-bold text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed"
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