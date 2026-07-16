import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { WeibullResult, Language, AIProvider, GeminiModel, OpenAIModel, ClaudeModel } from "../types";

export const analyzeWithAI = async (
    result1: WeibullResult | null,
    result2: WeibullResult | null,
    isDualMode: boolean,
    lang: Language,
    apiKey: string,
    provider: AIProvider = 'GEMINI',
    geminiModel: GeminiModel = 'gemini-2.5-flash',
    openaiModel: OpenAIModel = 'gpt-4o-mini',
    claudeModel: ClaudeModel = 'claude-sonnet-4-6'
) => {
    if (!apiKey) throw new Error("API Key is required.");

    const isZh = lang === 'zh';
    let prompt = '';

    if (isDualMode && result1 && result2) {
        prompt = `
I have performed a comparative Weibull Analysis on two datasets (Group A vs Group B).

Group A Results:
- Beta (Shape): ${result1.beta.toFixed(4)}
- Eta (Scale): ${result1.eta.toFixed(4)}
- MTTF: ${result1.mttf.toFixed(4)}
- R²: ${result1.rSquared.toFixed(4)}

Group B Results:
- Beta (Shape): ${result2.beta.toFixed(4)}
- Eta (Scale): ${result2.eta.toFixed(4)}
- MTTF: ${result2.mttf.toFixed(4)}
- R²: ${result2.rSquared.toFixed(4)}

As a Senior Reliability Engineer, provide a comparative analysis:
1. Compare the failure modes (based on Beta). Which group is aging faster?
2. Compare the life characteristics (based on Eta and MTTF). Which group lasts longer?
3. Conclusion: Which group is more reliable?
4. Suggest a reason for the difference (e.g., material change, manufacturing defect).

Important: Do NOT use LaTeX math symbols (e.g. $\\beta$). Use plain text (e.g. Beta) or Unicode (e.g. R²).

**CRITICAL: You MUST respond in BOTH languages.** First paragraph in Traditional Chinese (繁體中文), second paragraph in English. Each point must have both languages. Example format:
- **Beta 解讀 Beta Interpretation:** (Chinese text...) (English text...)`;
    } else if (result1) {
        prompt = `
I have performed a Weibull Analysis on failure data.
Results:
- Beta (Shape): ${result1.beta.toFixed(4)}
- Eta (Scale): ${result1.eta.toFixed(4)}
- MTTF: ${result1.mttf.toFixed(4)}
- R²: ${result1.rSquared.toFixed(4)}

Provide a technical analysis:
1. Interpret Beta (infant mortality, random, wear-out).
2. Explain Eta and MTTF.
3. Comment on fit quality (R²).
4. One actionable recommendation.

Important: Do NOT use LaTeX math symbols (e.g. $\\beta$). Use plain text (e.g. Beta) or Unicode (e.g. R²).

**CRITICAL: You MUST respond in BOTH languages.** First paragraph in Traditional Chinese (繁體中文), second paragraph in English. Each point must have both languages. Example format:
- **Beta 解讀 Beta Interpretation:** (Chinese text...) (English text...)`;
    } else {
        throw new Error("No results to analyze.");
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
