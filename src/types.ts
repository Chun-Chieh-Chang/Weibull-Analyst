export interface WeibullDataPoint {
  id: number;
  time: number; // Failure time
  rank: number; // Median rank
  x: number; // ln(time)
  y: number; // ln(-ln(1-rank))
  status: 'F' | 'S';
}

export interface WeibullResult {
  beta: number; // Shape parameter
  eta: number;  // Scale parameter
  mttf: number; // Mean Time To Failure
  rSquared: number;
  dataPoints: WeibullDataPoint[];
  linePoints: { x: number; y: number }[]; // For Probability Plot regression line
}

export interface GroupDataset {
  id: string;
  label: string;
  text: string;
  color: string;
  result: WeibullResult | null;
  visible: boolean;
}

export type AnalysisMode = 'SINGLE' | 'MULTI';
export type ChartType = 'PROBABILITY' | 'PDF' | 'RELIABILITY';
export type Language = 'en' | 'zh';
export type AIProvider = 'GEMINI' | 'OPENAI' | 'AGNES' | 'CLAUDE';
export type GeminiModel = 'gemini-2.5-flash' | 'gemini-3.5-flash';
export type OpenAIModel = 'gpt-4o-mini';
export type ClaudeModel = 'claude-sonnet-4-6' | 'claude-haiku-4-5';