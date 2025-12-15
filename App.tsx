import React, { useState, useEffect } from 'react';
import { Search, BookOpen, Database, AlertCircle, Loader2, Sparkles, Beaker, CheckCircle2, Bookmark, Trash2, Play, Info, Plus } from 'lucide-react';
import { Paper, AnalysisResult } from './types';
import { searchPapers } from './services/paperService';
import { analyzePaperWithOllama, checkOllamaConnection } from './services/ollamaService';
import PaperDetailModal from './components/PaperDetailModal';

const App: React.FC = () => {
  // State
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'search' | 'saved'>('search');
  
  // Data State
  const [papers, setPapers] = useState<Paper[]>([]);
  const [savedPapers, setSavedPapers] = useState<Paper[]>(() => {
    // Load from local storage on initial render
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('savedPapers');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  
  // Pagination State
  const [totalResults, setTotalResults] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const [analyses, setAnalyses] = useState<Record<string, AnalysisResult>>({});
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  
  // UI State
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false); // To show "No results" message
  const [ollamaStatus, setOllamaStatus] = useState<boolean | null>(null);

  // Check protocol for Mixed Content warnings
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

  // Initial check for Ollama
  useEffect(() => {
    checkConnection();
    // Re-check connection periodically (every 10 seconds)
    const interval = setInterval(checkConnection, 10000);
    return () => clearInterval(interval);
  }, []);

  // Hydrate analyses from saved papers on mount
  useEffect(() => {
    if (savedPapers.length > 0) {
      setAnalyses(prev => {
        const newAnalyses = { ...prev };
        let hasNewData = false;
        
        savedPapers.forEach(p => {
          if (p.savedAnalysis && !newAnalyses[p.id]) {
            newAnalyses[p.id] = {
              paperId: p.id,
              summary: p.savedAnalysis.summary,
              methodology: p.savedAnalysis.methodology,
              outcome: p.savedAnalysis.outcome,
              isLoading: false
            };
            hasNewData = true;
          }
        });
        
        return hasNewData ? newAnalyses : prev;
      });
    }
  }, []); 

  // Save effect
  useEffect(() => {
    localStorage.setItem('savedPapers', JSON.stringify(savedPapers));
  }, [savedPapers]);

  const checkConnection = async () => {
    const isConnected = await checkOllamaConnection();
    setOllamaStatus(isConnected);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    setActiveTab('search'); 
    setPapers([]);
    setOffset(0);
    setTotalResults(0);
    setSelectedPaper(null);

    try {
      console.log("Arama başlatıldı:", query);
      // Fetch first page (limit 10)
      const response = await searchPapers(query, 0, 10);
      
      setPapers(response.papers);
      setTotalResults(response.total);

      // Trigger analysis automatically if connected
      if (response.papers.length > 0) {
        response.papers.forEach(paper => {
          if (!analyses[paper.id]) {
            triggerAnalysis(paper);
          }
        });
      }
    } catch (error) {
      console.error("Search failed", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLoadMore = async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);

    try {
      const nextOffset = papers.length;
      const response = await searchPapers(query, nextOffset, 10);
      
      const newPapers = response.papers;
      setPapers(prev => [...prev, ...newPapers]);
      
      // Trigger analysis for new batch
      if (newPapers.length > 0) {
        newPapers.forEach(paper => {
          if (!analyses[paper.id]) {
            triggerAnalysis(paper);
          }
        });
      }
    } catch (error) {
      console.error("Load more failed", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const toggleSave = (e: React.MouseEvent, paper: Paper) => {
    e.stopPropagation(); // Prevent opening modal
    const isSaved = savedPapers.some(p => p.id === paper.id);
    if (isSaved) {
      if (activeTab === 'saved') {
         if (window.confirm(`"${paper.title}" listeden silinsin mi?`)) {
             setSavedPapers(prev => prev.filter(p => p.id !== paper.id));
         }
      } else {
         setSavedPapers(prev => prev.filter(p => p.id !== paper.id));
      }
    } else {
      // Save logic
      const currentAnalysis = analyses[paper.id];
      const hasValidAnalysis = currentAnalysis && !currentAnalysis.isLoading && !currentAnalysis.error && 
                              (currentAnalysis.summary || currentAnalysis.methodology || currentAnalysis.outcome);

      const paperToSave: Paper = {
        ...paper,
        savedAnalysis: hasValidAnalysis ? {
          summary: currentAnalysis.summary,
          methodology: currentAnalysis.methodology,
          outcome: currentAnalysis.outcome
        } : undefined
      };

      setSavedPapers(prev => [...prev, paperToSave]);
    }
  };

  const triggerAnalysis = async (paper: Paper) => {
    setAnalyses(prev => ({
      ...prev,
      [paper.id]: {
        paperId: paper.id,
        summary: '',
        methodology: '',
        outcome: '',
        isLoading: true
      }
    }));

    try {
      const liveConnection = await checkOllamaConnection();
      if (!liveConnection) {
          throw new Error("Ollama bağlantısı yok");
      }

      const [summary, methodology, outcome] = await Promise.all([
        analyzePaperWithOllama(paper.abstract, 'summary'),
        analyzePaperWithOllama(paper.abstract, 'methodology'),
        analyzePaperWithOllama(paper.abstract, 'outcome')
      ]);

      setAnalyses(prev => ({
        ...prev,
        [paper.id]: {
          paperId: paper.id,
          summary,
          methodology,
          outcome,
          isLoading: false
        }
      }));

      setSavedPapers(prevSaved => {
        return prevSaved.map(p => {
          if (p.id === paper.id) {
            return {
              ...p,
              savedAnalysis: { summary, methodology, outcome }
            };
          }
          return p;
        });
      });

    } catch (error: any) {
      console.error("Analysis error for paper", paper.id, error);
      setAnalyses(prev => ({
        ...prev,
        [paper.id]: {
          ...prev[paper.id],
          isLoading: false,
          error: "Analiz başarısız. Ollama'yı kontrol edin."
        }
      }));
    }
  };

  const displayedPapers = activeTab === 'search' ? papers : savedPapers;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
      
      {/* Modal */}
      {selectedPaper && (
        <PaperDetailModal 
          paper={selectedPaper}
          analysis={analyses[selectedPaper.id]}
          isOpen={!!selectedPaper}
          onClose={() => setSelectedPaper(null)}
          onAnalyze={triggerAnalysis}
          ollamaConnected={!!ollamaStatus}
        />
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-600 p-2 rounded-lg">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600 hidden sm:block">
              Yerel Araştırma Asistanı
            </h1>
            <h1 className="text-xl font-bold text-purple-600 sm:hidden">
              Elicit-Local
            </h1>
          </div>
          
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('search')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                activeTab === 'search' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Arama
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
                activeTab === 'saved' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Kayıtlılar
              {savedPapers.length > 0 && (
                <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full text-xs">
                  {savedPapers.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center space-x-4">
             <div className={`hidden md:flex items-center px-3 py-1 rounded-full text-xs font-medium ${ollamaStatus ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                <Database className="w-3 h-3 mr-1.5" />
                {ollamaStatus ? 'Ollama Bağlı' : 'Bağlantı Yok'}
             </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Connection Warning */}
        {ollamaStatus === false && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800 space-y-3">
              <div>
                <h3 className="font-semibold mb-1">Ollama'ya bağlanılamadı</h3>
                <p>Analizlerin çalışması için "qwen2.5:14b" modelinin yüklü ve Ollama'nın çalışıyor olması gerekir.</p>
              </div>
              <code className="bg-red-100 px-2 py-1.5 rounded text-red-900 font-mono block w-fit border border-red-200 select-all">
                ollama run qwen2.5:14b
              </code>
            </div>
          </div>
        )}

        {/* Search Hero */}
        {activeTab === 'search' && (
          <div className="max-w-3xl mx-auto text-center mb-8">
            <form onSubmit={handleSearch} className="relative shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-11 pr-4 py-4 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg placeholder-gray-400 shadow-sm transition-all"
                placeholder="Örn: Kahve tüketiminin uyku kalitesi üzerindeki etkileri..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button 
                type="submit" 
                disabled={isSearching}
                className="absolute right-2.5 top-2.5 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Ara'}
              </button>
            </form>
            {!hasSearched && papers.length === 0 && (
               <div className="mt-4 text-xs text-gray-400 flex justify-center gap-3 flex-wrap">
                <span>Örnekler:</span>
                <button onClick={() => setQuery("Diabetes detection machine learning")} className="hover:text-purple-600 underline decoration-dotted">Diyabet & Yapay Zeka</button>
                <button onClick={() => setQuery("Climate change agriculture")} className="hover:text-purple-600 underline decoration-dotted">Tarım & İklim</button>
              </div>
            )}
          </div>
        )}

        {/* Saved Header */}
        {activeTab === 'saved' && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Kayıtlı Makaleler</h2>
            <p className="text-gray-500">Daha sonra incelemek üzere işaretlediğiniz çalışmalar.</p>
          </div>
        )}

        {/* Results List */}
        {displayedPapers.length > 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
             {activeTab === 'search' && (
              <div className="flex items-center gap-2 text-sm text-gray-500 bg-blue-50 p-2 rounded-lg border border-blue-100">
                <Info className="w-4 h-4 text-blue-600" />
                Detaylı analiz için makalenin üzerine tıklayın.
              </div>
             )}

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="w-12 px-6 py-4"></th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Makale</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Özet (AI)</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Metodoloji (AI)</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Sonuçlar (AI)</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {displayedPapers.map((paper) => {
                      const analysis = analyses[paper.id];
                      const isSaved = savedPapers.some(p => p.id === paper.id);

                      return (
                        <tr 
                          key={paper.id} 
                          onClick={() => setSelectedPaper(paper)}
                          className="hover:bg-purple-50/50 transition-colors cursor-pointer group"
                        >
                          <td className="px-6 py-6 align-top">
                            <button 
                              onClick={(e) => toggleSave(e, paper)}
                              className={`p-2 rounded-full transition-colors z-10 relative ${
                                isSaved 
                                  ? 'text-purple-600 bg-purple-50 hover:bg-purple-100' 
                                  : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
                              } ${activeTab === 'saved' ? 'hover:text-red-600 hover:bg-red-50' : ''}`}
                              title={activeTab === 'saved' ? "Sil" : "Kaydet"}
                            >
                              {activeTab === 'saved' ? <Trash2 className="w-5 h-5" /> : <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />}
                            </button>
                          </td>
                          <td className="px-6 py-6 align-top">
                            <div className="flex flex-col gap-1">
                              <h4 className="text-sm font-bold text-gray-900 group-hover:text-purple-700 transition-colors">
                                {paper.title}
                              </h4>
                              <p className="text-xs text-gray-500">
                                {paper.authors.join(', ')} • {paper.year}
                              </p>
                              <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 w-fit">
                                {paper.source}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-6 align-top text-sm text-gray-600 border-l border-gray-100">
                            <AnalysisCell content={analysis?.summary} isLoading={analysis?.isLoading} label="Özet" />
                          </td>
                          <td className="px-6 py-6 align-top text-sm text-gray-600 border-l border-gray-100">
                            <AnalysisCell content={analysis?.methodology} isLoading={analysis?.isLoading} label="Metodoloji" />
                          </td>
                          <td className="px-6 py-6 align-top text-sm text-gray-600 border-l border-gray-100">
                            <AnalysisCell content={analysis?.outcome} isLoading={analysis?.isLoading} label="Sonuç" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Load More Button (Only for Search Tab and if has more results) */}
            {activeTab === 'search' && papers.length < totalResults && (
              <div className="flex justify-center pt-4 pb-8">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="group flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 text-gray-600 font-medium rounded-full shadow-sm hover:border-purple-300 hover:text-purple-600 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoadingMore ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  )}
                  {isLoadingMore ? 'Yükleniyor...' : 'Daha Fazla Göster'}
                  <span className="text-xs text-gray-400 font-normal ml-1">
                    ({papers.length} / {totalResults})
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

const AnalysisCell: React.FC<{ content?: string; isLoading?: boolean; label: string }> = ({ content, isLoading, label }) => {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 animate-pulse">
        <div className="h-2 bg-gray-200 rounded w-3/4"></div>
        <div className="h-2 bg-gray-200 rounded w-full"></div>
        <span className="text-xs text-purple-500 font-medium flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> {label}...
        </span>
      </div>
    );
  }
  if (!content) return <span className="text-gray-300 italic text-xs">Analiz bekleniyor...</span>;
  return <span className="line-clamp-4">{content}</span>;
};

export default App;