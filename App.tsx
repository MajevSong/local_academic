import React, { useState, useEffect, useRef } from 'react';
import { Search, Database, AlertCircle, Loader2, Sparkles, Filter, ArrowUpDown, Download, Layout, ChevronRight, Send, CheckSquare, Square, MessageSquare, Plus, ExternalLink, XCircle, FileText, Check, Library, Bookmark, BookOpen, Calendar, Hash, FileCheck, X, User, Bot, Trash2, PenTool, BookText, Wand2 } from 'lucide-react';
import { Paper, AnalysisResult, FilterState, ChatMessage } from './types';
import { searchPapers } from './services/paperService';
import { analyzePaperWithOllama, checkOllamaConnection, synthesizeFindings, chatWithPapers, generateLiteratureReview, generateTopicFromPapers } from './services/ollamaService';
import { savePdfToCache, getPdfFromCache, deletePdfFromCache, getCachedPdfIds, extractTextFromPdf } from './services/storageService';
import PaperDetailModal from './components/PaperDetailModal';

// Column Configuration Types
type ColumnKey = 'summary' | 'methodology' | 'outcome';
interface ColumnConfig {
  key: ColumnKey;
  label: string;
  width: string;
}

const AVAILABLE_COLUMNS: ColumnConfig[] = [
  { key: 'summary', label: 'Özet', width: 'w-[40%]' },
  { key: 'methodology', label: 'Metodoloji', width: 'w-[30%]' },
  { key: 'outcome', label: 'Bulgular', width: 'w-[30%]' },
];

