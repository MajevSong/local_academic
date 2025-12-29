import { ChatMessage, OllamaResponse, Paper } from '../types';

// Use 127.0.0.1 instead of localhost to avoid IPv6 resolution issues (::1 vs 127.0.0.1)
// which often cause "Failed to fetch" errors.
const OLLAMA_HOST = 'http://127.0.0.1:11434';
const MODEL_NAME = 'mistral-small:24b';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export type AIProvider = 'ollama' | 'gemini';
export type ProviderPreference = 'auto' | 'ollama' | 'gemini';

let preferredProvider: ProviderPreference = 'auto';

export const setPreferredProvider = (provider: ProviderPreference) => {
  preferredProvider = provider;
  console.log(`AI Provider set to: ${provider}`);
};
let activeProvider: AIProvider = 'ollama';

// Helper to prepare content from paper (Abstract vs Full Text)
const getPaperContent = (p: Paper): string => {
  if (p.fullText && p.fullText.length > 200) {
    // If full text exists, use it but truncate to prevent context explosion.
    // 10,000 chars is roughly 2000-3000 tokens.
    // We add a marker so the model knows this is detailed content.
    return `(Tam Metin İçeriği Mevcut - İlk Kısım):\n${p.fullText.substring(0, 10000)}...`;
  }
  return `(Özet):\n${p.abstract}`;
};

