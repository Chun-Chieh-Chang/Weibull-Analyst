import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { WeibullResult, Language, AIProvider, GeminiModel, GeminiBackupModel, OpenAIModel, ClaudeModel, GroupDataset } from "../types";

/* --- Transient-failure retry ------------------------------------------------
   Provider APIs return capacity errors that clear on their own — the common one
   is Gemini's 503 UNAVAILABLE ("This model is currently experiencing high
   demand. Spikes in demand are usually temporary."), which is a server-side
   throttle and NOT a bad model name (that would be 404 NOT_FOUND). Google's own
   guidance for these is exponential backoff, so retryable errors are retried
   here before surfacing anything to the user. Permanent errors (401 bad key,
   404 unknown model, 400 bad request) bypass the retry entirely so the user
   still gets the real cause immediately. */
const MAX_ATTEMPTS = 4;                     // 1 initial call + 3 retries
const RETRY_DELAYS_MS = [1000, 2000, 4000]; // gap before attempt 2, 3, 4

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isRetryable = (error: any): boolean => {
    const status = error?.status ?? error?.code ?? error?.response?.status;
    if (typeof status === 'number' && [408, 429, 500, 502, 503, 504].includes(status)) return true;
    const msg = String(error?.message ?? error ?? '');
    return /(UNAVAILABLE|RESOURCE_EXHAUSTED|INTERNAL|overloaded|high demand|temporarily|rate limit|Too Many Requests|fetch failed|network error|ECONNRESET|ETIMEDOUT)/i.test(msg);
};

const withRetry = async <T>(provider: AIProvider, run: () => Promise<T>, attempts: number = MAX_ATTEMPTS): Promise<T> => {
    for (let attempt = 1; ; attempt++) {
        try {
            return await run();
        } catch (error: any) {
            if (attempt >= attempts || !isRetryable(error)) throw error;
            const wait = RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)];
            console.warn(`${provider}: transient failure on attempt ${attempt}/${attempts}, retrying in ${wait}ms —`, error?.message ?? error);
            await sleep(wait);
        }
    }
};

/* --- Model fallback ---------------------------------------------------------
   A single pinned model is a single point of failure: a 503 throttle outlives
   any sane retry budget, and a retired or access-restricted model name fails
   permanently (404 NOT_FOUND / 403 PERMISSION_DENIED). The backups below are
   therefore tried in order once the primary has burned through its retries,
   nearest same-family substitute first. */
const GEMINI_BACKUP_MODELS: GeminiBackupModel[] = ['gemini-3.7-flash', 'gemini-3.1-pro-preview', 'gemini-3.5-flash-lite'];
const BACKUP_MAX_ATTEMPTS = 2; // 1 initial call + 1 retry

// Attempts per chain position: full budget for the primary, one retry for the
// first substitute, a single attempt for anything deeper. Uniform budgets would
// make a 4-model chain cost 20s+ of spinner time in a real outage, and a model
// at position 3 is unlikely to succeed right after positions 1-2 failed. Worst
// case waiting is therefore ~7s + 1s + 0 + 0 ≈ 8s, with every model tried.
const attemptsForChainIndex = (index: number): number =>
    index === 0 ? MAX_ATTEMPTS : index === 1 ? BACKUP_MAX_ATTEMPTS : 1;

// "This model won't serve you right now, try another name" — distinct from a
// malformed request, which must not cascade through every backup.
const isModelUnavailable = (error: any): boolean => {
    const status = error?.status ?? error?.code ?? error?.response?.status;
    if (status === 404 || status === 403) return true;
    return /(is not found|not supported|NOT_FOUND|PERMISSION_DENIED|does not have access)/i.test(String(error?.message ?? ''));
};

// Anything that justifies both retrying and, if that keeps failing, swapping the
// model. Auth/validation errors are excluded so the real cause surfaces at once.
const isFallbackWorthy = (error: any): boolean => isRetryable(error) || isModelUnavailable(error);

const withFallback = async <T>(
    provider: AIProvider,
    models: string[],
    run: (model: string) => Promise<T>
): Promise<T> => {
    for (let i = 0; i < models.length; i++) {
        const model = models[i];
        try {
            const value = await withRetry(provider, () => run(model), attemptsForChainIndex(i));
            if (i > 0) console.warn(`${provider}: served by fallback model ${model} (primary ${models[0]} unavailable)`);
            return value;
        } catch (error: any) {
            if (i === models.length - 1 || !isFallbackWorthy(error)) throw error;
            console.warn(`${provider}: ${model} failed, falling back to ${models[i + 1]} —`, error?.message ?? error);
        }
    }
    throw new Error(`${provider}: no model available in the chain.`);
};

// REST providers (Agnes / Claude) go through fetch, so carry the HTTP status on
// the error object — the retry guard keys off it instead of parsing the body.
const httpError = (status: number, body: string) => {
    const error: any = new Error(`API ${status}: ${body}`);
    error.status = status;
    return error;
};

