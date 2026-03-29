import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { logger } from './logger.js';

// Disable worker for server-side use
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

export interface ExtractTextResult {
  text: string;
  pageCount: number;
  wordCount: number;
}

export interface PageResult {
  num: number;
  text: string;
  wordCount: number;
}

export interface ToJsonResult {
  pages: PageResult[];
  pageCount: number;
  wordCount: number;
}

async function loadDocument(input: { url?: string; base64?: string }) {
  let data: ArrayBuffer | string;

  if (input.url) {
    logger.debug({ url: input.url }, 'Fetching PDF from URL');
    const response = await fetch(input.url, {
      headers: { 'User-Agent': 'Lumora-PDF-Service/0.1' },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
    }
    data = await response.arrayBuffer();
  } else if (input.base64) {
    data = Buffer.from(input.base64, 'base64').buffer as ArrayBuffer;
  } else {
    throw new Error('Either url or base64 must be provided');
  }

  return pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false }).promise;
}

export async function extractText(input: { url?: string; base64?: string }): Promise<ExtractTextResult> {
  const doc = await loadDocument(input);
  const pageCount = doc.numPages;
  const textParts: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    textParts.push(pageText);
  }

  const text = textParts.join('\n\n');
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return { text, pageCount, wordCount };
}

export async function toJson(input: { url?: string; base64?: string }): Promise<ToJsonResult> {
  const doc = await loadDocument(input);
  const pageCount = doc.numPages;
  const pages: PageResult[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    pages.push({ num: i, text, wordCount });
  }

  const wordCount = pages.reduce((sum, p) => sum + p.wordCount, 0);
  return { pages, pageCount, wordCount };
}
