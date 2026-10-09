import React, { useState } from 'react';
import {
  X,
  Layers,
  Compass,
  Coffee,
  CheckCircle2,
  Copy,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  BookOpen,
  Bookmark,
  Search,
} from 'lucide-react';
import { SplitChineseConfig, TOCAnalysisResult } from '../types';
import { analyzeVHLTableOfContents } from '../utils/chineseSplitter';

interface VHLTOCAnalyzerModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SplitChineseConfig;
  onApplyConfig: (updatedConfig: Partial<SplitChineseConfig>) => void;
}

const SAMPLE_VHL_TOC = `1 第1章 和平友爱族谱村
第一卷: 和平友爱族谱村 • 1,932 chữ • 2025-08-02
2 第2章 和平友爱族谱村2
第一卷: 和平友爱族谱村 • 2,223 chữ • 2025-08-03
3 第3章 和平友爱族谱村3
第一卷: 和平友爱族谱村 • 2,090 chữ • 2025-08-03
4 第4章 和平友爱族谱村4
第一卷: 和平友爱族谱村 • 2,751 chữ • 2025-08-05
5 第5章 和平友爱族谱村5
第一卷: 和平友爱族谱村 • 2,406 chữ • 2025-08-05
6 第6章 现实世界：结算与抽奖
7 第7章 现实世界：特殊交易
8 第8章 恐怖游乐园（1）
第一卷: 恐怖游乐园 • 2,800 chữ • 2025-08-10
9 第9章 恐怖游乐园（2）
10 第10章 恐怖游乐园（3）`;

