import {
  ProcessedChineseChapter,
  SplitChineseConfig,
  ChineseSplitResult,
  ChineseParagraph,
  AnalyzedTOCChapter,
  AnalyzedArc,
  TOCAnalysisResult,
  DungeonBracketStyle,
  ChapterPrefixType,
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
  stripAuthorNotes: true,

  // Custom title & web metadata filter
  customTitlesToStrip: '',
  stripWebMetadata: true,

  // Infinite flow defaults
  enableInfiniteFlow: false,
  dungeonName: '',
  dungeonStartIndex: 1,
  dungeonAutoDetect: true,
  dungeonBracketStyle: 'suffix-omit-first',

  // TOC Analysis & Transition Handling
  useAnalyzedTOC: false,
  analyzedChapterHeaders: [],
  vhlTransitionMode: 'keep-original',
  vhlTransitionCustomLabel: '现实',
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
  formatHint?: SplitChineseConfig['dungeonBracketStyle'];
}

/**
 * Converts integer to Chinese numeral (1 -> 一, 2 -> 二, 10 -> 十, 15 -> 十五, 22 -> 二十二)
 */
export function numberToChineseNumeral(num: number): string {
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  if (num >= 0 && num <= 10) return digits[num];
  if (num > 10 && num < 20) return `十${digits[num % 10]}`;
  if (num >= 20 && num < 100) {
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    return `${digits[tens]}十${ones > 0 ? digits[ones] : ''}`;
  }
  return String(num);
}

/**
 * Extracts dungeon name and index from a raw header line:
 * - "第一卷: 和平友爱族谱村 • 1,932 chữ • 2025-08-02"
 * - "第2章 和平友爱族谱村2"
 * - "第1章 和平友爱族谱村"
 * - "第1章 恐怖高校（1）"
 * - "Chương 5: Bệnh Viện (2)"
 */
export function extractDungeonFromHeader(
  header: string
): { name: string; index: number; formatHint?: SplitChineseConfig['dungeonBracketStyle'] } | null {
  if (!header || !header.trim()) return null;
  const cleaned = header.trim();

  // Pattern 0: Volume / Arc format e.g. "第一卷: 和平友爱族谱村 • 1,932 chữ • 2025-08-02" or "第一卷 和平友爱族谱村"
  const volumeMatch = cleaned.match(
    /^(?:[0-9]{1,4}[.\s、\t]+)?(?:第\s*[0-9一二三四五六七八九十百千万]+\s*卷|分卷(?:阅读)?|卷\s*[0-9一二三四五六七八九十]+)\s*[:：\s]*([^\s•·|\-–—\n\r:：()（）【】]+)/i
  );
  if (volumeMatch && volumeMatch[1]) {
    const vName = volumeMatch[1].trim();
    if (vName && !/^(?:正文|默认|作品相关|VIP|免费章节|第[0-9一二三四五六七八九十]+章)$/i.test(vName)) {
      return {
        name: vName,
        index: 1,
        formatHint: 'suffix-omit-first',
      };
    }
  }

  // Pattern 1: Chapter prefix + Dungeon Name + (1) or （1） or 【1】 or - 1
  const pattern1 =
    /^(?:[0-9]{1,4}[.\s、\t]+)?(?:(?:第\s*[0-9一二三四五六七八九十百千万]+\s*[章回节篇])|(?:Chapter|Chương|Section)\s*\d+[:：\s]*|[0-9]{1,4}\s*[.、:：\-])?\s*([^()（）【】\n\r:：]+?)\s*(?:[（(]([0-9一二三四五六七八九十]+)[)）]|【([0-9一二三四五六七八九十]+)】|[-_]\s*([0-9]+))\s*$/i;

  const match1 = cleaned.match(pattern1);
  if (match1) {
    const rawName = match1[1].trim();
    const rawIdx = match1[2] || match1[3] || match1[4];
    if (rawName && !/^(?:正文|VIP|章节|Chapter|Chương)$/i.test(rawName)) {
      let formatHint: SplitChineseConfig['dungeonBracketStyle'] = 'half';
      if (cleaned.includes('（')) formatHint = 'full';
      else if (cleaned.includes('【')) formatHint = 'bracket';
      else if (cleaned.includes('-')) formatHint = 'dash';

      return {
        name: rawName.replace(/^[:：\-\—\s]+/, '').trim(),
        index: chineseNumeralToNumber(rawIdx),
        formatHint,
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
      formatHint: 'suffix-omit-first',
    };
  }

  // Pattern 3: Chapter prefix + Dungeon Name + glued digit suffix (e.g. "第2章 和平友爱族谱村2" or "2 第2章 和平友爱族谱村2")
  const pattern3 =
    /^(?:[0-9]{1,4}[.\s、\t]+)?(?:第\s*[0-9一二三四五六七八九十百千万]+\s*[章回节篇]|Chapter\s*[0-9]+|Chương\s*[0-9]+|[0-9]{1,4}[.、:：\-])\s*[:：\-\—\s]*([^\s\d:：()（）【】]{2,30})\s*([0-9]{1,3}|[一二三四五六七八九十]{1,2})\s*$/i;
  const match3 = cleaned.match(pattern3);
  if (match3) {
    const rawName = match3[1].trim();
    const rawIdx = match3[2];
    if (rawName && !/^(?:正文|VIP|章节|Chapter|Chương)$/i.test(rawName)) {
      return {
        name: rawName,
        index: chineseNumeralToNumber(rawIdx),
        formatHint: 'suffix-omit-first',
      };
    }
  }

  // Pattern 4: Chapter prefix + Dungeon Name (without suffix number, e.g. "第1章 和平友爱族谱村" or "1 第1章 和平友爱族谱村")
  const pattern4 =
    /^(?:[0-9]{1,4}[.\s、\t]+)?(?:第\s*[0-9一二三四五六七八九十百千万]+\s*[章回节篇]|Chapter\s*[0-9]+|Chương\s*[0-9]+|[0-9]{1,4}[.、:：\-])\s*[:：\-\—\s]+([^\s\d:：()（）【】]{2,30})\s*$/i;
  const match4 = cleaned.match(pattern4);
  if (match4) {
    const rawName = match4[1].trim();
    if (rawName && !/^(?:正文|VIP|章节|Chapter|Chương|无题|默认|第一章|第二章|第三章)$/i.test(rawName)) {
      return {
        name: rawName,
        index: 1,
        formatHint: 'suffix-omit-first',
      };
    }
  }

  return null;
}

/**
 * Scans the raw text and discovers all Dungeon names mentioned in headers/volumes
 */
export function scanDungeonsFromRaw(rawText: string): DetectedDungeon[] {
  if (!rawText) return [];
  const lines = rawText.split(/\r?\n/);
  const found: DetectedDungeon[] = [];
  const nameMap = new Map<string, DetectedDungeon>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > 90) continue;

    const detected = extractDungeonFromHeader(trimmed);
    if (detected && detected.name && detected.name.length >= 2) {
      const existing = nameMap.get(detected.name);
      if (!existing) {
        const item: DetectedDungeon = {
          name: detected.name,
          suggestedStartIndex: detected.index || 1,
          rawSample: trimmed,
          formatHint: detected.formatHint,
        };
        nameMap.set(detected.name, item);
        found.push(item);
      } else {
        // If we see index 1, keep 1 as starting index
        if (detected.index === 1 && existing.suggestedStartIndex !== 1) {
          existing.suggestedStartIndex = 1;
        }
        if (detected.formatHint) {
          existing.formatHint = detected.formatHint;
        }
      }
    }
  }

  return found;
}

