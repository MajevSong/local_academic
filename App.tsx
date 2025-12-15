import React, { useState, useEffect } from 'react';
import { Search, Database, AlertCircle, Loader2, Sparkles, Filter, ArrowUpDown, Download, Layout, ChevronRight, Send, CheckSquare, Square, MessageSquare, Plus, ExternalLink, XCircle, FileText, Link as LinkIcon } from 'lucide-react';
import { Paper, AnalysisResult } from './types';
import { searchPapers } from './services/paperService';
import { analyzePaperWithOllama, checkOllamaConnection } from './services/ollamaService';
import PaperDetailModal from './components/PaperDetailModal';

const App: React.FC = () => {
  // State
  const [query, setQuery] = useState('');
  
  // Data State
  const [papers, setPapers] = useState<Paper[]>([]);
  const [savedPapers, setSavedPapers] = useState<Paper[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('savedPapers');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  
  // Pagination State
  const [totalResults, setTotalResults] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const [analyses, setAnalyses] = useState<Record<string, AnalysisResult>>({});
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  
  // Selection State for Checkboxes
  const [selectedPaperIds, setSelectedPaperIds] = useState<Set<string>>(new Set());

  // UI State
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Initial check for Ollama
  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem('savedPapers', JSON.stringify(savedPapers));
  }, [savedPapers]);

  const checkConnection = async () => {
    const isConnected = await checkOllamaConnection();
    setOllamaStatus(isConnected);
  };

  const clearSearch = () => {
    setQuery('');
    setPapers([]);
    setTotalResults(0);
    setHasSearched(false);
    setAnalyses({});
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    setPapers([]);
    setTotalResults(0);
    setSelectedPaper(null);
    setSelectedPaperIds(new Set());

    try {
      const response = await searchPapers(query, 0, 10);
      setPapers(response.papers);
      setTotalResults(response.total);

      // Trigger analysis automatically
      if (response.papers.length > 0) {
        response.papers.forEach(paper => {
          if (!analyses[paper.id]) triggerAnalysis(paper);
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
      
      if (newPapers.length > 0) {
        newPapers.forEach(paper => {
          if (!analyses[paper.id]) triggerAnalysis(paper);
        });
      }
    } catch (error) {
      console.error("Load more failed", error);
    } finally {
      setIsLoadingMore(false);
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

  const toggleSelectAll = () => {
    if (selectedPaperIds.size === papers.length && papers.length > 0) {
      setSelectedPaperIds(new Set());
    } else {
      setSelectedPaperIds(new Set(papers.map(p => p.id)));
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
      if (!liveConnection) throw new Error("Ollama bağlantısı yok");

      // Only fetch summary for the table view as requested
      const summary = await analyzePaperWithOllama(paper.abstract, 'summary');
      
      // We skip methodology and outcome for the main table to be fast, 
      // but the state structure supports them if we open the modal later.
      
      setAnalyses(prev => ({
        ...prev,
        [paper.id]: {
          paperId: paper.id,
          summary,
          methodology: '',
          outcome: '',
          isLoading: false
        }
      }));

    } catch (error: any) {
      setAnalyses(prev => ({
        ...prev,
        [paper.id]: {
          ...prev[paper.id],
          isLoading: false,
          error: "Analiz başarısız."
        }
      }));
    }
  };

  return (
    <div className="h-screen flex flex-col bg-white text-gray-900 font-sans overflow-hidden">
      
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

      {/* Navbar */}
      <header className="h-14 border-b border-gray-200 flex items-center px-4 justify-between bg-white z-20 shrink-0">
        <div className="flex items-center gap-4 flex-1">
           <div className="flex items-center gap-2 font-bold text-lg text-gray-800 mr-4">
              <div className="bg-purple-600 p-1 rounded text-white"><Sparkles className="w-4 h-4" /></div>
              Elicit Clone
           </div>
           
           <form onSubmit={handleSearch} className="relative w-full max-w-2xl">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-9 pr-8 py-1.5 bg-gray-100 border-transparent focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-md text-sm placeholder-gray-500 transition-all"
                placeholder="Search for papers..."
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
        </div>

        <div className="flex items-center gap-3 text-sm">
           <div className={`flex items-center px-2 py-1 rounded text-xs font-medium ${ollamaStatus ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
             <Database className="w-3 h-3 mr-1.5" />
             {ollamaStatus ? 'Local Model Ready' : 'Model Offline'}
           </div>
           <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-bold text-xs">
             YO
           </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="h-12 border-b border-gray-200 flex items-center px-4 justify-between bg-white shrink-0">
         <div className="flex items-center gap-2">
            <ToolbarButton icon={<ArrowUpDown className="w-3.5 h-3.5" />} label="Sort: Most relevant" />
            <div className="h-4 w-px bg-gray-300 mx-1"></div>
            <ToolbarButton icon={<Filter className="w-3.5 h-3.5" />} label="Filters" />
            <ToolbarButton icon={<Layout className="w-3.5 h-3.5" />} label="Columns" />
            <ToolbarButton icon={<Download className="w-3.5 h-3.5" />} label="Export" />
         </div>
         <div className="text-xs text-gray-500">
            {totalResults > 0 && `${totalResults} results found`}
         </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left: Table */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-50/50">
           
           {!hasSearched && !isSearching && papers.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                     <Search className="w-8 h-8 text-gray-300" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-600">Start your research</h3>
                  <p className="text-sm mt-2 max-w-md text-center">Search for a topic to analyze papers, extract methodologies, and synthesize results.</p>
                  
                  <div className="mt-8 grid grid-cols-2 gap-3 w-full max-w-lg">
                      <SampleQueryCard query="Impact of caffeine on sleep" onClick={setQuery} />
                      <SampleQueryCard query="Machine learning in healthcare" onClick={setQuery} />
                  </div>
              </div>
           )}

           {(papers.length > 0 || isSearching) && (
             <div className="flex-1 overflow-auto">
               <table className="min-w-full divide-y divide-gray-200 border-separate border-spacing-0">
                  <thead className="bg-white sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th scope="col" className="w-10 px-3 py-3 border-b border-gray-200">
                         <div 
                           className="cursor-pointer text-gray-400 hover:text-gray-600"
                           onClick={toggleSelectAll}
                         >
                           {selectedPaperIds.size > 0 && selectedPaperIds.size === papers.length ? (
                             <CheckSquare className="w-4 h-4 text-purple-600" />
                           ) : (
                             <Square className="w-4 h-4" />
                           )}
                         </div>
                      </th>
                      {/* Elicit-like: Paper Column (Wide) */}
                      <th scope="col" className="w-[45%] px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-r border-gray-200 bg-gray-50/50">
                        Paper
                      </th>
                      {/* Elicit-like: Summary Column (Wide) */}
                      <th scope="col" className="w-[55%] px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                        Summary
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {papers.map((paper) => {
                       const analysis = analyses[paper.id];
                       const isSelected = selectedPaperIds.has(paper.id);

                       return (
                         <tr 
                           key={paper.id} 
                           className={`hover:bg-purple-50/10 group transition-colors ${isSelected ? 'bg-purple-50/20' : ''}`}
                         >
                           <td className="px-3 py-5 align-top border-r border-transparent">
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
                               <a 
                                 href={paper.url || '#'} 
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 className="text-base font-bold text-gray-900 hover:text-purple-600 hover:underline leading-snug"
                               >
                                 {paper.title}
                               </a>
                               
                               <div className="text-sm text-gray-500 font-medium">
                                 {paper.authors.slice(0, 3).join(', ')}{paper.authors.length > 3 ? ' et al.' : ''}
                               </div>
                               
                               <div className="flex flex-wrap items-center gap-2 mt-2">
                                 <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                   {paper.year}
                                 </span>
                                 <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                   {paper.citationCount} cit.
                                 </span>
                                 {paper.doi && (
                                    <a 
                                      href={`https://doi.org/${paper.doi}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200 hover:text-gray-800 transition-colors"
                                      title="Open DOI"
                                    >
                                      DOI
                                      <ExternalLink className="w-2.5 h-2.5 ml-1" />
                                    </a>
                                 )}
                               </div>

                               <div className="flex items-center gap-3 mt-3">
                                  {paper.url && (
                                     <a 
                                      href={paper.url} 
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-purple-600 transition-colors"
                                     >
                                       <FileText className="w-3.5 h-3.5" />
                                       Full Text
                                     </a>
                                  )}
                                  <button 
                                     onClick={() => setSelectedPaper(paper)}
                                     className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-purple-600 transition-colors"
                                  >
                                     <Database className="w-3.5 h-3.5" />
                                     Abstract
                                  </button>
                               </div>
                             </div>
                           </td>
                           
                           {/* Single Summary Column */}
                           <AnalysisCell content={analysis?.summary} isLoading={analysis?.isLoading} isLast={true} />
                         </tr>
                       );
                    })}
                    
                    {/* Loading Skeleton */}
                    {isSearching && Array.from({ length: 3 }).map((_, i) => (
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
                          <td className="p-5"><div className="h-24 bg-gray-50 rounded animate-pulse"/></td>
                       </tr>
                    ))}
                  </tbody>
               </table>
               
               {/* Load More Trigger */}
               {papers.length < totalResults && !isSearching && (
                 <div className="p-4 flex justify-center border-t border-gray-200 bg-white">
                    <button 
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                      className="text-sm font-medium text-purple-600 hover:text-purple-700 flex items-center gap-2 px-4 py-2 hover:bg-purple-50 rounded-md transition-colors"
                    >
                      {isLoadingMore ? <Loader2 className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4"/>}
                      Load more results
                    </button>
                 </div>
               )}
             </div>
           )}
        </div>

        {/* Right: Sidebar / Chat */}
        <div className={`w-[360px] bg-white border-l border-gray-200 flex flex-col shrink-0 transition-all duration-300 ${sidebarOpen ? 'translate-x-0' : 'translate-x-full hidden'}`}>
           <div className="h-12 border-b border-gray-200 flex items-center justify-between px-4 bg-gray-50/50">
              <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Chat with papers
              </span>
              <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-gray-600">
                <ChevronRight className="w-4 h-4" />
              </button>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Answer Box */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                 <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center justify-between">
                    Answer
                    <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[10px] normal-case">Generated by AI</span>
                 </div>
                 
                 {hasSearched ? (
                    <div className="text-sm text-gray-800 leading-relaxed space-y-3">
                       <p>
                         Based on the <strong>{papers.length}</strong> papers found for "<em>{query}</em>", the consensus suggests significant interest in this field.
                       </p>
                       <p>
                         <strong>Key themes include:</strong>
                       </p>
                       <ul className="list-disc pl-4 space-y-1 text-gray-700">
                         <li>Advanced methodologies utilizing recent technologies.</li>
                         <li>Correlations observed in longitudinal studies.</li>
                         <li>Need for further randomized control trials.</li>
                       </ul>
                       {ollamaStatus === false && (
                         <div className="mt-4 p-3 bg-red-50 text-red-700 text-xs rounded flex gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            To get a real synthesized answer, please ensure Ollama is running.
                         </div>
                       )}
                    </div>
                 ) : (
                    <div className="text-sm text-gray-400 italic text-center py-8">
                       Perform a search to see a synthesized answer here.
                    </div>
                 )}
              </div>
           </div>

           {/* Chat Input */}
           <div className="p-4 border-t border-gray-200 bg-white">
              <div className="relative">
                 <input 
                   type="text" 
                   className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                   placeholder="Ask anything about the results..."
                 />
                 <button className="absolute right-2 top-2 p-1 text-gray-400 hover:text-purple-600 transition-colors">
                    <Send className="w-4 h-4" />
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

// UI Components
const ToolbarButton = ({ icon, label }: { icon: React.ReactNode, label: string }) => (
  <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-md transition-colors border border-transparent hover:border-gray-200">
    {icon}
    {label}
  </button>
);

const AnalysisCell = ({ content, isLoading, isLast = false }: { content?: string, isLoading?: boolean, isLast?: boolean }) => {
   return (
      <td className={`px-5 py-5 align-top text-sm text-gray-700 leading-relaxed ${isLast ? '' : 'border-r border-gray-100'}`}>
         {isLoading ? (
            <div className="space-y-3 opacity-60">
               <div className="h-2 bg-gray-200 rounded w-full animate-pulse"/>
               <div className="h-2 bg-gray-200 rounded w-5/6 animate-pulse"/>
               <div className="h-2 bg-gray-200 rounded w-4/6 animate-pulse"/>
            </div>
         ) : content ? (
            <div className="line-clamp-[10]">{content}</div>
         ) : (
            <span className="text-gray-300 italic">Pending...</span>
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