const pdfParse = require('pdf-parse');
const fs = require('fs');
const { createWorker } = require('tesseract.js');
const path = require('path');
const { createCanvas } = require('canvas');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { GlobalWorkerOptions } = require('pdfjs-dist/legacy/build/pdf.js');

// Disable worker for Node.js environment
GlobalWorkerOptions.workerSrc = null;

async function extractTextFromPDF(filePath) {
  try {
    console.log('Starting text extraction from:', filePath);
    
    // First attempt: Try pdf-parse
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      
      if (pdfData.text && pdfData.text.trim().length > 50) {
        console.log('Successfully extracted text using pdf-parse');
        return pdfData.text;
      }
      console.log('pdf-parse result too short, trying PDF.js extraction...');
    } catch (err) {
      console.log('pdf-parse failed, trying PDF.js extraction...', err.message);
    }

    // Second attempt: Try PDF.js extraction
    try {
      const data = new Uint8Array(fs.readFileSync(filePath));
      const doc = await pdfjsLib.getDocument({ data }).promise;
      let fullText = '';
      
      // Process each page
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map(item => item.str);
        fullText += strings.join(' ') + '\n';
      }

      if (fullText.trim().length > 50) {
        console.log('Successfully extracted text using PDF.js');
        return fullText.trim();
      }

      console.log('PDF.js extraction result too short, trying OCR...');
    } catch (err) {
      console.log('PDF.js extraction failed, trying OCR...', err.message);
    }

    // Last attempt: Try OCR
    try {
      // Initialize Tesseract worker
      const worker = await createWorker();
      
      // Load PDF with PDF.js
      const data = new Uint8Array(fs.readFileSync(filePath));
      const doc = await pdfjsLib.getDocument({ data }).promise;
      const page = await doc.getPage(1);
      
      // Get page dimensions
      const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better quality
      
      // Create canvas
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');
      
      // Render PDF page to canvas
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      // Convert canvas to buffer
      const buffer = canvas.toBuffer('image/png');
      const tempPath = path.join(path.dirname(filePath), 'temp.png');
      fs.writeFileSync(tempPath, buffer);

      // Perform OCR
      const { data: { text } } = await worker.recognize(tempPath);
      await worker.terminate();

      // Clean up temporary file
      try {
        fs.unlinkSync(tempPath);
      } catch (cleanupErr) {
        console.error('Error cleaning up temporary file:', cleanupErr);
      }

      if (text && text.trim().length > 0) {
        console.log('Successfully extracted text using OCR');
        return text;
      }
      throw new Error('OCR extraction produced no text');
    } catch (err) {
      console.error('OCR extraction failed:', err);
      throw new Error('Failed to extract text from PDF using all available methods');
    }
  } catch (error) {
    console.error('Error in text extraction:', error);
    throw new Error(`Failed to extract text: ${error.message}`);
  }
}

async function extractTextWithPDFJS(pdfPath) {
  try {
    console.log('Attempting text extraction with PDF.js...');
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;
    console.log(`PDF loaded successfully. Number of pages: ${pdf.numPages}`);

    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map(item => item.str);
      fullText += strings.join(' ') + '\n';
    }

    console.log(`PDF.js extracted ${fullText.length} characters of text`);
    return fullText.trim();
  } catch (error) {
    console.error('Error extracting text with PDF.js:', error);
    throw error;
  }
}

module.exports = extractTextFromPDF;
