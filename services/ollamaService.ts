import { ChatMessage, OllamaResponse } from '../types';

// Use 127.0.0.1 instead of localhost to avoid IPv6 resolution issues (::1 vs 127.0.0.1)
// which often cause "Failed to fetch" errors.
const OLLAMA_HOST = 'http://127.0.0.1:11434';
const MODEL_NAME = 'qwen2.5:14b';

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
      systemPrompt = "Sen kıdemli bir araştırmacısın. Verilen akademik özeti tek bir cümleyle, çok özlü bir şekilde özetle. Türkçe cevap ver.";
      userPrompt = `Özet: "${abstract}"\n\nBu makalenin ana fikri nedir? (Tek cümle)`;
      break;
    case 'methodology':
      systemPrompt = "Sen kıdemli bir araştırmacısın. Bu çalışmada kullanılan metodolojiyi (katılımcı sayısı, yöntem, süre vb.) kısaca çıkar. Türkçe cevap ver.";
      userPrompt = `Özet: "${abstract}"\n\nMetodoloji nedir? Kısa ve net ol.`;
      break;
    case 'outcome':
      systemPrompt = "Sen kıdemli bir araştırmacısın. Bu çalışmanın ana sonucunu veya bulgusunu çıkar. İstatistiksel veri varsa dahil et. Türkçe cevap ver.";
      userPrompt = `Özet: "${abstract}"\n\nBu çalışmanın sonucu nedir?`;
      break;
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

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
          temperature: 0.1, // Low temperature for factual extraction
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
    // Only log the actual analysis failure, which is important
    console.error("Ollama analizi başarısız:", error);
    return "Analiz yapılamadı. Ollama çalışıyor mu?";
  }
};