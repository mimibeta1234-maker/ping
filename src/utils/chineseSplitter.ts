import {
  ProcessedChineseChapter,
  SplitChineseConfig,
  ChineseSplitResult,
  ChineseParagraph,
} from '../types';

export const DEFAULT_CHINESE_CONFIG: SplitChineseConfig = {
  novelTitle: 'Truyen_Raw',
  targetCharsPerChapter: 1500,
  prefixFormat: 'di-zhang',
  customPrefix: '第 {n} 章',
  startChapterNumber: 1,
  includeCharCountInHeader: false,
  dialogueSafe: true,
  paragraphIndentation: true,
  autoStripExistingHeaders: true,

  // Custom title & web metadata filter
  customTitlesToStrip: '',
  stripWebMetadata: true,

  // Infinite flow defaults
  enableInfiniteFlow: false,
  dungeonName: '',
  dungeonStartIndex: 1,
  dungeonAutoDetect: true,
  dungeonBracketStyle: 'half',
};

/**
 * Chinese numerals to integer converter (一, 二, 三... 十)
 */
export function chineseNumeralToNumber(str: string): number {
  const map: Record<string, number> = {
    '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '百': 100, '千': 1000,
  };

  const trimmed = str.trim();
  const parsed = parseInt(trimmed, 10);
  if (!isNaN(parsed)) return parsed;

  if (trimmed.length === 1 && map[trimmed] !== undefined) {
    return map[trimmed];
  }

  if (trimmed.length === 2) {
    if (trimmed.startsWith('十')) return 10 + (map[trimmed[1]] || 0);
    if (trimmed.endsWith('十')) return (map[trimmed[0]] || 1) * 10;
  }

  return 1;
}

export interface DetectedDungeon {
  name: string;
  suggestedStartIndex: number;
  rawSample: string;
}

/**
 * Extracts dungeon name and index from a raw header line (e.g. "第1章 恐怖高校（1）" or "Chương 5: Bệnh Viện (2)")
 */
export function extractDungeonFromHeader(header: string): { name: string; index: number } | null {
  if (!header || !header.trim()) return null;
  const cleaned = header.trim();

  // Pattern 1: Chapter prefix + Dungeon Name + (1) or （1） or 【1】 or - 1
  // e.g. 第1章 恐怖游乐园（1） | Chương 1: Bệnh Viện Ma (2) | 01. 绝命列车 (01)
  const pattern1 =
    /(?:(?:第\s*[0-9一二三四五六七八九十百千万]+\s*[章回节篇])|(?:Chapter|Chương|Section)\s*\d+[:：\s]*|[0-9]{1,4}\s*[.、:：\-])?\s*([^()（）【】\n\r:：]+?)\s*(?:[（(【]([0-9一二三四五六七八九十]+)[)）】]|[-_]\s*([0-9]+))\s*$/i;

  const match1 = cleaned.match(pattern1);
  if (match1) {
    const rawName = match1[1].trim();
    const rawIdx = match1[2] || match1[3];
    // Filter out generic words
    if (rawName && !/^(?:正文|VIP|章节|Chapter|Chương)$/i.test(rawName)) {
      return {
        name: rawName.replace(/^[:：\-\—\s]+/, '').trim(),
        index: chineseNumeralToNumber(rawIdx),
      };
    }
  }

  // Pattern 2: Explicit dungeon bracket: 【副本一：幽灵古宅】 or [副本: 死亡高校]
  const pattern2 = /[【\[\(]副本[一二三四五六七八九十0-9]*[:：\s]*([^】\]\)]+)[】\]\)]/i;
  const match2 = cleaned.match(pattern2);
  if (match2 && match2[1]) {
    return {
      name: match2[1].trim(),
      index: 1,
    };
  }

  return null;
}

/**
 * Scans the raw text and discovers all Dungeon names mentioned in headers
 */