export const analyzeWithAI = async (
    groupsOrResult1: GroupDataset[] | WeibullResult | null,
    result2: WeibullResult | null,
    isMultiMode: boolean,
    lang: Language,
    apiKey: string,
    provider: AIProvider = 'GEMINI',
    geminiModel: GeminiModel = 'gemini-3.8-flash',
    openaiModel: OpenAIModel = 'gpt-4o-mini',
    claudeModel: ClaudeModel = 'claude-sonnet-4-6',
    label1: string = 'Group A',
    label2: string = 'Group B'
) => {
    if (!apiKey) throw new Error("API Key is required.");

    const isZh = lang === 'zh';
    let prompt = '';

    // Language gate: output must be single-language, matching the UI locale.
    // Technical terms (Beta, Eta, MTTF, R²) may stay in English even in zh mode.
    const languageRule = isZh
        ? "**CRITICAL: You MUST respond entirely in Traditional Chinese (繁體中文). Do NOT append English translations or bilingual paragraphs. Technical terms (e.g. Beta, Eta, MTTF, R²) may remain in English."
        : "**CRITICAL: You MUST respond entirely in English. Do NOT include any Chinese text.";

    const systemInstruction = isZh
        ? "你是一位資深的可靠度工程專家。請全程使用繁體中文回答，不要附中英文對照或英文翻譯段落；專有名詞（如 Beta、Eta、MTTF、R²）可保留英文。"
        : "You are a senior Reliability Engineer. Always respond entirely in English; do not include any Chinese text.";

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

${languageRule}`;
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

${languageRule}`;
    }

    try {
        if (provider === 'GEMINI') {
            const ai = new GoogleGenAI({ apiKey });
            return await withFallback(provider, [geminiModel, ...GEMINI_BACKUP_MODELS], async (model) => {
                const response = await ai.models.generateContent({
                    model,
                    contents: prompt,
                    config: {
                        systemInstruction
                    }
                });
                return response.text;
            });
        } else if (provider === 'AGNES') {
            return await withRetry(provider, async () => {
                const resp = await fetch('https://apihub.agnes-ai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                    body: JSON.stringify({
                        model: 'agnes-3.0-flash',
                        messages: [
                            {
                                role: "system",
                                content: systemInstruction
                            },
                            { role: "user", content: prompt }
                        ],
                        max_tokens: 8192
                    })
                });
                if (!resp.ok) {
                    const errBody = await resp.text().catch(() => '');
                    throw httpError(resp.status, errBody);
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
            });
        } else if (provider === 'OPENAI') {
            return await withRetry(provider, async () => {
                const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
                const response = await openai.chat.completions.create({
                    model: openaiModel,
                    messages: [
                        {
                            role: "system",
                            content: systemInstruction
                        },
                        { role: "user", content: prompt }
                    ],
                    // Was 500 — a leftover from an early smoke test, roughly 375
                    // words, which truncated the four-section analysis mid-report
                    // with no visible warning (finish_reason is not inspected).
                    // Now matches Claude's budget; Agnes' 8192 is the outlier.
                    max_tokens: 1024
                });
                return response.choices[0].message.content;
            });
        } else if (provider === 'CLAUDE') {
            return await withRetry(provider, async () => {
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
                        system: systemInstruction,
                        messages: [{ role: "user", content: prompt }]
                    })
                });
                if (!resp.ok) {
                    const errBody = await resp.text().catch(() => '');
                    throw httpError(resp.status, errBody);
                }
                const data = await resp.json();
                const content = data.content?.[0]?.text;
                if (content) return content;
                const snippet = JSON.stringify(data).slice(0, 500);
                throw new Error(isZh
                    ? `API 回傳異常，前500字元: ${snippet}`
                    : `Unexpected API response (first 500 chars): ${snippet}`);
            });
        }
    } catch (error: any) {
        console.error(`${provider} API Error:`, error);
        const msg = error.message || "Unknown error";
        // A capacity/availability error that survived the retries (and, for
        // Gemini, the backup chain) deserves a plain-language note instead of
        // only the raw provider JSON envelope.
        const fallbackNote = provider === 'GEMINI' && GEMINI_BACKUP_MODELS.length > 0
            ? (isZh
                ? `，並已嘗試 ${GEMINI_BACKUP_MODELS.length} 個備援模型`
                : ` and tried ${GEMINI_BACKUP_MODELS.length} fallback model${GEMINI_BACKUP_MODELS.length > 1 ? 's' : ''}`)
            : '';
        const hint = isFallbackWorthy(error)
            ? (isZh
                ? `（供應商暫時性錯誤或模型不可用，已自動重試 ${MAX_ATTEMPTS - 1} 次${fallbackNote}仍未成功）`
                : ` (transient provider error or unavailable model — retried ${MAX_ATTEMPTS - 1} times${fallbackNote} without success)`)
            : '';
        throw new Error(isZh
            ? `無法生成 AI 分析報告 (${provider})${hint}: ${msg}`
            : `Failed to generate AI analysis (${provider})${hint}: ${msg}`);
    }
};
