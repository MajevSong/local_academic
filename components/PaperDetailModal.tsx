import React from 'react';
import { X, Calendar, Users, BookOpen, Quote, Sparkles, Play, Loader2, AlertCircle } from 'lucide-react';
import { Paper, AnalysisResult } from '../types';

interface PaperDetailModalProps {
  paper: Paper;
  analysis?: AnalysisResult;
  isOpen: boolean;
  onClose: () => void;
  onAnalyze: (paper: Paper) => void;
  ollamaConnected: boolean;
}

const PaperDetailModal: React.FC<PaperDetailModalProps> = ({ 
  paper, 
  analysis, 
  isOpen, 
  onClose,
  onAnalyze,
  ollamaConnected
}) => {
  if (!isOpen) return null;

  // Prevent background scrolling when modal is open
  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const hasAnalysis = analysis && !analysis.isLoading && (analysis.summary || analysis.methodology || analysis.outcome);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100 bg-gray-50/50">
          <div className="space-y-2 pr-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">
              {paper.title}
            </h2>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                <span>{paper.authors.join(', ')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>{paper.year}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" />
                <span className="font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                  {paper.source}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Quote className="w-4 h-4" />
                <span>{paper.citationCount} alıntı</span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* AI Analysis Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="bg-purple-100 p-1.5 rounded-lg">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">AI Analizi</h3>
              </div>
              
              {/* Analyze Button inside Modal */}
              {(!hasAnalysis || analysis?.isLoading) && (
                <button
                  onClick={() => onAnalyze(paper)}
                  disabled={!ollamaConnected || analysis?.isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {analysis?.isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analiz Yapılıyor...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      {ollamaConnected ? 'Analizi Başlat' : 'Ollama Bağlı Değil'}
                    </>
                  )}
                </button>
              )}
            </div>

            {!ollamaConnected && !hasAnalysis && (
               <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2 border border-red-100 mb-4">
                 <AlertCircle className="w-4 h-4" />
                 Analiz yapabilmek için Ollama bağlantısı gereklidir.
               </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <AnalysisCard 
                title="Özet" 
                content={analysis?.summary} 
                isLoading={analysis?.isLoading} 
                icon={<BookOpen className="w-4 h-4 text-blue-600" />}
                bgColor="bg-blue-50"
                borderColor="border-blue-100"
              />
              <AnalysisCard 
                title="Metodoloji" 
                content={analysis?.methodology} 
                isLoading={analysis?.isLoading}
                icon={<Users className="w-4 h-4 text-amber-600" />}
                bgColor="bg-amber-50"
                borderColor="border-amber-100"
              />
              <AnalysisCard 
                title="Sonuçlar" 
                content={analysis?.outcome} 
                isLoading={analysis?.isLoading}
                icon={<Sparkles className="w-4 h-4 text-green-600" />}
                bgColor="bg-green-50"
                borderColor="border-green-100"
              />
            </div>
            {analysis?.error && (
              <p className="text-red-500 text-sm mt-2">Hata: {analysis.error}</p>
            )}
          </section>

          {/* Abstract Section */}
          <section>
            <h3 className="text-lg font-bold text-gray-900 mb-3 border-l-4 border-gray-900 pl-3">
              Özet (Abstract)
            </h3>
            <p className="text-gray-700 leading-relaxed text-lg font-serif">
              {paper.abstract}
            </p>
          </section>

        </div>
      </div>
    </div>
  );
};

const AnalysisCard = ({ title, content, isLoading, icon, bgColor, borderColor }: any) => (
  <div className={`p-4 rounded-xl border ${borderColor} ${bgColor} flex flex-col h-full`}>
    <div className="flex items-center gap-2 mb-3 font-semibold text-gray-900">
      {icon}
      {title}
    </div>
    <div className="flex-1 text-sm text-gray-800 leading-relaxed">
      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-2 bg-gray-200 rounded w-full"></div>
          <div className="h-2 bg-gray-200 rounded w-5/6"></div>
          <div className="h-2 bg-gray-200 rounded w-4/6"></div>
        </div>
      ) : content ? (
        content
      ) : (
        <span className="text-gray-400 italic text-xs">Henüz analiz edilmedi.</span>
      )}
    </div>
  </div>
);

export default PaperDetailModal;