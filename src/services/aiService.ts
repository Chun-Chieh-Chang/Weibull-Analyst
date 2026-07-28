import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { WeibullResult, Language, AIProvider, GeminiModel, OpenAIModel, ClaudeModel, GroupDataset } from "../types";

export const analyzeWithAI = async (
    groupsOrResult1: GroupDataset[] | WeibullResult | null,
    result2: WeibullResult | null,
    isMultiMode: boolean,
    lang: Language,
    apiKey: string,
    provider: AIProvider = 'GEMINI',
    geminiModel: GeminiModel = 'gemini-2.5-flash',
    openaiModel: OpenAIModel = 'gpt-4o-mini',
    claudeModel: ClaudeModel = 'claude-sonnet-4-6',
    label1: string = 'Group A',
    label2: string = 'Group B'
) => {
    if (!apiKey) throw new Error("API Key is required.");

    const isZh = lang === 'zh';
    let prompt = '';

    let activeGroups: { label: string; result: WeibullResult }[] = [];

    if (Array.isArray(groupsOrResult1)) {
        activeGroups = groupsOrResult1
            .filter(g => g.result !== null)
            .map(g => ({ label: g.label, result: g.result! }));
    } else {
        if (groupsOrResult1) activeGroups.push({ label: label1, result: groupsOrResult1 });
        if (isMultiMode && result2) activeGroups.push({ label: label2, result: result2 });
    }

    if (activeGroups.length === 0) {
        throw new Error("No results to analyze.");
    }

    if (activeGroups.length > 1) {
        const groupSummaries = activeGroups.map(g => `
Dataset: ${g.label}
- Beta (Shape): ${g.result.beta.toFixed(4)}
- Eta (Scale): ${g.result.eta.toFixed(4)}
- MTTF: ${g.result.mttf.toFixed(4)}
- R²: ${g.result.rSquared.toFixed(4)}
`).join('\n');

        prompt = `
I have performed a comparative Weibull Analysis on ${activeGroups.length} datasets (${activeGroups.map(g => g.label).join(' vs ')}).

${groupSummaries}

As a Senior Reliability Engineer, provide a comprehensive comparative analysis across all datasets:
1. Compare failure modes (based on Beta). Which dataset is aging/wearing out faster?
2. Compare characteristic life (Eta) and MTTF. Which dataset demonstrates the longest life?
3. Overall Reliability Ranking: Rank the datasets from most reliable to least reliable.
4. Suggest potential root causes for observed differences (e.g. material variation, process changes, stress levels).

Important: Do NOT use LaTeX math symbols (e.g. $\\beta$). Use plain text (e.g. Beta) or Unicode (e.g. R²).

**CRITICAL: You MUST respond in BOTH languages.** First paragraph in Traditional Chinese (繁體中文), second paragraph in English. Each point must have both languages. Example format:
- **Beta 解讀 Beta Interpretation:** (Chinese text...) (English text...)`;
    } else {
        const g = activeGroups[0];
        prompt = `
I have performed a Weibull Analysis on dataset: ${g.label}.
Results:
- Beta (Shape): ${g.result.beta.toFixed(4)}
- Eta (Scale): ${g.result.eta.toFixed(4)}
- MTTF: ${g.result.mttf.toFixed(4)}
- R²: ${g.result.rSquared.toFixed(4)}

Provide a technical analysis:
1. Interpret Beta (infant mortality, random, wear-out).
2. Explain Eta and MTTF.
3. Comment on fit quality (R²).
4. One actionable recommendation.

Important: Do NOT use LaTeX math symbols (e.g. $\\beta$). Use plain text (e.g. Beta) or Unicode (e.g. R²).

**CRITICAL: You MUST respond in BOTH languages.** First paragraph in Traditional Chinese (繁體中文), second paragraph in English. Each point must have both languages. Example format:
- **Beta 解讀 Beta Interpretation:** (Chinese text...) (English text...)`;
    }

    try {
        if (provider === 'GEMINI') {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: geminiModel,
                contents: prompt,
                config: {
                    systemInstruction: "你是一位資深的可靠度工程專家。請務必使用繁體中文和 English 雙語回答，先中文後英文。You are a senior Reliability Engineer. Always respond bilingually in Traditional Chinese then English."
                }
            });
            return response.text;
        } else if (provider === 'AGNES') {
            const resp = await fetch('https://apihub.agnes-ai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: 'agnes-2.0-flash',
                    messages: [
                        {
                            role: "system",
                            content: "你是一位資深的可靠度工程專家。請務必使用繁體中文和 English 雙語回答，先中文後英文。You are a senior Reliability Engineer. Always respond bilingually in Traditional Chinese then English."
                        },
                        { role: "user", content: prompt }
                    ],
                    max_tokens: 8192
                })
            });
            if (!resp.ok) {
                const errBody = await resp.text().catch(() => '');
                throw new Error(`API ${resp.status}: ${errBody}`);
            }
            const data = await resp.json();
            const content = data.choices?.[0]?.message?.content;
            if (content) return content;
            const refusal = data.choices?.[0]?.message?.refusal;
            if (refusal) throw new Error(isZh ? `模型拒絕回應: ${refusal}` : `Model refused: ${refusal}`);
            const snippet = JSON.stringify(data).slice(0, 500);
            throw new Error(isZh
                ? `API 回傳異常，前500字元: ${snippet}`
                : `Unexpected API response (first 500 chars): ${snippet}`);
        } else if (provider === 'OPENAI') {
            const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
            const response = await openai.chat.completions.create({
                model: openaiModel,
                messages: [
                    {
                        role: "system",
                        content: "你是一位資深的可靠度工程專家。請務必使用繁體中文和 English 雙語回答，先中文後英文。You are a senior Reliability Engineer. Always respond bilingually in Traditional Chinese then English."
                    },
                    { role: "user", content: prompt }
                ],
                max_tokens: 500
            });
            return response.choices[0].message.content;
        } else if (provider === 'CLAUDE') {
            const resp = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: claudeModel,
                    max_tokens: 1024,
                    system: "你是一位資深的可靠度工程專家。請務必使用繁體中文和 English 雙語回答，先中文後英文。You are a senior Reliability Engineer. Always respond bilingually in Traditional Chinese then English.",
                    messages: [{ role: "user", content: prompt }]
                })
            });
            if (!resp.ok) {
                const errBody = await resp.text().catch(() => '');
                throw new Error(`API ${resp.status}: ${errBody}`);
            }
            const data = await resp.json();
            const content = data.content?.[0]?.text;
            if (content) return content;
            const snippet = JSON.stringify(data).slice(0, 500);
            throw new Error(isZh
                ? `API 回傳異常，前500字元: ${snippet}`
                : `Unexpected API response (first 500 chars): ${snippet}`);
        }
    } catch (error: any) {
        console.error(`${provider} API Error:`, error);
        const msg = error.message || "Unknown error";
        throw new Error(isZh ? `無法生成 AI 分析報告 (${provider}): ${msg}` : `Failed to generate AI analysis (${provider}): ${msg}`);
    }
};
