import React, { useState, useRef, ChangeEvent, useMemo } from 'react';
import {
  Upload,
  Trash2,
  ClipboardPaste,
  Scissors,
  Layers,
  Compass,
  Search,
  Check,
  ListFilter,
  ChevronDown,
  ChevronUp,
  FileText,
  Bookmark,
} from 'lucide-react';
import {
  countChineseChars,
  scanDungeonsFromRaw,
  formatDungeonBracket,
  formatChapterHeader,
  extractCustomTitlesSet,
} from '../utils/chineseSplitter';
import { SplitChineseConfig, ChapterPrefixType, DungeonBracketStyle } from '../types';
import { VHLTOCAnalyzerModal } from './VHLTOCAnalyzerModal';

interface ChineseInputPanelProps {
  rawText: string;
  onChangeRawText: (text: string) => void;
  config: SplitChineseConfig;
  onChangeConfig: (newConfig: SplitChineseConfig) => void;
  onProcessSplit: () => void;
  onClear: () => void;
  onOpenFanqieDownloader?: () => void;
  onOpenDanmeiLeaderboard?: () => void;
}

export const ChineseInputPanel: React.FC<ChineseInputPanelProps> = ({
  rawText,
  onChangeRawText,
  config,
  onChangeConfig,
  onProcessSplit,
  onClear,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [showTitleFilter, setShowTitleFilter] = useState(Boolean(config.customTitlesToStrip));
  const [isTOCModalOpen, setIsTOCModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalChars = countChineseChars(rawText);

  // Scan detected dungeons from current raw text
  const detectedDungeons = useMemo(() => {
    if (!rawText.trim()) return [];
    return scanDungeonsFromRaw(rawText);
  }, [rawText]);

  // Count detected custom titles in filter list
  const customTitleCount = useMemo(() => {
    if (!config.customTitlesToStrip) return 0;
    return extractCustomTitlesSet(config.customTitlesToStrip).size;
  }, [config.customTitlesToStrip]);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Automatically set novel title from uploaded filename
    const cleanFileName = file.name.replace(/\.[^/.]+$/, '').trim();
    if (cleanFileName) {
      onChangeConfig({
        ...config,
        novelTitle: cleanFileName,
      });
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      onChangeRawText(text);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      const cleanFileName = file.name.replace(/\.[^/.]+$/, '').trim();
      if (cleanFileName) {
        onChangeConfig({
          ...config,
          novelTitle: cleanFileName,
        });
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = (event.target?.result as string) || '';
        onChangeRawText(text);
      };
      reader.readAsText(file, 'UTF-8');
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onChangeRawText(text);
      }
    } catch {
      // Ignore
    }
  };

  // Preview header format
  const previewSampleHeader = useMemo(() => {
    let p = '第 1 章';
    if (config.prefixFormat === 'chuong') p = 'Chương 1:';
    if (config.prefixFormat === 'di-hui') p = '第 1 回';
    if (config.prefixFormat === 'custom') p = (config.customPrefix || '第 {n} 章').replace('{n}', '1');

    if (!config.enableInfiniteFlow) return `${p} ...`;

    const dName = config.dungeonName.trim() || (detectedDungeons[0]?.name || '和平友爱族谱村');
    const startIdx = config.dungeonStartIndex || 1;
    const h1 = formatChapterHeader(1, config, 1500, dName, startIdx);
    const h2 = formatChapterHeader(2, config, 1500, dName, startIdx + 1);

    return `${h1.header}  ➔  ${h2.header}`;
  }, [config, detectedDungeons]);

  return (
    <div className="bg-white/90 border border-pink-200/70 rounded-3xl p-4 sm:p-5 shadow-sm shadow-pink-100/50 backdrop-blur-sm space-y-3.5">
      {/* Top action bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center space-x-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.raw"
            onChange={handleFileUpload}
            className="hidden"
            id="file-upload-input"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-pink-50 hover:bg-pink-100 text-pink-700 text-xs font-medium border border-pink-200/80 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Tải file .txt</span>
          </button>

          <button
            type="button"
            onClick={handlePasteClipboard}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-pink-50/50 hover:bg-pink-100/70 text-pink-800 text-xs font-medium border border-pink-200/70 transition-colors cursor-pointer"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>Dán</span>
          </button>
        </div>

        {rawText && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-full text-rose-500 hover:bg-rose-50 text-xs font-medium transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa</span>
          </button>
        )}
      </div>

      {/* Input textarea */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`relative rounded-2xl border transition-all ${
          dragActive
            ? 'border-pink-300 ring-4 ring-pink-100 bg-pink-50/50'
            : 'border-pink-200/80 bg-pink-50/30'
        }`}
      >
        <textarea
          value={rawText}
          onChange={(e) => onChangeRawText(e.target.value)}
          placeholder="Dán nội dung raw tiếng Trung vào đây..."
          rows={6}
          className="w-full bg-transparent p-3.5 text-xs sm:text-sm text-pink-950 placeholder-pink-300 focus:outline-none focus:ring-0 leading-relaxed resize-y"
        />

        <div className="absolute right-3 bottom-3 text-[11px] font-semibold bg-white/95 px-2.5 py-0.5 rounded-full border border-pink-200/80 text-pink-700 shadow-2xs">
          {totalChars.toLocaleString()} chữ
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-0.5 text-xs">
        <div>
          <label className="block text-[11px] text-pink-700 font-medium mb-1">Tên truyện / Folder:</label>
          <input
            type="text"
            value={config.novelTitle || ''}
            onChange={(e) =>
              onChangeConfig({
                ...config,
                novelTitle: e.target.value,
              })
            }
            placeholder="Truyen_Raw"
            className="w-full bg-pink-50/40 border border-pink-200 rounded-xl px-2.5 py-1.5 text-pink-950 font-semibold focus:outline-none focus:border-pink-400 text-xs"
          />
        </div>

        <div>
          <label className="block text-[11px] text-pink-700 font-medium mb-1">Mỗi chương:</label>
          <div className="flex items-center space-x-1">
            <input
              type="number"
              min={500}
              max={5000}
              step={100}
              value={config.targetCharsPerChapter}
              onChange={(e) =>
                onChangeConfig({
                  ...config,
                  targetCharsPerChapter: parseInt(e.target.value, 10) || 1500,
                })
              }
              className="w-full bg-pink-50/40 border border-pink-200 rounded-xl px-2.5 py-1.5 text-pink-900 font-bold focus:outline-none focus:border-pink-400"
            />
            <span className="text-[11px] text-pink-600">chữ</span>
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-pink-700 font-medium mb-1">Đánh số:</label>
          <select
            value={config.prefixFormat}
            onChange={(e) =>
              onChangeConfig({
                ...config,
                prefixFormat: e.target.value as ChapterPrefixType,
              })
            }
            className="w-full bg-pink-50/40 border border-pink-200 rounded-xl px-2.5 py-1.5 text-pink-900 text-xs focus:outline-none focus:border-pink-400 font-medium cursor-pointer"
          >
            <option value="di-zhang">第 1 章</option>
            <option value="chuong">Chương 1</option>
            <option value="di-hui">第 1 回</option>
          </select>
        </div>
      </div>

      {/* Quick Cleaning Options Row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-xs">
        <label className="flex items-center space-x-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={config.autoStripExistingHeaders}
            onChange={(e) =>
              onChangeConfig({
                ...config,
                autoStripExistingHeaders: e.target.checked,
              })
            }
            className="w-4 h-4 rounded text-pink-500 focus:ring-pink-300 border-pink-300 accent-pink-400 cursor-pointer"
          />
          <span className="text-pink-900 font-medium">Xóa số chương cũ</span>
        </label>

        <label className="flex items-center space-x-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={config.dialogueSafe}
            onChange={(e) =>
              onChangeConfig({
                ...config,
                dialogueSafe: e.target.checked,
              })
            }
            className="w-4 h-4 rounded text-pink-500 focus:ring-pink-300 border-pink-300 accent-pink-400 cursor-pointer"
          />
          <span className="text-pink-900 font-medium">Bảo vệ câu thoại</span>
        </label>

        <label className="flex items-center space-x-2 cursor-pointer select-none bg-pink-100/60 hover:bg-pink-100 px-2.5 py-1 rounded-xl border border-pink-200/80 transition-colors">
          <input
            type="checkbox"
            checked={config.stripAuthorNotes ?? true}
            onChange={(e) =>
              onChangeConfig({
                ...config,
                stripAuthorNotes: e.target.checked,
              })
            }
            className="w-4 h-4 rounded text-pink-500 focus:ring-pink-300 border-pink-300 accent-pink-400 cursor-pointer"
          />
          <span className="text-pink-950 font-bold">Bỏ lời tác giả (作话 / 题外话)</span>
        </label>
      </div>

      {/* FILTER UNNUMBERED TITLES & WEB METADATA SECTION */}
      <div className="bg-pink-50/50 border border-pink-200/70 rounded-2xl p-3 sm:p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowTitleFilter(!showTitleFilter)}
            className="flex items-center space-x-2 text-left cursor-pointer select-none text-pink-900 hover:text-pink-950 font-bold text-xs"
          >
            <ListFilter className="w-3.5 h-3.5 text-pink-500" />
            <span>Lọc bỏ tiêu đề gốc không có số chương / Dán mục lục</span>
            {customTitleCount > 0 && (
              <span className="bg-pink-200/80 text-pink-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {customTitleCount} tiêu đề
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowTitleFilter(!showTitleFilter)}
            className="p-1 text-pink-500 hover:text-pink-800 rounded-lg transition-colors cursor-pointer"
          >
            {showTitleFilter ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showTitleFilter && (
          <div className="pt-2 border-t border-pink-200/50 space-y-2.5 animate-in fade-in duration-150">
            <p className="text-[11px] text-pink-700 leading-relaxed">
              Dán danh sách tiêu đề gốc (hoặc copy nguyên mục lục từ trang truyện) vào đây. Tool sẽ tự động tìm và xóa sạch các dòng tiêu đề này khỏi nội dung raw để truyện không bị lẫn tiêu đề cũ.
            </p>

            <textarea
              value={config.customTitlesToStrip}
              onChange={(e) =>
                onChangeConfig({
                  ...config,
                  customTitlesToStrip: e.target.value,
                })
              }
              placeholder={`VD dán danh sách tiêu đề:\n请问有吃的吗\n我老公和我老婆怎么坐一块儿去了？\n好像动了。\n人间有真情\n找到你了，小漂亮`}
              rows={4}
              className="w-full bg-white border border-pink-200 rounded-xl p-2.5 text-xs text-pink-950 placeholder-pink-300 focus:outline-none focus:border-pink-400 leading-relaxed font-sans"
            />

            <div className="flex items-center justify-between flex-wrap gap-2 text-[11px]">
              <label className="flex items-center space-x-2 cursor-pointer text-pink-800 font-medium">
                <input
                  type="checkbox"
                  checked={config.stripWebMetadata}
                  onChange={(e) =>
                    onChangeConfig({
                      ...config,
                      stripWebMetadata: e.target.checked,
                    })
                  }
                  className="w-3.5 h-3.5 rounded text-pink-500 focus:ring-pink-300 border-pink-300 accent-pink-400 cursor-pointer"
                />
                <span>Tự động lọc dòng thông tin web (ví dụ: 第一卷: 默认, 3,347 chữ, ngày tháng...)</span>
              </label>

              {config.customTitlesToStrip && (
                <button
                  type="button"
                  onClick={() =>
                    onChangeConfig({
                      ...config,
                      customTitlesToStrip: '',
                    })
                  }
                  className="text-pink-600 hover:text-pink-900 underline font-medium cursor-pointer"
                >
                  Xóa bộ lọc tiêu đề
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* INFINITE FLOW (VÔ HẠN LƯU) SPECIAL SECTION */}
      <div className="bg-pink-50/50 border border-pink-200/70 rounded-2xl p-3 sm:p-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center space-x-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={config.enableInfiniteFlow}
              onChange={(e) =>
                onChangeConfig({
                  ...config,
                  enableInfiniteFlow: e.target.checked,
                })
              }
              className="w-4 h-4 rounded text-pink-500 focus:ring-pink-300 border-pink-300 accent-pink-400 cursor-pointer"
            />
            <span className="font-bold text-xs text-pink-900 flex items-center space-x-1.5">
              <Compass className="w-3.5 h-3.5 text-pink-500" />
              <span>Chế độ Vô Hạn Lưu (Đánh số theo Phó bản)</span>
            </span>
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsTOCModalOpen(true)}
              className="px-3 py-1.5 bg-pink-100 hover:bg-pink-200/80 text-pink-800 border border-pink-300/70 rounded-xl text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer transform active:scale-95"
            >
              <Bookmark className="w-3.5 h-3.5 text-pink-600" />
              <span>Phân tích mục lục VHL</span>
            </button>

            {config.enableInfiniteFlow && (
              <span className="text-[11px] font-medium text-pink-700 bg-pink-100/70 px-2.5 py-0.5 rounded-full border border-pink-200/80">
                {previewSampleHeader}
              </span>
            )}
          </div>
        </div>

        {/* Status banner when TOC has been analyzed and applied */}
        {config.enableInfiniteFlow && config.useAnalyzedTOC && (config.analyzedChapterHeaders?.length ?? 0) > 0 && (
          <div className="bg-pink-100/50 border border-pink-200/80 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 font-bold shrink-0" />
              <div>
                <span className="font-bold text-pink-950">
                  Đang kích hoạt danh sách tiêu đề mục lục ({config.analyzedChapterHeaders?.length} chương)
                </span>
                <span className="text-[11px] text-pink-700 ml-1.5 font-medium">
                  • Chương quá độ: {config.vhlTransitionMode === 'empty-title' || config.vhlTransitionMode === 'pure-number' ? 'Để trống tên chương (chỉ số chương)' : config.vhlTransitionMode === 'custom-label' ? `Gán nhãn "${config.vhlTransitionCustomLabel}"` : 'Giữ tên gốc tác giả'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsTOCModalOpen(true)}
                className="text-pink-600 hover:text-pink-800 font-bold underline text-xs cursor-pointer"
              >
                Chỉnh sửa
              </button>
              <button
                type="button"
                onClick={() =>
                  onChangeConfig({
                    ...config,
                    useAnalyzedTOC: false,
                    analyzedChapterHeaders: [],
                  })
                }
                className="text-gray-400 hover:text-red-500 text-xs cursor-pointer ml-1"
                title="Hủy áp dụng mục lục"
              >
                Gỡ bỏ
              </button>
            </div>
          </div>
        )}

        {config.enableInfiniteFlow && (
          <div className="pt-2 border-t border-pink-200/50 space-y-3 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              {/* Dungeon Name input */}
              <div>
                <label className="block text-[11px] text-pink-800 font-medium mb-1">
                  Tên phó bản:
                </label>
                <input
                  type="text"
                  value={config.dungeonName}
                  onChange={(e) =>
                    onChangeConfig({
                      ...config,
                      dungeonName: e.target.value,
                    })
                  }
                  placeholder="VD: 恐怖游乐园 hoặc Bệnh Viện Ma"
                  className="w-full bg-white border border-pink-200 rounded-xl px-2.5 py-1.5 text-pink-950 font-medium focus:outline-none focus:border-pink-400"
                />
              </div>

              {/* Start index (1, 2, 3...) */}
              <div>
                <label className="block text-[11px] text-pink-800 font-medium mb-1">
                  Bắt đầu từ phần:
                </label>
                <div className="flex items-center space-x-1">
                  <span className="text-pink-600 text-xs">Phần</span>
                  <input
                    type="number"
                    min={1}
                    value={config.dungeonStartIndex}
                    onChange={(e) =>
                      onChangeConfig({
                        ...config,
                        dungeonStartIndex: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-20 bg-white border border-pink-200 rounded-xl px-2.5 py-1.5 text-pink-900 font-bold text-center focus:outline-none focus:border-pink-400"
                  />
                  <span className="text-pink-600 text-xs">(nối tiếp (1), (2)...)</span>
                </div>
              </div>

              {/* Bracket Style */}
              <div>
                <label className="block text-[11px] text-pink-800 font-medium mb-1">
                  Định dạng tên / số phần phó bản:
                </label>
                <select
                  value={config.dungeonBracketStyle}
                  onChange={(e) =>
                    onChangeConfig({
                      ...config,
                      dungeonBracketStyle: e.target.value as DungeonBracketStyle,
                    })
                  }
                  className="w-full bg-white border border-pink-200 rounded-xl px-2.5 py-1.5 text-pink-900 text-xs focus:outline-none focus:border-pink-400 font-medium cursor-pointer"
                >
                  <option value="suffix-omit-first">
                    PhóBản, PhóBản2, PhóBản3... (C1 không số, từ C2 dính liền số - Như trong ảnh)
                  </option>
                  <option value="suffix">
                    PhóBản1, PhóBản2, PhóBản3... (Dính liền số không ngoặc)
                  </option>
                  <option value="space">
                    PhóBản 1, PhóBản 2, PhóBản 3... (Cách 1 khoảng trắng)
                  </option>
                  <option value="half">
                    PhóBản (1), PhóBản (2)... (Ngoặc đơn nửa góc)
                  </option>
                  <option value="full">
                    PhóBản（1）, PhóBản（2）... (Ngoặc đơn tiếng Trung)
                  </option>
                  <option value="bracket">
                    PhóBản【1】, PhóBản【2】... (Ngoặc vuông đậm)
                  </option>
                  <option value="dash">
                    PhóBản - 1, PhóBản - 2... (Dấu gạch nối)
                  </option>
                  <option value="chinese-bracket">
                    PhóBản（一）, PhóBản（二）... (Ngoặc chữ Hán)
                  </option>
                  <option value="chinese-suffix">
                    PhóBản一, PhóBản二... (Chữ Hán dính liền)
                  </option>
                </select>
              </div>
            </div>

            {/* Auto-detected dungeons from raw */}
            {detectedDungeons.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[11px] text-pink-700 font-medium shrink-0 flex items-center space-x-1">
                  <Search className="w-3 h-3" />
                  <span>Phó bản tìm thấy trong raw:</span>
                </span>
                {detectedDungeons.map((d, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() =>
                      onChangeConfig({
                        ...config,
                        dungeonName: d.name,
                        dungeonStartIndex: d.suggestedStartIndex || 1,
                        dungeonBracketStyle: d.formatHint || config.dungeonBracketStyle,
                      })
                    }
                    title={`Chọn "${d.name}" (Bắt đầu từ ${d.suggestedStartIndex})`}
                    className="px-2.5 py-0.5 rounded-full text-[11px] bg-white border border-pink-300/80 hover:bg-pink-100 text-pink-800 font-semibold cursor-pointer shadow-2xs transition-colors"
                  >
                    + {d.name} ({d.suggestedStartIndex})
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Split action button */}
      <button
        id="btn-split-chinese-raw"
        onClick={onProcessSplit}
        disabled={!rawText.trim()}
        className="w-full flex items-center justify-center space-x-2 py-3 rounded-2xl bg-pink-400 hover:bg-pink-500 text-white font-bold text-xs sm:text-sm transition-all shadow-sm shadow-pink-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99]"
      >
        <Scissors className="w-4 h-4" />
        <span>Chia & Đánh số chương</span>
      </button>

      {/* VHL TOC Analyzer Modal */}
      <VHLTOCAnalyzerModal
        isOpen={isTOCModalOpen}
        onClose={() => setIsTOCModalOpen(false)}
        config={config}
        onApplyConfig={(updated) => onChangeConfig({ ...config, ...updated })}
      />
    </div>
  );
};
