import { ChatMessage, OllamaResponse, Paper } from '../types';

// Use 127.0.0.1 instead of localhost to avoid IPv6 resolution issues (::1 vs 127.0.0.1)
// which often cause "Failed to fetch" errors.
const OLLAMA_HOST = 'http://127.0.0.1:11434';
const MODEL_NAME = 'qwen2.5:14b';

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

export const checkOllamaConnection = async (): Promise<boolean> => {
  try {
    // We try to fetch tags to see if the server is responsive
    const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
        mode: 'cors',
    });
    return response.ok;
  } catch (error) {
    // Suppress console.error here to avoid spamming the console during polling
    // console.warn("Ollama connection check failed..."); 
    return false;
  }
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

  return await sendOllamaRequest(messages);
};

export const synthesizeFindings = async (query: string, papers: Paper[]): Promise<string> => {
  // Take top 4 papers to avoid context window issues if abstracts are long
  const topPapers = papers.slice(0, 4);
  
  const context = topPapers.map((p, i) => `[${i+1}] ${p.title} (${p.year}): ${getPaperContent(p)}`).join("\n\n");

  const systemPrompt = "Sen uzman bir akademik araştırma asistanısın. Kullanıcının sorusuna, sağlanan makale içeriklerini sentezleyerek yanıt ver. Sadece verilen bilgilere dayan. Her iddiayı köşeli parantez içinde kaynak numarasıyla atıfla (örn. [1]). Türkçe yanıt ver.";
  
  const userPrompt = `Araştırma Sorusu: "${query}"\n\nBulunan Makaleler:\n${context}\n\nBu makalelerdeki bulguları sentezleyerek soruyu yanıtla. Kısa ve öz ol (maksimum 200 kelime).`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  return await sendOllamaRequest(messages);
};

export const chatWithPapers = async (
  query: string, 
  papers: Paper[], 
  history: ChatMessage[]
): Promise<string> => {
  // Use top 5 papers for context.
  // We prioritize papers with full text if they match the query well, but here we just take top list.
  const contextPapers = papers.slice(0, 5);
  
  const context = contextPapers.map((p, i) => `[${i+1}] ${p.title} (${p.year}): ${getPaperContent(p)}`).join("\n\n-----------------\n\n");

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

  return await sendOllamaRequest(messages);
};

export const generateTopicFromPapers = async (papers: Paper[]): Promise<string> => {
  // Use abstract (or truncated full text) of top papers to determine a common topic
  const contextPapers = papers.slice(0, 5);
  const context = contextPapers.map((p, i) => 
    `Makale ${i+1}:
     Başlık: ${p.title}
     İçerik: ${p.abstract}` // Just abstract is usually enough for titles
  ).join("\n\n");

  const systemPrompt = "Sen uzman bir akademik editörsün. Aşağıdaki makale özetlerini analiz ederek, bu çalışmaların ortak noktasını kapsayan tek bir, profesyonel, akademik Türkçe başlık oluştur. Sadece başlığı yaz, tırnak işareti veya 'Başlık önerisi:' gibi ifadeler kullanma.";

  const userPrompt = `Makaleler:\n${context}\n\nBu makalelerden yola çıkarak uygun bir araştırma başlığı öner.`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  return await sendOllamaRequest(messages);
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
    `MAKALE_ID: ref${i+1}
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

  return await sendOllamaRequest(messages);
};

const sendOllamaRequest = async (messages: ChatMessage[]): Promise<string> => {
  try {
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
          temperature: 0.1, // Low temp for factual accuracy
          num_ctx: 16384 // Request larger context window if possible
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API hatası: ${response.status} - ${errorText}`);
    }

    const data: OllamaResponse = await response.json();
    return data.message.content.trim();

  } catch (error) {
    console.error("Ollama isteği başarısız:", error);
    return "Analiz yapılamadı veya model yanıt vermedi.";
  }
}