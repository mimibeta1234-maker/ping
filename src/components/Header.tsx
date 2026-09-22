import React from 'react';
import { BookOpen } from 'lucide-react';

interface HeaderProps {
  targetChars: number;
}

export const Header: React.FC<HeaderProps> = ({ targetChars }) => {
  return (
    <header className="border-b border-pink-200/60 bg-white/75 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-13 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center shadow-2xs border border-pink-200/60">
            <BookOpen className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-baseline space-x-2">
            <h1 className="text-xs sm:text-sm font-bold text-pink-950 tracking-tight">
              Ping
            </h1>
            <span className="text-[11px] font-semibold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full border border-pink-200/70">
              ~{targetChars} chữ
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
