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

export enum RankMethod {
  MEDIAN = 'MEDIAN',
  MEAN = 'MEAN',
}

export type AnalysisMode = 'SINGLE' | 'DUAL';
export type ChartType = 'PROBABILITY' | 'PDF' | 'RELIABILITY';
export type Language = 'en' | 'zh';
export type Theme = 'light' | 'dark';
export type AIProvider = 'GEMINI' | 'OPENAI';