import React, { useState, useEffect } from 'react';
import { Search, BookOpen, Database, AlertCircle, Loader2, Sparkles, FileText, Beaker, CheckCircle2 } from 'lucide-react';
import { Paper, AnalysisResult } from './types';
import { searchPapers } from './services/paperService';
import { analyzePaperWithOllama, checkOllamaConnection } from './services/ollamaService';

const App: React.FC = () => {
  const [query, setQuery] = useState('');
  const [papers, setPapers] = useState<Paper[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, AnalysisResult>>({});
  const [isSearching, setIsSearching] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<boolean | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  
  // Check protocol for Mixed Content warnings
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

  // Initial check for Ollama
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    const isConnected = await checkOllamaConnection();
    setOllamaStatus(isConnected);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setPapers([]);
    setAnalyses({});

    try {
      // 1. Search for papers (Mock)
      const results = await searchPapers(query);
      setPapers(results);

      // 2. Trigger analysis for each paper (Parallel but decoupled from UI blocking)
      if (ollamaStatus) {
        results.forEach(paper => triggerAnalysis(paper));
      }
    } catch (error) {
      console.error("Search failed", error);
    } finally {
      setIsSearching(false);
    }
  };

  const triggerAnalysis = async (paper: Paper) => {
    // Initialize loading state for this paper
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
      // Run these in parallel
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
    } catch (error) {
      setAnalyses(prev => ({
        ...prev,
        [paper.id]: {
          ...prev[paper.id],
          isLoading: false,
          error: "Analiz hatası"
        }
      }));
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
      
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-600 p-2 rounded-lg">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600">
              Yerel Araştırma Asistanı
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
             <div className={`flex items-center px-3 py-1 rounded-full text-xs font-medium ${ollamaStatus ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                <Database className="w-3 h-3 mr-1.5" />
                {ollamaStatus ? 'Ollama: qwen2.5:14b Bağlı' : 'Ollama Bağlantısı Yok'}
             </div>
             <button onClick={() => checkConnection()} className="text-gray-500 hover:text-gray-700 text-sm">
               Yenile
             </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Connection Warning */}
        {ollamaStatus === false && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800 space-y-3">
              <div>
                <h3 className="font-semibold mb-1">Ollama'ya bağlanılamadı</h3>
                <p>Uygulamanın çalışması için yerel Ollama sunucusu gereklidir.</p>
              </div>

              {isHttps && (
                <div className="bg-orange-100 p-2 rounded border border-orange-200 text-orange-900">
                  <strong>⚠️ HTTPS Hatası Tespit Edildi:</strong> Bu site güvenli (HTTPS) bağlantı üzerinden çalışıyor ancak Ollama yerel ağda güvenli olmayan (HTTP) bir portta çalışır. Tarayıcılar bu iletişimi engeller (Mixed Content). 
                  <br className="mb-1"/>
                  Çözüm: Bu projeyi yerel bilgisayarınızda (localhost) çalıştırın veya tarayıcı ayarlarından bu site için "Güvenli olmayan içeriğe izin ver" seçeneğini açın.
                </div>
              )}

              <div>
                <p className="font-medium mb-1">Terminalde şu komutla başlattığınızdan emin olun:</p>
                <code className="bg-red-100 px-2 py-1.5 rounded text-red-900 font-mono block w-fit border border-red-200 select-all">
                  OLLAMA_ORIGINS="*" ollama serve
                </code>
              </div>
              
              <div>
                 <p className="font-medium mb-1">Modelin yüklü olduğundan emin olun:</p>
                 <code className="bg-gray-100 px-2 py-1 rounded text-gray-800 font-mono inline-block border border-gray-200 select-all">
                   ollama pull qwen2.5:14b
                 </code>
              </div>
            </div>
          </div>
        )}

        {/* Search Hero */}
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-4">
            Ne araştırmak istiyorsunuz?
          </h2>
          <p className="text-lg text-gray-500 mb-8">
            Literatür taraması yapın, qwen2.5 ile içgörüleri çıkarın.
          </p>
          
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
              disabled={isSearching || !ollamaStatus}
              className="absolute right-2.5 top-2.5 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Ara'}
            </button>
          </form>
          <div className="mt-2 text-xs text-gray-400 flex justify-center gap-2">
            <span>Denenmesi gerekenler:</span>
            <button onClick={() => setQuery("Diabetes detection machine learning")} className="hover:text-purple-600 underline">Diyabet makine öğrenmesi</button>
            <button onClick={() => setQuery("Climate change agriculture")} className="hover:text-purple-600 underline">Tarım ve iklim</button>
          </div>
        </div>

        {/* Results Area */}
        {papers.length > 0 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {papers.length} makale bulundu
              </h3>
              <div className="text-sm text-gray-500">
                qwen2.5:14b tarafından analiz ediliyor
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                        Makale
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4" />
                          Özet (AI)
                        </div>
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                        <div className="flex items-center gap-2">
                          <Beaker className="w-4 h-4" />
                          Metodoloji (AI)
                        </div>
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          Sonuçlar (AI)
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {papers.map((paper) => {
                      const analysis = analyses[paper.id];
                      return (
                        <tr key={paper.id} className="hover:bg-gray-50 transition-colors">
                          {/* Paper Info Column */}
                          <td className="px-6 py-6 align-top">
                            <div className="flex flex-col gap-1">
                              <h4 className="text-sm font-bold text-gray-900 leading-snug">
                                {paper.title}
                              </h4>
                              <p className="text-xs text-gray-500">
                                {paper.authors.join(', ')} • {paper.year}
                              </p>
                              <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 w-fit">
                                {paper.source}
                              </div>
                              <div className="mt-2 text-xs text-gray-400">
                                {paper.citationCount} alıntı
                              </div>
                            </div>
                          </td>

                          {/* Analysis Columns */}
                          <td className="px-6 py-6 align-top text-sm text-gray-600 leading-relaxed border-l border-gray-100">
                            <AnalysisCell 
                              content={analysis?.summary} 
                              isLoading={analysis?.isLoading} 
                              label="Özet"
                            />
                          </td>
                          <td className="px-6 py-6 align-top text-sm text-gray-600 leading-relaxed border-l border-gray-100">
                            <AnalysisCell 
                              content={analysis?.methodology} 
                              isLoading={analysis?.isLoading} 
                              label="Metodoloji"
                            />
                          </td>
                          <td className="px-6 py-6 align-top text-sm text-gray-600 leading-relaxed border-l border-gray-100">
                            <AnalysisCell 
                              content={analysis?.outcome} 
                              isLoading={analysis?.isLoading} 
                              label="Sonuç"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

// Helper component for table cells to handle loading states
const AnalysisCell: React.FC<{ content?: string; isLoading?: boolean; label: string }> = ({ content, isLoading, label }) => {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 animate-pulse">
        <div className="h-2 bg-gray-200 rounded w-3/4"></div>
        <div className="h-2 bg-gray-200 rounded w-full"></div>
        <div className="h-2 bg-gray-200 rounded w-2/3"></div>
        <span className="text-xs text-purple-500 font-medium mt-1 flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          {label} çıkarılıyor...
        </span>
      </div>
    );
  }
  
  if (!content) return <span className="text-gray-300 italic">-</span>;
  
  return <span>{content}</span>;
};

export default App;