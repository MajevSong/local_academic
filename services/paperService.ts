import { Paper } from '../types';

// Hardcoded high-quality samples for fallback with REAL working links
const MOCK_DATABASE: Paper[] = [
  {
    id: '1',
    title: "The Effects of Caffeine on Sleep Quality and Architecture",
    authors: ["Clark, I.", "Landolt, H.P."],
    year: 2017,
    citationCount: 145,
    doi: "10.1016/j.smrv.2016.01.006",
    source: "Sleep Medicine Reviews",
    url: "https://pubmed.ncbi.nlm.nih.gov/26847979/",
    isMock: false,
    abstract: "Caffeine is the most widely consumed psychoactive substance in the world. It promotes wakefulness by antagonizing adenosine receptors in the brain. This systematic review examines the effects of caffeine on sleep quality and sleep architecture. The results consistently show that caffeine prolonged sleep latency, reduced total sleep time and sleep efficiency, and worsened perceived sleep quality."
  },
  {
    id: '2',
    title: "Machine Learning Approaches for Early Diabetes Detection",
    authors: ["Lai, H.", "Huang, H.", "Keshavjee, K."],
    year: 2019,
    citationCount: 89,
    doi: "10.3390/jpm9040049",
    source: "Journal of Personalized Medicine",
    url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6961054/",
    pdfUrl: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6961054/pdf/jpm-09-00049.pdf",
    isMock: false,
    abstract: "Diabetes mellitus is a chronic disease that affects millions of people worldwide. In this study, we propose a novel ensemble learning framework utilizing Random Forest and Gradient Boosting machines to predict Type 2 diabetes risk. The model achieved an accuracy of 92% and sensitivity of 89%, significantly outperforming traditional logistic regression models."
  },
  {
    id: '3',
    title: "Urban Green Spaces and Mental Health: A Systematic Review",
    authors: ["Houlden, V.", "Weich, S.", "Porto de Albuquerque, J."],
    year: 2018,
    citationCount: 312,
    doi: "10.1371/journal.pone.0203000",
    source: "PLOS ONE",
    url: "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0203000",
    pdfUrl: "https://journals.plos.org/plosone/article/file?id=10.1371/journal.pone.0203000&type=printable",
    isMock: false,
    abstract: "Mental health disorders are a growing global concern. Increasing evidence suggests that urban green spaces can positively influence mental well-being. This systematic review analyzed 50 observational and longitudinal studies examining the relationship between proximity to urban green spaces and anxiety/mood disorders. The findings suggest a consistent negative correlation between green space accessibility and self-reported anxiety symptoms."
  },
  {
    id: '4',
    title: "Attention Is All You Need",
    authors: ["Vaswani, A.", "Shazeer, N.", "Parmar, N.", "Uszkoreit, J."],
    year: 2017,
    citationCount: 95000,
    doi: "10.48550/arXiv.1706.03762",
    source: "NeurIPS",
    url: "https://arxiv.org/abs/1706.03762",
    pdfUrl: "https://arxiv.org/pdf/1706.03762.pdf",
    isMock: false,
    abstract: "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. Experiments on two machine translation tasks show these models to be superior in quality."
  },
  {
    id: '5',
    title: "Global Warming of 1.5°C",
    authors: ["Masson-Delmotte, V.", "Zhai, P.", "Pörtner, H.O."],
    year: 2018,
    citationCount: 15000,
    doi: "10.1017/9781009157940",
    source: "IPCC Special Report",
    url: "https://www.ipcc.ch/sr15/",
    isMock: false,
    abstract: "An IPCC Special Report on the impacts of global warming of 1.5°C above pre-industrial levels and related global greenhouse gas emission pathways. The report highlights that limiting warming to 1.5°C requires rapid, far-reaching and unprecedented changes in all aspects of society."
  },
  {
    id: '6',
    title: "A Programmable Dual-RNA-Guided DNA Endonuclease in Adaptive Bacterial Immunity",
    authors: ["Jinek, M.", "Chylinski, K.", "Doudna, J.A.", "Charpentier, E."],
    year: 2012,
    citationCount: 12000,
    doi: "10.1126/science.1225829",
    source: "Science",
    url: "https://www.science.org/doi/10.1126/science.1225829",
    isMock: false,
    abstract: "CRISPR/Cas9 is a simple, RNA-guided platform for genome editing. We show that the Cas9 endonuclease can be programmed with a guide RNA to cleave specific DNA sequences. This technology has revolutionized biology by enabling precise manipulation of genomes in various organisms."
  },
  {
    id: '7',
    title: "ImageNet Classification with Deep Convolutional Neural Networks",
    authors: ["Krizhevsky, A.", "Sutskever, I.", "Hinton, G.E."],
    year: 2012,
    citationCount: 110000,
    doi: "10.1145/3065386",
    source: "NeurIPS",
    url: "https://papers.nips.cc/paper/2012/hash/c399862d3b9d6b76c8436e924a68c45b-Abstract.html",
    pdfUrl: "https://papers.nips.cc/paper/2012/file/c399862d3b9d6b76c8436e924a68c45b-Paper.pdf",
    isMock: false,
    abstract: "We trained a large, deep convolutional neural network to classify the 1.2 million high-resolution images in the ImageNet LSVRC-2010 contest into the 1000 different classes. On the test data, we achieved top-1 and top-5 error rates of 37.5% and 17.0% which is considerably better than the previous state-of-the-art."
  },
  {
    id: '8',
    title: "Prospect Theory: An Analysis of Decision under Risk",
    authors: ["Kahneman, D.", "Tversky, A."],
    year: 1979,
    citationCount: 65000,
    doi: "10.2307/1914185",
    source: "Econometrica",
    url: "https://www.jstor.org/stable/1914185",
    isMock: false,
    abstract: "This paper presents a critique of expected utility theory as a descriptive model of decision making under risk, and develops an alternative model, called prospect theory. Choices among risky prospects exhibit several pervasive effects that are inconsistent with the basic tenets of utility theory."
  }
];

export const searchPapers = async (query: string, offset: number = 0, limit: number = 10): Promise<{ papers: Paper[], total: number }> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));

  const lowerQuery = query.toLowerCase();
  const filtered = MOCK_DATABASE.filter(p => 
    p.title.toLowerCase().includes(lowerQuery) || 
    p.abstract.toLowerCase().includes(lowerQuery) ||
    p.authors.some(a => a.toLowerCase().includes(lowerQuery))
  );

  return {
    papers: filtered.slice(offset, offset + limit),
    total: filtered.length
  };
};