export const VHLTOCAnalyzerModal: React.FC<VHLTOCAnalyzerModalProps> = ({
  isOpen,
  onClose,
  config,
  onApplyConfig,
}) => {
  const [rawTOC, setRawTOC] = useState('');
  const [transitionMode, setTransitionMode] = useState<
    'empty-title' | 'keep-original' | 'custom-label' | 'pure-number'
  >(config.vhlTransitionMode || 'empty-title');
  const [transitionLabel, setTransitionLabel] = useState(
    config.vhlTransitionCustomLabel || '现实'
  );
  const [analysisResult, setAnalysisResult] = useState<TOCAnalysisResult | null>(null);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  if (!isOpen) return null;

  const handleAnalyze = () => {
    if (!rawTOC.trim()) return;
    const res = analyzeVHLTableOfContents(rawTOC, {
      vhlTransitionMode: transitionMode,
      vhlTransitionCustomLabel: transitionLabel,
      prefixFormat: config.prefixFormat,
      customPrefix: config.customPrefix,
    });
    setAnalysisResult(res);
  };

  const handleApply = () => {
    if (!analysisResult || analysisResult.chapters.length === 0) return;

    const formattedHeaders = analysisResult.chapters.map((c) => c.formattedHeader);
    const titlesToStrip = analysisResult.chapters
      .map((c) => c.originalTitle)
      .filter((t) => t && t.length > 1)
      .join('\n');

    // First detected dungeon as default
    const firstDungeon = analysisResult.arcs.find((a) => a.type === 'dungeon');

    onApplyConfig({
      enableInfiniteFlow: true,
      useAnalyzedTOC: true,
      analyzedChapterHeaders: formattedHeaders,
      vhlTransitionMode: transitionMode,
      vhlTransitionCustomLabel: transitionLabel,
      dungeonName: firstDungeon ? firstDungeon.name : config.dungeonName,
      dungeonBracketStyle: firstDungeon?.format || config.dungeonBracketStyle,
      customTitlesToStrip: config.customTitlesToStrip
        ? `${config.customTitlesToStrip}\n${titlesToStrip}`
        : titlesToStrip,
    });

    onClose();
  };

  const handleCopy = () => {
    if (!analysisResult) return;
    const text = analysisResult.chapters.map((c) => c.formattedHeader).join('\n');
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-xl border border-pink-200/80 max-w-4xl w-full max-h-[92vh] flex flex-col my-auto overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-pink-200/70 bg-pink-50/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center border border-pink-200/80 shadow-2xs">
              <Bookmark className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-pink-950 flex items-center gap-2">
                Phân Tích Mục Lục & Tiêu Đề Vô Hạn Lưu
                <span className="text-[11px] bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full font-semibold border border-pink-200/80">
                  Tự Động Nhận Diện
                </span>
              </h2>
              <p className="text-xs text-pink-700/80">
                Phát hiện các phó bản, định dạng số phần và xử lý thông minh các chương đời thực / quá độ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-pink-400 hover:text-pink-700 hover:bg-pink-100/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs sm:text-sm">
          {/* Input Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-semibold text-pink-950 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-pink-600" />
                Dán danh sách tiêu đề / mục lục truyện:
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRawTOC(SAMPLE_VHL_TOC)}
                  className="text-xs font-semibold text-pink-600 hover:text-pink-800 hover:underline cursor-pointer"
                >
                  Dán mẫu VHL thử nghiệm
                </button>
                {rawTOC && (
                  <button
                    type="button"
                    onClick={() => {
                      setRawTOC('');
                      setAnalysisResult(null);
                    }}
                    className="text-xs text-pink-400 hover:text-pink-700 cursor-pointer"
                  >
                    Xóa trắng
                  </button>
                )}
              </div>
            </div>
            <textarea
              value={rawTOC}
              onChange={(e) => setRawTOC(e.target.value)}
              rows={6}
              placeholder={`Dán danh sách mục lục vào đây...\nVí dụ:\n1 第1章 和平友爱族谱村\n2 第2章 和平友爱族谱村2\n...\n第6章 现实世界：结算与抽奖\n第8章 恐怖游乐园（1）`}
              className="w-full bg-pink-50/30 border border-pink-200 rounded-2xl p-3 text-xs font-mono text-pink-950 placeholder-pink-300 focus:outline-none focus:border-pink-400 focus:bg-white resize-y leading-relaxed"
            />
          </div>

          {/* Strategy Selection for Transition / Real-World Chapters */}
          <div className="bg-pink-50/50 border border-pink-200/80 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-pink-950 font-bold mb-1.5">
              <HelpCircle className="w-4 h-4 text-pink-500" />
              <span>Cách chia hợp lý khi có các chương bình thường (quá độ / đời thực) giữa các phó bản?</span>
            </div>
            <p className="text-xs text-pink-800/80 mb-3 leading-relaxed">
              Trong truyện VHL, sau khi kết thúc 1 phó bản thường có 1-3 chương nhân vật chính về đời thực nghỉ ngơi,
              kết toán điểm thưởng, rút thưởng hoặc mua trang bị. Bạn có thể chọn cách định dạng các chương này:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Option 1: Empty Title / Pure Number (User Preferred) */}
              <label
                className={`flex flex-col p-3 rounded-2xl border cursor-pointer transition-all ${
                  transitionMode === 'empty-title' || transitionMode === 'pure-number'
                    ? 'border-pink-400 bg-white ring-2 ring-pink-200 shadow-2xs'
                    : 'border-pink-200 bg-pink-50/30 hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <input
                    type="radio"
                    name="vhlTransitionMode"
                    value="empty-title"
                    checked={transitionMode === 'empty-title' || transitionMode === 'pure-number'}
                    onChange={() => setTransitionMode('empty-title')}
                    className="text-pink-500 focus:ring-pink-300 accent-pink-400"
                  />
                  <span className="font-bold text-pink-950 text-xs">Để trống tên chương (Khuyên dùng)</span>
                </div>
                <p className="text-[11px] text-pink-700/80 leading-relaxed">
                  Ví dụ: <code className="bg-pink-50 text-pink-700 px-1 py-0.5 rounded border border-pink-200/60">第 25 章</code>.
                  Chỉ giữ số thứ tự chương, để trống tên chương đời thường.
                </p>
              </label>

              {/* Option 2: Keep Original */}
              <label
                className={`flex flex-col p-3 rounded-2xl border cursor-pointer transition-all ${
                  transitionMode === 'keep-original'
                    ? 'border-pink-400 bg-white ring-2 ring-pink-200 shadow-2xs'
                    : 'border-pink-200 bg-pink-50/30 hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <input
                    type="radio"
                    name="vhlTransitionMode"
                    value="keep-original"
                    checked={transitionMode === 'keep-original'}
                    onChange={() => setTransitionMode('keep-original')}
                    className="text-pink-500 focus:ring-pink-300 accent-pink-400"
                  />
                  <span className="font-bold text-pink-950 text-xs">Giữ nguyên tên gốc tác giả</span>
                </div>
                <p className="text-[11px] text-pink-700/80 leading-relaxed">
                  Ví dụ: <code className="bg-pink-50 text-pink-700 px-1 py-0.5 rounded border border-pink-200/60">第 25 章 结算与现实休憩</code>.
                  Giữ đúng tên tác giả đặt.
                </p>
              </label>

              {/* Option 3: Custom Label Group */}
              <label
                className={`flex flex-col p-3 rounded-2xl border cursor-pointer transition-all ${
                  transitionMode === 'custom-label'
                    ? 'border-pink-400 bg-white ring-2 ring-pink-200 shadow-2xs'
                    : 'border-pink-200 bg-pink-50/30 hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <input
                    type="radio"
                    name="vhlTransitionMode"
                    value="custom-label"
                    checked={transitionMode === 'custom-label'}
                    onChange={() => setTransitionMode('custom-label')}
                    className="text-pink-500 focus:ring-pink-300 accent-pink-400"
                  />
                  <span className="font-bold text-pink-950 text-xs">Gán nhãn Đời thực</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="text"
                    value={transitionLabel}
                    onChange={(e) => setTransitionLabel(e.target.value)}
                    placeholder="现实"
                    className="w-20 px-2 py-0.5 text-xs bg-white border border-pink-200 rounded-lg font-medium text-pink-950 focus:outline-none focus:border-pink-400"
                  />
                  <span className="text-[11px] text-pink-600">➔ (1), (2)...</span>
                </div>
              </label>
            </div>
          </div>

          {/* Analyze Button */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!rawTOC.trim()}
              className="px-6 py-2.5 bg-pink-400 hover:bg-pink-500 text-white font-bold rounded-2xl shadow-xs shadow-pink-200 transition-all transform active:scale-98 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-xs sm:text-sm"
            >
              <Search className="w-4 h-4" />
              <span>Phân Tích & Phát Hiện Phó Bản Tự Động</span>
            </button>
          </div>

          {/* Analysis Results Display */}
          {analysisResult && (
            <div className="space-y-4 border-t border-pink-200/60 pt-4 animate-fade-in">
              {/* Summary Stats Badges */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-pink-50/60 border border-pink-200/80 rounded-2xl p-3 text-center">
                  <div className="text-xs text-pink-700 font-medium">Tổng số chương</div>
                  <div className="text-xl font-extrabold text-pink-950 mt-0.5">
                    {analysisResult.totalAnalyzed}
                  </div>
                </div>
                <div className="bg-pink-100/40 border border-pink-200/80 rounded-2xl p-3 text-center">
                  <div className="text-xs text-pink-700 font-medium">Chương trong phó bản</div>
                  <div className="text-xl font-extrabold text-pink-950 mt-0.5">
                    {analysisResult.dungeonChaptersCount}
                  </div>
                </div>
                <div className="bg-pink-50/40 border border-pink-200/80 rounded-2xl p-3 text-center">
                  <div className="text-xs text-pink-700 font-medium">Chương quá độ / Đời thực</div>
                  <div className="text-xl font-extrabold text-pink-950 mt-0.5">
                    {analysisResult.transitionChaptersCount}
                  </div>
                </div>
              </div>

              {/* Detected Arcs */}
              <div>
                <h3 className="font-bold text-pink-950 text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-pink-500" />
                  Danh Sách Phó Bản & Giai Đoạn Phát Hiện ({analysisResult.arcs.length}):
                </h3>
                <div className="space-y-2">
                  {analysisResult.arcs.map((arc, aIdx) => (
                    <div
                      key={aIdx}
                      className="p-3 rounded-2xl border border-pink-200/70 bg-pink-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                            arc.type === 'dungeon'
                              ? 'bg-pink-100 text-pink-700 border border-pink-200'
                              : 'bg-pink-50 text-pink-600 border border-pink-200/60'
                          }`}
                        >
                          {arc.type === 'dungeon' ? (
                            <Compass className="w-4 h-4" />
                          ) : (
                            <Coffee className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-pink-950 flex items-center gap-2">
                            <span>{arc.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-pink-100 text-pink-800 border border-pink-200/60">
                              {arc.type === 'dungeon' ? 'Phó bản' : 'Quá độ / Đời thực'}
                            </span>
                          </div>
                          <div className="text-xs text-pink-700/80 mt-0.5">
                            Chương {arc.startChapter} ➔ Chương {arc.endChapter} ({arc.totalChapters} chương)
                            {arc.format && (
                              <span className="ml-2 text-pink-600 font-mono text-[11px]">
                                [Kiểu: {arc.format}]
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Sample title */}
                      <div className="text-xs font-mono text-pink-900 bg-white px-2.5 py-1 rounded-xl border border-pink-200 truncate max-w-xs">
                        {arc.samples[0]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview of Chapter Headers */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-pink-950 text-xs uppercase tracking-wider">
                    Xem trước tiêu đề sau định dạng ({analysisResult.chapters.length} chương):
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowFullPreview(!showFullPreview)}
                    className="text-xs text-pink-600 hover:text-pink-800 font-semibold cursor-pointer"
                  >
                    {showFullPreview ? 'Thu gọn' : 'Xem toàn bộ'}
                  </button>
                </div>

                <div className="bg-pink-50/20 border border-pink-200 rounded-2xl p-3 font-mono text-xs max-h-52 overflow-y-auto space-y-1">
                  {(showFullPreview
                    ? analysisResult.chapters
                    : analysisResult.chapters.slice(0, 15)
                  ).map((c, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-white"
                    >
                      <span className="font-bold text-pink-950">{c.formattedHeader}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-pink-100/80 text-pink-700 border border-pink-200/60">
                        {c.type === 'dungeon' ? `Phần ${c.dungeonIndex}` : 'Quá độ'}
                      </span>
                    </div>
                  ))}
                  {!showFullPreview && analysisResult.chapters.length > 15 && (
                    <div className="text-center py-1 text-pink-400 text-xs italic">
                      ... và {analysisResult.chapters.length - 15} chương nữa ...
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-pink-200/70 bg-pink-50/40 flex items-center justify-between gap-3">
          <div className="text-xs text-pink-700">
            {analysisResult && (
              <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Đã sẵn sàng áp dụng {analysisResult.chapters.length} tiêu đề
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {analysisResult && (
              <button
                type="button"
                onClick={handleCopy}
                className="px-4 py-2 bg-white border border-pink-200 hover:bg-pink-50 text-pink-800 font-semibold rounded-2xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-pink-600" />
                <span>{copySuccess ? 'Đã sao chép!' : 'Sao chép tiêu đề'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-pink-200 text-pink-700 hover:bg-pink-100/60 font-medium rounded-2xl text-xs transition-colors cursor-pointer"
            >
              Hủy
            </button>

            <button
              type="button"
              onClick={handleApply}
              disabled={!analysisResult || analysisResult.chapters.length === 0}
              className="px-5 py-2 bg-pink-400 hover:bg-pink-500 text-white font-bold rounded-2xl text-xs shadow-xs shadow-pink-200 transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>Áp Dụng Vào Cấu Hình Chia Chương</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
