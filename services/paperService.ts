import { Paper } from '../types';

// Use OpenAlex API for robust, free, and CORS-friendly academic data
const API_ENDPOINT = 'https://api.openalex.org/works';

export const searchPapers = async (query: string, offset: number = 0, limit: number = 10): Promise<{ papers: Paper[], total: number }> => {
  try {
    // OpenAlex uses page numbers (1-based)
    const page = Math.floor(offset / limit) + 1;

    const params = new URLSearchParams({
      search: query,
      page: page.toString(),
      per_page: limit.toString(),
      // Filter for works that likely have abstracts to ensure quality
      filter: 'has_abstract:true,type:article', 
      // Select specific fields to reduce payload size and speed up request
      select: 'id,title,publication_year,primary_location,open_access,authorships,abstract_inverted_index,cited_by_count,doi'
    });

    const response = await fetch(`${API_ENDPOINT}?${params.toString()}`, {
       method: 'GET',
       headers: {
         'Accept': 'application/json',
         // Polite pool: Adding contact info is good practice for OpenAlex
         'User-Agent': 'YerelElicit/1.0 (mailto:test@example.com)' 
       }
    });

    if (!response.ok) {
        throw new Error(`API Hatası: ${response.statusText}`);
    }

    const data = await response.json();

    const papers: Paper[] = data.results.map((item: any) => {
        // OpenAlex stores abstracts as an inverted index to save space. We need to reconstruct it.
        let abstract = "Özet bulunamadı.";
        if (item.abstract_inverted_index) {
            const index = item.abstract_inverted_index;
            // Find max index to determine array size
            let maxIndex = 0;
            Object.values(index).forEach((positions: any) => {
                positions.forEach((pos: number) => {
                    if (pos > maxIndex) maxIndex = pos;
                });
            });
            
            const words = new Array(maxIndex + 1);
            for (const [word, positions] of Object.entries(index)) {
                (positions as number[]).forEach(pos => {
                    words[pos] = word;
                });
            }
            abstract = words.join(' ').replace(/\s+/g, ' ').trim();
        }

        // Extract authors
        const authors = item.authorships?.map((a: any) => a.author.display_name) || ['Bilinmeyen Yazar'];

        // Extract PDF URL
        const pdfUrl = item.open_access?.pdf_url;
        
        // Extract Source (Journal/Conference)
        const source = item.primary_location?.source?.display_name || "Bilinmeyen Kaynak";

        // Landing URL
        const landingUrl = item.doi || item.primary_location?.landing_page_url;

        return {
            id: item.id,
            title: item.title || "Başlıksız Çalışma",
            authors: authors,
            year: item.publication_year,
            abstract: abstract,
            citationCount: item.cited_by_count || 0,
            doi: item.doi ? item.doi.replace('https://doi.org/', '') : undefined,
            source: source,
            url: landingUrl,
            pdfUrl: pdfUrl,
            isMock: false
        };
    });

    return {
      papers: papers,
      total: data.meta.count || 0
    };

  } catch (error) {
    console.error("OpenAlex araması başarısız:", error);
    // Re-throw to let App.tsx handle the error state if needed, or return empty
    // Returning empty allows the app to stay stable
    return { papers: [], total: 0 };
  }
};