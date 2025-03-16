const pdfParse = require("pdf-parse");
const fs = require("fs");

const extractTextFromPDF = async (filePath) => {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text; // Extracted text from PDF
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    throw error;
  }
};

module.exports = extractTextFromPDF;
