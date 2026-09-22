import React, { useState, useMemo } from 'react';
import {
  Download,
  Archive,
  Copy,
  Check,
  Search,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
  SlidersHorizontal,
  X,
  Edit2,
  FileDown,
} from 'lucide-react';
import { ChineseSplitResult, SplitChineseConfig, ProcessedChineseChapter } from '../types';
import {
  downloadChineseNovelAsTxt,
  downloadChineseChaptersAsZip,
  downloadChapterRangeAsTxt,
  downloadBatchedChaptersAsZip,
  generateFullChineseNovelText,
  downloadTextFile,
} from '../utils/fileExport';

interface ChineseChapterListProps {
  splitResult: ChineseSplitResult;
  config: SplitChineseConfig;
  onUpdateChapterHeader: (chapterId: string, newHeader: string) => void;
  onBulkUpdateDungeon?: (
    startNum: number,
    endNum: number,
    dungeonName: string,
    dungeonStartIndex: number
  ) => void;
}

export const ChineseChapterList: React.FC<ChineseChapterListProps> = ({
  splitResult,
  config,
  onUpdateChapterHeader,
  onBulkUpdateDungeon,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [isBatchZipping, setIsBatchZipping] = useState(false);

  // Range Download Tab / Toggle
  const [showRangePanel, setShowRangePanel] = useState(true);
  const [batchSize, setBatchSize] = useState<number>(10);
  const [customRangeStart, setCustomRangeStart] = useState<number>(1);
  const [customRangeEnd, setCustomRangeEnd] = useState<number>(10);

  // Bulk Dungeon Renaming state
  const [showDungeonPanel, setShowDungeonPanel] = useState(false);
  const [bulkDungeonStart, setBulkDungeonStart] = useState<number>(1);
  const [bulkDungeonEnd, setBulkDungeonEnd] = useState<number>(10);
  const [bulkDungeonName, setBulkDungeonName] = useState<string>(config.dungeonName || '');
  const [bulkDungeonStartIndex, setBulkDungeonStartIndex] = useState<number>(1);
  const [dungeonAppliedMsg, setDungeonAppliedMsg] = useState(false);

  // Edit header modal
  const [editingChapter, setEditingChapter] = useState<ProcessedChineseChapter | null>(null);
  const [editHeaderVal, setEditHeaderVal] = useState('');

  const { chapters, totalChapters, totalChars, averageCharsPerChapter } = splitResult;

  const minChapNum = chapters.length > 0 ? chapters[0].chapterIndex : 1;
  const maxChapNum = chapters.length > 0 ? chapters[chapters.length - 1].chapterIndex : 1;

  // Compute automatic batches (e.g. 1-10, 11-20, etc.)
  const computedBatches = useMemo(() => {
    if (chapters.length === 0 || batchSize <= 0) return [];
    const batches: {
      id: string;
      startNum: number;
      endNum: number;
      count: number;
      chars: number;
      chapters: ProcessedChineseChapter[];
    }[] = [];

    for (let i = 0; i < chapters.length; i += batchSize) {
      const slice = chapters.slice(i, i + batchSize);
      const startNum = slice[0].chapterIndex;
      const endNum = slice[slice.length - 1].chapterIndex;
      const chars = slice.reduce((sum, c) => sum + c.charCount, 0);

      batches.push({
        id: `batch-${startNum}-${endNum}`,
        startNum,
        endNum,
        count: slice.length,
        chars,
        chapters: slice,
      });
    }
    return batches;
  }, [chapters, batchSize]);

  const filteredChapters = chapters.filter(
    (c) =>
      c.header.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCopyChapter = (chapter: ProcessedChineseChapter) => {
    const fullText = `${chapter.header}\n\n${chapter.content}`;
    navigator.clipboard.writeText(fullText);
    setCopiedId(chapter.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    const fullNovel = generateFullChineseNovelText(chapters);
    navigator.clipboard.writeText(fullNovel);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleDownloadSingleRange = (start: number, end: number) => {
    downloadChapterRangeAsTxt(chapters, start, end, `${start}-${end}.txt`);
  };

  const handleDownloadCustomRange = () => {
    const start = Math.max(minChapNum, customRangeStart || minChapNum);
    const end = Math.min(maxChapNum, customRangeEnd || maxChapNum);
    if (start > end) return;
    downloadChapterRangeAsTxt(chapters, start, end, `${start}-${end}.txt`);
  };

  const handleDownloadAllBatchesZip = async () => {
    setIsBatchZipping(true);
    try {
      await downloadBatchedChaptersAsZip(
        chapters,
        batchSize,
        config.novelTitle || 'Truyen_Raw'
      );
    } catch (err) {
      console.error(err);
    } finally {
      setIsBatchZipping(false);
    }
  };

  const handleDownloadFullZip = async () => {
    setIsZipping(true);
    try {
      await downloadChineseChaptersAsZip(
        chapters,
        config.novelTitle || 'Truyen_Raw'
      );
    } catch (err) {
      console.error(err);
    } finally {
      setIsZipping(false);
    }
  };

  const openEditModal = (chapter: ProcessedChineseChapter, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChapter(chapter);
    setEditHeaderVal(chapter.header);
  };

  const saveEditedHeader = () => {
    if (editingChapter && editHeaderVal.trim()) {
      onUpdateChapterHeader(editingChapter.id, editHeaderVal.trim());
      setEditingChapter(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Main Summary & Quick Full Download Card */}
      <div className="bg-white/90 border border-pink-200/70 rounded-3xl p-4 sm:p-5 shadow-sm shadow-pink-100/50 backdrop-blur-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-pink-100/80">
          <div className="flex items-center space-x-2 text-xs">
            <span className="font-bold text-pink-900 text-sm">{totalChapters} chương</span>
            <span className="text-pink-300">•</span>
            <span className="text-pink-700/80">{totalChars.toLocaleString()} chữ</span>
            <span className="text-pink-300">•</span>
            <span className="bg-pink-100/70 text-pink-800 px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-pink-200/60">
              TB ~{averageCharsPerChapter} chữ/chương
            </span>
          </div>

          {/* Quick full download actions */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={handleCopyAll}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-pink-50/80 hover:bg-pink-100/80 text-pink-700 border border-pink-200/70 transition-all cursor-pointer"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAll ? 'Đã sao chép' : 'Sao chép hết'}</span>
            </button>

            <button
              onClick={handleDownloadFullZip}
              disabled={isZipping}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-pink-50/80 hover:bg-pink-100/80 text-pink-700 border border-pink-200/70 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Archive className="w-3.5 h-3.5 text-pink-500" />
              <span>{isZipping ? 'Đang nén...' : 'Tải .ZIP (Từng chương)'}</span>
            </button>

            <button
              onClick={() =>
                downloadChineseNovelAsTxt(
                  chapters,
                  `${config.novelTitle || 'truyen_da_chia'}.txt`
                )
              }
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-pink-400 hover:bg-pink-500 text-white shadow-xs shadow-pink-200 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải cả bộ (.TXT)</span>
            </button>
          </div>
        </div>

        {/* 2. SECTION: Tải file theo khoảng chương (Range Download) */}
        <div className="bg-pink-50/40 border border-pink-200/60 rounded-2xl p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-pink-500" />
              <h3 className="text-xs font-bold text-pink-900 uppercase tracking-wider">
                Tải file .txt theo khoảng chương
              </h3>
            </div>
            <button
              onClick={() => setShowRangePanel(!showRangePanel)}
              className="text-xs text-pink-600 hover:text-pink-800 flex items-center space-x-1 cursor-pointer"
            >
              <span>{showRangePanel ? 'Thu gọn' : 'Mở rộng'}</span>
              {showRangePanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {showRangePanel && (
            <div className="space-y-3.5 pt-1">
              {/* Option A: Tự động chia X chương 1 file */}
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="text-pink-800 font-medium">Tự động chia:</span>
                    <div className="flex items-center space-x-1 bg-white/80 p-0.5 rounded-xl border border-pink-200">
                      {[5, 10, 20, 50, 100].map((num) => (
                        <button
                          key={num}
                          onClick={() => setBatchSize(num)}
                          className={`px-2.5 py-0.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                            batchSize === num
                              ? 'bg-pink-400 text-white shadow-xs'
                              : 'text-pink-700 hover:bg-pink-100/60'
                          }`}
                        >
                          {num} ch/file
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleDownloadAllBatchesZip}
                    disabled={isBatchZipping}
                    className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-pink-100 hover:bg-pink-200/70 text-pink-800 font-semibold border border-pink-200/80 transition-all cursor-pointer disabled:opacity-50 shrink-0 self-start sm:self-auto"
                  >
                    <Archive className="w-3.5 h-3.5 text-pink-600" />
                    <span>{isBatchZipping ? 'Đang nén...' : `Tải tất cả ${computedBatches.length} file (.ZIP)`}</span>
                  </button>
                </div>

                {/* Batch list cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                  {computedBatches.map((batch) => (
                    <div
                      key={batch.id}
                      className="flex items-center justify-between p-2.5 bg-white/95 rounded-xl border border-pink-200/70 hover:border-pink-300 transition-all group shadow-2xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-xs text-pink-900 truncate">
                          Chương {batch.startNum} - {batch.endNum}
                        </div>
                        <div className="text-[11px] text-pink-600/80 font-mono">
                          {batch.startNum}-{batch.endNum}.txt • {batch.count} ch
                        </div>
                      </div>

                      <button
                        onClick={() => handleDownloadSingleRange(batch.startNum, batch.endNum)}
                        title={`Tải file ${batch.startNum}-${batch.endNum}.txt`}
                        className="p-1.5 bg-pink-50 hover:bg-pink-400 text-pink-600 hover:text-white rounded-lg border border-pink-200/80 transition-colors cursor-pointer shrink-0"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Option B: Tải theo khoảng tự nhập tùy chỉnh */}
              <div className="pt-2 border-t border-pink-200/50 flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
                <span className="text-pink-800 font-medium shrink-0">Hoặc chọn khoảng tự do:</span>
                <div className="flex items-center space-x-1.5 flex-wrap gap-y-1.5">
                  <span className="text-pink-600">Từ chương</span>
                  <input
                    type="number"
                    min={minChapNum}
                    max={maxChapNum}
                    value={customRangeStart}
                    onChange={(e) => setCustomRangeStart(parseInt(e.target.value, 10) || minChapNum)}
                    className="w-16 bg-white border border-pink-200 rounded-lg px-2 py-1 text-center font-bold text-pink-900 focus:outline-none focus:border-pink-400"
                  />
                  <span className="text-pink-600">đến</span>
                  <input
                    type="number"
                    min={minChapNum}
                    max={maxChapNum}
                    value={customRangeEnd}
                    onChange={(e) => setCustomRangeEnd(parseInt(e.target.value, 10) || maxChapNum)}
                    className="w-16 bg-white border border-pink-200 rounded-lg px-2 py-1 text-center font-bold text-pink-900 focus:outline-none focus:border-pink-400"
                  />

                  <button
                    onClick={handleDownloadCustomRange}
                    className="flex items-center space-x-1 px-3 py-1 bg-pink-400 hover:bg-pink-500 text-white rounded-lg font-medium shadow-2xs transition-colors cursor-pointer ml-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải khoảng này (.TXT)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. SECTION: Đổi tên Phó Bản Vô Hạn Lưu cho khoảng chương */}
        <div className="bg-pink-50/40 border border-pink-200/60 rounded-2xl p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-pink-500" />
              <h3 className="text-xs font-bold text-pink-900 uppercase tracking-wider">
                Đổi / Gán tên Phó Bản cho khoảng chương
              </h3>
            </div>
            <button
              onClick={() => setShowDungeonPanel(!showDungeonPanel)}
              className="text-xs text-pink-600 hover:text-pink-800 flex items-center space-x-1 cursor-pointer font-medium"
            >
              <span>{showDungeonPanel ? 'Thu gọn' : 'Mở công cụ'}</span>
              {showDungeonPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {showDungeonPanel && (
            <div className="space-y-2.5 pt-1 text-xs">
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-pink-700 font-medium">Khoảng chương:</span>
                <input
                  type="number"
                  min={minChapNum}
                  max={maxChapNum}
                  value={bulkDungeonStart}
                  onChange={(e) => setBulkDungeonStart(parseInt(e.target.value, 10) || minChapNum)}
                  className="w-14 bg-white border border-pink-200 rounded-lg px-2 py-1 text-center font-bold text-pink-900 focus:outline-none focus:border-pink-400"
                />
                <span className="text-pink-500">➔</span>
                <input
                  type="number"
                  min={minChapNum}
                  max={maxChapNum}
                  value={bulkDungeonEnd}
                  onChange={(e) => setBulkDungeonEnd(parseInt(e.target.value, 10) || maxChapNum)}
                  className="w-14 bg-white border border-pink-200 rounded-lg px-2 py-1 text-center font-bold text-pink-900 focus:outline-none focus:border-pink-400"
                />

                <span className="text-pink-700 font-medium ml-1">Tên phó bản:</span>
                <input
                  type="text"
                  value={bulkDungeonName}
                  onChange={(e) => setBulkDungeonName(e.target.value)}
                  placeholder="VD: 恐怖游乐园"
                  className="w-36 sm:w-48 bg-white border border-pink-200 rounded-lg px-2.5 py-1 text-pink-950 font-medium focus:outline-none focus:border-pink-400"
                />

                <span className="text-pink-700 font-medium">Bắt đầu từ (1):</span>
                <input
                  type="number"
                  min={1}
                  value={bulkDungeonStartIndex}
                  onChange={(e) => setBulkDungeonStartIndex(parseInt(e.target.value, 10) || 1)}
                  className="w-14 bg-white border border-pink-200 rounded-lg px-2 py-1 text-center font-bold text-pink-900 focus:outline-none focus:border-pink-400"
                />

                <button
                  type="button"
                  onClick={() => {
                    if (onBulkUpdateDungeon && bulkDungeonName.trim()) {
                      onBulkUpdateDungeon(
                        bulkDungeonStart,
                        bulkDungeonEnd,
                        bulkDungeonName.trim(),
                        bulkDungeonStartIndex
                      );
                      setDungeonAppliedMsg(true);
                      setTimeout(() => setDungeonAppliedMsg(false), 2500);
                    }
                  }}
                  disabled={!bulkDungeonName.trim()}
                  className="flex items-center space-x-1.5 px-3 py-1 bg-pink-400 hover:bg-pink-500 disabled:opacity-40 text-white rounded-lg font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Áp dụng (1), (2), (3)...</span>
                </button>
              </div>

              {dungeonAppliedMsg && (
                <div className="text-[11px] text-emerald-700 font-medium animate-in fade-in">
                  ✓ Đã cập nhật tên phó bản và đánh số nối tiếp từ chương {bulkDungeonStart} đến {bulkDungeonEnd}!
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. Search and Individual Chapters Viewer */}
      <div className="bg-white/90 border border-pink-200/70 rounded-3xl p-4 sm:p-5 shadow-sm shadow-pink-100/50 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-pink-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm theo tiêu đề hoặc nội dung..."
            className="w-full bg-pink-50/30 border border-pink-200/80 rounded-2xl pl-9 pr-4 py-2 text-xs text-pink-950 placeholder-pink-300 focus:outline-none focus:border-pink-400"
          />
        </div>

        {/* Chapters Cards */}
        <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
          {filteredChapters.map((chapter) => {
            const isExpanded = expandedId === chapter.id;
            const isCopied = copiedId === chapter.id;

            return (
              <div
                key={chapter.id}
                className={`rounded-2xl border transition-all ${
                  isExpanded
                    ? 'border-pink-300 bg-pink-50/40 shadow-xs'
                    : 'border-pink-100 bg-white hover:border-pink-200'
                }`}
              >
                {/* Header item */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : chapter.id)}
                  className="p-3 flex items-center justify-between cursor-pointer gap-2 select-none"
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-pink-100 text-pink-700 text-xs font-bold flex items-center justify-center shrink-0">
                      {chapter.chapterIndex}
                    </span>
                    <span className="font-semibold text-xs sm:text-sm text-pink-950 truncate">
                      {chapter.header}
                    </span>
                    <span className="text-[11px] text-pink-600/80 bg-pink-50 px-2 py-0.5 rounded-full shrink-0 font-medium border border-pink-100">
                      {chapter.charCount} chữ
                    </span>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => openEditModal(chapter, e)}
                      title="Sửa tiêu đề"
                      className="p-1.5 text-pink-400 hover:text-pink-700 hover:bg-pink-100/60 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyChapter(chapter);
                      }}
                      title="Sao chép chương này"
                      className="p-1.5 text-pink-400 hover:text-pink-700 hover:bg-pink-100/60 rounded-lg transition-colors cursor-pointer"
                    >
                      {isCopied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadChapterRangeAsTxt(
                          chapters,
                          chapter.chapterIndex,
                          chapter.chapterIndex,
                          `${chapter.header}.txt`
                        );
                      }}
                      title="Tải chương này dạng .txt"
                      className="p-1.5 text-pink-400 hover:text-pink-700 hover:bg-pink-100/60 rounded-lg transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <div className="text-pink-400 p-1">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded text content */}
                {isExpanded && (
                  <div className="p-3.5 pt-0 border-t border-pink-100/80 mt-1">
                    <div className="p-3.5 bg-white rounded-xl text-xs text-slate-700 leading-relaxed max-h-72 overflow-y-auto whitespace-pre-wrap font-sans border border-pink-100">
                      {chapter.content}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Header Modal */}
      {editingChapter && (
        <div className="fixed inset-0 z-50 bg-pink-950/20 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-pink-200 rounded-3xl max-w-sm w-full p-4.5 shadow-xl space-y-3.5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-pink-900">Sửa tiêu đề chương</h3>
              <button
                onClick={() => setEditingChapter(null)}
                className="text-pink-400 hover:text-pink-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              value={editHeaderVal}
              onChange={(e) => setEditHeaderVal(e.target.value)}
              className="w-full bg-pink-50/40 border border-pink-200 rounded-xl px-3 py-2 text-xs text-pink-950 focus:outline-none focus:border-pink-400 font-medium"
              placeholder="Nhập tiêu đề chương mới..."
              autoFocus
            />

            <div className="flex justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setEditingChapter(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs text-pink-700 hover:bg-pink-50 cursor-pointer font-medium"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={saveEditedHeader}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-pink-400 hover:bg-pink-500 text-white cursor-pointer shadow-xs"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
