import JSZip from 'jszip';
import { ProcessedChineseChapter } from '../types';

/**
 * Generates concatenated novel text for a given list of chapters
 */
export function generateFullChineseNovelText(
  chapters: ProcessedChineseChapter[],
  separator = '\n\n'
): string {
  return chapters
    .map((chap) => `${chap.header}\n\n${chap.content}`)
    .join(separator);
}

/**
 * Downloads text as a single .txt file
 */
export function downloadTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.txt') ? filename : `${filename}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads full novel text as a single .txt file
 */
export function downloadChineseNovelAsTxt(
  chapters: ProcessedChineseChapter[],
  filename = 'truyen_da_chia_chuong.txt'
): void {
  const fullText = generateFullChineseNovelText(chapters);
  downloadTextFile(fullText, filename);
}

/**
 * Downloads a specific range of chapters as one .txt file (e.g. 1-5.txt, 6-10.txt)
 */
export function downloadChapterRangeAsTxt(
  chapters: ProcessedChineseChapter[],
  startIndex: number,
  endIndex: number,
  customFilename?: string
): void {
  const targetChapters = chapters.filter(
    (c) => c.chapterIndex >= startIndex && c.chapterIndex <= endIndex
  );

  if (targetChapters.length === 0) return;

  const fullText = generateFullChineseNovelText(targetChapters);
  const defaultName = startIndex === endIndex ? `${startIndex}.txt` : `${startIndex}-${endIndex}.txt`;
  downloadTextFile(fullText, customFilename || defaultName);
}

/**
 * Sanitizes file names for safe saving
 */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Exports all chapters as a ZIP archive containing individual chapter files inside a root folder named after the novel
 */
export async function downloadChineseChaptersAsZip(
  chapters: ProcessedChineseChapter[],
  novelTitle = 'Truyen_Raw'
): Promise<void> {
  const zip = new JSZip();
  const safeFolderName = sanitizeFileName(novelTitle || 'Truyen_Raw');
  const rootFolder = zip.folder(safeFolderName) || zip;

  chapters.forEach((chap) => {
    const fileName = `${chap.chapterIndex}.txt`;
    const fileContent = `${chap.header}\n\n${chap.content}`;
    rootFolder.file(fileName, fileContent);
  });

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFolderName}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Splits chapters into batches of X chapters per file, then downloads as a ZIP
 * containing a root folder named after the novel (e.g. 1-10.txt, 11-20.txt)
 */
export async function downloadBatchedChaptersAsZip(
  chapters: ProcessedChineseChapter[],
  chaptersPerBatch: number,
  novelTitle = 'Truyen_Raw'
): Promise<void> {
  if (chapters.length === 0) return;

  const zip = new JSZip();
  const safeFolderName = sanitizeFileName(novelTitle || 'Truyen_Raw');
  const rootFolder = zip.folder(safeFolderName) || zip;

  const total = chapters.length;
  for (let i = 0; i < total; i += chaptersPerBatch) {
    const batch = chapters.slice(i, i + chaptersPerBatch);
    const startIdx = batch[0].chapterIndex;
    const endIdx = batch[batch.length - 1].chapterIndex;
    const fileName = startIdx === endIdx ? `${startIdx}.txt` : `${startIdx}-${endIdx}.txt`;
    const content = generateFullChineseNovelText(batch);
    rootFolder.file(fileName, content);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFolderName}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
