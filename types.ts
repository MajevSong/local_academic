export interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number;
  abstract: string;
  citationCount: number;
  url?: string;
  source: string;
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

export type AnalysisColumn = 'summary' | 'methodology' | 'outcome';