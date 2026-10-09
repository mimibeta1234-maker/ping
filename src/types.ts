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
export type DungeonBracketStyle =
  | 'suffix-omit-first' // PhóBản (chương 1 không số), PhóBản2, PhóBản3... (Như trong ảnh)
  | 'suffix' // PhóBản1, PhóBản2, PhóBản3... (viết liền không ngoặc)
  | 'space' // PhóBản 1, PhóBản 2, PhóBản 3... (cách 1 khoảng trắng)
  | 'half' // (1) vs （1） vs 【1】 vs - 1
  | 'full'
  | 'bracket'
  | 'dash'
  | 'chinese-bracket'
  | 'chinese-suffix';

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
  stripAuthorNotes: boolean; // Tự động phát hiện và bỏ lời tác giả (作话 / 作者有话说 / 题外话 / PS)

  // Filter unnumbered titles & web metadata
  customTitlesToStrip: string; // Danh sách tiêu đề gốc cần lọc bỏ (mỗi dòng 1 tiêu đề hoặc dán mục lục)
  stripWebMetadata: boolean; // Xóa các dòng metadata web như "第一卷: 默认", "3,347 chữ", ngày tháng...

  // Vô Hạn Lưu mode
  enableInfiniteFlow: boolean;
  dungeonName: string; // Tên phó bản mặc định/tự nhập
  dungeonStartIndex: number; // Số bắt đầu trong phó bản (mặc định: 1)
  dungeonAutoDetect: boolean; // Tự động phát hiện tên phó bản & chỉ số phó bản từ tiêu đề raw gốc
  dungeonBracketStyle: DungeonBracketStyle; // Định dạng số thứ tự phó bản: (1) hay （1）

  // TOC Analysis & Transition Handling
  useAnalyzedTOC?: boolean; // Sử dụng danh sách tiêu đề đã phân tích từ mục lục khi chia chương
  analyzedChapterHeaders?: string[]; // Danh sách tiêu đề chi tiết theo từng chương
  vhlTransitionMode?: 'empty-title' | 'keep-original' | 'custom-label' | 'pure-number'; // Cách xử lý các chương quá độ / đời thực
  vhlTransitionCustomLabel?: string; // Nhãn phó bản cho chương quá độ (vd: "现实" hoặc "日常")
  vhlAutoReindexDungeon?: boolean; // Tự động đánh số liên tục cho phó bản dựa trên số chữ sau khi chia
}

export interface AnalyzedTOCChapter {
  rawLine: string;
  chapterIndex: number;
  type: 'dungeon' | 'transition';
  dungeonName?: string;
  dungeonIndex?: number;
  detectedFormat?: DungeonBracketStyle;
  originalTitle: string;
  formattedHeader: string;
}

export interface AnalyzedArc {
  type: 'dungeon' | 'transition';
  name: string;
  startChapter: number;
  endChapter: number;
  totalChapters: number;
  format?: DungeonBracketStyle;
  samples: string[];
}

export interface TOCAnalysisResult {
  totalAnalyzed: number;
  dungeonChaptersCount: number;
  transitionChaptersCount: number;
  arcs: AnalyzedArc[];
  chapters: AnalyzedTOCChapter[];
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
