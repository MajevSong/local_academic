import { Paper } from '../types';

// This acts as a mock Semantic Scholar or PubMed.
// In a real app, you would fetch from an external API here.
const MOCK_DATABASE: Paper[] = [
  {
    id: '1',
    title: "The Effects of Caffeine on Sleep Quality and Architecture",
    authors: ["J. Smith", "A. Doe"],
    year: 2023,
    citationCount: 45,
    source: "Journal of Sleep Research",
    abstract: "This study investigates the impact of high-dose caffeine consumption (400mg) administered 6 hours prior to bedtime. Using polysomnography, we found a significant reduction in sleep efficiency and slow-wave sleep duration in the experimental group compared to placebo."
  },
  {
    id: '2',
    title: "Machine Learning Approaches for Early Diabetes Detection",
    authors: ["K. Johnson", "B. Lee", "T. Nguyen"],
    year: 2024,
    citationCount: 12,
    source: "AI in Medicine",
    abstract: "We propose a novel ensemble learning framework utilizing Random Forest and Gradient Boosting machines to predict Type 2 diabetes risk. The model achieved an accuracy of 92% and sensitivity of 89% on the Pima Indians Diabetes Dataset, outperforming traditional logistic regression models."
  },
  {
    id: '3',
    title: "Urban Green Spaces and Mental Health: A Systematic Review",
    authors: ["M. Garcia", "S. Patel"],
    year: 2022,
    citationCount: 156,
    source: "Environmental Psychology",
    abstract: "A systematic review of 50 longitudinal studies examining the relationship between proximity to urban green spaces and anxiety disorders. The findings suggest a moderate negative correlation between green space accessibility and self-reported anxiety symptoms."
  },
  {
    id: '4',
    title: "Optimizing React Applications with Concurrent Mode",
    authors: ["D. Abramov", "S. Mark"],
    year: 2023,
    citationCount: 89,
    source: "Web Engineering Journal",
    abstract: "This paper explores the performance benefits of React's Concurrent Mode features. Through benchmark testing on low-end mobile devices, we demonstrate a 30% reduction in Total Blocking Time (TBT) during heavy rendering tasks."
  },
  {
    id: '5',
    title: "Climate Change Mitigation Strategies in Agriculture",
    authors: ["R. Green", "L. White"],
    year: 2024,
    citationCount: 5,
    source: "Nature Sustainability",
    abstract: "This article evaluates the efficacy of regenerative farming practices. Soil carbon sequestration rates were measured over a 5-year period. Results indicate that cover cropping and no-till farming can sequester up to 1.5 tons of carbon per hectare annually."
  }
];

export const searchPapers = async (query: string): Promise<Paper[]> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));

  const lowerQuery = query.toLowerCase();
  
  // Simple mock search algorithm
  return MOCK_DATABASE.filter(paper => 
    paper.title.toLowerCase().includes(lowerQuery) || 
    paper.abstract.toLowerCase().includes(lowerQuery) ||
    paper.source.toLowerCase().includes(lowerQuery)
  );
};