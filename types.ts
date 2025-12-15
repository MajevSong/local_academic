export interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number;
  abstract: string;
  citationCount: number;
  url?: string;
  doi?: string;
  pdfUrl?: string;
  source: string;
  isMock?: boolean;
  fullText?: string; // Content extracted from PDF
  savedAnalysis?: {
    summary: string;
    methodology: string;
    outcome: string;
  };
}

export interface AnalysisResult {
  paperId: string;
  summary: string;
  methodology: string;
  outcome: string;
  isLoading: boolean;
  error?: string;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface FilterState {
  minYear: number | '';
  maxYear: number | '';
  minCitations: number | '';
  hasPdf: boolean;
}

export type AnalysisColumn = 'summary' | 'methodology' | 'outcome';