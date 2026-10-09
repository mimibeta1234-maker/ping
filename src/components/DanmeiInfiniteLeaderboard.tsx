import React, { useState, useEffect } from 'react';
import { BookCover } from './BookCover';
import {
  Trophy,
  Flame,
  Star,
  CheckCircle2,
  Clock,
  BookOpen,
  Download,
  Scissors,
  FileText,
  Search,
  ExternalLink,
  RefreshCw,
  List,
  SlidersHorizontal,
  Swords,
  Skull,
  Scroll,
  Biohazard,
  Gamepad2,
  Compass,
  Zap,
  History,
  Layers,
  Shuffle,
  Building2,
  Crown,
  ChevronDown,
} from 'lucide-react';

interface BookItem {
  book_id: string;
  book_name: string;
  author: string;
  thumb_url: string;
  score: string;
  category: string;
  abstract: string;
  word_number: string;
  chapter_count: number;
  last_chapter_title: string;
  creation_status: string;
}

interface DanmeiInfiniteLeaderboardProps {
  onSelectBookForDownload: (bookId: string) => void;
  onOneClickSplit: (bookId: string, bookName: string) => void;
}

type DanmeiCategory = 'all' | 'vohan' | 'escape' | 'rules' | 'khoaixuyen' | 'cuongcuong' | 'matthe' | 'dothi' | 'cotrang' | 'vongdu';
type DanmeiSort = 'score' | 'hot' | 'newest' | 'updated' | 'ongoing' | 'completed' | 'chapters';

