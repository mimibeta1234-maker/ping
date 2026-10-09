import React from 'react';
import { BookOpen, Scissors, Download, Trophy } from 'lucide-react';

export type AppTab = 'splitter' | 'fanqie' | 'danmei_leaderboard';

interface HeaderProps {
  targetChars: number;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

export const Header: React.FC<HeaderProps> = ({ targetChars, activeTab, onTabChange }) => {
  return (
    <header className="border-b border-pink-200/60 bg-white/80 backdrop-blur-md sticky top-0 z-30 shadow-2xs">
      <div className="max-w-4xl mx-auto px-3.5 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-3">
        {/* Brand */}
        <div className="flex items-center space-x-2 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center shadow-2xs border border-pink-200/60 font-bold">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <h1 className="text-sm sm:text-base font-bold text-pink-950 tracking-tight">
              Ping
            </h1>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-pink-100/60 p-1 rounded-2xl border border-pink-200/70 text-xs font-semibold overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => onTabChange('splitter')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'splitter'
                ? 'bg-white text-pink-950 shadow-xs font-bold'
                : 'text-pink-700 hover:text-pink-950 hover:bg-white/40'
            }`}
          >
            <Scissors className="w-3.5 h-3.5 text-pink-500" />
            <span>Bộ chia chương</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('fanqie')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'fanqie'
                ? 'bg-white text-pink-950 shadow-xs font-bold'
                : 'text-pink-700 hover:text-pink-950 hover:bg-white/40'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-pink-500" />
            <span>Tải Raw</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('danmei_leaderboard')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'danmei_leaderboard'
                ? 'bg-white text-pink-950 shadow-xs font-bold'
                : 'text-pink-700 hover:text-pink-950 hover:bg-white/40'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span>BXH Đam mỹ</span>
          </button>
        </div>
      </div>
    </header>
  );
};