export const checkAIConnection = async (): Promise<{ ollama: boolean, gemini: boolean }> => {
  let ollamaStatus = false;
  let geminiStatus = false;

  // Check Ollama
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`, { mode: 'cors' });
    ollamaStatus = response.ok;
  } catch (error) {
    // console.warn("Ollama connection check failed...");
  }

  // Check Gemini
  if (GEMINI_API_KEY) {
    geminiStatus = true; // Assume true if key exists, validity checked on request
  }

  return { ollama: ollamaStatus, gemini: geminiStatus };
};

// Deprecated: kept for compatibility if needed, but prefer checkAIConnection
export const checkOllamaConnection = async (): Promise<boolean> => {
  const status = await checkAIConnection();
  return status.ollama || status.gemini;
};

export const analyzePaperWithOllama = async (
  abstract: string,
  promptType: 'summary' | 'methodology' | 'outcome'
): Promise<string> => {

  let systemPrompt = "";
  let userPrompt = "";

  switch (promptType) {
    case 'summary':
      // Updated prompt for a fuller summary
      systemPrompt = "Sen kıdemli bir araştırmacısın. Verilen akademik metni Türkçe olarak detaylı bir şekilde özetle. Önemli noktaları atlama. 3-4 cümle kullan.";
      userPrompt = `Metin: "${abstract}"\n\nBu makalenin kapsamlı bir özeti nedir? (3-4 cümle)`;
      break;
    case 'methodology':
      systemPrompt = "Sen kıdemli bir araştırmacısın. Bu çalışmada kullanılan metodolojiyi (katılımcı sayısı, yöntem, süre vb.) kısaca çıkar. Türkçe cevap ver.";
      userPrompt = `Metin: "${abstract}"\n\nMetodoloji nedir? Kısa ve net ol.`;
      break;
    case 'outcome':
      systemPrompt = "Sen kıdemli bir araştırmacısın. Bu çalışmanın ana sonucunu veya bulgusunu çıkar. İstatistiksel veri varsa dahil et. Türkçe cevap ver.";
      userPrompt = `Metin: "${abstract}"\n\nBu çalışmanın sonucu nedir?`;
      break;
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  return await generateAIResponse(messages);
};

export const synthesizeFindings = async (query: string, papers: Paper[]): Promise<string> => {
  // Take top 4 papers to avoid context window issues if abstracts are long
  const topPapers = papers.slice(0, 4);

  const context = topPapers.map((p, i) => `[${i + 1}] ${p.title} (${p.year}): ${getPaperContent(p)}`).join("\n\n");

  const systemPrompt = "Sen uzman bir akademik araştırma asistanısın. Kullanıcının sorusuna, sağlanan makale içeriklerini sentezleyerek yanıt ver. Sadece verilen bilgilere dayan. Her iddiayı köşeli parantez içinde kaynak numarasıyla atıfla (örn. [1]). Türkçe yanıt ver.";

  const userPrompt = `Araştırma Sorusu: "${query}"\n\nBulunan Makaleler:\n${context}\n\nBu makalelerdeki bulguları sentezleyerek soruyu yanıtla. Kısa ve öz ol (maksimum 200 kelime).`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  return await generateAIResponse(messages);
};

export const chatWithPapers = async (
  query: string,
  papers: Paper[],
  history: ChatMessage[]
): Promise<string> => {
  // Use top 5 papers for context.
  // We prioritize papers with full text if they match the query well, but here we just take top list.
  const contextPapers = papers.slice(0, 5);

  const context = contextPapers.map((p, i) => `[${i + 1}] ${p.title} (${p.year}): ${getPaperContent(p)}`).join("\n\n-----------------\n\n");

  const systemPrompt = `Sen uzman bir akademik araştırma asistanısın. Kullanıcı sana mevcut makale listesi hakkında sorular soracak.
Aşağıdaki makale içeriklerini (Özet veya varsa Tam Metin) bağlam olarak kullan ve sadece bu bilgilere dayanarak cevap ver.
Tam metin içeriği varsa, metodoloji ve sonuçlar hakkında daha detaylı bilgi verebilirsin.
Bilgi makalelerde yoksa, "Bu bilgi sağlanan metinlerde bulunmuyor" de.
Cevaplarında iddialarını desteklemek için makale numaralarını köşeli parantez içinde kullan (örn. [1]).
Türkçe cevap ver.

Makaleler:
${context}`;

  // Filter out system messages from history to prevent duplication, 
  // we inject the fresh system prompt with current papers every time.
  const conversationHistory = history.filter(m => m.role !== 'system');

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: query }
  ];

  return await generateAIResponse(messages);
};

export const generateTopicFromPapers = async (papers: Paper[]): Promise<string> => {
  // Use abstract (or truncated full text) of top papers to determine a common topic
  const contextPapers = papers.slice(0, 5);
  const context = contextPapers.map((p, i) =>
    `Makale ${i + 1}:
     Başlık: ${p.title}
     İçerik: ${p.abstract}` // Just abstract is usually enough for titles
  ).join("\n\n");

  const systemPrompt = "Sen uzman bir akademik editörsün. Aşağıdaki makale özetlerini analiz ederek, bu çalışmaların ortak noktasını kapsayan tek bir, profesyonel, akademik Türkçe başlık oluştur. Sadece başlığı yaz, tırnak işareti veya 'Başlık önerisi:' gibi ifadeler kullanma.";

  const userPrompt = `Makaleler:\n${context}\n\nBu makalelerden yola çıkarak uygun bir araştırma başlığı öner.`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  return await generateAIResponse(messages);
};

export const generateLiteratureReview = async (
  topic: string,
  papers: Paper[]
): Promise<string> => {
  // Limit to roughly 5-6 papers if full texts are included to stay within context limits.
  // If no full text, we can do more.
  const hasFullText = papers.some(p => p.fullText);
  const limit = hasFullText ? 6 : 15;

  const contextPapers = papers.slice(0, limit);

  const context = contextPapers.map((p, i) =>
    `MAKALE_ID: ref${i + 1}
     Başlık: ${p.title}
     Yazarlar: ${p.authors.join(", ")}
     Yıl: ${p.year}
     İçerik: ${getPaperContent(p)}`
  ).join("\n\n----------------\n\n");

  const systemPrompt = `Sen profesyonel bir akademik yazarsın. Görevin, verilen kaynakları kullanarak "literatür taraması" (literature review) niteliğinde bir makale yazmaktır.
Çıktı formatı KESİNLİKLE bir LaTeX dosyası olmalıdır. Kod bloğu kullanmadan, doğrudan LaTeX kodunu ver.

Kullanılacak Yapı:
\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath, amsfonts, amssymb}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{hyperref}
\\usepackage[numbers]{natbib}

\\begin{document}

\\title{...} % Konuya uygun başlık
\\author{Yerel Elicit AI}
\\date{\\today}

\\maketitle

\\begin{abstract}
% Konuyu ve incelenen makalelerin genel bulgularını özetle.
\\end{abstract}

\\section{Giriş}
% Konuyu tanıt ve neden önemli olduğunu açıkla.