export const DanmeiInfiniteLeaderboard: React.FC<DanmeiInfiniteLeaderboardProps> = ({
  onSelectBookForDownload,
  onOneClickSplit,
}) => {
  const [category, setCategory] = useState<DanmeiCategory>('all');
  const [sort, setSort] = useState<DanmeiSort>('score');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [books, setBooks] = useState<BookItem[]>([]);
  const [displayCount, setDisplayCount] = useState<number>(30);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Catalog modal
  const [isCatalogOpen, setIsCatalogOpen] = useState<boolean>(false);
  const [activeCatalogBook, setActiveCatalogBook] = useState<BookItem | null>(null);
  const [catalogList, setCatalogList] = useState<any[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);
  const [catalogSearch, setCatalogSearch] = useState<string>('');

  const fetchRanking = async (cat = category, s = sort, search = searchTerm, forceFresh = false) => {
    setIsLoading(true);
    setError(null);
    setDisplayCount(30);
    try {
      const params = new URLSearchParams({
        category: cat,
        sort: s,
        search: search.trim(),
      });
      if (forceFresh) {
        params.set('fresh', 'true');
      }
      const res = await fetch(`/api/fanqie/ranking/danmei-vohan?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không thể tải BXH');
      }
      setBooks(data.books || []);
      if (data.lastUpdated) {
        setLastUpdated(data.lastUpdated);
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi tải danh sách BXH');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRanking(category, sort, searchTerm);
  }, [category, sort]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRanking(category, sort, searchTerm, true);
  };

  const handleOpenCatalog = async (book: BookItem) => {
    setActiveCatalogBook(book);
    setIsCatalogOpen(true);
    setIsLoadingCatalog(true);
    setCatalogList([]);
    setCatalogSearch('');
    try {
      const res = await fetch(`/api/fanqie/catalog?bookId=${book.book_id}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setCatalogList(data.catalog?.chapter_list || []);
      }
    } catch (e) {
      console.error('Failed to load catalog', e);
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const filteredCatalog = catalogList.filter((ch) => {
    if (!catalogSearch.trim()) return true;
    return ch.title?.toLowerCase().includes(catalogSearch.toLowerCase());
  });

  const categories = [
    { id: 'all', label: 'Tất cả Đam mỹ', icon: Layers },
    { id: 'vohan', label: 'Vô Hạn Lưu', icon: Compass },
    { id: 'escape', label: 'Trốn Thoát / Sinh Tồn', icon: Skull },
    { id: 'rules', label: 'Quy Tắc Quái Đàm', icon: Scroll },
    { id: 'khoaixuyen', label: 'Khoái Xuyên / Trọng Sinh', icon: Shuffle },
    { id: 'cuongcuong', label: 'Cường Cường / Sảng Văn', icon: Swords },
    { id: 'matthe', label: 'Mạt Thế / Dị Năng', icon: Biohazard },
    { id: 'dothi', label: 'Đô Thị / Hào Môn', icon: Building2 },
    { id: 'cotrang', label: 'Cổ Trang / Tiên Hiệp', icon: Crown },
    { id: 'vongdu', label: 'Võng Du / E-Sports', icon: Gamepad2 },
  ];

  return (
    <div className="space-y-3.5">
      {/* Top Header & Search */}
      <div className="bg-white/95 border border-pink-200/80 rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-xl bg-pink-500 text-white flex items-center justify-center shadow-2xs shrink-0">
              <Trophy className="w-4 h-4 text-amber-200" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-pink-950">
                BXH Đam mỹ
              </h2>
            </div>
          </div>

          <form onSubmit={handleSearchSubmit} className="relative sm:w-64">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm tên truyện, tác giả..."
              className="w-full bg-pink-50/50 border border-pink-200/80 rounded-xl pl-3 pr-8 py-1.5 text-xs text-pink-950 placeholder-pink-300 focus:outline-none focus:border-pink-400"
            />
            <button
              type="submit"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-pink-400 hover:text-pink-600 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((c) => {
            const Icon = c.icon;
            const isActive = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id as DanmeiCategory)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-pink-500 text-white shadow-2xs font-bold'
                    : 'bg-pink-50/60 hover:bg-pink-100/70 text-pink-800 border border-pink-200/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>

        {/* Sort Options */}
        <div className="flex items-center gap-1 overflow-x-auto pt-2 border-t border-pink-100 scrollbar-none text-[11px]">
          <span className="font-semibold text-pink-400 mr-1 flex items-center gap-1">
            <SlidersHorizontal className="w-3 h-3" />
            <span>Sắp xếp:</span>
          </span>

          <button
            type="button"
            onClick={() => setSort('score')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
              sort === 'score'
                ? 'bg-pink-100 text-pink-900 border border-pink-300'
                : 'text-pink-600 hover:bg-pink-50'
            }`}
          >
            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
            <span>Điểm cao</span>
          </button>

          <button
            type="button"
            onClick={() => setSort('hot')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
              sort === 'hot'
                ? 'bg-pink-100 text-pink-900 border border-pink-300'
                : 'text-pink-600 hover:bg-pink-50'
            }`}
          >
            <Flame className="w-3 h-3 text-rose-500" />
            <span>Hot nhất</span>
          </button>

          {/* Mới nhất */}
          <button
            type="button"
            onClick={() => setSort('newest')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
              sort === 'newest'
                ? 'bg-pink-100 text-pink-900 border border-pink-300'
                : 'text-pink-600 hover:bg-pink-50'
            }`}
            title="Truyện mới xuất bản gần đây"
          >
            <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
            <span>Mới nhất</span>
          </button>

          {/* Mới cập nhật */}
          <button
            type="button"
            onClick={() => setSort('updated')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
              sort === 'updated'
                ? 'bg-pink-100 text-pink-900 border border-pink-300'
                : 'text-pink-600 hover:bg-pink-50'
            }`}
            title="Truyện vừa ra chương mới nhất"
          >
            <History className="w-3 h-3 text-violet-500" />
            <span>Mới cập nhật</span>
          </button>

          <button
            type="button"
            onClick={() => setSort('ongoing')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
              sort === 'ongoing'
                ? 'bg-pink-100 text-pink-900 border border-pink-300'
                : 'text-pink-600 hover:bg-pink-50'
            }`}
          >
            <Clock className="w-3 h-3 text-blue-500" />
            <span>Đang ra</span>
          </button>

          <button
            type="button"
            onClick={() => setSort('completed')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
              sort === 'completed'
                ? 'bg-pink-100 text-pink-900 border border-pink-300'
                : 'text-pink-600 hover:bg-pink-50'
            }`}
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Hoàn thành</span>
          </button>

          <button
            type="button"
            onClick={() => setSort('chapters')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
              sort === 'chapters'
                ? 'bg-pink-100 text-pink-900 border border-pink-300'
                : 'text-pink-600 hover:bg-pink-50'
            }`}
          >
            <BookOpen className="w-3 h-3 text-pink-600" />
            <span>Nhiều chương</span>
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="bg-white/90 border border-pink-200/80 rounded-2xl p-8 text-center space-y-2">
          <RefreshCw className="w-5 h-5 animate-spin text-pink-500 mx-auto" />
          <p className="text-xs font-semibold text-pink-700">Đang tải danh sách truyện...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-center text-xs text-rose-700 space-y-1.5">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => fetchRanking(category, sort, searchTerm, true)}
            className="px-3 py-1 bg-rose-500 text-white rounded-lg text-xs font-bold"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Books List */}
      {!isLoading && (
        <div className="bg-white/95 border border-pink-200/80 rounded-2xl p-3 sm:p-4 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-pink-950">
            <div className="flex items-center gap-2">
              <span>Danh sách ({books.length} truyện)</span>
              {lastUpdated && (
                <span className="text-[10px] text-slate-400 font-normal">
                  (Cập nhật lúc {lastUpdated})
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fetchRanking(category, sort, searchTerm, true)}
              disabled={isLoading}
              className="text-[11px] font-semibold text-pink-500 hover:text-pink-700 flex items-center gap-1 cursor-pointer transition-colors"
              title="Lấy dữ liệu mới nhất từ Fanqie"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Làm mới danh sách</span>
            </button>
          </div>

          <div className="divide-y divide-pink-100">
            {books.slice(0, displayCount).map((book, idx) => {
              const rank = idx + 1;
              const isTop3 = rank <= 3;
              const rankBadgeColor =
                rank === 1
                  ? 'bg-amber-400 text-amber-950 font-black'
                  : rank === 2
                  ? 'bg-slate-300 text-slate-800 font-extrabold'
                  : rank === 3
                  ? 'bg-amber-200 text-amber-900 font-extrabold'
                  : 'bg-pink-100 text-pink-700 font-bold';

              return (
                <div
                  key={book.book_id}
                  className="py-3 first:pt-1 last:pb-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group hover:bg-pink-50/40 p-2 rounded-xl transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Rank Badge */}
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs shrink-0 mt-0.5 shadow-2xs ${rankBadgeColor}`}
                    >
                      {rank}
                    </div>

                    {/* Book Cover */}
                    <BookCover
                      src={book.thumb_url}
                      bookId={book.book_id}
                      alt={book.book_name}
                      title={book.book_name}
                      author={book.author}
                      category={category}
                      widthClass="w-13"
                      heightClass="h-17"
                    />

                    {/* Book Info */}
                    <div className="min-w-0 space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xs sm:text-sm font-bold text-pink-950 group-hover:text-pink-600 transition-colors truncate">
                          {book.book_name}
                        </h3>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/70">
                          {book.creation_status}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-pink-800 flex-wrap">
                        <span>Tác giả: <strong>{book.author}</strong></span>
                        <span>•</span>
                        <span className="text-amber-600 font-bold flex items-center gap-0.5">
                          ★ {book.score || '9.0'}
                        </span>
                        <span>•</span>
                        <span className="text-pink-600 font-semibold">{book.chapter_count} chương</span>
                      </div>

                      {book.last_chapter_title && (
                        <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1 truncate">
                          <span className="text-violet-600 font-semibold shrink-0">Chương mới:</span>
                          <span className="truncate">{book.last_chapter_title}</span>
                        </div>
                      )}

                      <p className="text-[11px] text-pink-900/70 line-clamp-1 leading-relaxed">
                        {book.abstract || 'Không có mô tả'}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenCatalog(book)}
                      className="p-1.5 rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200/80 text-xs transition-colors cursor-pointer"
                      title="Xem mục lục"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectBookForDownload(book.book_id)}
                      className="px-2.5 py-1.5 bg-pink-50 hover:bg-pink-100 text-pink-700 rounded-lg text-xs font-bold border border-pink-200/70 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Chuyển sang công cụ tải raw"
                    >
                      <Download className="w-3.5 h-3.5 text-pink-500" />
                      <span>Tải raw</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOneClickSplit(book.book_id, book.book_name)}
                      className="px-3 py-1.5 bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer transform active:scale-95"
                      title="Tải toàn bộ raw và thêm vào ô nhập liệu để bạn tự cài đặt chia chương"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Thêm raw</span>
                    </button>

                    <a
                      href={`https://fanqienovel.com/page/${book.book_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg text-pink-400 hover:text-pink-600 hover:bg-pink-50 transition-colors"
                      title="Mở Fanqie"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination / Load more */}
          {books.length > displayCount && (
            <div className="pt-3 pb-1 border-t border-pink-100 flex flex-col sm:flex-row items-center justify-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDisplayCount((prev) => Math.min(prev + 30, books.length))}
                className="w-full sm:w-auto px-5 py-2 rounded-xl bg-pink-50 hover:bg-pink-100 text-pink-700 font-bold border border-pink-200/80 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              >
                <ChevronDown className="w-4 h-4" />
                <span>Xem thêm 30 truyện (Đang hiện {Math.min(displayCount, books.length)}/{books.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setDisplayCount(books.length)}
                className="text-pink-500 hover:text-pink-700 font-semibold underline cursor-pointer px-2 py-1"
              >
                Xem tất cả {books.length} truyện
              </button>
            </div>
          )}
        </div>
      )}

      {/* Catalog Modal */}
      {isCatalogOpen && activeCatalogBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-white w-full max-w-xl max-h-[80vh] rounded-2xl border border-pink-200 shadow-xl flex flex-col overflow-hidden animate-in fade-in duration-100">
            <div className="p-3.5 border-b border-pink-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-pink-950">
                  {activeCatalogBook.book_name}
                </h3>
                <p className="text-[11px] text-pink-500">
                  {activeCatalogBook.author} • {catalogList.length} chương
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCatalogOpen(false)}
                className="p-1 rounded-lg hover:bg-pink-50 text-pink-400 hover:text-pink-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-2.5 border-b border-pink-100/60 bg-pink-50/20">
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Tìm chương..."
                className="w-full bg-white border border-pink-200 rounded-lg px-2.5 py-1.5 text-xs text-pink-950 placeholder-pink-300 focus:outline-none focus:border-pink-400"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
              {isLoadingCatalog ? (
                <div className="flex items-center justify-center h-28 text-pink-400 text-xs">
                  <RefreshCw className="w-4 h-4 animate-spin mr-1.5" />
                  <span>Đang tải mục lục...</span>
                </div>
              ) : (
                filteredCatalog.map((ch: any, idx: number) => (
                  <div
                    key={ch.item_id || idx}
                    className="flex items-center justify-between p-1.5 rounded-lg hover:bg-pink-50/60 text-xs"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-7 text-[10px] text-pink-400 font-mono text-right">
                        {idx + 1}.
                      </span>
                      <span className="font-medium text-pink-950 truncate">{ch.title}</span>
                    </div>
                    {ch.char_count > 0 && (
                      <span className="text-[10px] text-pink-400 shrink-0">{ch.char_count} chữ</span>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-2.5 border-t border-pink-100 flex items-center justify-between bg-pink-50/20">
              <span className="text-[11px] text-pink-500">
                {filteredCatalog.length} / {catalogList.length} chương
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCatalogOpen(false);
                    onOneClickSplit(activeCatalogBook.book_id, activeCatalogBook.book_name);
                  }}
                  className="px-3 py-1.5 bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                  title="Tải toàn bộ raw và thêm vào ô nhập liệu để bạn tự điều chỉnh cấu hình"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Thêm raw vào Ping</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCatalogOpen(false)}
                  className="px-3 py-1.5 bg-white border border-pink-200 hover:bg-pink-50 text-pink-800 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
