/**
 * Types for Raw Chinese Novel Chapter Splitter (1500 chars/chapter)
 */

export interface ChineseParagraph {
  index: number;
  text: string;
  charCount: number;
  cumulativeChars: number;
}

export interface ProcessedChineseChapter {
  id: string;
  chapterIndex: number; // 1, 2, 3...
  header: string; // e.g. "第 1 章 恐怖高校 (1)" or "Chương 1: Bệnh viện (1)"
  title: string;
  content: string;
  charCount: number; // Chinese character count (~1500)
  paragraphCount: number;
  isCustomEdited?: boolean;
  dungeonName?: string; // Tên phó bản (nếu có)
  dungeonIndex?: number; // Số thứ tự trong phó bản (1, 2, 3...)
}

export type ChapterPrefixType = 'di-zhang' | 'chuong' | 'di-hui' | 'custom';
export type DungeonBracketStyle = 'half' | 'full' | 'bracket' | 'dash'; // (1) vs （1） vs 【1】 vs - 1

export interface SplitChineseConfig {
  novelTitle: string; // Tên truyện (dùng làm tên folder trong file zip)
  targetCharsPerChapter: number; // Default: 1500 characters (字)
  prefixFormat: ChapterPrefixType; // 'di-zhang' (第 {n} 章), 'chuong' (Chương {n}), 'di-hui' (第 {n} 回)
  customPrefix: string; // Custom template e.g. "第 {n} 章"
  startChapterNumber: number; // Default: 1
  includeCharCountInHeader: boolean; // e.g. "第 1 章 (1508字)"
  dialogueSafe: boolean; // Protect speech cues and quotation marks
  paragraphIndentation: boolean; // Add standard 2-space indentation (　　)
  autoStripExistingHeaders: boolean; // Automatically remove existing chapter headers/numbers from raw file

  // Filter unnumbered titles & web metadata
  customTitlesToStrip: string; // Danh sách tiêu đề gốc cần lọc bỏ (mỗi dòng 1 tiêu đề hoặc dán mục lục)
  stripWebMetadata: boolean; // Xóa các dòng metadata web như "第一卷: 默认", "3,347 chữ", ngày tháng...

  // Vô Hạn Lưu mode
  enableInfiniteFlow: boolean;
  dungeonName: string; // Tên phó bản mặc định/tự nhập
  dungeonStartIndex: number; // Số bắt đầu trong phó bản (mặc định: 1)
  dungeonAutoDetect: boolean; // Tự động phát hiện tên phó bản & chỉ số phó bản từ tiêu đề raw gốc
  dungeonBracketStyle: DungeonBracketStyle; // Định dạng số thứ tự phó bản: (1) hay （1）
}

export interface ChineseSplitResult {
  chapters: ProcessedChineseChapter[];
  totalChapters: number;
  totalChars: number;
  averageCharsPerChapter: number;
  minChars: number;
  maxChars: number;
  removedHeadersCount: number;
  removedHeadersSample: string[];
}
