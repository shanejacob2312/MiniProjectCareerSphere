const use = require("@tensorflow-models/universal-sentence-encoder");
const natural = require("natural");

// Load BERT Model
let model;

const loadModel = async () => {
  if (!model) {
    model = await use.load();
    console.log("✅ BERT Model Loaded");
  }
};

// Extract Keywords
const extractKeywords = (text) => {
  const tokenizer = new natural.WordTokenizer();
  const words = tokenizer.tokenize(text);
  const tfidf = new natural.TfIdf();

  tfidf.addDocument(text);
  let keywords = [];

  words.forEach((word) => {
    tfidf.tfidfs(word, (i, measure) => {
      if (measure > 0.2) keywords.push(word);
    });
  });

  return [...new Set(keywords)];
};

// Analyze Resume Using BERT
const analyzeResume = async (resumeText) => {
  await loadModel();

  const embeddings = await model.embed([resumeText]);
  const sentiment = Math.random() * 10; // Placeholder (Replace with real sentiment analysis)

  const keywords = extractKeywords(resumeText);
  const positivePoints = keywords.slice(0, 5); // Pick top keywords as strengths
  const negativePoints = ["Lack of certifications", "Limited experience"]; // Placeholder negatives

  return {
    grade: sentiment.toFixed(1),
    positives: positivePoints,
    negatives: negativePoints,
    improvements: ["Improve formatting", "Add more skills", "Include certifications"],
    suggestedCourses: ["Advanced Python", "Machine Learning Fundamentals"],
  };
};

module.exports = analyzeResume;