/**
 * Format dungeon index with specified bracket style:
 * - 'suffix-omit-first': C1 is '' (empty), C2 is '2', C3 is '3'... (e.g. 和平友爱族谱村, 和平友爱族谱村2)
 * - 'suffix': '1', '2', '3'... (e.g. 和平友爱族谱村1, 和平友爱族谱村2)
 * - 'space': ' 1', ' 2', ' 3'...
 * - 'half': '(1)', '(2)', '(3)'...
 * - 'full': '（1）', '（2）', '（3）'...
 * - 'bracket': '【1】', '【2】', '【3】'...
 * - 'dash': '- 1', '- 2', '- 3'...
 * - 'chinese-bracket': '（一）', '（二）', '（三）'...
 * - 'chinese-suffix': '一', '二', '三'...
 */
export function formatDungeonBracket(
  index: number,
  style: SplitChineseConfig['dungeonBracketStyle'] = 'half'
): string {
  switch (style) {
    case 'suffix-omit-first':
      return index <= 1 ? '' : `${index}`;
    case 'suffix':
      return `${index}`;
    case 'space':
      return ` ${index}`;
    case 'half':
      return `(${index})`;
    case 'full':
      return `（${index}）`;
    case 'bracket':
      return `【${index}】`;
    case 'dash':
      return `- ${index}`;
    case 'chinese-bracket': {
      const cn = numberToChineseNumeral(index);
      return `（${cn}）`;
    }
    case 'chinese-suffix': {
      const cn = numberToChineseNumeral(index);
      return `${cn}`;
    }
    default:
      return `(${index})`;
  }
}

export interface VHLAnalysisOptions {
  vhlTransitionMode?: 'empty-title' | 'keep-original' | 'custom-label' | 'pure-number';
  vhlTransitionCustomLabel?: string;
  prefixFormat?: ChapterPrefixType;
  customPrefix?: string;
  forcedBracketStyle?: DungeonBracketStyle;
}

/**
 * Powerful Table of Contents Analyzer for Infinite Flow (Vô Hạn Lưu):
 * 1. Parses raw TOC lines, removes web metadata (word counts, dates, etc.)
 * 2. Distinguishes Dungeon chapters from Transition / Real-World chapters
 * 3. Identifies Arc boundaries, dungeon names, numbering styles
 * 4. Generates formatted headers matching the novel's flow
 */