export function scanDungeonsFromRaw(rawText: string): DetectedDungeon[] {
  if (!rawText) return [];
  const lines = rawText.split(/\r?\n/);
  const found: DetectedDungeon[] = [];
  const seenNames = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 80) continue;

    const detected = extractDungeonFromHeader(trimmed);
    if (detected && detected.name && detected.name.length >= 2) {
      if (!seenNames.has(detected.name)) {
        seenNames.add(detected.name);
        found.push({
          name: detected.name,
          suggestedStartIndex: detected.index || 1,
          rawSample: trimmed,
        });
      }
    }
  }

  return found;
}

/**
 * Format dungeon index with specified bracket style: (1), （1）, 【1】, or - 1
 */
export function formatDungeonBracket(index: number, style: SplitChineseConfig['dungeonBracketStyle']): string {
  switch (style) {
    case 'half':
      return `(${index})`;
    case 'full':
      return `（${index}）`;
    case 'bracket':
      return `【${index}】`;
    case 'dash':
      return `- ${index}`;
    default:
      return `(${index})`;
  }
}

/**
 * Counts Chinese characters / standard word count in Chinese text.
 * In Chinese web novels, 1 non-whitespace character = 1 字.
 */
export function countChineseChars(text: string): number {
  if (!text) return 0;
  return text.replace(/[\s\r\n\t\u3000]/g, '').length;
}

/**
 * Counts pure Hanzi (Chinese ideographs) in text.
 */
export function countPureHanzi(text: string): number {
  if (!text) return 0;
  const match = text.match(/[\u4e00-\u9fa5\u3400-\u4dbf\uf900-\ufaff]/g);
  return match ? match.length : 0;
}

/**
 * Regex patterns identifying existing chapter headers in raw Chinese text
 */
const CHAPTER_HEADER_PATTERNS: RegExp[] = [
  // Standalone: 第1章, 第一千二百章 逆天改命, 第 001 章：天道崩塌
  /^\s*(?:[=*-]{2,}\s*)?(?:【|\[|\()?\s*(?:正文\s*|VIP\s*|VIP章节\s*)?第\s*[0-9一二三四五六七八九十百千万零两]+\s*[章回节篇集卷部话折]\s*(?:】|\]|\))?(?:\s*[:：\-\—\s].*|\s+.*)?(?:\s*[=*-]{2,})?\s*$/i,

  // Standalone: Chapter 1, Chương 1: Bí Mật, Section 1
  /^\s*(?:[=*-]{2,}\s*)?(?:Chapter|CHAPTER|Chương|CHƯƠNG|Section|SECTION)\s*[0-9]+(?:\s*[:：\-\—\s].*|\s+.*)?(?:\s*[=*-]{2,})?\s*$/i,

  // Standalone: 1、林轩觉醒, 001. 重生都市, 1. 逃出生天, 1: 诡异降临
  /^\s*[0-9]{1,5}\s*[、.：:\-\—]\s*[\u4e00-\u9fa5a-zA-Z0-9\s（）()【】\-—]{1,45}\s*$/,

  // Standalone: 001, 1, 12, 123 (chỉ có số độc lập trên 1 dòng ngắn)
  /^\s*[0-9]{1,5}\s*$/,

  // Standalone: 【第1章 惊变】, [第01回], (第1章), 【1】
  /^\s*[【\[\(][^】\]\)]*(?:第\s*[0-9一二三四五六七八九十百千万零两]+\s*[章回节篇集卷部话折]|Chapter|Chương|[0-9]{1,4})[^】\]\)]*[】\]\)]\s*$/i,

  // Standalone: 一、 序曲, 二、 降临
  /^\s*[一二三四五六七八九十百千万]+\s*[、.：:\-\—]\s*[\u4e00-\u9fa5a-zA-Z0-9\s]{1,40}\s*$/,

  // Standalone: === 第1章 ===, *** Chapter 1 ***
  /^\s*[=*-]{2,}\s*.*?(?:第.+?[章回节]|Chapter|Chương|[0-9]{1,4}).*?\s*[=*-]{2,}\s*$/i,

  // Standalone short section markers: 卷一、分卷阅读
  /^\s*(?:卷[0-9一二三四五六七八九十百千万零两]+|分卷阅读[0-9一二三四五六七八九十百千万零两]*|作品相关|序章|楔子|引子|尾声|番外[0-9一二三四五六七八九十百千万零两]*)\s*(?:[:：\-\—\s].*)?\s*$/,
];

