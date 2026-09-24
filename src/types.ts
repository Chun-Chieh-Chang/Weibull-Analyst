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
export type GeminiModel = 'gemini-3.8-flash';
// Automatic backups for the pinned primary: tried in order when the primary is
// throttled (503), retired or access-restricted (404 / 403). Ordering principle:
// nearest same-family substitute first, then the user-specified chain.
export type GeminiBackupModel = 'gemini-3.7-flash' | 'gemini-3.1-pro-preview' | 'gemini-3.5-flash-lite';
export type OpenAIModel = 'gpt-4o-mini';
export type ClaudeModel = 'claude-sonnet-4-6' | 'claude-haiku-4-5';