export function analyzeVHLTableOfContents(
  rawTOC: string,
  options: VHLAnalysisOptions = {}
): TOCAnalysisResult {
  const transitionMode = options.vhlTransitionMode || 'keep-original';
  const transitionLabel = options.vhlTransitionCustomLabel || '现实';
  const prefixFormat = options.prefixFormat || 'di-zhang';
  const customPrefix = options.customPrefix || '第 {n} 章';

  if (!rawTOC || !rawTOC.trim()) {
    return {
      totalAnalyzed: 0,
      dungeonChaptersCount: 0,
      transitionChaptersCount: 0,
      arcs: [],
      chapters: [],
    };
  }

  const lines = rawTOC.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  interface RawCandidate {
    lineIndex: number;
    raw: string;
    chapterNum?: number;
    titlePart: string;
  }

  const candidates: RawCandidate[] = [];
  const knownVolumeDungeons: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;

    // Volume detection e.g. "第一卷: 和平友爱族谱村 • 1,932 chữ • 2025-08-02"
    const volMatch = raw.match(
      /^(?:[0-9]{1,4}[.\s、\t]+)?(?:第\s*[0-9一二三四五六七八九十百千万]+\s*卷|分卷(?:阅读)?|卷\s*[0-9一二三四五六七八九十]+)\s*[:：\s]*([^\s•·|\-–—\n\r:：()（）【】]+)/i
    );
    if (volMatch && volMatch[1]) {
      const vName = volMatch[1].trim();
      if (vName && !/^(?:正文|默认|作品相关|VIP|免费章节)$/i.test(vName)) {
        if (!knownVolumeDungeons.includes(vName)) {
          knownVolumeDungeons.push(vName);
        }
      }
    }

    // Skip pure web metadata lines
    if (isWebMetadataLine(raw)) {
      continue;
    }

    // Skip standalone digits if followed by a chapter header
    if (
      /^[0-9]{1,5}$/.test(raw) &&
      i + 1 < lines.length &&
      /第\s*[0-9一二三四五六七八九十]+\s*章|Chapter|Chương/i.test(lines[i + 1])
    ) {
      continue;
    }

    // Extract chapter number & title part
    const chapRegex =
      /^(?:([0-9]{1,5})\s+[.\s、\t]*)?(?:(?:第\s*([0-9一二三四五六七八九十百千万]+)\s*[章回节篇集卷部话折])|(?:Chapter|Chương|Section)\s*([0-9]+)|([0-9]{1,5})\s*[.、:：\-])\s*[:：\-\—\s]*(.*)$/i;
    const match = raw.match(chapRegex);

    let chapNum: number | undefined = undefined;
    let titlePart = raw;

    if (match) {
      const numStr = match[2] || match[3] || match[4] || match[1];
      if (numStr) {
        chapNum = chineseNumeralToNumber(numStr);
      }
      titlePart = (match[5] || '').trim();
    } else {
      titlePart = raw;
    }

    candidates.push({
      lineIndex: i,
      raw,
      chapterNum: chapNum,
      titlePart,
    });
  }

  // Frequency analysis to distinguish Dungeon names from Transition titles
  const dungeonFrequencyMap = new Map<string, number>();

  for (const c of candidates) {
    const dInfo = extractDungeonFromHeader(c.raw) || extractDungeonFromHeader(c.titlePart);
    if (dInfo && dInfo.name) {
      dungeonFrequencyMap.set(dInfo.name, (dungeonFrequencyMap.get(dInfo.name) || 0) + 1);
    }
  }

  for (const vName of knownVolumeDungeons) {
    dungeonFrequencyMap.set(vName, (dungeonFrequencyMap.get(vName) || 0) + 5);
  }

  const transitionRegex =
    /(?:现实|日常|过度|过渡|休憩|休息|结算|抽奖|回归|准备|整顿|番外|总结|Interlude|Real\s*World|Hiện\s*thực|Kết\s*toán|Nghỉ\s*ngơi)/i;

  const parsedChapters: AnalyzedTOCChapter[] = [];
  let runningChapIndex = 1;
  let transitionRunningIndex = 1;

  for (let idx = 0; idx < candidates.length; idx++) {
    const c = candidates[idx];
    const chapNum =
      c.chapterNum !== undefined && c.chapterNum > 0 ? c.chapterNum : runningChapIndex;
    runningChapIndex = chapNum + 1;

    const dInfo = extractDungeonFromHeader(c.raw) || extractDungeonFromHeader(c.titlePart);
    let isDungeon = false;
    let dName = '';
    let dIndex = 1;
    let dFormat: DungeonBracketStyle = options.forcedBracketStyle || 'suffix-omit-first';

    if (dInfo && dInfo.name) {
      const freq = dungeonFrequencyMap.get(dInfo.name) || 0;
      if (
        freq >= 2 ||
        (dInfo.formatHint && dInfo.formatHint !== 'suffix-omit-first') ||
        knownVolumeDungeons.includes(dInfo.name)
      ) {
        isDungeon = true;
        dName = dInfo.name;
        dIndex = dInfo.index || 1;
        dFormat = options.forcedBracketStyle || dInfo.formatHint || 'suffix-omit-first';
      } else if (!transitionRegex.test(c.titlePart) && freq >= 1) {
        isDungeon = true;
        dName = dInfo.name;
        dIndex = dInfo.index || 1;
        dFormat = options.forcedBracketStyle || dInfo.formatHint || 'suffix-omit-first';
      }
    }

    if (!isDungeon) {
      for (const [knownName] of dungeonFrequencyMap.entries()) {
        if (c.titlePart.includes(knownName)) {
          isDungeon = true;
          dName = knownName;
          const suffixNumMatch = c.titlePart
            .slice(c.titlePart.indexOf(knownName) + knownName.length)
            .match(/^[^\d]*(\d+)/);
          dIndex = suffixNumMatch ? parseInt(suffixNumMatch[1], 10) : 1;
          dFormat = options.forcedBracketStyle || 'suffix-omit-first';
          break;
        }
      }
    }

    let pfx = '';
    if (prefixFormat === 'chuong') {
      pfx = `Chương ${chapNum}:`;
    } else if (prefixFormat === 'di-hui') {
      pfx = `第 ${chapNum} 回`;
    } else if (prefixFormat === 'custom') {
      pfx = customPrefix.replace('{n}', String(chapNum));
    } else {
      pfx = `第 ${chapNum} 章`;
    }

    if (isDungeon) {
      transitionRunningIndex = 1;
      const bracketStr = formatDungeonBracket(dIndex, dFormat);
      let formatted = '';
      if (
        dFormat === 'suffix-omit-first' ||
        dFormat === 'suffix' ||
        dFormat === 'chinese-suffix'
      ) {
        formatted =
          prefixFormat === 'chuong'
            ? `${pfx} ${dName}${bracketStr}`
            : `${pfx} ${dName}${bracketStr}`;
      } else if (dFormat === 'space') {
        formatted = `${pfx} ${dName}${bracketStr}`;
      } else {
        formatted = `${pfx} ${dName} ${bracketStr}`;
      }

      parsedChapters.push({
        rawLine: c.raw,
        chapterIndex: chapNum,
        type: 'dungeon',
        dungeonName: dName,
        dungeonIndex: dIndex,
        detectedFormat: dFormat,
        originalTitle: c.titlePart || dName,
        formattedHeader: formatted.trim(),
      });
    } else {
      // Transition chapter!
      let formatted = '';
      if (transitionMode === 'empty-title' || transitionMode === 'pure-number') {
        // Pure chapter number, no sub-title (để trống tên chương)
        formatted = pfx;
      } else if (transitionMode === 'keep-original') {
        const cleanTitle = c.titlePart || '现实世界';
        formatted =
          prefixFormat === 'chuong' ? `${pfx} ${cleanTitle}` : `${pfx} ${cleanTitle}`;
      } else if (transitionMode === 'custom-label') {
        const bracketStr = formatDungeonBracket(transitionRunningIndex, 'half');
        formatted =
          prefixFormat === 'chuong'
            ? `${pfx} ${transitionLabel} ${bracketStr}`
            : `${pfx} ${transitionLabel} ${bracketStr}`;
        transitionRunningIndex++;
      } else {
        formatted = pfx;
      }

      parsedChapters.push({
        rawLine: c.raw,
        chapterIndex: chapNum,
        type: 'transition',
        originalTitle: c.titlePart || 'Chương quá độ',
        formattedHeader: formatted.trim(),
      });
    }
  }

  // Group into contiguous Arcs
  const arcs: AnalyzedArc[] = [];
  let currentArc: AnalyzedArc | null = null;

  for (const ch of parsedChapters) {
    const arcKey =
      ch.type === 'dungeon' ? ch.dungeonName || 'Phó bản' : 'Quá độ / Hiện thực';
    if (!currentArc || currentArc.name !== arcKey || currentArc.type !== ch.type) {
      if (currentArc) {
        arcs.push(currentArc);
      }
      currentArc = {
        type: ch.type,
        name: arcKey,
        startChapter: ch.chapterIndex,
        endChapter: ch.chapterIndex,
        totalChapters: 1,
        format: ch.detectedFormat,
        samples: [ch.formattedHeader],
      };
    } else {
      currentArc.endChapter = ch.chapterIndex;
      currentArc.totalChapters++;
      if (currentArc.samples.length < 3) {
        currentArc.samples.push(ch.formattedHeader);
      }
    }
  }
  if (currentArc) {
    arcs.push(currentArc);
  }

  const dungeonChaptersCount = parsedChapters.filter((c) => c.type === 'dungeon').length;
  const transitionChaptersCount = parsedChapters.filter(
    (c) => c.type === 'transition'
  ).length;

  return {
    totalAnalyzed: parsedChapters.length,
    dungeonChaptersCount,
    transitionChaptersCount,
    arcs,
    chapters: parsedChapters,
  };
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
  // Standalone: 第1章, 第一千二百章 逆天改命, 第 001 章：天道崩塌, 1 第1章 和平友爱族谱村, 2 第2章 和平友爱族谱村2
  /^\s*(?:[0-9]{1,5}\s*[.\s、\t]+)?(?:[=*-]{2,}\s*)?(?:【|\[|\()?\s*(?:正文\s*|VIP\s*|VIP章节\s*)?第\s*[0-9一二三四五六七八九十百千万零两]+\s*[章回节篇集卷部话折]\s*(?:】|\]|\))?(?:\s*[:：\-\—\s].*|\s+.*)?(?:\s*[=*-]{2,})?\s*$/i,

  // Standalone: Chapter 1, Chương 1: Bí Mật, Section 1
  /^\s*(?:[0-9]{1,5}\s*[.\s、\t]+)?(?:[=*-]{2,}\s*)?(?:Chapter|CHAPTER|Chương|CHƯƠNG|Section|SECTION)\s*[0-9]+(?:\s*[:：\-\—\s].*|\s+.*)?(?:\s*[=*-]{2,})?\s*$/i,

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

  // Standalone short section markers: 卷一、分卷阅读, 第一卷: 和平友爱族谱村
  /^\s*(?:[0-9]{1,5}\s*[.\s、\t]+)?(?:卷[0-9一二三四五六七八九十百千万零两]+|第\s*[0-9一二三四五六七八九十百千万零两]+\s*卷|分卷阅读[0-9一二三四五六七八九十百千万零两]*|作品相关|序章|楔子|引子|尾声|番外[0-9一二三四五六七八九十百千万零两]*)\s*(?:[:：\-\—\s].*)?\s*$/,
];

