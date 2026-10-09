import React, { useState } from 'react';
import { Header, AppTab } from './components/Header';
import { ChineseInputPanel } from './components/ChineseInputPanel';
import { ChineseChapterList } from './components/ChineseChapterList';
import { FanqieDownloader } from './components/FanqieDownloader';
import { DanmeiInfiniteLeaderboard } from './components/DanmeiInfiniteLeaderboard';
import { SplitChineseConfig, ChineseSplitResult } from './types';
import {
  DEFAULT_CHINESE_CONFIG,
  splitRawIntoChineseChapters,
  formatChapterHeader,
} from './utils/chineseSplitter';
import { CheckCircle2, X, RefreshCw, Scissors, AlertCircle } from 'lucide-react';

interface OneClickProgressState {
  isOpen: boolean;
  bookName: string;
  taskId: string | null;
  status: 'initializing' | 'downloading' | 'completed' | 'error';
  totalChapters: number;
  completedChapters: number;
  percent: number;
  currentChapterTitle: string;
  speed: string;
  error?: string;
}

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('splitter');
  const [rawText, setRawText] = useState<string>('');
  const [config, setConfig] = useState<SplitChineseConfig>(DEFAULT_CHINESE_CONFIG);
  const [splitResult, setSplitResult] = useState<ChineseSplitResult | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'loading' } | null>(null);
  const [selectedBookForDownload, setSelectedBookForDownload] = useState<string | null>(null);
  const [oneClickProgress, setOneClickProgress] = useState<OneClickProgressState | null>(null);

  const showNotification = (message: string, type: 'success' | 'info' | 'loading' = 'success', duration = 4000) => {
    setNotification({ message, type });
    if (duration > 0) {
      setTimeout(() => {
        setNotification((curr) => (curr?.message === message ? null : curr));
      }, duration);
    }
  };

  const runSplit = (text: string, currentConfig: SplitChineseConfig) => {
    if (!text.trim()) {
      setSplitResult(null);
      return;
    }
    const result = splitRawIntoChineseChapters(text, currentConfig);
    setSplitResult(result);
  };

  const handleProcessSplit = () => {
    runSplit(rawText, config);
  };

  const handleClear = () => {
    setRawText('');
    setSplitResult(null);
  };

  const handleChangeConfig = (newConfig: SplitChineseConfig) => {
    setConfig(newConfig);
    // Only re-split if user already explicitly ran a split
    if (splitResult && rawText.trim()) {
      runSplit(rawText, newConfig);
    }
  };

  const handleTransferFromFanqie = (downloadedRawText: string, novelTitle: string) => {
    setRawText(downloadedRawText);
    const updatedConfig: SplitChineseConfig = {
      ...config,
      novelTitle: novelTitle || config.novelTitle,
    };
    setConfig(updatedConfig);
    // Do NOT automatically split - only insert raw so user can review and adjust settings
    setSplitResult(null);
    setActiveTab('splitter');
    showNotification(
      `Đã thêm toàn bộ raw truyện "${novelTitle}". Bạn hãy tùy chỉnh cài đặt theo ý muốn rồi bấm "Bắt đầu chia chương"!`,
      'success',
      6000
    );
  };

  // From Leaderboard: Select book and switch to downloader
  const handleSelectBookForDownload = (bookId: string) => {
    setSelectedBookForDownload(bookId);
    setActiveTab('fanqie');
  };

  // From Leaderboard: 1-Click download ALL chapters and split
  const handleOneClickSplit = async (bookId: string, bookName: string) => {
    setOneClickProgress({
      isOpen: true,
      bookName,
      taskId: null,
      status: 'initializing',
      totalChapters: 0,
      completedChapters: 0,
      percent: 0,
      currentChapterTitle: 'Đang kết nối Fanqie và lấy mục lục...',
      speed: '',
    });

    try {
      // 1. Fetch book info & catalog
      const [infoRes, catRes] = await Promise.all([
        fetch(`/api/fanqie/book-info?bookId=${bookId}`).then((r) => r.json()),
        fetch(`/api/fanqie/catalog?bookId=${bookId}`).then((r) => r.json()),
      ]);

      if (!infoRes.success || !catRes.success) {
        throw new Error('Không thể lấy thông tin mục lục truyện');
      }

      const totalChapters = catRes.catalog?.chapter_list?.length || infoRes.bookInfo?.chapter_count || 1;
      
      // Download ALL chapters (1 to totalChapters)
      const ranges = [{ start: 1, end: totalChapters, label: `Toàn bộ (1 - ${totalChapters})` }];

      // 2. Create download task
      const createRes = await fetch('/api/fanqie/download/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          bookInfo: infoRes.bookInfo,
          catalog: catRes.catalog,
          ranges,
          includeIntro: true,
          provider: 'fanqie',
        }),
      }).then((r) => r.json());

      if (!createRes.success) {
        throw new Error(createRes.error || 'Lỗi khởi tạo tải raw');
      }

      const taskId = createRes.taskId;

      setOneClickProgress((prev) =>
        prev
          ? {
              ...prev,
              taskId,
              status: 'downloading',
              totalChapters,
            }
          : null
      );

      // 3. Poll until done with progress tracking
      const pollTask = () =>
        new Promise<string>((resolve, reject) => {
          const timer = setInterval(async () => {
            try {
              const statusRes = await fetch(`/api/fanqie/download/status/${taskId}`).then((r) => r.json());
              if (statusRes.status === 'completed') {
                clearInterval(timer);
                setOneClickProgress((prev) =>
                  prev
                    ? {
                        ...prev,
                        status: 'completed',
                        completedChapters: statusRes.totalChapters,
                        percent: 100,
                        currentChapterTitle: 'Hoàn tất tải!',
                      }
                    : null
                );
                const rawRes = await fetch(`/api/fanqie/download/get-raw-text/${taskId}`).then((r) => r.json());
                resolve(rawRes.rawText || '');
              } else if (statusRes.status === 'error' || statusRes.status === 'cancelled') {
                clearInterval(timer);
                reject(new Error(statusRes.error || 'Lỗi trong quá trình tải'));
              } else {
                setOneClickProgress((prev) =>
                  prev
                    ? {
                        ...prev,
                        completedChapters: statusRes.completedChapters || 0,
                        totalChapters: statusRes.totalChapters || totalChapters,
                        percent: statusRes.percent || 0,
                        currentChapterTitle: statusRes.currentChapterTitle || '',
                        speed: statusRes.speed || '',
                      }
                    : null
                );
              }
            } catch (err) {
              clearInterval(timer);
              reject(err);
            }
          }, 450);
        });

      const raw = await pollTask();
      setOneClickProgress(null);
      handleTransferFromFanqie(raw, bookName);
    } catch (err: any) {
      setOneClickProgress((prev) =>
        prev
          ? {
              ...prev,
              status: 'error',
              error: err.message || 'Không thể tải truyện',
            }
          : null
      );
    }
  };

  const handleCancelOneClick = async () => {
    if (oneClickProgress?.taskId) {
      try {
        await fetch(`/api/fanqie/download/cancel/${oneClickProgress.taskId}`, { method: 'POST' });
      } catch (e) {
        console.error(e);
      }
    }
    setOneClickProgress(null);
  };

  const handleUpdateChapterHeader = (chapterId: string, newHeader: string) => {
    if (!splitResult) return;
    const updatedChapters = splitResult.chapters.map((chap) => {
      if (chap.id === chapterId) {
        return {
          ...chap,
          header: newHeader,
          title: newHeader,
          isCustomEdited: true,
        };
      }
      return chap;
    });

    setSplitResult({
      ...splitResult,
      chapters: updatedChapters,
    });
  };

  const handleBulkUpdateDungeon = (
    startNum: number,
    endNum: number,
    dungeonName: string,
    dungeonStartIndex: number
  ) => {
    if (!splitResult) return;
    let dIdx = dungeonStartIndex;

    const updatedChapters = splitResult.chapters.map((chap) => {
      if (chap.chapterIndex >= startNum && chap.chapterIndex <= endNum) {
        const { header } = formatChapterHeader(
          chap.chapterIndex,
          config,
          chap.charCount,
          dungeonName,
          dIdx
        );

        const result = {
          ...chap,
          header,
          title: header,
          dungeonName,
          dungeonIndex: dIdx,
          isCustomEdited: true,
        };
        dIdx++;
        return result;
      }
      return chap;
    });

    setSplitResult({
      ...splitResult,
      chapters: updatedChapters,
    });
  };

  return (
    <div className="min-h-screen bg-[#fff5f7] text-slate-800 flex flex-col font-sans selection:bg-pink-200 selection:text-pink-900">
      <Header
        targetChars={config.targetCharsPerChapter}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Floating Notification */}
      {notification && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-3 duration-200 px-4 py-2.5 rounded-2xl bg-white/95 border border-pink-300 text-pink-950 text-xs sm:text-sm font-semibold shadow-lg shadow-pink-200/60 backdrop-blur-md flex items-center gap-2 max-w-md">
          {notification.type === 'loading' ? (
            <RefreshCw className="w-4 h-4 text-pink-500 animate-spin shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          )}
          <span className="flex-1">{notification.message}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-pink-400 hover:text-pink-600 p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Real-time One-Click Split Download Progress Modal */}
      {oneClickProgress && oneClickProgress.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-3xl border border-pink-200 shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center font-bold">
                  <Scissors className="w-4 h-4 text-pink-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-pink-950">
                    Đang tải raw & thêm vào ô nhập liệu
                  </h3>
                  <p className="text-[11px] text-pink-600 font-semibold truncate max-w-[240px]">
                    {oneClickProgress.bookName}
                  </p>
                </div>
              </div>

              {oneClickProgress.status === 'error' && (
                <button
                  type="button"
                  onClick={() => setOneClickProgress(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {oneClickProgress.status === 'error' ? (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-xs text-rose-700 space-y-2">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle className="w-4 h-4" />
                  <span>Có lỗi khi tải truyện</span>
                </div>
                <p>{oneClickProgress.error}</p>
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setOneClickProgress(null)}
                    className="px-3 py-1 bg-rose-500 text-white rounded-xl text-xs font-bold"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Progress bar */}
                <div className="w-full bg-pink-100 h-3 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-pink-500 to-rose-400 transition-all duration-300 rounded-full"
                    style={{ width: `${Math.max(3, oneClickProgress.percent)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-pink-950">
                    {oneClickProgress.completedChapters} / {oneClickProgress.totalChapters} chương ({oneClickProgress.percent}%)
                  </span>
                  {oneClickProgress.speed && (
                    <span className="text-[11px] text-pink-500 font-semibold">
                      Tốc độ: {oneClickProgress.speed}
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-pink-600/90 truncate bg-pink-50/60 px-3 py-1.5 rounded-xl border border-pink-100">
                  <span className="text-pink-400 mr-1">Đang xử lý:</span>
                  <span className="font-medium text-pink-950">
                    {oneClickProgress.currentChapterTitle || 'Đang kết nối server...'}
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 italic text-center">
                  Sau khi tải xong 100%, nội dung sẽ được thêm vào ô nhập liệu để bạn tùy chỉnh cài đặt và bấm chia chương!
                </p>

                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={handleCancelOneClick}
                    className="text-xs text-rose-500 hover:text-rose-700 font-semibold px-4 py-1.5 rounded-xl bg-pink-50/50 hover:bg-rose-50 border border-pink-200 hover:border-rose-200 transition-colors cursor-pointer"
                  >
                    Hủy tải
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <main className="flex-1 max-w-4xl w-full mx-auto px-3.5 sm:px-6 py-5 space-y-4">
        {activeTab === 'splitter' && (
          <>
            <ChineseInputPanel
              rawText={rawText}
              onChangeRawText={setRawText}
              config={config}
              onChangeConfig={handleChangeConfig}
              onProcessSplit={handleProcessSplit}
              onClear={handleClear}
            />

            {splitResult && splitResult.chapters.length > 0 && (
              <ChineseChapterList
                splitResult={splitResult}
                config={config}
                onUpdateChapterHeader={handleUpdateChapterHeader}
                onBulkUpdateDungeon={handleBulkUpdateDungeon}
              />
            )}
          </>
        )}

        {activeTab === 'fanqie' && (
          <FanqieDownloader
            onTransferToSplitter={handleTransferFromFanqie}
            initialBookId={selectedBookForDownload}
          />
        )}

        {activeTab === 'danmei_leaderboard' && (
          <DanmeiInfiniteLeaderboard
            onSelectBookForDownload={handleSelectBookForDownload}
            onOneClickSplit={handleOneClickSplit}
          />
        )}
      </main>

      <footer className="border-t border-pink-200/50 py-3 text-center text-[11px] text-pink-400 bg-white/40">
        <p>Ping • Chia chương raw & BXH Đam mỹ Fanqie</p>
      </footer>
    </div>
  );
}

export default App;