\\section{Literatür Taraması}
% Kaynakları sentezleyerek anlat. Benzer çalışmaları grupla. 

\\section{Metodoloji Sentezi}
% İncelenen makalelerde kullanılan yöntemleri karşılaştır (örn. deneyler, anketler, yapay zeka modelleri).

\\section{Bulgular ve Tartışma}
% Makalelerin temel sonuçlarını ve bu sonuçların ne anlama geldiğini tartış.

\\section{Sonuç}
% Genel bir yargıya var.

\\bibliographystyle{plainnat}
\\begin{thebibliography}{99}
% Buraya kaynakları ekle. Format: \\bibitem{refX} Yazarlar (Yıl). Başlık. Kaynak.
\\end{thebibliography}

\\end{document}

Kurallar:
1. İçerik dili TÜRKÇE olacaktır.
2. Metin içinde atıf yaparken mutlaka \\cite{refX} kullan. Sana verilen listedeki 'ref1', 'ref2' ID'lerini kullan.
3. Asla uydurma kaynak kullanma, sadece aşağıda verilenleri kullan.
4. Tam metin içeriği varsa, istatistiksel verileri ve detayları kullanmaya özen göster.`;

  const userPrompt = `Konu: "${topic}"

Kullanılacak Kaynak Listesi:
${context}

Lütfen yukarıdaki şablona uygun olarak LaTeX formatında makaleyi oluştur.`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  return await generateAIResponse(messages);
};

export const fetchPaperDataFromCrossref = async (doi: string): Promise<Partial<Paper>> => {
  try {
    const response = await fetch(`https://api.crossref.org/works/${doi}`);
    if (!response.ok) return {};

    const data = await response.json();
    const item = data.message;

    // Abstract often contains HTML tags like <jats:p>, lets clean them
    let abstract = item.abstract;
    if (abstract) {
      abstract = abstract.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
    }

    return {
      title: item.title?.[0],
      authors: item.author?.map((a: any) => `${a.given} ${a.family}`),
      year: item.created?.['date-parts']?.[0]?.[0],
      doi: item.DOI,
      abstract: abstract
    };
  } catch (error) {
    console.error("CrossRef fetch failed:", error);
    return {};
  }
};

