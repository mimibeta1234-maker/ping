import React, { useState } from 'react';
import { Header } from './components/Header';
import { ChineseInputPanel } from './components/ChineseInputPanel';
import { ChineseChapterList } from './components/ChineseChapterList';
import { SplitChineseConfig, ChineseSplitResult } from './types';
import { DEFAULT_CHINESE_CONFIG, splitRawIntoChineseChapters } from './utils/chineseSplitter';

export function App() {
  const [rawText, setRawText] = useState<string>('');
  const [config, setConfig] = useState<SplitChineseConfig>(DEFAULT_CHINESE_CONFIG);
  const [splitResult, setSplitResult] = useState<ChineseSplitResult | null>(null);

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
    if (rawText.trim()) {
      runSplit(rawText, newConfig);
    }
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
        const { header, title } = {
          header: config.prefixFormat === 'chuong'
            ? `Chương ${chap.chapterIndex}: ${dungeonName} (${dIdx})`
            : `第 ${chap.chapterIndex} 章 ${dungeonName} (${dIdx})`,
          title: '',
        };

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
      <Header targetChars={config.targetCharsPerChapter} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-3.5 sm:px-6 py-5 space-y-4">
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
      </main>

      <footer className="border-t border-pink-200/50 py-3 text-center text-[11px] text-pink-400 bg-white/40">
        <p>Tự động chia & xuất file truyện raw tiếng Trung</p>
      </footer>
    </div>
  );
}

export default App;