const App: React.FC = () => {
  // State
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'search' | 'library' | 'write'>('search');
  
  // Data State
  const [papers, setPapers] = useState<Paper[]>([]);
  const [savedPapers, setSavedPapers] = useState<Paper[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('savedPapers');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  
  // PDF Cache State
  const [cachedPdfIds, setCachedPdfIds] = useState<Set<string>>(new Set());
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<Record<string, boolean>>({});

  // Filter State
  const [filters, setFilters] = useState<FilterState>({
    minYear: '',
    maxYear: '',
    minCitations: '',
    hasPdf: false
  });
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  // Analysis & Synthesis & Chat
  const [analyses, setAnalyses] = useState<Record<string, AnalysisResult>>({});
  const [synthesis, setSynthesis] = useState<string>("");
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Writing Assistant State
  const [writeTopic, setWriteTopic] = useState('');
  const [generatedPaper, setGeneratedPaper] = useState('');
  const [isWriting, setIsWriting] = useState(false);
  const [isGeneratingTopic, setIsGeneratingTopic] = useState(false);

  // Pagination State
  const [totalResults, setTotalResults] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  
  // Selection State
  const [selectedPaperIds, setSelectedPaperIds] = useState<Set<string>>(new Set());

  // UI State
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Column State
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(new Set(['summary']));
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  // Initial check for Ollama and Cache
  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 10000);
    
    // Load cached PDFs
    getCachedPdfIds().then(ids => {
        setCachedPdfIds(new Set(ids));
    }).catch(err => console.error("Cache load error:", err));

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem('savedPapers', JSON.stringify(savedPapers));
  }, [savedPapers]);

  // Scroll to bottom of chat when history changes
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, isChatLoading, synthesis]);

  // Click outside listener for column menu and filter menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) {
        setShowColumnMenu(false);
      }
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setShowFilterMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const checkConnection = async () => {
    const isConnected = await checkOllamaConnection();
    setOllamaStatus(isConnected);
  };

  // Helper: Enrich papers with PDF content if available in cache
  const enrichPapersWithPdfContent = async (papersToEnrich: Paper[]): Promise<Paper[]> => {
    return await Promise.all(papersToEnrich.map(async (p) => {
      // Only check if we know we have it cached AND we haven't extracted it yet
      if (cachedPdfIds.has(p.id) && !p.fullText) {
        try {
          const blob = await getPdfFromCache(p.id);
          if (blob) {
            const text = await extractTextFromPdf(blob);
            if (text.length > 50) {
              return { ...p, fullText: text };
            }
          }
        } catch (e) {
          console.warn(`Failed to extract text for ${p.id}`, e);
        }
      }
      return p;
    }));
  };

  // PDF Handling Functions
  const handleDownloadPdf = async (paper: Paper) => {
      if (!paper.pdfUrl) return;
      
      setIsDownloadingPdf(prev => ({ ...prev, [paper.id]: true }));
      try {
          let blob: Blob;

          try {
             // Attempt 1: Direct Fetch
             const response = await fetch(paper.pdfUrl);
             if (!response.ok) throw new Error('Direct fetch failed');
             blob = await response.blob();
          } catch (directError) {
             console.warn("Direct download failed (CORS?), trying proxy...", directError);
             // Attempt 2: CORS Proxy (corsproxy.io)
             // Using a standard CORS proxy to bypass browser restrictions for the demo
             const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(paper.pdfUrl)}`;
             const proxyResponse = await fetch(proxyUrl);
             if (!proxyResponse.ok) throw new Error('Proxy fetch failed');
             blob = await proxyResponse.blob();
          }
          
          await savePdfToCache(paper.id, blob);
          setCachedPdfIds(prev => {
              const newSet = new Set(prev);
              newSet.add(paper.id);
              return newSet;
          });
      } catch (error) {
          console.error("PDF Download failed:", error);
          alert("PDF indirilemedi. Sunucu indirmeye izin vermiyor (CORS). Lütfen 'PDF Bağlantısı' butonu ile yeni sekmede açın.");
      } finally {
          setIsDownloadingPdf(prev => ({ ...prev, [paper.id]: false }));
      }
  };

  const handleDeletePdf = async (paperId: string) => {
      if (!confirm("Bu PDF'i yerel hafızadan silmek istediğinize emin misiniz?")) return;
      try {
          await deletePdfFromCache(paperId);
          setCachedPdfIds(prev => {
              const newSet = new Set(prev);
              newSet.delete(paperId);
              return newSet;
          });
          // Remove fullText from memory if exists
          setSavedPapers(prev => prev.map(p => p.id === paperId ? { ...p, fullText: undefined } : p));
      } catch (error) {
          console.error("Delete failed:", error);
          alert("Silme işlemi başarısız oldu.");
      }
  };

  const handleOpenLocalPdf = async (paperId: string) => {
      try {
          const blob = await getPdfFromCache(paperId);
          if (blob) {
              const url = URL.createObjectURL(blob);
              window.open(url, '_blank');
          } else {
              alert("Dosya bulunamadı.");
          }
      } catch (error) {
          console.error("Open failed:", error);
          alert("Dosya açılamadı.");
      }
  };

  const clearSearch = () => {
    setQuery('');
    setPapers([]);
    setTotalResults(0);
    setHasSearched(false);
    setAnalyses({});
    setSynthesis("");
    setChatHistory([]);
    setView('search');
    // We don't necessarily clear filters here, but user might expect it. Let's keep filters.
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setView('search');
    setIsSearching(true);
    setHasSearched(true);
    setPapers([]);
    setTotalResults(0);
    setSelectedPaper(null);
    setSelectedPaperIds(new Set());
    setSynthesis("");
    setChatHistory([]);

    try {
      const response = await searchPapers(query, 0, 10);
      setPapers(response.papers);
      setTotalResults(response.total);

      if (response.papers.length > 0) {
        // Trigger row analysis
        triggerBatchAnalysis(response.papers);
        // Trigger synthesis
        triggerSynthesis(query, response.papers);
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
      
      // DEDUPLICATION LOGIC
      setPapers(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const uniqueNewPapers = newPapers.filter(p => !existingIds.has(p.id));
        return [...prev, ...uniqueNewPapers];
      });
      
      if (newPapers.length > 0) {
        triggerBatchAnalysis(newPapers);
      }
    } catch (error) {
      console.error("Load more failed", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleChatSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const currentMessage = chatInput.trim();
    setChatInput('');
    
    // Add user message
    const userMsg: ChatMessage = { role: 'user', content: currentMessage };
    setChatHistory(prev => [...prev, userMsg]);
    setIsChatLoading(true);

    try {
      // Determine context papers (search results or saved library depending on view)
      let contextPapers = view === 'search' ? papers : savedPapers;
      
      if (contextPapers.length === 0) {
         setChatHistory(prev => [...prev, { role: 'assistant', content: "Sohbet edebilmek için önce arama yapmalı veya kitaplığınıza makale eklemelisiniz." }]);
         setIsChatLoading(false);
         return;
      }
      
      // ENRICH WITH PDF CONTENT IF AVAILABLE
      // We only enrich the top 5 papers to be used in context to save performance
      const papersToEnrich = contextPapers.slice(0, 5);
      const enrichedPapers = await enrichPapersWithPdfContent(papersToEnrich);

      const response = await chatWithPapers(currentMessage, enrichedPapers, [...chatHistory, userMsg]);
      
      setChatHistory(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      console.error("Chat error:", error);
      setChatHistory(prev => [...prev, { role: 'assistant', content: "Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleWritePaper = async () => {
     if (!writeTopic.trim() || savedPapers.length === 0) return;
     
     setIsWriting(true);
     setGeneratedPaper(""); // Clear previous
     try {
         // Enrich cached papers with full text content
         const enrichedSavedPapers = await enrichPapersWithPdfContent(savedPapers);
         
         // Update state with enriched papers so we don't re-parse next time
         setSavedPapers(enrichedSavedPapers);

         const result = await generateLiteratureReview(writeTopic, enrichedSavedPapers);
         setGeneratedPaper(result);
     } catch (error) {
         setGeneratedPaper("Bir hata oluştu. Lütfen tekrar deneyin.");
         console.error(error);
     } finally {
         setIsWriting(false);
     }
  };

  const handleGenerateTopic = async () => {
    if (savedPapers.length === 0 || !ollamaStatus) return;
    setIsGeneratingTopic(true);
    try {
        const title = await generateTopicFromPapers(savedPapers);
        setWriteTopic(title.replace(/^["']|["']$/g, '')); // Remove quotes if model adds them
    } catch (e) {
        console.error("Topic generation failed", e);
    } finally {
        setIsGeneratingTopic(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedPaperIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedPaperIds(newSet);
  };

  const toggleSavePaper = (paper: Paper) => {
    setSavedPapers(prev => {
      const exists = prev.some(p => p.id === paper.id);
      if (exists) {
        return prev.filter(p => p.id !== paper.id);
      } else {
        return [...prev, paper];
      }
    });
  };

  const isSaved = (id: string) => savedPapers.some(p => p.id === id);

  // Filter Logic
  const getFilteredPapers = (rawPapers: Paper[]) => {
    return rawPapers.filter(paper => {
      if (filters.minYear !== '' && paper.year < filters.minYear) return false;
      if (filters.maxYear !== '' && paper.year > filters.maxYear) return false;
      if (filters.minCitations !== '' && paper.citationCount < filters.minCitations) return false;
      if (filters.hasPdf && !paper.pdfUrl) return false;
      return true;
    });
  };

  // Determine active papers based on View and Filter
  const sourcePapers = view === 'search' ? papers : savedPapers;
  const displayPapers = getFilteredPapers(sourcePapers);

  const activeFilterCount = [
    filters.minYear !== '', 
    filters.maxYear !== '', 
    filters.minCitations !== '', 
    filters.hasPdf
  ].filter(Boolean).length;

  const toggleSelectAll = () => {
    if (selectedPaperIds.size === displayPapers.length && displayPapers.length > 0) {
      setSelectedPaperIds(new Set());
    } else {
      setSelectedPaperIds(new Set(displayPapers.map(p => p.id)));
    }
  };

  const toggleColumn = (key: ColumnKey) => {
    const newSet = new Set(visibleColumns);
    if (newSet.has(key)) {
      if (newSet.size > 1) newSet.delete(key);
    } else {
      newSet.add(key);
      if (papers.length > 0) {
        papers.forEach(p => triggerSingleAnalysis(p, key));
      }
    }
    setVisibleColumns(newSet);
  };

  const triggerBatchAnalysis = (papersToAnalyze: Paper[]) => {
    papersToAnalyze.forEach(paper => {
      visibleColumns.forEach(colKey => {
        triggerSingleAnalysis(paper, colKey);
      });
    });
  };

  const triggerSingleAnalysis = async (paper: Paper, field: ColumnKey) => {
    if (analyses[paper.id]?.[field] && analyses[paper.id]?.[field] !== '...') return;

    setAnalyses(prev => ({
      ...prev,
      [paper.id]: {
        ...(prev[paper.id] || { paperId: paper.id, summary: '', methodology: '', outcome: '', isLoading: false }),
        [field]: undefined,
        isLoading: true 
      }
    }));

    try {
      const liveConnection = await checkOllamaConnection();
      if (!liveConnection) return;
      
      // Try to enrich paper with full text for better analysis if available
      let paperToAnalyze = paper;
      if (cachedPdfIds.has(paper.id) && !paper.fullText) {
          const enriched = await enrichPapersWithPdfContent([paper]);
          paperToAnalyze = enriched[0];
      }
      
      // Use full text if available, otherwise abstract
      const contentToAnalyze = paperToAnalyze.fullText 
        ? `(Tam Metin):\n${paperToAnalyze.fullText.substring(0, 5000)}` 
        : paperToAnalyze.abstract;

      const result = await analyzePaperWithOllama(contentToAnalyze, field);
      
      setAnalyses(prev => ({
        ...prev,
        [paper.id]: {
          ...(prev[paper.id] || { paperId: paper.id, summary: '', methodology: '', outcome: '', isLoading: false }),
          [field]: result,
          isLoading: false
        }
      }));

    } catch (error) {
       console.error(`Analysis failed for ${paper.id} field ${field}`);
    }
  };

  const triggerSynthesis = async (searchQuery: string, currentPapers: Paper[]) => {
    setIsSynthesizing(true);
    try {
      const liveConnection = await checkOllamaConnection();
      if (!liveConnection) {
        setSynthesis("Ollama bağlantısı kurulamadığı için sentez yapılamadı.");
        return;
      }
      
      // Enrich top 5 papers for synthesis if possible
      const papersToEnrich = currentPapers.slice(0, 5);
      const enrichedPapers = await enrichPapersWithPdfContent(papersToEnrich);
      
      const result = await synthesizeFindings(searchQuery, enrichedPapers);
      setSynthesis(result);
    } catch (error) {
      setSynthesis("Sentez sırasında bir hata oluştu.");
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleExport = () => {
    // If papers are selected, export those. Otherwise, export all visible papers.
    const targetPapers = selectedPaperIds.size > 0 
      ? displayPapers.filter(p => selectedPaperIds.has(p.id))
      : displayPapers;

    if (targetPapers.length === 0) {
      alert("Dışa aktarılacak makale bulunamadı.");
      return;
    }

    let markdownContent = `# Araştırma Raporu\n\n`;
    markdownContent += `**Tarih:** ${new Date().toLocaleDateString('tr-TR')}\n`;
    markdownContent += `**Kaynak:** Yerel Elicit\n\n---\n\n`;

    targetPapers.forEach((paper, index) => {
      const analysis = analyses[paper.id];
      
      markdownContent += `## ${index + 1}. ${paper.title}\n\n`;
      markdownContent += `**Yazarlar:** ${paper.authors.join(', ')}\n`;
      markdownContent += `**Yıl:** ${paper.year}\n`;
      if (paper.doi) {
        markdownContent += `**DOI:** [${paper.doi}](https://doi.org/${paper.doi})\n`;
      }
      markdownContent += `**Dergi/Kaynak:** ${paper.source}\n\n`;
      
      markdownContent += `### Özet (Abstract)\n${paper.abstract}\n\n`;
      
      if (analysis) {
         if (analysis.summary && visibleColumns.has('summary')) {
            markdownContent += `### AI Özeti\n${analysis.summary}\n\n`;
         }
         if (analysis.methodology && visibleColumns.has('methodology')) {
            markdownContent += `### Metodoloji\n${analysis.methodology}\n\n`;
         }
         if (analysis.outcome && visibleColumns.has('outcome')) {
            markdownContent += `### Bulgular\n${analysis.outcome}\n\n`;
         }
      }
      
      markdownContent += `---\n\n`;
    });

    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'research_report.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen flex flex-col bg-white text-gray-900 font-sans overflow-hidden">
      
      {selectedPaper && (
        <PaperDetailModal 
          paper={selectedPaper}
          analysis={analyses[selectedPaper.id]}
          isOpen={!!selectedPaper}
          onClose={() => setSelectedPaper(null)}
          onAnalyze={(p) => triggerBatchAnalysis([p])}
          ollamaConnected={!!ollamaStatus}
          isSaved={isSaved(selectedPaper.id)}
          onToggleSave={() => toggleSavePaper(selectedPaper)}
          isCached={cachedPdfIds.has(selectedPaper.id)}
          isDownloading={isDownloadingPdf[selectedPaper.id]}
          onDownloadPdf={() => handleDownloadPdf(selectedPaper)}
          onDeletePdf={() => handleDeletePdf(selectedPaper.id)}
          onOpenPdf={() => handleOpenLocalPdf(selectedPaper.id)}
        />
      )}

      {/* Navbar */}
      <header className="h-14 border-b border-gray-200 flex items-center px-4 justify-between bg-white z-20 shrink-0">
        <div className="flex items-center gap-4 flex-1">
           <div className="flex items-center gap-2 font-bold text-lg text-gray-800 mr-4">
              <div className="bg-purple-600 p-1 rounded text-white"><Sparkles className="w-4 h-4" /></div>
              Yerel Elicit
           </div>
           
           {view !== 'write' && (
               <form onSubmit={handleSearch} className="relative w-full max-w-xl transition-all">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-9 pr-8 py-1.5 bg-gray-100 border-transparent focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-md text-sm placeholder-gray-500 transition-all"
                    placeholder="Araştırma sorunuzu yazın..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
               </form>
           )}

           {/* View Toggles */}
           <div className="flex items-center bg-gray-100 p-1 rounded-lg">
             <button
                onClick={() => setView('search')}
                className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium transition-all ${view === 'search' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
             >
                <Search className="w-3.5 h-3.5" />
                Arama
             </button>
             <button
                onClick={() => setView('library')}
                className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium transition-all ${view === 'library' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
             >
                <Library className="w-3.5 h-3.5" />
                Kitaplığım ({savedPapers.length})
             </button>
             <button
                onClick={() => setView('write')}
                className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium transition-all ${view === 'write' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
             >
                <PenTool className="w-3.5 h-3.5" />
                Yazım Asistanı
             </button>
           </div>
        </div>

        <div className="flex items-center gap-3 text-sm">
           <div className={`flex items-center px-2 py-1 rounded text-xs font-medium ${ollamaStatus ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
             <Database className="w-3 h-3 mr-1.5" />
             {ollamaStatus ? 'Model Hazır' : 'Model Kapalı'}
           </div>
           <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-bold text-xs">
             S
           </div>
        </div>
      </header>

      {/* Toolbar - Only show in Search/Library mode */}
      {view !== 'write' && (
        <div className="h-12 border-b border-gray-200 flex items-center px-4 justify-between bg-white shrink-0 relative">
           <div className="flex items-center gap-2">
              <ToolbarButton icon={<ArrowUpDown className="w-3.5 h-3.5" />} label="Sırala" />
              <div className="h-4 w-px bg-gray-300 mx-1"></div>
              
              {/* Filter Button & Menu */}
              <div className="relative" ref={filterMenuRef}>
                 <button 
                    onClick={() => setShowFilterMenu(!showFilterMenu)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors border ${showFilterMenu || activeFilterCount > 0 ? 'bg-purple-50 border-purple-200 text-purple-700' : 'text-gray-600 hover:bg-gray-100 border-transparent hover:border-gray-200'}`}
                 >
                    <Filter className="w-3.5 h-3.5" />
                    Filtrele
                    {activeFilterCount > 0 && (
                       <span className="ml-1 px-1.5 py-0.5 bg-purple-600 text-white text-[10px] rounded-full">
                          {activeFilterCount}
                       </span>
                    )}
                 </button>

                 {showFilterMenu && (
                    <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-50 animate-in fade-in zoom-in-95 duration-100">
                       <div className="p-4 space-y-4">
                          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                             <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Filtreler</span>
                             <button 
                                onClick={() => setFilters({ minYear: '', maxYear: '', minCitations: '', hasPdf: false })}
                                className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                             >
                                Temizle
                             </button>
                          </div>

                          {/* Year Filter */}
                          <div className="space-y-2">
                             <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                Yıl Aralığı
                             </label>
                             <div className="flex items-center gap-2">
                                <input 
                                   type="number" 
                                   placeholder="Min" 
                                   className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm focus:outline-none focus:border-purple-500"
                                   value={filters.minYear}
                                   onChange={(e) => setFilters(prev => ({ ...prev, minYear: e.target.value ? parseInt(e.target.value) : '' }))}
                                />
                                <span className="text-gray-400">-</span>
                                <input 
                                   type="number" 
                                   placeholder="Max" 
                                   className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm focus:outline-none focus:border-purple-500"
                                   value={filters.maxYear}
                                   onChange={(e) => setFilters(prev => ({ ...prev, maxYear: e.target.value ? parseInt(e.target.value) : '' }))}
                                />
                             </div>
                          </div>

                          {/* Citation Filter */}
                          <div className="space-y-2">
                             <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                <Hash className="w-4 h-4 text-gray-400" />
                                Minimum Atıf
                             </label>
                             <input 
                                type="number" 
                                placeholder="0" 
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm focus:outline-none focus:border-purple-500"
                                value={filters.minCitations}
                                onChange={(e) => setFilters(prev => ({ ...prev, minCitations: e.target.value ? parseInt(e.target.value) : '' }))}
                             />
                          </div>
                       </div>
                    </div>
                 )}
              </div>

              {/* Quick PDF Filter */}
              <button 
                onClick={() => setFilters(prev => ({ ...prev, hasPdf: !prev.hasPdf }))}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors border ${filters.hasPdf ? 'bg-red-50 border-red-200 text-red-700' : 'text-gray-600 hover:bg-gray-100 border-transparent hover:border-gray-200'}`}
              >
                <FileCheck className="w-3.5 h-3.5" />
                Sadece PDF
              </button>

              <div className="relative" ref={columnMenuRef}>
                <button 
                  onClick={() => setShowColumnMenu(!showColumnMenu)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors border ${showColumnMenu ? 'bg-purple-50 border-purple-200 text-purple-700' : 'text-gray-600 hover:bg-gray-100 border-transparent hover:border-gray-200'}`}
                >
                  <Layout className="w-3.5 h-3.5" />
                  Sütunlar
                </button>
                
                {showColumnMenu && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Görünüm Seçenekleri</div>
                    {AVAILABLE_COLUMNS.map((col) => (
                      <button
                        key={col.key}
                        onClick={() => toggleColumn(col.key)}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                      >
                        <span>{col.label}</span>
                        {visibleColumns.has(col.key) && <Check className="w-4 h-4 text-purple-600" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <ToolbarButton onClick={handleExport} icon={<Download className="w-3.5 h-3.5" />} label="Dışa Aktar" />
           </div>
           <div className="text-xs text-gray-500">
              {view === 'search' ? (
                  // Use filtered count if filters are active
                  totalResults > 0 ? (
                    activeFilterCount > 0 
                       ? `${displayPapers.length} / ${totalResults} sonuç gösteriliyor (Filtreli)`
                       : `${totalResults} sonuç bulundu`
                  ) : ''
              ) : (
                  `${savedPapers.length} makale kayıtlı`
              )}
           </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {view === 'write' ? (
             // WRITER VIEW
             <div className="flex-1 flex overflow-hidden">
                {/* Source Panel */}
                <div className="w-1/3 min-w-[300px] border-r border-gray-200 bg-gray-50 flex flex-col">
                   <div className="p-4 border-b border-gray-200 bg-white">
                      <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                          <Library className="w-4 h-4" />
                          Kaynak Listesi ({savedPapers.length})
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">Makale yazımı için sadece bu kaynaklar kullanılacaktır.</p>
                   </div>
                   <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {savedPapers.length === 0 ? (
                          <div className="text-center p-6 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                              <BookText className="w-8 h-8 mx-auto mb-2 opacity-50"/>
                              <p className="text-sm">Kitaplığınız boş.</p>
                              <button onClick={() => setView('search')} className="text-xs text-purple-600 font-medium hover:underline mt-2">Arama yapıp makale ekleyin</button>
                          </div>
                      ) : (
                          savedPapers.map((paper, idx) => (
                              <div key={paper.id} className="bg-white p-3 rounded border border-gray-200 shadow-sm text-sm">
                                  <div className="font-bold text-gray-800 flex gap-2 justify-between">
                                      <div className="flex gap-2">
                                        <span className="text-purple-600">[{idx + 1}]</span>
                                        {paper.title}
                                      </div>
                                      {paper.fullText && (
                                        <span className="text-[10px] uppercase font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded h-fit whitespace-nowrap">
                                          Tam Metin
                                        </span>
                                      )}
                                  </div>
                                  <div className="text-gray-500 text-xs mt-1">
                                      {paper.authors[0]}, {paper.year}
                                  </div>
                              </div>
                          ))
                      )}
                   </div>
                </div>

                {/* Editor Panel */}
                <div className="flex-1 flex flex-col bg-white">
                   <div className="p-6 border-b border-gray-100">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Makale Konusu / Başlığı</label>
                      <div className="flex gap-3">
                         <div className="relative flex-1">
                            <input 
                                type="text" 
                                className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="Örn: Yapay Zekanın Tıbbi Görüntülemedeki Etkileri"
                                value={writeTopic}
                                onChange={(e) => setWriteTopic(e.target.value)}
                            />
                            <button
                                onClick={handleGenerateTopic}
                                disabled={isGeneratingTopic || savedPapers.length === 0 || !ollamaStatus}
                                className="absolute right-2 top-1.5 p-1 text-purple-600 hover:bg-purple-50 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                                title="Kaynaklara göre başlık öner"
                            >
                                {isGeneratingTopic ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4"/>}
                            </button>
                         </div>
                         <button 
                            onClick={handleWritePaper}
                            disabled={isWriting || savedPapers.length === 0 || !ollamaStatus}
                            className="bg-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                         >
                            {isWriting ? <Loader2 className="w-4 h-4 animate-spin"/> : <PenTool className="w-4 h-4"/>}
                            {isWriting ? 'Yazılıyor...' : 'Taslak Oluştur'}
                         </button>
                      </div>
                      {!ollamaStatus && <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Ollama bağlantısı gerekli.</p>}
                   </div>

                   <div className="flex-1 overflow-y-auto p-8 bg-gray-50/30">
                      {generatedPaper ? (
                          <div className="max-w-3xl mx-auto bg-white p-10 rounded-xl shadow-sm border border-gray-100 min-h-[500px] prose prose-sm prose-purple">
                              <div className="whitespace-pre-wrap font-serif text-gray-800 leading-relaxed">
                                  {generatedPaper}
                              </div>
                          </div>
                      ) : (
                          <div className="h-full flex flex-col items-center justify-center text-gray-400">
                              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                  <FileText className="w-8 h-8 text-gray-300" />
                              </div>
                              <h3 className="text-lg font-medium text-gray-600">Henüz Bir Taslak Yok</h3>
                              <p className="text-sm mt-2 max-w-sm text-center">Konunuzu girin ve sol taraftaki kaynakları kullanarak akademik bir taslak oluşturun.</p>
                          </div>
                      )}
                   </div>
                </div>
             </div>
        ) : (
            // SEARCH / LIBRARY TABLE VIEW (Existing)
            <div className="flex-1 flex flex-col min-w-0 bg-gray-50/50">
           
           {/* Empty State - Initial Search */}
           {view === 'search' && !hasSearched && !isSearching && papers.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                     <Search className="w-8 h-8 text-gray-300" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-600">Araştırmaya Başla</h3>
                  <p className="text-sm mt-2 max-w-md text-center">Makaleleri analiz etmek, metodolojileri çıkarmak ve sonuçları sentezlemek için bir konu arayın.</p>
                  
                  <div className="mt-8 grid grid-cols-2 gap-3 w-full max-w-lg">
                      <SampleQueryCard query="Kafeinin uyku kalitesine etkisi" onClick={(q) => { setQuery(q); handleSearch(); }} />
                      <SampleQueryCard query="Yapay zekanın sağlıkta kullanımı" onClick={(q) => { setQuery(q); handleSearch(); }} />
                  </div>
              </div>
           )}

            {/* Empty State - Library */}
           {view === 'library' && savedPapers.length === 0 && (
             <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
               <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Library className="w-8 h-8 text-gray-300" />
               </div>
               <h3 className="text-lg font-medium text-gray-600">Kitaplığınız Boş</h3>
               <p className="text-sm mt-2 max-w-md text-center">Arama sonuçlarından ilgilendiğiniz makaleleri kaydederek burada görüntüleyebilirsiniz.</p>
             </div>
           )}
           
           {/* Empty State - Filter Result Empty */}
           {hasSearched && !isSearching && sourcePapers.length > 0 && displayPapers.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
                 <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mb-4">
                    <Filter className="w-8 h-8 text-purple-300" />
                 </div>
                 <h3 className="text-lg font-medium text-gray-600">Sonuç Bulunamadı</h3>
                 <p className="text-sm mt-2 max-w-md text-center">Seçilen filtreler çok kısıtlayıcı olabilir. Filtreleri temizleyip tekrar deneyin.</p>
                 <button 
                    onClick={() => setFilters({ minYear: '', maxYear: '', minCitations: '', hasPdf: false })}
                    className="mt-4 px-4 py-2 bg-white border border-gray-300 rounded text-sm font-medium hover:bg-gray-50 text-gray-700"
                 >
                    Filtreleri Temizle
                 </button>
              </div>
           )}

           {(displayPapers.length > 0 || isSearching) && (
             <div className="flex-1 overflow-auto">
               <table className="min-w-full divide-y divide-gray-200 border-separate border-spacing-0 table-fixed">
                  <thead className="bg-white sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th scope="col" className="w-10 px-3 py-3 border-b border-gray-200">
                         <div 
                           className="cursor-pointer text-gray-400 hover:text-gray-600"
                           onClick={toggleSelectAll}
                         >
                           {selectedPaperIds.size > 0 && selectedPaperIds.size === displayPapers.length ? (
                             <CheckSquare className="w-4 h-4 text-purple-600" />
                           ) : (
                             <Square className="w-4 h-4" />
                           )}
                         </div>
                      </th>
                      {/* Paper Column (Fixed) */}
                      <th scope="col" className="w-[30%] min-w-[300px] px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-r border-gray-200 bg-gray-50/50">
                        Makale
                      </th>
                      {/* Dynamic Columns */}
                      {AVAILABLE_COLUMNS.filter(col => visibleColumns.has(col.key)).map((col, idx, arr) => (
                        <th 
                          key={col.key}
                          scope="col" 
                          className={`min-w-[250px] px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 ${idx !== arr.length - 1 ? 'border-r' : ''}`}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {displayPapers.map((paper) => {
                       const analysis = analyses[paper.id];
                       const isSelected = selectedPaperIds.has(paper.id);
                       const saved = isSaved(paper.id);
                       const isCached = cachedPdfIds.has(paper.id);
                       const isDownloading = isDownloadingPdf[paper.id];

                       return (
                         <tr 
                           key={paper.id} 
                           onClick={() => setSelectedPaper(paper)}
                           className={`hover:bg-purple-50/10 group transition-colors cursor-pointer ${isSelected ? 'bg-purple-50/20' : ''}`}
                         >
                           <td className="px-3 py-5 align-top border-r border-transparent" onClick={(e) => e.stopPropagation()}>
                              <div 
                                className="cursor-pointer pt-1"
                                onClick={() => toggleSelection(paper.id)}
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-purple-600" />
                                ) : (
                                  <Square className="w-4 h-4 text-gray-300 group-hover:text-gray-400" />
                                )}
                              </div>
                           </td>
                           <td className="px-5 py-5 align-top border-r border-gray-100">
                             <div className="flex flex-col gap-1.5">
                               <div 
                                 className="text-base font-bold text-gray-900 hover:text-purple-600 hover:underline leading-snug"
                               >
                                 {paper.title}
                               </div>
                               
                               <div className="text-sm text-gray-500 font-medium">
                                 {paper.authors.slice(0, 3).join(', ')}{paper.authors.length > 3 ? ' et al.' : ''}
                               </div>
                               
                               <div className="flex flex-wrap items-center gap-2 mt-2">
                                 <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                   {paper.year}
                                 </span>
                                 <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                   {paper.citationCount} atıf
                                 </span>
                                 {paper.doi && (
                                    <a
                                      href={`https://doi.org/${paper.doi}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 hover:underline z-10 relative"
                                    >
                                      DOI: {paper.doi.length > 25 ? paper.doi.substring(0, 25) + '...' : paper.doi}
                                      <ExternalLink className="w-2.5 h-2.5 ml-1" />
                                    </a>
                                 )}
                               </div>

                               <div className="flex items-center gap-3 mt-3 pt-1">
                                  {paper.pdfUrl && (
                                    view === 'library' || saved ? (
                                        isCached ? (
                                           <div className="flex items-center gap-1">
                                              <button 
                                                onClick={(e) => { e.stopPropagation(); handleOpenLocalPdf(paper.id); }}
                                                className="flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded border border-green-200 hover:bg-green-100 transition-colors z-10 relative"
                                                title="Yerel PDF Aç"
                                              >
                                                <FileCheck className="w-3.5 h-3.5" />
                                                Yerel PDF
                                              </button>
                                              <button
                                                onClick={(e) => { e.stopPropagation(); handleDeletePdf(paper.id); }}
                                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded z-10 relative"
                                                title="PDF'i Yerelden Sil"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                           </div>
                                        ) : (
                                           <button 
                                             onClick={(e) => { e.stopPropagation(); handleDownloadPdf(paper); }}
                                             disabled={isDownloading}
                                             className="flex items-center gap-1.5 text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded border border-purple-100 hover:bg-purple-100 transition-colors z-10 relative disabled:opacity-50"
                                           >
                                              {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                              {isDownloading ? '...' : 'Önbelleğe İndir'}
                                           </button>
                                        )
                                    ) : (
                                       <a 
                                        href={paper.pdfUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100 hover:bg-red-100 transition-colors z-10 relative"
                                        title="PDF Bağlantısı"
                                      >
                                        <FileText className="w-3.5 h-3.5" />
                                        PDF
                                      </a>
                                    )
                                  )}
                                  
                                  <div className="w-px h-3 bg-gray-300 mx-1"></div>

                                  <button 
                                     onClick={(e) => { e.stopPropagation(); setSelectedPaper(paper); }}
                                     className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-purple-600 transition-colors px-1 z-10 relative"
                                  >
                                     <BookOpen className="w-3.5 h-3.5" />
                                     Özet
                                  </button>
                                  
                                  <div className="flex-1"></div>

                                  <button 
                                    onClick={(e) => { e.stopPropagation(); toggleSavePaper(paper); }}
                                    className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded transition-colors border z-10 relative ${saved ? 'text-purple-700 bg-purple-50 border-purple-200' : 'text-gray-400 hover:text-gray-600 border-transparent'}`}
                                  >
                                    <Bookmark className={`w-3.5 h-3.5 ${saved ? 'fill-current' : ''}`} />
                                    {saved ? 'Kaydedildi' : 'Kaydet'}
                                  </button>
                               </div>
                             </div>
                           </td>
                           
                           {/* Dynamic Analysis Cells */}
                           {AVAILABLE_COLUMNS.filter(col => visibleColumns.has(col.key)).map((col, idx, arr) => (
                             <AnalysisCell 
                                key={col.key}
                                content={analysis?.[col.key]} 
                                isLoading={analysis?.isLoading && !analysis?.[col.key]} 
                                isLast={idx === arr.length - 1} 
                             />
                           ))}
                         </tr>
                       );
                    })}
                    
                    {/* Loading Skeleton */}
                    {isSearching && view === 'search' && Array.from({ length: 3 }).map((_, i) => (
                       <tr key={i}>
                          <td className="p-4"><div className="w-4 h-4 bg-gray-200 rounded animate-pulse"/></td>
                          <td className="p-5 border-r border-gray-100">
                             <div className="space-y-3">
                                <div className="h-5 bg-gray-200 rounded w-11/12 animate-pulse"/>
                                <div className="h-4 bg-gray-100 rounded w-1/2 animate-pulse"/>
                                <div className="flex gap-2">
                                  <div className="h-4 w-12 bg-gray-100 rounded animate-pulse"/>
                                  <div className="h-4 w-16 bg-gray-100 rounded animate-pulse"/>
                                </div>
                             </div>
                          </td>
                          {Array.from({ length: visibleColumns.size }).map((_, j) => (
                             <td key={j} className="p-5"><div className="h-24 bg-gray-50 rounded animate-pulse"/></td>
                          ))}
                       </tr>
                    ))}
                  </tbody>
               </table>
               
               {/* Load More Trigger - Only in Search View */}
               {view === 'search' && papers.length < totalResults && !isSearching && (
                 <div className="p-4 flex justify-center border-t border-gray-200 bg-white">
                    <button 
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                      className="text-sm font-medium text-purple-600 hover:text-purple-700 flex items-center gap-2 px-4 py-2 hover:bg-purple-50 rounded-md transition-colors"
                    >
                      {isLoadingMore ? <Loader2 className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4"/>}
                      Daha fazla yükle
                    </button>
                 </div>
               )}
             </div>
           )}
        </div>

        {/* Right: Sidebar / Chat - Hide in Write mode to give full width to editor */}
        {view !== 'write' && (
            <div className={`w-[360px] bg-white border-l border-gray-200 flex flex-col shrink-0 transition-all duration-300 ${sidebarOpen ? 'translate-x-0' : 'translate-x-full hidden'}`}>
               <div className="h-12 border-b border-gray-200 flex items-center justify-between px-4 bg-gray-50/50 shrink-0">
                  <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Makalelerle Sohbet
                  </span>
                  <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <ChevronRight className="w-4 h-4" />
                  </button>
               </div>
               
               <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Pinned Synthesis Box */}
                  {(hasSearched || synthesis) && (
                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 shrink-0">
                       <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                            Sentez
                          </div>
                          <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[10px] normal-case">AI</span>
                       </div>
                       
                       <div className="text-sm text-gray-800 leading-relaxed">
                          {isSynthesizing ? (
                             <div className="flex flex-col gap-2 animate-pulse">
                                <div className="h-3 bg-gray-100 rounded w-full"></div>
                                <div className="h-3 bg-gray-100 rounded w-5/6"></div>
                                <div className="h-3 bg-gray-100 rounded w-4/5"></div>
                                <span className="text-xs text-purple-500 flex items-center gap-1 mt-1">
                                   <Sparkles className="w-3 h-3" />
                                   {view === 'search' ? 'Arama sonuçları sentezleniyor...' : 'Kitaplık sentezleniyor...'}
                                </span>
                             </div>
                          ) : synthesis ? (
                             <div className="space-y-3">
                                <p className="whitespace-pre-line">{synthesis}</p>
                                <div className="mt-2 text-xs text-gray-400 border-t pt-2">
                                   * Listenin başındaki makalelere dayalıdır.
                                </div>
                             </div>
                          ) : (
                             <div className="text-gray-500 italic text-xs">
                                {ollamaStatus ? 'Sentez bekleniyor...' : 'Sentez için Ollama gerekli.'}
                             </div>
                          )}

                          {ollamaStatus === false && !synthesis && (
                            <div className="mt-3 p-2 bg-red-50 text-red-700 text-xs rounded flex gap-2">
                               <AlertCircle className="w-4 h-4 shrink-0" />
                               Ollama'nın çalıştığından emin olun.
                            </div>
                          )}
                       </div>
                    </div>
                  )}

                  {/* Empty Chat State */}
                  {!hasSearched && chatHistory.length === 0 && (
                     <div className="flex flex-col items-center justify-center text-center text-gray-400 py-10">
                        <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                        <p className="text-sm">Sonuçlar hakkında sohbet etmek için arama yapın.</p>
                     </div>
                  )}

                  {/* Chat Messages */}
                  {chatHistory.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-gray-200' : 'bg-purple-100 text-purple-700'}`}>
                          {msg.role === 'user' ? <User className="w-4 h-4 text-gray-600" /> : <Bot className="w-5 h-5" />}
                       </div>
                       <div className={`rounded-lg p-3 text-sm max-w-[85%] ${msg.role === 'user' ? 'bg-gray-100 text-gray-800' : 'bg-white border border-gray-200 text-gray-800 shadow-sm'}`}>
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                       </div>
                    </div>
                  ))}

                  {isChatLoading && (
                     <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                           <Bot className="w-5 h-5" />
                        </div>
                        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                           <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                        </div>
                     </div>
                  )}
                  
                  <div ref={chatEndRef} />
               </div>

               {/* Chat Input */}
               <div className="p-4 border-t border-gray-200 bg-white shrink-0">
                  <form onSubmit={handleChatSubmit} className="relative">
                     <input 
                       type="text" 
                       value={chatInput}
                       onChange={(e) => setChatInput(e.target.value)}
                       className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                       placeholder="Makaleler hakkında soru sorun..."
                       disabled={isChatLoading || !ollamaStatus}
                     />
                     <button 
                        type="submit"
                        disabled={!chatInput.trim() || isChatLoading || !ollamaStatus}
                        className="absolute right-2 top-2 p-1.5 text-gray-400 hover:text-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                     >
                        <Send className="w-4 h-4" />
                     </button>
                  </form>
               </div>
            </div>
        )}
      </div>
    </div>
  );
};

// UI Components
const ToolbarButton = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) => (
  <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-md transition-colors border border-transparent hover:border-gray-200">
    {icon}
    {label}
  </button>
);

const AnalysisCell: React.FC<{ content?: string, isLoading?: boolean, isLast?: boolean }> = ({ content, isLoading, isLast = false }) => {
   return (
      <td className={`px-5 py-5 align-top text-sm text-gray-700 leading-relaxed ${isLast ? '' : 'border-r border-gray-100'}`}>
         {isLoading ? (
            <div className="space-y-3 opacity-60">
               <div className="h-2 bg-gray-200 rounded w-full animate-pulse"/>
               <div className="h-2 bg-gray-200 rounded w-5/6 animate-pulse"/>
               <div className="h-2 bg-gray-200 rounded w-4/6 animate-pulse"/>
            </div>
         ) : content ? (
            <div className="line-clamp-[10] whitespace-pre-line">{content}</div>
         ) : (
            <span className="text-gray-300 italic">-</span>
         )}
      </td>
   );
};

const SampleQueryCard = ({ query, onClick }: { query: string, onClick: (q: string) => void }) => (
   <div 
     onClick={() => onClick(query)}
     className="bg-white border border-gray-200 p-3 rounded-lg text-sm text-gray-600 cursor-pointer hover:border-purple-300 hover:shadow-sm transition-all text-center"
   >
      {query}
   </div>
);

export default App;