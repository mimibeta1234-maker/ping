import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';

interface BookCoverProps {
  src?: string;
  bookId?: string;
  alt?: string;
  title?: string;
  author?: string;
  category?: string;
  className?: string;
  widthClass?: string;
  heightClass?: string;
}

// Generate deterministic gradient theme based on title string
function getThemeStyle(str: string = '', category: string = '') {
  const cat = category.toLowerCase();
  
  if (cat.includes('escape') || cat.includes('sinh tồn') || cat.includes('trốn thoát')) {
    return {
      bg: 'from-rose-900 via-stone-900 to-red-950',
      accent: 'border-red-500/40 text-rose-200',
      tagBg: 'bg-red-500/30 text-rose-200',
      label: 'TRỐN THOÁT',
      spine: 'from-black/60 to-transparent'
    };
  }
  
  if (cat.includes('rules') || cat.includes('quái đàm') || cat.includes('kinh dị')) {
    return {
      bg: 'from-purple-950 via-slate-900 to-indigo-950',
      accent: 'border-purple-400/40 text-purple-200',
      tagBg: 'bg-purple-500/30 text-purple-200',
      label: 'QUÁI ĐÀM',
      spine: 'from-black/60 to-transparent'
    };
  }

  if (cat.includes('vohan') || cat.includes('vô hạn')) {
    return {
      bg: 'from-slate-900 via-indigo-950 to-rose-950',
      accent: 'border-indigo-400/40 text-indigo-200',
      tagBg: 'bg-indigo-500/30 text-indigo-200',
      label: 'VÔ HẠN',
      spine: 'from-black/60 to-transparent'
    };
  }

  if (cat.includes('cotrang') || cat.includes('tiên hiệp') || cat.includes('cổ trang')) {
    return {
      bg: 'from-teal-950 via-emerald-950 to-slate-900',
      accent: 'border-emerald-400/40 text-emerald-200',
      tagBg: 'bg-emerald-500/30 text-emerald-200',
      label: 'CỔ PHONG',
      spine: 'from-black/60 to-transparent'
    };
  }

  if (cat.includes('vongdu') || cat.includes('võng du') || cat.includes('điện cạnh')) {
    return {
      bg: 'from-blue-950 via-sky-950 to-slate-900',
      accent: 'border-sky-400/40 text-sky-200',
      tagBg: 'bg-sky-500/30 text-sky-200',
      label: 'ĐIỆN CẠNH',
      spine: 'from-black/60 to-transparent'
    };
  }

  if (cat.includes('matthe') || cat.includes('mạt thế')) {
    return {
      bg: 'from-amber-950 via-stone-900 to-red-950',
      accent: 'border-amber-400/40 text-amber-200',
      tagBg: 'bg-amber-500/30 text-amber-200',
      label: 'MẠT THẾ',
      spine: 'from-black/60 to-transparent'
    };
  }

  // Fallback hash color for others
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const palettes = [
    {
      bg: 'from-pink-900 via-rose-950 to-purple-950',
      accent: 'border-pink-400/40 text-pink-200',
      tagBg: 'bg-pink-500/30 text-pink-200',
      label: 'ĐAM MỸ',
      spine: 'from-black/60 to-transparent'
    },
    {
      bg: 'from-fuchsia-950 via-pink-900 to-stone-900',
      accent: 'border-fuchsia-400/40 text-fuchsia-200',
      tagBg: 'bg-fuchsia-500/30 text-fuchsia-200',
      label: 'NGỌT SỦNG',
      spine: 'from-black/60 to-transparent'
    },
    {
      bg: 'from-rose-950 via-purple-950 to-slate-900',
      accent: 'border-rose-400/40 text-rose-200',
      tagBg: 'bg-rose-500/30 text-rose-200',
      label: 'SẢNG VĂN',
      spine: 'from-black/60 to-transparent'
    }
  ];

  return palettes[Math.abs(hash) % palettes.length];
}

export const BookCover: React.FC<BookCoverProps> = ({
  src,
  bookId,
  alt = 'Bìa truyện',
  title = '',
  author = '',
  category = '',
  className = '',
  widthClass = 'w-13',
  heightClass = 'h-17'
}) => {
  const [hasError, setHasError] = useState(false);

  // Compute proxied image URL to bypass CORS & anti-hotlinking
  const getProxiedUrl = () => {
    const raw = (src || '').trim();
    if (raw) {
      if (raw.startsWith('/api/fanqie/image-proxy') || raw.startsWith('data:')) {
        return raw;
      }
      return `/api/fanqie/image-proxy?url=${encodeURIComponent(raw)}${bookId ? `&book_id=${encodeURIComponent(bookId)}` : ''}`;
    }
    if (bookId && bookId.length >= 5) {
      return `/api/fanqie/image-proxy?book_id=${encodeURIComponent(bookId)}`;
    }
    return '';
  };

  const proxiedSrc = getProxiedUrl();
  const theme = getThemeStyle(title, category);

  // Clean title for display snippet
  const cleanTitle = title
    .replace(/[【】\[\]（）()]/g, ' ')
    .replace(/双男主|无限流|快穿|重生|规则怪谈/g, '')
    .trim();

  // Pick up to 4 key characters for vertical aesthetic
  const displayChars = cleanTitle.slice(0, 4) || title.slice(0, 4) || '小说';

  if (!proxiedSrc || hasError) {
    return (
      <div
        className={`relative overflow-hidden rounded-lg bg-gradient-to-br ${theme.bg} shadow-md border border-white/10 shrink-0 select-none flex flex-col justify-between p-1 text-white ${widthClass} ${heightClass} ${className}`}
        title={`${title} - ${author}`}
      >
        {/* Book spine simulation */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-r from-white/20 via-black/30 to-transparent z-10" />

        {/* Top Tag */}
        <div className="flex items-center justify-between z-10 pl-1">
          <span className={`text-[8px] font-bold px-1 py-0.2 rounded-xs backdrop-blur-xs tracking-tighter ${theme.tagBg}`}>
            {theme.label}
          </span>
          <BookOpen className="w-2.5 h-2.5 opacity-60 text-white/80" />
        </div>

        {/* Center Title Stylized */}
        <div className="z-10 text-center my-auto flex flex-col items-center justify-center">
          <span className="text-[11px] font-black tracking-widest text-white/95 leading-tight drop-shadow-sm font-serif">
            {displayChars}
          </span>
        </div>

        {/* Bottom Author */}
        <div className="z-10 text-[8px] text-white/70 truncate text-center font-medium pl-1">
          {author ? author.slice(0, 4) : '番茄'}
        </div>

        {/* Decorative subtle texture/border */}
        <div className="absolute inset-0.5 border border-white/10 rounded-md pointer-events-none" />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-pink-100 shadow-2xs border border-pink-200 shrink-0 ${widthClass} ${heightClass} ${className}`}
    >
      <img
        src={proxiedSrc}
        alt={alt}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        loading="lazy"
        onError={() => setHasError(true)}
        className="w-full h-full object-cover rounded-lg"
      />
      {/* Subtle glossy overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-black/10 via-transparent to-white/10 pointer-events-none" />
    </div>
  );
};