export const extractPaperMetadata = async (text: string): Promise<Partial<Paper>> => {
  // Truncate to first 3000 chars to avoid token limits, usually enough for header info
  const content = text.substring(0, 3000);

  // 1. Try to find DOI via Regex directly first (Fastest & Most Reliable)
  const doiMatch = text.match(/\b(10[.][0-9]{4,}(?:[.][0-9]+)*\/(?:(?!["&\'<>])\S)+)\b/);

  if (doiMatch && doiMatch[0]) {
    const doi = doiMatch[0];
    try {
      const crossRefData = await fetchPaperDataFromCrossref(doi);
      if (crossRefData.title && crossRefData.authors) {
        // We have basic metadata from CrossRef (Title, Authors, Year).
        // User Request: "Check text for abstract first. If not in text, use CrossRef/DOI."

        // 1. Try to extract Abstract from TEXT (LLM)
        const abstractPrompt = `Metin:\n${content}\n\nBu metnin özetini (abstract) çıkar. Sadece özeti metin olarak döndür, başka bir şey yazma. Eğer özet metinde yoksa "ÖZET_YOK" yaz.`;
        const messages: ChatMessage[] = [
          { role: 'system', content: "Sen bir akademik asistansın. Görevin sadece metinden özet çıkarmak. Yorum yapma." },
          { role: 'user', content: abstractPrompt }
        ];
        const extractedAbstract = await generateAIResponse(messages);

        let finalAbstract: string | undefined = undefined;

        // Check if LLM found a valid abstract
        if (!extractedAbstract.includes("ÖZET_YOK") && extractedAbstract.length > 50 && !extractedAbstract.includes("[Sayfa")) {
          finalAbstract = extractedAbstract.trim();
        } else {
          // 2. Fallback to CrossRef Abstract
          if (crossRefData.abstract && crossRefData.abstract.length > 50) {
            finalAbstract = crossRefData.abstract;
          }
        }

        return {
          ...crossRefData,
          abstract: finalAbstract
        };
      }
    } catch (e) {
      console.warn("CrossRef check failed, falling back to LLM", e);
    }
  }

  // 2. Fallback: Full LLM Extraction (Slower, but works for papers without DOI)
  const systemPrompt = "Sen bir akademik metadata ayıklayıcısısın. Verilen metni analiz et ve şu bilgileri JSON formatında çıkar: title (başlık), authors (yazarlar listesi), year (yıl, sayı olarak), doi (varsa), abstract (kısa özet). Sadece JSON döndür.";

  const userPrompt = `Metin:\n${content}\n\nLütfen bu metinden başlık, yazarlar, yıl ve DOI'yi JSON olarak çıkar. Eğer bulamazsan ilgili alanı null bırak.`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  try {
    const jsonStr = await generateAIResponse(messages);
    // Clean code blocks if present
    const cleanJson = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
    let metadata: Partial<Paper> = {};

    try {
      const data = JSON.parse(cleanJson);
      metadata = {
        title: data.title || undefined,
        authors: Array.isArray(data.authors) ? data.authors : (data.authors ? [data.authors] : undefined),
        year: data.year ? parseInt(data.year) : undefined,
        doi: data.doi || undefined,
        abstract: data.abstract || undefined
      };
    } catch (parseError) {
      console.error("JSON parse failed", parseError);
    }

    // If LLM found a DOI that regex missed (unlikely but possible), try CrossRef enrichment
    if (metadata.doi) {
      // ... (Same CrossRef fetch logic could apply here, but Regex usually catches it first)
      // For simplicity, we trust LLM or minimal enrichment here if needed.
      // But usually, regex catches 99% of DOIs.
    }

    return metadata;

  } catch (e) {
    console.error("Metadata extraction failed", e);
    return {};
  }
};

// Unified function to generate response based on availability and preference
export const generateAIResponse = async (messages: ChatMessage[]): Promise<string> => {
  // Check Preference First
  if (preferredProvider === 'ollama') {
    console.log("Using Ollama (Forced)");
    return await sendOllamaRequest(messages);
  }

  if (preferredProvider === 'gemini') {
    console.log("Using Gemini (Forced)");
    if (!process.env.GEMINI_API_KEY && !import.meta.env.VITE_GEMINI_API_KEY) {
      throw new Error("Gemini API Key eksik!");
    }
    return await sendGeminiRequest(messages);
  }

  // Auto Mode: Try Ollama first, then Gemini
  try {
    const isOllamaUp = (await checkAIConnection()).ollama;
    if (isOllamaUp) {
      return await sendOllamaRequest(messages);
    } else {
      console.log("Ollama unreachable, failing over to Gemini...");
    }
  } catch (e) {
    console.warn("Ollama attempt failed in auto mode", e);
  }

  // Fallback to Gemini
  if (process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY) {
    return await sendGeminiRequest(messages);
  }

  throw new Error("Hiçbir AI servisine erişilemiyor (Ollama kapalı ve Gemini anahtarı yok).");
};

const sendOllamaRequest = async (messages: ChatMessage[]): Promise<string> => {
  const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: messages,
      stream: false,
      options: {
        temperature: 0.1,
        num_ctx: 16384
      }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama API hatası: ${response.status} - ${errorText}`);
  }

  const data: OllamaResponse = await response.json();
  return data.message.content.trim();
}

const sendGeminiRequest = async (messages: ChatMessage[]): Promise<string> => {
  // Convert ChatMessage[] to Gemini format
  // https://ai.google.dev/tutorials/rest_quickstart#chat_multi_turn
  const contents = messages
    .filter(m => m.role !== 'system') // Gemini uses 'model' or 'user' roles primarily, system instruction is separate in beta but we can prepend it
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

  // If there is a system message, prepend it to the first user message or handle slightly differently
  // For simplicity in this 'generateContent' endpoint, we can prepend system context to the first prompt 
  // or use the system_instruction if using the beta API. Let's prepend to text for robustness across versions.
  const systemMessage = messages.find(m => m.role === 'system');
  if (systemMessage && contents.length > 0) {
    contents[0].parts[0].text = `[SYSTEM: ${systemMessage.content}]\n\n${contents[0].parts[0].text}`;
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: contents,
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API Error: ${response.status} ${err}`);
  }

  const data = await response.json();
  if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts.length > 0) {
    return data.candidates[0].content.parts[0].text;
  }

  return "";
};