/**
 * Strips author notes (lời tác giả / 作话 / 作者有话说 / 题外话 / PS) safely and precisely from raw Chinese text.
 * Spans from "作者有话说：" (or 作话 / 题外话 / PS) all the way until the next chapter header
 * in the original text (e.g. 第一章, 第1章, Chapter 1, 1., etc. depending on the story), or EOF.
 */
export function stripAuthorNotes(rawText: string): string {
  if (!rawText || !rawText.trim()) return '';

  let text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 1. Remove bracketed author note blocks self-contained inside brackets with colon / content
  // e.g. 【作者有话说：...】, 【作话：...】, 【作者题外话：...】, 【作家想说的话：...】
  text = text.replace(
    /【\s*(?:作者\s*(?:有话说|题外话|留言|唠叨|碎碎念|碎念|想说的话|唠嗑|的话)|作话|题外话|作家想说的话|作家的话|彩蛋章|本章说|感谢名单|加更说明)\s*[:：][^】]{0,800}】/g,
    ''
  );
  text = text.replace(
    /\[\s*(?:作者\s*(?:有话说|题外话|留言|唠叨|碎碎念|碎念|想说的话|的话)|作话|题外话)\s*[:：][^\]\n]{0,300}\]/g,
    ''
  );
  text = text.replace(
    /[（\(]\s*(?:作者\s*(?:有话说|题外话|留言|唠叨|碎碎念|碎念|想说的话|菌|君|注|的话)|作话|题外话|PS|ps)\s*[:：]?[^）\)\n]{0,300}[）\)]/g,
    ''
  );

  const lines = text.split('\n');
  const resultLines: string[] = [];
  let inAuthorNoteBlock = false;

  // Chapter header patterns to safely exit author note block and preserve the new chapter
  // Covers: 第一章, 第1章, 1., 01, Chapter 1, Chương 1, 【第1章】, 一、, etc.
  const isChapterHeader = (trimmedLine: string): boolean => {
    if (!trimmedLine || trimmedLine.length > 80) return false;
    // Lines ending with dialogue colons or opening quotes are dialogue/story narrative
    if (/[:：]\s*$/.test(trimmedLine) || /[“"「『]$/.test(trimmedLine)) return false;

    // Fast check against existing chapter header detector
    if (isExistingChapterHeaderLine(trimmedLine)) return true;

    // 1. 第...章/回/节/篇/集/卷/部/话/折 (e.g. 第一章, 第1章, 1 第1章, 正文 第一章, 【第1章】)
    if (
      /^\s*(?:[0-9]{1,5}\s*[.\s、\t]+)?(?:[=*-]{2,}\s*)?(?:【|\[|\()?\s*(?:正文\s*|VIP\s*|VIP章节\s*)?第\s*[0-9一二三四五六七八九十百千万零两]+\s*[章回节篇集卷部话折]/i.test(
        trimmedLine
      )
    ) {
      return true;
    }

    // 2. Chapter / Chương / Section
    if (
      /^\s*(?:[0-9]{1,5}\s*[.\s、\t]+)?(?:[=*-]{2,}\s*)?(?:Chapter|CHAPTER|Chương|CHƯƠNG|Section|SECTION)\s*[0-9]+/i.test(
        trimmedLine
      )
    ) {
      return true;
    }

    // 3. Numbered: 1. , 1、, 01. , 1: , 1 - 
    if (
      /^\s*[0-9]{1,5}\s*[、.：:\-\—\s]\s*[\u4e00-\u9fa5a-zA-Z0-9\s（）()【】\-—]{1,45}\s*$/.test(
        trimmedLine
      )
    ) {
      return true;
    }

    // 4. Standalone pure number: 1, 2, 01, 001
    if (/^\s*[0-9]{1,5}\s*$/.test(trimmedLine)) {
      return true;
    }

    // 5. Chinese numeral header: 一、, 二、, 一. 
    if (
      /^\s*[一二三四五六七八九十百千万]+\s*[、.：:\-\—\s]\s*[\u4e00-\u9fa5a-zA-Z0-9\s]{1,40}\s*$/.test(
        trimmedLine
      )
    ) {
      return true;
    }

    // 6. Bracketed chapter/index: 【第1章】, 【1】, [1], （1）
    if (
      /^\s*[【\[\(][^】\]\)]*(?:第\s*[0-9一二三四五六七八九十百千万零两]+\s*[章回节篇集卷部话折]|Chapter|Chương|[0-9]{1,4})[^】\]\)]*[】\]\)]\s*$/i.test(
        trimmedLine
      )
    ) {
      return true;
    }

    // 7. Divider chapter header: === 第1章 ===, *** 第一章 ***
    if (
      /^\s*[=*-]{2,}\s*.*?(?:第.+?[章回节]|Chapter|Chương|[0-9]{1,4}).*?\s*[=*-]{2,}\s*$/i.test(
        trimmedLine
      )
    ) {
      return true;
    }

    // 8. Special section markers: 序章, 楔子, 引子, 尾声, 番外, 后记, 作品相关
    if (
      /^\s*(?:[0-9]{1,5}\s*[.\s、\t]+)?(?:卷[0-9一二三四五六七八九十百千万零两]+|第\s*[0-9一二三四五六七八九十百千万零两]+\s*卷|分卷阅读[0-9一二三四五六七八九十百千万零两]*|作品相关|序章|楔子|引子|尾声|番外[0-9一二三四五六七八九十百千万零两]*|后记)\s*(?:[:：\-\—\s].*)?\s*$/.test(
        trimmedLine
      )
    ) {
      return true;
    }

    return false;
  };

  // Author note start marker:
  // e.g. 作者有话说：, 作者有话说:, 作者有话说, 【作者有话说】, 作话：, 题外话：, PS：, etc.
  const isAuthorNoteStart = (trimmedLine: string): boolean => {
    if (!trimmedLine) return false;
    // Dialogue quotes do not start author notes
    if (/^[“"「『]/.test(trimmedLine)) return false;

    // Pattern A: Standalone or with colon: "作者有话说：...", "【作者有话说】", "作话：...", "题外话：..."
    const keywordPattern =
      /^(?:[=*-~#]{2,}\s*)?(?:【|\[|\(|（)?\s*(?:作者\s*(?:有话说|题外话|留言|唠叨|碎碎念|碎念|想说的话|唠嗑|菌说|君说|的话)|作话|题外话|作家想说的话|作家的话|彩蛋章|感谢名单|加更说明)\s*(?:】|\]|\)|）)?\s*[:：]?/i;
    if (keywordPattern.test(trimmedLine)) {
      return true;
    }

    // Pattern B: Standalone author line: "作者：" / "作者:"
    if (/^(?:[=*-~#]{2,}\s*)?(?:【|\[|\(|（)?\s*作者\s*(?:】|\]|\)|）)?\s*[:：]/i.test(trimmedLine)) {
      return true;
    }

    // Pattern C: PS lines: "PS：", "ps:", "P.S:"
    if (/^(?:[=*-~#]{2,}\s*)?(?:[（\(【\[])?\s*(?:PS|ps|P\.S|p\.s)\s*[:：]/i.test(trimmedLine)) {
      return true;
    }

    return false;
  };

  // Chapter end markers: (本章完), 【本章完】, ===本章完===
  const chapterEndMarkerRegex =
    /^\s*(?:[=*-~#]{2,}\s*)?(?:【|\[|\(|（)?\s*(?:本章完|全书完|完结|正文完)\s*(?:】|\]|\)|）)?(?:\s*[=*-~#]{2,})?\s*$/;

  // Pure vote / recommendation begs
  const voteBegRegex =
    /^\s*(?:求推荐票|求月票|求催更|求为爱发电|求收藏|求花花|求追读|求好评|求打赏|求票票|感谢大家投喂)\s*[!！~。…]*$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (!inAuthorNoteBlock) {
        resultLines.push('');
      }
      // Blank lines inside author note block are part of the note and skipped
      continue;
    }

    // Check if this line is a new chapter header (e.g. 第一章, 第1章, 1., etc.)
    if (isChapterHeader(trimmed)) {
      if (inAuthorNoteBlock) {
        // Exited author note block: the author note ended right before this chapter!
        inAuthorNoteBlock = false;
      }
      resultLines.push(line);
      continue;
    }

    // If we are currently inside an author note block:
    if (inAuthorNoteBlock) {
      // Check for standalone chapter end markers (just in case)
      if (trimmed.length <= 30 && chapterEndMarkerRegex.test(trimmed)) {
        continue;
      }
      // Everything inside author note block is skipped until next chapter header
      continue;
    }

    // Check if this line starts an author note
    if (isAuthorNoteStart(trimmed)) {
      inAuthorNoteBlock = true;
      continue;
    }

    // Standalone chapter end markers: (本章完), 【本章完】
    if (trimmed.length <= 30 && chapterEndMarkerRegex.test(trimmed)) {
      continue;
    }

    // Standalone vote / beg lines
    if (trimmed.length <= 30 && voteBegRegex.test(trimmed)) {
      continue;
    }

    resultLines.push(line);
  }

  // Clean trailing blank lines
  while (resultLines.length > 0 && !resultLines[resultLines.length - 1].trim()) {
    resultLines.pop();
  }

  return resultLines.join('\n');
}

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
 * Identifies web metadata lines common on web novel platforms (e.g. "第一卷: 和平友爱族谱村 • 1,932 chữ • 2025-08-02")
 */
export function isWebMetadataLine(line: string): boolean {
  if (!line || !line.trim()) return false;
  const trimmed = line.trim();
  if (trimmed.length > 120) return false;

  // Pattern: "第一卷: 和平友爱族谱村 • 1,932 chữ • 2025-08-02" or "第一卷: 默认" or "第1卷: 正文"
  if (/^\s*(?:[0-9]{1,5}\s*[.\s、\t]+)?(?:第\s*[0-9一二三四五六七八九十百千万]+\s*卷|分卷(?:阅读)?|卷\s*[0-9一二三四五六七八九十]+)\s*[:：\s]/i.test(trimmed)) {
    return true;
  }

  // Pattern: contains bullet points with word counts and dates: "• 1,932 chữ • 2025-08-02" or "3,347 chữ • 2026-04-08"
  if (/^\s*.*?(?:chữ|字|Words|words)\s*[•·|\-–—]\s*[0-9]{4}[-/][0-9]{2}[-/][0-9]{2}/i.test(trimmed)) {
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
    const style = config.dungeonBracketStyle || 'half';
    const bracketOrSuffix = formatDungeonBracket(dIdx, style);

    if (dName) {
      if (style === 'suffix-omit-first' || style === 'suffix' || style === 'chinese-suffix') {
        // Direct glued suffix: e.g. "第 1 章 和平友爱族谱村" (c1) or "第 2 章 和平友爱族谱村2" (c2)
        if (config.prefixFormat === 'chuong') {
          fullHeader = `${headerPrefix}: ${dName}${bracketOrSuffix}`;
        } else {
          fullHeader = `${headerPrefix} ${dName}${bracketOrSuffix}`;
        }
      } else if (style === 'space') {
        // Spaced suffix: e.g. "第 1 章 和平友爱族谱村 1"
        if (config.prefixFormat === 'chuong') {
          fullHeader = `${headerPrefix}: ${dName}${bracketOrSuffix}`;
        } else {
          fullHeader = `${headerPrefix} ${dName}${bracketOrSuffix}`;
        }
      } else {
        // Bracketed styles e.g. "第 1 章 和平友爱族谱村 (1)" or "Chương 1: 和平友爱族谱村 (1)"
        if (config.prefixFormat === 'chuong') {
          fullHeader = `${headerPrefix}: ${dName} ${bracketOrSuffix}`;
        } else {
          fullHeader = `${headerPrefix} ${dName} ${bracketOrSuffix}`;
        }
      }
    } else {
      fullHeader = bracketOrSuffix ? `${headerPrefix} ${bracketOrSuffix}` : headerPrefix;
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
  stripWebMetadata = true,
  stripAuthorNotesEnabled = true
): {
  blocks: BlockWithMetadata[];
  detectedDungeons: DetectedDungeon[];
  strippedCount: number;
} {
  if (!rawText || !rawText.trim()) {
    return { blocks: [], detectedDungeons: [], strippedCount: 0 };
  }

  // If author note stripping is enabled, sanitize raw text first
  let processedText = rawText;
  if (stripAuthorNotesEnabled) {
    processedText = stripAuthorNotes(processedText);
  }

  const customTitleSet = extractCustomTitlesSet(customTitlesToStrip);

  const normalized = processedText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  const blocks: BlockWithMetadata[] = [];
  const detectedDungeons: DetectedDungeon[] = [];
  let currentActiveDungeon: string | undefined = undefined;
  let strippedCount = 0;

  // Regex to strip inline chapter prefixes if a line starts with "第1章 惊变 ... "
  const inlineHeaderRegex =
    /^\s*(?:[0-9]{1,5}\s*[.\s、\t]+)?(?:[=*-]{2,}\s*)?(?:【|\[|\()?\s*(?:正文\s*|VIP\s*|VIP章节\s*)?第\s*[0-9一二三四五六七八九十百千万零两]+\s*[章回节篇集卷部话折]\s*(?:】|\]|\))?(?:\s*[:：\-\—\s][^\n\u3000]{1,35})?\s+(?=[“「『\u4e00-\u9fa5a-zA-Z0-9])/;

  const transitionRegex =
    /(?:现实|日常|过度|过渡|休憩|休息|结算|抽奖|回归|准备|整顿|番外|总结|Interlude|Real\s*World|Hiện\s*thực|Kết\s*toán|Nghỉ\s*ngơi)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let trimmed = line.trim();
    if (!trimmed) continue;

    // 0. Auto-detect dungeon or transition on ANY header or volume line before filtering
    if (autoDetectDungeon) {
      if (transitionRegex.test(trimmed)) {
        currentActiveDungeon = undefined;
      } else {
        const dInfo = extractDungeonFromHeader(trimmed);
        if (dInfo && dInfo.name) {
          currentActiveDungeon = dInfo.name;
          if (!detectedDungeons.some((d) => d.name === dInfo.name)) {
            detectedDungeons.push({
              name: dInfo.name,
              suggestedStartIndex: dInfo.index || 1,
              rawSample: trimmed,
              formatHint: dInfo.formatHint,
            });
          }
        }
      }
    }

    // 1. Check if line is a web metadata line (e.g. "第一卷: 和平友爱族谱村 • 1,932 chữ • 2025-08-02")
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
      continue; // Skip the header itself
    }

    // 4. Check if line starts with an inline chapter header (strip it)
    if (inlineHeaderRegex.test(trimmed)) {
      const match = trimmed.match(inlineHeaderRegex);
      if (match) {
        const headerPart = match[0].trim();
        strippedCount++;
        if (autoDetectDungeon) {
          if (transitionRegex.test(headerPart)) {
            currentActiveDungeon = undefined;
          } else {
            const dInfo = extractDungeonFromHeader(headerPart);
            if (dInfo && dInfo.name) {
              currentActiveDungeon = dInfo.name;
              if (!detectedDungeons.some((d) => d.name === dInfo.name)) {
                detectedDungeons.push({
                  name: dInfo.name,
                  suggestedStartIndex: dInfo.index || 1,
                  rawSample: headerPart,
                  formatHint: dInfo.formatHint,
                });
              }
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
    config.stripWebMetadata,
    config.stripAuthorNotes !== false
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
    (config.dungeonName ? config.dungeonName.trim() : '') ||
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
    const currentSlice = blocks.slice(currentBlockIndex, chosenEndIndex);
    const chapterBlockTexts = currentSlice.map((b) => b.text);

    const formattedParagraphs = config.paragraphIndentation
      ? chapterBlockTexts.map((b) =>
          b.startsWith('　　') || b.startsWith('  ') ? b : `　　${b}`
        )
      : chapterBlockTexts;

    const chapterContent = formattedParagraphs.join('\n\n');
    const chapterChars = countChineseChars(chapterContent);

    // Majority Content Analysis for Infinite Flow:
    // If a split chapter contains mixed content (dungeon vs transition/real-world),
    // calculate character counts for each. Whichever has the majority percentage (> 50%) wins:
    // - If dungeon characters > transition/undefined characters: label with dungeon name.
    // - If transition/undefined characters >= dungeon characters: empty title / no dungeon name.
    let activeDName: string | undefined = undefined;
    let activeDIdx: number | undefined = undefined;

    if (config.enableInfiniteFlow) {
      if (config.dungeonAutoDetect) {
        let dungeonCharCount = 0;
        let undefinedCharCount = 0;
        const dungeonNameCounts = new Map<string, number>();

        for (const block of currentSlice) {
          const bChars = countChineseChars(block.text);
          if (block.dungeonName) {
            dungeonCharCount += bChars;
            dungeonNameCounts.set(
              block.dungeonName,
              (dungeonNameCounts.get(block.dungeonName) || 0) + bChars
            );
          } else {
            undefinedCharCount += bChars;
          }
        }

        if (dungeonCharCount > undefinedCharCount) {
          // Dungeon is majority: pick the dominant dungeon name in this chapter
          let dominantDungeon = currentDungeonName;
          let maxDChars = 0;
          for (const [dName, count] of dungeonNameCounts.entries()) {
            if (count > maxDChars) {
              maxDChars = count;
              dominantDungeon = dName;
            }
          }
          activeDName = dominantDungeon;
          activeDIdx = currentDungeonIndex;
        } else {
          // Transition/real-world is majority: leave title empty (no dungeon name)
          activeDName = undefined;
          activeDIdx = undefined;
        }
      } else {
        // Auto-detect disabled: standard manual dungeon mode
        activeDName = currentDungeonName || undefined;
        activeDIdx = activeDName ? currentDungeonIndex : undefined;
      }
    }

    let finalHeader = '';
    let finalTitle = '';

    if (
      config.useAnalyzedTOC &&
      config.analyzedChapterHeaders &&
      config.analyzedChapterHeaders.length >= currentChapterNum
    ) {
      finalHeader = config.analyzedChapterHeaders[currentChapterNum - 1];
      if (config.includeCharCountInHeader) {
        finalHeader = `${finalHeader} (${chapterChars}字)`;
      }
      finalTitle = finalHeader;
    } else {
      const { header, title } = formatChapterHeader(
        currentChapterNum,
        config,
        chapterChars,
        activeDName,
        activeDIdx
      );
      finalHeader = header;
      finalTitle = title;
    }

    chapters.push({
      id: `cn-chap-${currentChapterNum}`,
      chapterIndex: currentChapterNum,
      header: finalHeader,
      title: finalTitle,
      content: chapterContent,
      charCount: chapterChars,
      paragraphCount: chapterBlockTexts.length,
      dungeonName: activeDName,
      dungeonIndex: activeDIdx,
    });

    currentChapterNum++;
    if (config.enableInfiniteFlow && activeDName) {
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
