import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { WeibullResult, Language, AIProvider } from "../types";

export const analyzeWithAI = async (
    result1: WeibullResult | null,
    result2: WeibullResult | null,
    isDualMode: boolean,
    lang: Language,
    apiKey: string,
    provider: AIProvider = 'GEMINI'
) => {
    if (!apiKey) throw new Error("API Key is required.");

    const isZh = lang === 'zh';
    let prompt = '';

    if (isDualMode && result1 && result2) {
        if (isZh) {
            prompt = `
          我對兩組數據（A組 vs B組）進行了韋伯分析比較。
          
          A組結果:
          - Beta (形狀參數): ${result1.beta.toFixed(4)}
          - Eta (尺度參數): ${result1.eta.toFixed(4)}
          - MTTF (平均壽命): ${result1.mttf.toFixed(4)}
          - R² (適配度): ${result1.rSquared.toFixed(4)}

          B組結果:
          - Beta (形狀參數): ${result2.beta.toFixed(4)}
          - Eta (尺度參數): ${result2.eta.toFixed(4)}
          - MTTF (平均壽命): ${result2.mttf.toFixed(4)}
          - R² (適配度): ${result2.rSquared.toFixed(4)}

          作為資深可靠度工程師，請提供比較分析：
          1. 比較失效模式 (基於 Beta)。哪一組老化得更快？
          2. 比較壽命特徵 (基於 Eta 和 MTTF)。哪一組壽命更長？
          3. 綜合結論：哪一組更可靠？
          4. 推測可能的原因（例如：材料變更、製造缺陷）。

          請保持簡潔（250字以內），使用繁體中文和 Markdown 格式。
          重要：請勿使用 LaTeX 數學符號 (如 $\\beta$ 或 \\[ ... \\]), 請直接使用文字 (如 Beta) 或 Unicode 符號 (如 R²)。
        `;
        } else {
            prompt = `
          I have performed a comparative Weibull Analysis on two datasets (Group A vs Group B).
          
          Group A Results:
          - Beta: ${result1.beta.toFixed(4)}
          - Eta: ${result1.eta.toFixed(4)}
          - MTTF: ${result1.mttf.toFixed(4)}
          - R²: ${result1.rSquared.toFixed(4)}

          Group B Results:
          - Beta: ${result2.beta.toFixed(4)}
          - Eta: ${result2.eta.toFixed(4)}
          - MTTF: ${result2.mttf.toFixed(4)}
          - R²: ${result2.rSquared.toFixed(4)}

          As a Senior Reliability Engineer, provide a comparative analysis:
          1. Compare the failure modes (based on Beta). Which group is aging faster?
          2. Compare the life characteristics (based on Eta and MTTF). Which group lasts longer?
          3. Conclusion: Which group is more reliable?
          4. Suggest a reason for the difference (e.g., material change, manufacturing defect).

          Keep it concise (under 250 words) and use Markdown.
          Important: Do NOT use LaTeX math syntax (e.g. $\\beta$). Use plain text (e.g. Beta) or Unicode (e.g. R²).
        `;
        }
    } else if (result1) {
        if (isZh) {
            prompt = `
          我對失效數據進行了韋伯分析。
          結果:
          - Beta (形狀參數): ${result1.beta.toFixed(4)}
          - Eta (尺度參數): ${result1.eta.toFixed(4)}
          - MTTF (平均壽命): ${result1.mttf.toFixed(4)}
          - R² (適配度): ${result1.rSquared.toFixed(4)}

          請提供技術分析：
          1. 解讀 Beta (早夭期、隨機失效、耗損期)。
          2. 解釋 Eta 和 MTTF (壽命特徵)。
          3. 評論適配品質 (R²)。
          4. 提供一個可執行的建議。

          請保持簡潔（150字以內），使用繁體中文和 Markdown 格式。
          重要：請勿使用 LaTeX 數學符號 (如 $\\beta$), 請直接使用文字 (如 Beta) 或 Unicode 符號 (如 R²)。
        `;
        } else {
            prompt = `
          I have performed a Weibull Analysis on failure data.
          Results:
          - Beta: ${result1.beta.toFixed(4)}
          - Eta: ${result1.eta.toFixed(4)}
          - MTTF: ${result1.mttf.toFixed(4)}
          - R²: ${result1.rSquared.toFixed(4)}

          Provide a technical analysis:
          1. Interpret Beta (infant mortality, random, wear-out).
          2. Explain Eta and MTTF.
          3. Comment on fit quality (R²).
          4. One actionable recommendation.

          Keep it concise (under 150 words) and use Markdown.
          Important: Do NOT use LaTeX math syntax (e.g. $\\beta$). Use plain text (e.g. Beta) or Unicode (e.g. R²).
        `;
        }
    } else {
        throw new Error("No results to analyze.");
    }

    try {
        if (provider === 'GEMINI') {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.getGenerativeModel({
                model: 'gemini-1.5-flash',
                systemInstruction: isZh
                    ? "你是一位資深的可靠度工程專家，擅長使用繁體中文解釋韋伯分析結果。"
                    : "You are a senior Reliability Engineer expert in explaining Weibull analysis results."
            }).generateContent(prompt);
            return response.response.text();
        } else {
            const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: isZh
                            ? "你是一位資深的可靠度工程專家，擅長使用繁體中文解釋韋伯分析結果。"
                            : "You are a senior Reliability Engineer expert in explaining Weibull analysis results."
                    },
                    { role: "user", content: prompt }
                ],
                max_tokens: 500
            });
            return response.choices[0].message.content;
        }
    } catch (error: any) {
        console.error(`${provider} API Error:`, error);
        const msg = error.message || "Unknown error";
        throw new Error(isZh ? `無法生成 AI 分析報告 (${provider}): ${msg}` : `Failed to generate AI analysis (${provider}): ${msg}`);
    }
};