/**
 * Checks if a standalone line is an existing chapter header
 */
export function isExistingChapterHeaderLine(line: string): boolean {
  if (!line || !line.trim()) return false;
  const trimmed = line.trim();

  // If line is too long, it's definitely story body, not a chapter header
  if (trimmed.length > 80) return false;

  // If line ends with a dialogue colon or quote, it's story text
  if (/[:：]\s*$/.test(trimmed) || /[“「『]$/.test(trimmed)) return false;

  return CHAPTER_HEADER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Identifies web metadata lines common on web novel platforms (e.g. "第一卷: 默认 • 3,347 chữ • 2026-04-08")
 */
export function isWebMetadataLine(line: string): boolean {
  if (!line || !line.trim()) return false;
  const trimmed = line.trim();
  if (trimmed.length > 100) return false;

  // Pattern: "第一卷: 默认 • 3,347 chữ • 2026-04-08" or "第一卷: 默认" or "第1卷: 正文"
  if (/^\s*(?:第\s*[0-9一二三四五六七八九十百千万]+\s*卷|分卷(?:阅读)?|卷\s*[0-9一二三四五六七八九十]+)\s*[:：\s]/i.test(trimmed)) {
    return true;
  }

  // Pattern: contains bullet points with word counts and dates: "3,347 chữ • 2026-04-08"
  if (/^\s*.*?(?:chữ|字|Words|words)\s*[•·|\-]\s*[0-9]{4}[-/][0-9]{2}[-/][0-9]{2}/i.test(trimmed)) {
    return true;
  }

  // Pattern: update time or chapter word count lines
  if (/^\s*(?:更新时间|本章字数|发布时间|字数|发表时间)\s*[:：]/i.test(trimmed)) {
    return true;
  }

  // Pure date line
  if (/^\s*[0-9]{4}[-/][0-9]{2}[-/][0-9]{2}(?:\s+[0-9]{2}:[0-9]{2}(?::[0-9]{2})?)?\s*$/.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Extracts a normalized Set of custom titles from user-pasted text/TOC
 */
export function extractCustomTitlesSet(rawList: string): Set<string> {
  const set = new Set<string>();
  if (!rawList || !rawList.trim()) return set;

  const lines = rawList.split(/\r?\n/);
  for (const line of lines) {
    let trimmed = line.trim();
    if (!trimmed) continue;

    // Skip metadata lines from TOC paste (e.g. "第一卷: 默认 • 3,347 chữ • 2026-04-08")
    if (isWebMetadataLine(trimmed)) continue;

    // Strip leading numbering or bullet points if present: "1. 请问有吃的吗" -> "请问有吃的吗"
    trimmed = trimmed.replace(/^[0-9]{1,4}\s*[.、:：\-\—]\s*/, '').trim();
    trimmed = trimmed.replace(/^(?:第\s*[0-9一二三四五六七八九十]+\s*[章回节]|Chapter\s*[0-9]+|Chương\s*[0-9]+)[:：\s]*/i, '').trim();

    if (trimmed && trimmed.length >= 1 && trimmed.length <= 80) {
      set.add(trimmed);
      // Also add without trailing punctuation: "好像动了。" -> "好像动了"
      const noPunct = trimmed.replace(/[。？！?!,.，、]$/, '').trim();
      if (noPunct) set.add(noPunct);
    }
  }

  return set;
}

/**
 * Checks if a line is specifically the FIRST chapter header (Chapter 1 / 第1章 / 1)
 */
export function isFirstChapterHeaderLine(line: string): boolean {
  if (!line || !line.trim()) return false;
  const trimmed = line.trim();
  if (trimmed.length > 80) return false;
  if (/[:：]\s*$/.test(trimmed) || /[“「『]$/.test(trimmed)) return false;

  const firstPatterns = [
    /^\s*(?:[=*-]{2,}\s*)?(?:【|\[|\()?\s*(?:正文\s*|VIP\s*|VIP章节\s*)?第\s*(?:1|一|01|001|0001)\s*[章回节篇集卷部话折]/i,
    /^\s*(?:[=*-]{2,}\s*)?(?:Chapter|CHAPTER|Chương|CHƯƠNG|Section|SECTION)\s*(?:1|01|001)(?:[:：\-\—\s]|$)/i,
    /^\s*(?:001|01|1)\s*[.、:：\-\—\s]/,
    /^\s*(?:001|01|1)$/,
    /^\s*[【\[\(](?:1|01|001|第1章|第一章|Chapter 1|Chương 1)[】\]\)]/i,
    /^\s*(?:一|1)\s*、\s*[\u4e00-\u9fa5]/,
  ];

  return firstPatterns.some((p) => p.test(trimmed));
}

/**
 * Strips existing chapter headers and numbers from raw text.
 * Also cleans inline chapter prefixes from paragraph starts.
 */
export function stripExistingChapterHeaders(rawText: string): {
  cleanedText: string;
  removedHeaders: string[];
} {
  if (!rawText || !rawText.trim()) {
    return { cleanedText: '', removedHeaders: [] };
  }

  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  const cleanedLines: string[] = [];
  const removedHeaders: string[] = [];

  // Inline header regex: e.g. "第1章 逆天改命 林轩缓缓睁开双眼..." -> strip prefix
  const inlineHeaderRegex =
    /^\s*(?:【|\[|\()?\s*(?:正文\s*|VIP\s*)?第\s*[0-9一二三四五六七八九十百千万零两]+\s*[章回节篇集卷部话折]\s*(?:】|\]|\))?(?:\s*[:：\-\—\s][^\n\u3000]{1,30})?\s+(?=[“「『\u4e00-\u9fa5])/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      cleanedLines.push('');
      continue;
    }

    // 1. Check if the line itself is a chapter header line
    if (isExistingChapterHeaderLine(trimmed)) {
      removedHeaders.push(trimmed);
      continue; // Skip this line completely
    }

    // 2. Check if the line starts with an inline chapter header
    if (inlineHeaderRegex.test(trimmed)) {
      const match = trimmed.match(inlineHeaderRegex);
      if (match) {
        const headerPrefix = match[0].trim();
        removedHeaders.push(headerPrefix);
        const remainingContent = trimmed.slice(match[0].length).trim();
        if (remainingContent) {
          cleanedLines.push(remainingContent);
        }
        continue;
      }
    }

    cleanedLines.push(line);
  }

  return {
    cleanedText: cleanedLines.join('\n'),
    removedHeaders,
  };
}

/**
 * Checks if a boundary between prevBlock and nextBlock is safe from broken dialogue.
 */
export function evaluateChineseBoundary(
  prevBlock: string,
  nextBlock: string
): { penalty: number; isForbidden: boolean } {
  const prev = (prevBlock || '').trim();
  const next = (nextBlock || '').trim();

  // 1. FORBIDDEN: Previous block ends with colon ':' or '：' (speech lead-in e.g. "他冷笑道：")
  if (/[:：]\s*$/.test(prev) || /[:：]["'“‘「『]\s*$/.test(prev)) {
    return { penalty: 50000, isForbidden: true };
  }

  // 2. FORBIDDEN: Previous block ends with speech cues without closing
  if (/(?:道|说|问|答|喊|笑|怒|喝|冷笑|苦笑|叹道|沉声道|惊呼)[:：\s]*$/i.test(prev)) {
    return { penalty: 30000, isForbidden: true };
  }

  // 3. FORBIDDEN: Unclosed quotation mark in prev block
  const openQuotes = (prev.match(/[“「『]/g) || []).length;
  const closeQuotes = (prev.match(/[”」』]/g) || []).length;
  if (openQuotes > closeQuotes) {
    return { penalty: 40000, isForbidden: true };
  }

  // 4. PENALIZED: Ends with comma '，' or semicolon '；' or dash '——'
  if (/[，,；;——-]\s*$/.test(prev)) {
    return { penalty: 15000, isForbidden: false };
  }

  let bonusOrPenalty = 0;

  // Good boundary: ends with Chinese sentence terminal '。', '！', '？', '……', '。”', '！”'
  if (/[。！？…][”」』]*\s*$/.test(prev)) {
    bonusOrPenalty -= 400;
  }

  // Good transition: next block starts with scene transition
  if (/^(?:第二天|次日|几日后|数日后|与此同时|转眼间|半月后|不久后|此时|当下)/.test(next)) {
    bonusOrPenalty -= 600;
  }

  return { penalty: bonusOrPenalty, isForbidden: false };
}

/**
 * Breaks long paragraphs into smaller sentences at sentence terminators (。！？…)
 * to ensure we can split precisely at ~1500 characters.
 */
export function breakIntoSentences(paragraph: string): string[] {
  if (!paragraph || countChineseChars(paragraph) <= 300) {
    return [paragraph];
  }

  // Split at sentence terminators while keeping the terminator attached to the preceding sentence
  const parts = paragraph.split(/([。！？…]+[”」』]?)/g);
  const sentences: string[] = [];

  for (let i = 0; i < parts.length; i += 2) {
    const text = parts[i] || '';
    const punctuation = parts[i + 1] || '';
    const fullSentence = (text + punctuation).trim();
    if (fullSentence) {
      sentences.push(fullSentence);
    }
  }

  return sentences.length > 0 ? sentences : [paragraph];
}

/**
 * Parses raw text into discrete paragraph/sentence blocks.
 */
export function parseRawIntoBlocks(rawText: string): string[] {
  if (!rawText || !rawText.trim()) return [];

  // Normalize newlines
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  // Split by newlines
  const lines = normalized
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const blocks: string[] = [];
  for (const line of lines) {
    const charLen = countChineseChars(line);
    if (charLen > 400) {
      // Split large blocks into sentences
      const sentences = breakIntoSentences(line);
      blocks.push(...sentences);
    } else {
      blocks.push(line);
    }
  }

  return blocks;
}

/**
 * Builds chapter header according to configuration (with full Infinite Flow support)
 */
export function formatChapterHeader(
  index: number,
  config: SplitChineseConfig,
  charCount: number,
  dungeonName?: string,
  dungeonIndex?: number
): { header: string; title: string } {
  let headerPrefix = '';

  switch (config.prefixFormat) {
    case 'di-zhang':
      headerPrefix = `第 ${index} 章`;
      break;
    case 'chuong':
      headerPrefix = `Chương ${index}`;
      break;
    case 'di-hui':
      headerPrefix = `第 ${index} 回`;
      break;
    case 'custom':
      headerPrefix = (config.customPrefix || '第 {n} 章').replace('{n}', String(index));
      break;
    default:
      headerPrefix = `第 ${index} 章`;
  }

  let fullHeader = headerPrefix;

  if (config.enableInfiniteFlow) {
    const dName = (dungeonName !== undefined ? dungeonName : config.dungeonName || '').trim();
    const dIdx = dungeonIndex !== undefined ? dungeonIndex : config.dungeonStartIndex || 1;
    const bracket = formatDungeonBracket(dIdx, config.dungeonBracketStyle || 'half');

    if (dName) {
      if (config.prefixFormat === 'chuong') {
        fullHeader = `${headerPrefix}: ${dName} ${bracket}`;
      } else {
        fullHeader = `${headerPrefix} ${dName} ${bracket}`;
      }
    } else {
      fullHeader = `${headerPrefix} ${bracket}`;
    }
  }

  if (config.includeCharCountInHeader) {
    fullHeader = `${fullHeader} (${charCount}字)`;
  }

  return {
    header: fullHeader,
    title: fullHeader,
  };
}

interface BlockWithMetadata {
  text: string;
  dungeonName?: string;
}

/**
 * Parses raw text into discrete paragraph/sentence blocks, tracking dungeon transitions if any.
 * Removes isolated chapter headers, custom titles, web metadata, and trims inline chapter headers.
 */
export function parseRawIntoBlocksWithDungeon(
  rawText: string,
  autoDetectDungeon = false,
  customTitlesToStrip = '',
  stripWebMetadata = true
): {
  blocks: BlockWithMetadata[];
  detectedDungeons: DetectedDungeon[];
  strippedCount: number;
} {
  if (!rawText || !rawText.trim()) {
    return { blocks: [], detectedDungeons: [], strippedCount: 0 };
  }

  const customTitleSet = extractCustomTitlesSet(customTitlesToStrip);

  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  const blocks: BlockWithMetadata[] = [];
  const detectedDungeons: DetectedDungeon[] = [];
  let currentActiveDungeon: string | undefined = undefined;
  let strippedCount = 0;

  // Regex to strip inline chapter prefixes if a line starts with "第1章 惊变 ... "
  const inlineHeaderRegex =
    /^\s*(?:[=*-]{2,}\s*)?(?:【|\[|\()?\s*(?:正文\s*|VIP\s*|VIP章节\s*)?第\s*[0-9一二三四五六七八九十百千万零两]+\s*[章回节篇集卷部话折]\s*(?:】|\]|\))?(?:\s*[:：\-\—\s][^\n\u3000]{1,35})?\s+(?=[“「『\u4e00-\u9fa5a-zA-Z0-9])/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let trimmed = line.trim();
    if (!trimmed) continue;

    // 1. Check if line is a web metadata line (e.g. "第一卷: 默认 • 3,347 chữ • 2026-04-08")
    if (stripWebMetadata && isWebMetadataLine(trimmed)) {
      strippedCount++;
      continue;
    }

    // 2. Check if line matches custom title list
    if (customTitleSet.size > 0) {
      const cleanNoPunct = trimmed.replace(/[。？！?!,.，、]$/, '').trim();
      if (customTitleSet.has(trimmed) || customTitleSet.has(cleanNoPunct)) {
        strippedCount++;
        continue; // Skip the unnumbered original title
      }
    }

    // 3. Check if line is an isolated standard chapter header
    if (isExistingChapterHeaderLine(trimmed)) {
      strippedCount++;
      if (autoDetectDungeon) {
        const dInfo = extractDungeonFromHeader(trimmed);
        if (dInfo && dInfo.name) {
          currentActiveDungeon = dInfo.name;
          if (!detectedDungeons.some((d) => d.name === dInfo.name)) {
            detectedDungeons.push({
              name: dInfo.name,
              suggestedStartIndex: dInfo.index || 1,
              rawSample: trimmed,
            });
          }
        }
      }
      continue; // Skip the header itself
    }

    // 4. Check if line starts with an inline chapter header (strip it)
    if (inlineHeaderRegex.test(trimmed)) {
      const match = trimmed.match(inlineHeaderRegex);
      if (match) {
        const headerPart = match[0].trim();
        strippedCount++;
        if (autoDetectDungeon) {
          const dInfo = extractDungeonFromHeader(headerPart);
          if (dInfo && dInfo.name) {
            currentActiveDungeon = dInfo.name;
            if (!detectedDungeons.some((d) => d.name === dInfo.name)) {
              detectedDungeons.push({
                name: dInfo.name,
                suggestedStartIndex: dInfo.index || 1,
                rawSample: headerPart,
              });
            }
          }
        }
        trimmed = trimmed.slice(match[0].length).trim();
        if (!trimmed) continue;
      }
    }

    const charLen = countChineseChars(trimmed);
    if (charLen > 400) {
      const sentences = breakIntoSentences(trimmed);
      for (const s of sentences) {
        blocks.push({ text: s, dungeonName: currentActiveDungeon });
      }
    } else {
      blocks.push({ text: trimmed, dungeonName: currentActiveDungeon });
    }
  }

  return { blocks, detectedDungeons, strippedCount };
}

/**
 * Main engine:
 * 1. Strips any existing chapter headers/numbers from raw file (if enabled)
 * 2. Splits the entire raw file into new chapters of ~1500 Chinese characters
 * 3. Supports Infinite Flow (Vô Hạn Lưu) phó bản indexing: (1), (2), (3)...
 * 4. Automatically assigns sequential chapter numbers (第 1 章, 第 2 章...)
 */
export function splitRawIntoChineseChapters(
  rawText: string,
  config: SplitChineseConfig = DEFAULT_CHINESE_CONFIG
): ChineseSplitResult {
  if (!rawText || !rawText.trim()) {
    return {
      chapters: [],
      totalChapters: 0,
      totalChars: 0,
      averageCharsPerChapter: 0,
      minChars: 0,
      maxChars: 0,
      removedHeadersCount: 0,
      removedHeadersSample: [],
    };
  }

  // Parse raw text into blocks with optional dungeon tracking and custom title filters
  const { blocks, detectedDungeons, strippedCount } = parseRawIntoBlocksWithDungeon(
    rawText,
    config.enableInfiniteFlow && config.dungeonAutoDetect,
    config.customTitlesToStrip,
    config.stripWebMetadata
  );

  if (blocks.length === 0) {
    return {
      chapters: [],
      totalChapters: 0,
      totalChars: 0,
      averageCharsPerChapter: 0,
      minChars: 0,
      maxChars: 0,
      removedHeadersCount: 0,
      removedHeadersSample: [],
    };
  }

  const targetChars = config.targetCharsPerChapter || 1500;
  const chapters: ProcessedChineseChapter[] = [];

  let currentBlockIndex = 0;
  let currentChapterNum = config.startChapterNumber || 1;

  // Infinite flow dungeon tracking state
  let currentDungeonName =
    config.dungeonName.trim() ||
    (detectedDungeons.length > 0 ? detectedDungeons[0].name : '');
  let currentDungeonIndex = config.dungeonStartIndex || 1;

  while (currentBlockIndex < blocks.length) {
    // Check if the current block belongs to a newly detected dungeon
    if (config.enableInfiniteFlow && config.dungeonAutoDetect) {
      const blockDungeon = blocks[currentBlockIndex].dungeonName;
      if (blockDungeon && blockDungeon !== currentDungeonName) {
        currentDungeonName = blockDungeon;
        currentDungeonIndex = 1; // Reset to (1) for new dungeon instance
      }
    }

    let accumulatedChars = 0;
    let lookaheadIndex = currentBlockIndex;
    const candidates: {
      endIndex: number;
      charCount: number;
      diffFromTarget: number;
      penalty: number;
      isForbidden: boolean;
      score: number;
    }[] = [];

    // Look ahead to find optimal split point around targetChars (1500)
    while (lookaheadIndex < blocks.length) {
      const blockObj = blocks[lookaheadIndex];
      const blockChars = countChineseChars(blockObj.text);
      accumulatedChars += blockChars;
      lookaheadIndex++;

      const diff = Math.abs(accumulatedChars - targetChars);

      // Evaluate boundary
      const nextBlockText = lookaheadIndex < blocks.length ? blocks[lookaheadIndex].text : '';
      const boundaryEval =
        config.dialogueSafe && nextBlockText
          ? evaluateChineseBoundary(blockObj.text, nextBlockText)
          : { penalty: 0, isForbidden: false };

      const score = diff + boundaryEval.penalty;

      candidates.push({
        endIndex: lookaheadIndex,
        charCount: accumulatedChars,
        diffFromTarget: diff,
        penalty: boundaryEval.penalty,
        isForbidden: boundaryEval.isForbidden,
        score,
      });

      // If we've exceeded targetChars + 600, stop looking further
      if (accumulatedChars >= targetChars + 600) {
        break;
      }
    }

    // Determine the best split end index
    let chosenEndIndex = lookaheadIndex;

    if (lookaheadIndex >= blocks.length) {
      // Reached the end of the entire file!
      if (accumulatedChars < 500 && chapters.length > 0) {
        const lastChap = chapters[chapters.length - 1];
        const remainingText = blocks
          .slice(currentBlockIndex)
          .map((b) => b.text)
          .join('\n\n');
        const updatedContent = `${lastChap.content}\n\n${remainingText}`;
        const updatedChars = countChineseChars(updatedContent);
        const { header, title } = formatChapterHeader(
          lastChap.chapterIndex,
          config,
          updatedChars,
          lastChap.dungeonName,
          lastChap.dungeonIndex
        );

        chapters[chapters.length - 1] = {
          ...lastChap,
          content: updatedContent,
          charCount: updatedChars,
          paragraphCount: lastChap.paragraphCount + (blocks.length - currentBlockIndex),
          header,
          title,
        };
        break;
      } else {
        chosenEndIndex = blocks.length;
      }
    } else {
      const nonForbidden = candidates.filter(
        (c) => !c.isForbidden && c.charCount >= targetChars * 0.7
      );
      if (nonForbidden.length > 0) {
        nonForbidden.sort((a, b) => a.score - b.score);
        chosenEndIndex = nonForbidden[0].endIndex;
      } else {
        candidates.sort((a, b) => a.score - b.score);
        chosenEndIndex = candidates[0].endIndex;
      }
    }

    // Slice blocks for this chapter
    const chapterBlockTexts = blocks
      .slice(currentBlockIndex, chosenEndIndex)
      .map((b) => b.text);

    const formattedParagraphs = config.paragraphIndentation
      ? chapterBlockTexts.map((b) =>
          b.startsWith('　　') || b.startsWith('  ') ? b : `　　${b}`
        )
      : chapterBlockTexts;

    const chapterContent = formattedParagraphs.join('\n\n');
    const chapterChars = countChineseChars(chapterContent);

    const activeDName = config.enableInfiniteFlow ? currentDungeonName : undefined;
    const activeDIdx = config.enableInfiniteFlow ? currentDungeonIndex : undefined;

    const { header, title } = formatChapterHeader(
      currentChapterNum,
      config,
      chapterChars,
      activeDName,
      activeDIdx
    );

    chapters.push({
      id: `cn-chap-${currentChapterNum}`,
      chapterIndex: currentChapterNum,
      header,
      title,
      content: chapterContent,
      charCount: chapterChars,
      paragraphCount: chapterBlockTexts.length,
      dungeonName: activeDName,
      dungeonIndex: activeDIdx,
    });

    currentChapterNum++;
    if (config.enableInfiniteFlow) {
      currentDungeonIndex++;
    }
    currentBlockIndex = chosenEndIndex;
  }

  // Calculate statistics
  const totalChars = chapters.reduce((sum, c) => sum + c.charCount, 0);
  const totalChapters = chapters.length;
  const averageCharsPerChapter =
    totalChapters > 0 ? Math.round(totalChars / totalChapters) : 0;
  const charCounts = chapters.map((c) => c.charCount);
  const minChars = charCounts.length > 0 ? Math.min(...charCounts) : 0;
  const maxChars = charCounts.length > 0 ? Math.max(...charCounts) : 0;

  return {
    chapters,
    totalChapters,
    totalChars,
    averageCharsPerChapter,
    minChars,
    maxChars,
    removedHeadersCount: strippedCount,
    removedHeadersSample: detectedDungeons.map((d) => d.rawSample),
  };
}
