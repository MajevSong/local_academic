import React from 'react';
import { X, Calendar, Users, BookOpen, Quote, Sparkles, Play, Loader2, AlertCircle, ExternalLink, FileText, Bookmark, Trash2, FileCheck, Download } from 'lucide-react';
import { Paper, AnalysisResult } from '../types';

interface PaperDetailModalProps {
  paper: Paper;
  analysis?: AnalysisResult;
  isOpen: boolean;
  onClose: () => void;
  onAnalyze: (paper: Paper) => void;
  ollamaConnected: boolean;
  isSaved?: boolean;
  onToggleSave?: () => void;
  isCached?: boolean;
  isDownloading?: boolean;
  onDownloadPdf?: () => void;
  onDeletePdf?: () => void;
  onOpenPdf?: () => void;
}

const PaperDetailModal: React.FC<PaperDetailModalProps> = ({
  paper,
  analysis,
  isOpen,
  onClose,
  onAnalyze,
  ollamaConnected,
  isSaved,
  onToggleSave,
  isCached,
  isDownloading,
  onDownloadPdf,
  onDeletePdf,
  onOpenPdf
}) => {
  if (!isOpen) return null;

  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const hasAnalysis = analysis && !analysis.isLoading && (analysis.summary || analysis.methodology || analysis.outcome);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-start justify-between p-6 sm:p-8 border-b border-gray-100 bg-white">
          <div className="space-y-4 pr-8 flex-1">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight font-display">
              {paper.title}
            </h2>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-gray-700">{paper.authors.join(', ')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>{paper.year}</span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-gray-400" />
                <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                  {paper.source}
                </span>
              </div>

              {paper.doi && (
                <a
                  href={`https://doi.org/${paper.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline transition-colors ml-[-8px]"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Kaynağa Git
                </a>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              {paper.pdfUrl && (
                // Logic: If isCached -> Show Open Local & Delete. Else if isSaved -> Show Download. Else -> Show External Link
                isCached && onOpenPdf ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={onOpenPdf}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors shadow-sm"
                    >
                      <FileCheck className="w-4 h-4" />
                      Yerel PDF'i Aç
                    </button>
                    {onDeletePdf && (
                      <button
                        onClick={onDeletePdf}
                        className="p-1.5 bg-gray-100 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Önbellekten Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  (isSaved && onDownloadPdf) ? (
                    <button
                      onClick={onDownloadPdf}
                      disabled={isDownloading}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-wait"
                    >
                      {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      {isDownloading ? 'İndiriliyor...' : 'Önbelleğe İndir'}
                    </button>
                  ) : (
                    <a
                      href={paper.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors shadow-sm"
                    >
                      <FileText className="w-4 h-4" />
                      PDF Bağlantısı
                    </a>
                  )
                )
              )}

              {paper.url && (
                <a
                  href={paper.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Kaynağa Git
                </a>
              )}

              {onToggleSave && (
                <button
                  onClick={onToggleSave}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${isSaved ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                >
                  <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                  {isSaved ? 'Kaydedildi' : 'Kaydet'}
                </button>
              )}
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
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-10 bg-gray-50/50">

          {/* AI Analysis Section */}
          <section>
            <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-purple-600 p-2 rounded-lg shadow-sm">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Yapay Zeka Analizi</h3>
                  <p className="text-xs text-gray-500">Yerel LLM (qwen2.5) tarafından oluşturuldu</p>
                </div>
              </div>

              {(!hasAnalysis || analysis?.isLoading) && (
                <button
                  onClick={() => onAnalyze(paper)}
                  disabled={!ollamaConnected || analysis?.isLoading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 hover:border-purple-300 hover:shadow-md disabled:bg-gray-50 disabled:text-gray-400 disabled:shadow-none text-purple-700 text-sm font-medium rounded-xl transition-all"
                >
                  {analysis?.isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analiz Yapılıyor...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      {ollamaConnected ? 'Analizi Başlat' : 'Bağlantı Gerekli'}
                    </>
                  )}
                </button>
              )}
            </div>

            {!ollamaConnected && !hasAnalysis && (
              <div className="p-4 bg-amber-50 text-amber-800 rounded-xl text-sm flex items-start gap-3 border border-amber-100 mb-6">
                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Ollama Çalışmıyor</p>
                  <p>Makalenin analiz edilebilmesi için Ollama'nın arka planda çalışması gerekir.</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <AnalysisCard
                title="Özet"
                content={analysis?.summary}
                isLoading={analysis?.isLoading}
                icon={<BookOpen className="w-4 h-4 text-blue-600" />}
                theme="blue"
              />
              <AnalysisCard
                title="Metodoloji"
                content={analysis?.methodology}
                isLoading={analysis?.isLoading}
                icon={<Users className="w-4 h-4 text-amber-600" />}
                theme="amber"
              />
              <AnalysisCard
                title="Bulgular"
                content={analysis?.outcome}
                isLoading={analysis?.isLoading}
                icon={<Sparkles className="w-4 h-4 text-emerald-600" />}
                theme="emerald"
              />
            </div>
          </section>

          <hr className="border-gray-200" />

          {/* Abstract Section */}
          <section className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Quote className="w-5 h-5 text-gray-400" />
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

const AnalysisCard = ({ title, content, isLoading, icon, theme }: any) => {
  const themeStyles: Record<string, string> = {
    blue: "bg-blue-50/50 border-blue-100 hover:border-blue-200",
    amber: "bg-amber-50/50 border-amber-100 hover:border-amber-200",
    emerald: "bg-emerald-50/50 border-emerald-100 hover:border-emerald-200"
  };

  return (
    <div className={`p-5 rounded-2xl border ${themeStyles[theme]} transition-colors flex flex-col h-full`}>
      <div className="flex items-center gap-2 mb-3 font-bold text-gray-900">
        {icon}
        {title}
      </div>
      <div className="flex-1 text-sm text-gray-700 leading-relaxed">
        {isLoading ? (
          <div className="space-y-3 animate-pulse opacity-60">
            <div className="h-2 bg-gray-400 rounded w-full"></div>
            <div className="h-2 bg-gray-400 rounded w-5/6"></div>
            <div className="h-2 bg-gray-400 rounded w-4/6"></div>
          </div>
        ) : content ? (
          content
        ) : (
          <span className="text-gray-400 italic text-xs">Analiz bekleniyor...</span>
        )}
      </div>
    </div>
  );
};

export default PaperDetailModal;