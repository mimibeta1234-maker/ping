import React, { useState, useEffect, useRef } from 'react';
import { BookCover } from './BookCover';
import {
  Download,
  Search,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileText,
  Archive,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronRight,
  List,
  RefreshCw,
  Scissors,
  Copy,
  Check,
  Eye,
  Info,
  Sliders,
  FolderDown,
  Hash,
} from 'lucide-react';

interface FanqieBookSummary {
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

interface FanqieDownloaderProps {
  onTransferToSplitter: (rawText: string, novelTitle: string) => void;
  initialBookId?: string | null;
}

export const FanqieDownloader: React.FC<FanqieDownloaderProps> = ({
  onTransferToSplitter,
  initialBookId,
}) => {
  // Input & search state
  const [inputVal, setInputVal] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<FanqieBookSummary[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Active book state
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [isLoadingBook, setIsLoadingBook] = useState<boolean>(false);
  const [bookInfo, setBookInfo] = useState<any | null>(null);
  const [catalog, setCatalog] = useState<any | null>(null);

  // Auto-load if initialBookId is provided
  useEffect(() => {
    if (initialBookId) {
      setInputVal(initialBookId);
      loadBookDetails(initialBookId);
    }
  }, [initialBookId]);

  // Catalog modal
  const [isCatalogOpen, setIsCatalogOpen] = useState<boolean>(false);
  const [catalogSearch, setCatalogSearch] = useState<string>('');

  // Download configuration
  const [downloadMode, setDownloadMode] = useState<'all' | 'range' | 'multi'>('all');
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(100);
  const [batchSize, setBatchSize] = useState<number>(50); // For multiple ranges (e.g. 50 chapters per file)
  const [includeIntro, setIncludeIntro] = useState<boolean>(true);
  const [stripAuthorNotes, setStripAuthorNotes] = useState<boolean>(true);

  // Task & progress state
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<any | null>(null);
  const [isStartingDownload, setIsStartingDownload] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // Preview modal
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [previewText, setPreviewText] = useState<string>('');
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);

  // Polling ref for task progress
  const pollTimerRef = useRef<any>(null);
  const autoTransferRef = useRef<boolean>(false);

  // Poll download progress
  useEffect(() => {
    if (!taskId) return;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/fanqie/download/status/${taskId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success) {
          setTaskStatus(data);
          if (data.status === 'completed' || data.status === 'error' || data.status === 'cancelled') {
            clearInterval(pollTimerRef.current);
            if (data.status === 'completed' && autoTransferRef.current) {
              autoTransferRef.current = false;
              fetch(`/api/fanqie/download/get-raw-text/${taskId}`)
                .then((r) => r.json())
                .then((rawData) => {
                  if (rawData.success && rawData.rawText) {
                    const title = rawData.title || bookInfo?.title || bookInfo?.book_name || 'Truyen_Fanqie';
                    onTransferToSplitter(rawData.rawText, title);
                  }
                })
                .catch((e) => console.error('Auto transfer error:', e));
            }
          }
        }
      } catch (err) {
        console.error('Failed to poll status', err);
      }
    };

    checkStatus();
    pollTimerRef.current = setInterval(checkStatus, 700);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [taskId]);

  // Handle Search or Load Book
  const handleSearchOrLoad = async (overrideInput?: string) => {
    const raw = (overrideInput !== undefined ? overrideInput : inputVal).trim();
    if (!raw) return;

    setSearchError(null);
    setSearchResults([]);

    // Check if input contains pure digits or fanqienovel URL
    const digitsMatch = raw.match(/(\d{15,22})/);
    if (digitsMatch) {
      const bookId = digitsMatch[1];
      loadBookDetails(bookId);
      return;
    }

    // Otherwise, perform search by keyword/title
    setIsSearching(true);
    try {
      const res = await fetch(`/api/fanqie/search?query=${encodeURIComponent(raw)}&count=12`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không tìm thấy truyện');
      }
      setSearchResults(data.books || []);
      if (!data.books || data.books.length === 0) {
        setSearchError('Không tìm thấy truyện phù hợp với từ khóa này. Bạn có thể thử dán link hoặc ID truyện từ fanqienovel.com.');
      }
    } catch (err: any) {
      setSearchError(err.message || 'Lỗi tìm kiếm truyện Fanqie');
    } finally {
      setIsSearching(false);
    }
  };

  // Load Book Details & Catalog
  const loadBookDetails = async (bookId: string) => {
    setIsLoadingBook(true);
    setActiveBookId(bookId);
    setSearchError(null);
    setBookInfo(null);
    setCatalog(null);
    setTaskId(null);
    setTaskStatus(null);

    try {
      // 1. Fetch book info
      const infoRes = await fetch(`/api/fanqie/book-info?bookId=${bookId}`);
      const infoData = await infoRes.json();
      if (!infoRes.ok || !infoData.success) {
        throw new Error(infoData.error || 'Không thể lấy thông tin truyện');
      }
      setBookInfo(infoData.bookInfo);

      // 2. Fetch catalog
      const catRes = await fetch(`/api/fanqie/catalog?bookId=${bookId}`);
      const catData = await catRes.json();
      if (catRes.ok && catData.success) {
        setCatalog(catData.catalog);
        const total = catData.catalog?.chapter_list?.length || 0;
        setRangeStart(1);
        setRangeEnd(total || 1);
      }
    } catch (err: any) {
      setSearchError(err.message || 'Không thể tải thông tin truyện');
      setActiveBookId(null);
    } finally {
      setIsLoadingBook(false);
    }
  };

  // Compute calculated ranges based on mode
  const computedRanges = () => {
    const totalChapters = catalog?.chapter_list?.length || bookInfo?.chapter_count || 1;

    if (downloadMode === 'all') {
      return [{ start: 1, end: totalChapters, label: `Toàn bộ (Chương 1 - ${totalChapters})` }];
    }

    if (downloadMode === 'range') {
      const s = Math.max(1, Math.min(rangeStart, totalChapters));
      const e = Math.max(s, Math.min(rangeEnd, totalChapters));
      return [{ start: s, end: e, label: `Chương ${s} - ${e}` }];
    }

    if (downloadMode === 'multi') {
      const size = Math.max(5, batchSize || 50);
      const ranges = [];
      for (let i = 1; i <= totalChapters; i += size) {
        const e = Math.min(i + size - 1, totalChapters);
        ranges.push({
          start: i,
          end: e,
          label: `Chương ${i} - ${e}`
        });
      }
      return ranges;
    }

    return [{ start: 1, end: totalChapters, label: `Toàn bộ (1 - ${totalChapters})` }];
  };

  // Start Download
  const handleStartDownload = async (shouldAutoTransfer = false) => {
    if (!activeBookId || !bookInfo) return;

    autoTransferRef.current = shouldAutoTransfer;
    setIsStartingDownload(true);
    setSearchError(null);

    try {
      const ranges = computedRanges();
      const res = await fetch('/api/fanqie/download/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: activeBookId,
          bookInfo,
          catalog,
          ranges,
          includeIntro,
          stripAuthorNotes,
          provider: 'fanqie'
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không thể khởi động tác vụ tải');
      }

      setTaskId(data.taskId);
    } catch (err: any) {
      setSearchError(err.message || 'Lỗi bắt đầu tải');
    } finally {
      setIsStartingDownload(false);
    }
  };

  // Cancel Download
  const handleCancelDownload = async () => {
    if (!taskId) return;
    try {
      await fetch(`/api/fanqie/download/cancel/${taskId}`, { method: 'POST' });
    } catch (err) {
      console.error(err);
    }
  };

  // Transfer raw text directly to Ping's Chapter Splitter
  const handleSendToPingSplitter = async () => {
    if (!taskId) return;
    try {
      const res = await fetch(`/api/fanqie/download/get-raw-text/${taskId}`);
      const data = await res.json();
      if (res.ok && data.success && data.rawText) {
        const title = data.title || bookInfo?.title || bookInfo?.book_name || 'Truyen_Fanqie';
        onTransferToSplitter(data.rawText, title);
      }
    } catch (err) {
      console.error('Failed to get raw text for splitter', err);
    }
  };

  // Open Preview
  const handleOpenPreview = async () => {
    if (!taskId) return;
    setIsLoadingPreview(true);
    setIsPreviewOpen(true);
    try {
      const res = await fetch(`/api/fanqie/download/get-raw-text/${taskId}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setPreviewText(data.rawText || 'Không có nội dung');
      } else {
        setPreviewText('Chưa tải được nội dung xem trước');
      }
    } catch (e: any) {
      setPreviewText('Lỗi tải nội dung xem trước: ' + e.message);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleCopyPreview = () => {
    navigator.clipboard.writeText(previewText);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Filtered catalog
  const filteredCatalog = (catalog?.chapter_list || []).filter((ch: any) => {
    if (!catalogSearch.trim()) return true;
    const q = catalogSearch.toLowerCase();
    return ch.title?.toLowerCase().includes(q) || String(ch.item_id).includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Search & Input Box */}
      <div className="bg-white/90 border border-pink-200/80 rounded-3xl p-4 sm:p-5 shadow-sm shadow-pink-100/50 backdrop-blur-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-xl bg-pink-500 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
              番
            </div>
            <div>
              <h2 className="text-sm font-bold text-pink-950">
                Tải Raw Truyện Fanqie (番茄小说)
              </h2>
              <p className="text-[11px] text-pink-500">
                Nhập ID truyện (VD: 7069948840148732967), link web/app hoặc tên truyện tiếng Trung
              </p>
            </div>
          </div>
        </div>

        {/* Input input bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchOrLoad()}
              placeholder="Dán link fanqienovel.com/page/... hoặc nhập ID truyện hoặc tên truyện..."
              className="w-full bg-pink-50/40 border border-pink-200/90 rounded-2xl pl-3.5 pr-10 py-2.5 text-xs sm:text-sm text-pink-950 placeholder-pink-300 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all font-medium"
            />
            {inputVal && (
              <button
                type="button"
                onClick={() => setInputVal('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-pink-400 hover:text-pink-600 text-xs cursor-pointer p-1"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleSearchOrLoad()}
            disabled={isSearching || isLoadingBook || !inputVal.trim()}
            className="px-4 py-2.5 bg-pink-500 hover:bg-pink-600 text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm shadow-pink-200 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {isSearching || isLoadingBook ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span>Tìm & Lấy truyện</span>
          </button>
        </div>

        {/* Error message */}
        {searchError && (
          <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-2xl flex items-start gap-2 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1">{searchError}</div>
          </div>
        )}
      </div>

      {/* Search results list (if searching by name/keyword) */}
      {searchResults.length > 0 && (
        <div className="bg-white/90 border border-pink-200/80 rounded-3xl p-4 sm:p-5 shadow-sm shadow-pink-100/50 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-pink-900 uppercase tracking-wider flex items-center gap-1.5">
              <span>Kết quả tìm kiếm ({searchResults.length} truyện)</span>
            </h3>
            <span className="text-[11px] text-pink-400">Bấm "Chọn truyện" để mở mục lục & tải raw</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {searchResults.map((book) => (
              <div
                key={book.book_id}
                className="flex items-start gap-3 p-3 rounded-2xl border border-pink-100 bg-pink-50/20 hover:bg-pink-50/60 transition-all group"
              >
                <BookCover
                  src={book.thumb_url}
                  bookId={book.book_id}
                  alt={book.book_name}
                  title={book.book_name}
                  author={book.author}
                  category={book.category}
                  widthClass="w-16"
                  heightClass="h-22"
                />

                <div className="flex-1 min-w-0 space-y-1">
                  <h4 className="text-xs sm:text-sm font-bold text-pink-950 truncate group-hover:text-pink-600 transition-colors">
                    {book.book_name}
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] text-pink-700 flex-wrap">
                    <span className="font-semibold">{book.author}</span>
                    <span>•</span>
                    <span className="text-pink-500">{book.category}</span>
                    <span>•</span>
                    <span className="font-bold text-pink-600">{book.chapter_count || '?'} chương</span>
                  </div>

                  <p className="text-[11px] text-pink-400 line-clamp-2 leading-relaxed">
                    {book.abstract || 'Không có mô tả'}
                  </p>

                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-[10px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                      {book.creation_status}
                    </span>

                    <button
                      type="button"
                      onClick={() => loadBookDetails(book.book_id)}
                      className="px-3 py-1 bg-pink-500 hover:bg-pink-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                    >
                      <span>Chọn truyện</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Book Details & Downloader Controls */}
      {bookInfo && (
        <div className="bg-white/95 border border-pink-200/90 rounded-3xl p-4 sm:p-5 shadow-sm shadow-pink-100/50 space-y-4">
          {/* Novel Info Banner */}
          <div className="flex flex-col sm:flex-row items-start gap-4 pb-4 border-b border-pink-100">
            <div className="relative group shrink-0 mx-auto sm:mx-0">
              <BookCover
                src={bookInfo.cover_url}
                bookId={activeBookId || bookInfo.book_id}
                alt={bookInfo.title}
                title={bookInfo.title}
                author={bookInfo.author}
                category={bookInfo.category}
                widthClass="w-24 sm:w-28"
                heightClass="h-32 sm:h-38"
              />
              {bookInfo.cover_url && (
                <a
                  href={`/api/fanqie/cover?url=${encodeURIComponent(bookInfo.cover_url)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-lg text-[10px] flex items-center gap-1 backdrop-blur-xs transition-colors z-20"
                  title="Xem ảnh bìa gốc HD"
                >
                  <Eye className="w-3 h-3" />
                  <span>HD</span>
                </a>
              )}
            </div>

            <div className="flex-1 space-y-2 text-center sm:text-left min-w-0 w-full">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h3 className="text-base sm:text-lg font-bold text-pink-950">
                  {bookInfo.title}
                </h3>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-pink-100 text-pink-700 border border-pink-200">
                  ID: {bookInfo.book_id}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {bookInfo.status || 'Đang ra'}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1 text-xs text-pink-800 font-medium">
                <div>
                  <span className="text-pink-500">Tác giả: </span>
                  <span className="font-bold text-pink-900">{bookInfo.author}</span>
                </div>
                <div>
                  <span className="text-pink-500">Tổng chương: </span>
                  <span className="font-bold text-pink-900">
                    {catalog?.chapter_list?.length || bookInfo.chapter_count} chương
                  </span>
                </div>
                <div>
                  <span className="text-pink-500">Điểm: </span>
                  <span className="font-bold text-amber-600">★ {bookInfo.score || '9.0'}</span>
                </div>
              </div>

              {bookInfo.tags && (
                <div className="flex items-center justify-center sm:justify-start gap-1 flex-wrap pt-0.5">
                  <span className="text-[10px] text-pink-400 font-medium">Thể loại:</span>
                  {bookInfo.tags.split(/[,，、/]/).slice(0, 6).map((tag: string, idx: number) => (
                    <span
                      key={idx}
                      className="text-[10px] px-2 py-0.5 bg-pink-50 text-pink-700 rounded-md border border-pink-200/60 font-medium"
                    >
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              )}

              {bookInfo.summary && (
                <div className="text-[11px] text-pink-900/80 bg-pink-50/40 p-2.5 rounded-xl border border-pink-100/70 max-h-24 overflow-y-auto leading-relaxed text-left">
                  <p className="whitespace-pre-line">{bookInfo.summary}</p>
                </div>
              )}

              {/* View Catalog Button */}
              {catalog && (
                <div className="pt-1 flex items-center justify-center sm:justify-start gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCatalogOpen(true)}
                    className="flex items-center gap-1.5 text-xs text-pink-600 hover:text-pink-800 font-bold px-3 py-1 rounded-xl bg-pink-50 hover:bg-pink-100 border border-pink-200/80 transition-colors cursor-pointer"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>Xem mục lục ({catalog.chapter_list?.length || 0} chương)</span>
                  </button>
                  <a
                    href={`https://fanqienovel.com/page/${bookInfo.book_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[11px] text-pink-400 hover:text-pink-600 transition-colors"
                  >
                    <span>Trang gốc</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Download Options */}
          <div className="space-y-3 pt-1">
            <h4 className="text-xs font-bold text-pink-950 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-pink-500" />
              <span>Cấu hình tải chương</span>
            </h4>

            {/* Mode selection */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label
                className={`flex items-start gap-2 p-3 rounded-2xl border cursor-pointer transition-all ${
                  downloadMode === 'all'
                    ? 'border-pink-400 bg-pink-50/80 ring-2 ring-pink-200'
                    : 'border-pink-200/70 bg-white hover:bg-pink-50/40'
                }`}
              >
                <input
                  type="radio"
                  name="downloadMode"
                  checked={downloadMode === 'all'}
                  onChange={() => setDownloadMode('all')}
                  className="mt-0.5 text-pink-500 focus:ring-pink-300 accent-pink-500 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-bold text-pink-950">Tải toàn bộ</div>
                  <div className="text-[11px] text-pink-600 font-medium">
                    Tất cả {catalog?.chapter_list?.length || bookInfo.chapter_count} chương
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-2 p-3 rounded-2xl border cursor-pointer transition-all ${
                  downloadMode === 'range'
                    ? 'border-pink-400 bg-pink-50/80 ring-2 ring-pink-200'
                    : 'border-pink-200/70 bg-white hover:bg-pink-50/40'
                }`}
              >
                <input
                  type="radio"
                  name="downloadMode"
                  checked={downloadMode === 'range'}
                  onChange={() => setDownloadMode('range')}
                  className="mt-0.5 text-pink-500 focus:ring-pink-300 accent-pink-500 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-bold text-pink-950">Theo một khoảng</div>
                  <div className="text-[11px] text-pink-600 font-medium">Từ chương A đến B</div>
                </div>
              </label>

              <label
                className={`flex items-start gap-2 p-3 rounded-2xl border cursor-pointer transition-all ${
                  downloadMode === 'multi'
                    ? 'border-pink-400 bg-pink-50/80 ring-2 ring-pink-200'
                    : 'border-pink-200/70 bg-white hover:bg-pink-50/40'
                }`}
              >
                <input
                  type="radio"
                  name="downloadMode"
                  checked={downloadMode === 'multi'}
                  onChange={() => setDownloadMode('multi')}
                  className="mt-0.5 text-pink-500 focus:ring-pink-300 accent-pink-500 cursor-pointer"
                />
                <div>
                  <div className="text-xs font-bold text-pink-950">Chia nhiều file ZIP</div>
                  <div className="text-[11px] text-pink-600 font-medium">Tách mỗi file {batchSize} chương</div>
                </div>
              </label>
            </div>

            {/* Sub-options for single range */}
            {downloadMode === 'range' && (
              <div className="p-3 bg-pink-50/50 border border-pink-200/70 rounded-2xl flex items-center gap-3 text-xs flex-wrap animate-in fade-in duration-150">
                <span className="font-semibold text-pink-900">Chọn khoảng tải:</span>
                <div className="flex items-center gap-2">
                  <span className="text-pink-600">Từ chương:</span>
                  <input
                    type="number"
                    min={1}
                    max={catalog?.chapter_list?.length || bookInfo.chapter_count || 1000}
                    value={rangeStart}
                    onChange={(e) => setRangeStart(parseInt(e.target.value, 10) || 1)}
                    className="w-18 bg-white border border-pink-200 rounded-xl px-2 py-1 text-center font-bold text-pink-900 focus:outline-none focus:border-pink-400"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-pink-600">Đến chương:</span>
                  <input
                    type="number"
                    min={rangeStart}
                    max={catalog?.chapter_list?.length || bookInfo.chapter_count || 1000}
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(parseInt(e.target.value, 10) || rangeStart)}
                    className="w-18 bg-white border border-pink-200 rounded-xl px-2 py-1 text-center font-bold text-pink-900 focus:outline-none focus:border-pink-400"
                  />
                </div>
                <span className="text-[11px] text-pink-500 font-medium">
                  (Tổng cộng: {Math.max(0, rangeEnd - rangeStart + 1)} chương)
                </span>
              </div>
            )}

            {/* Sub-options for multi range */}
            {downloadMode === 'multi' && (
              <div className="p-3 bg-pink-50/50 border border-pink-200/70 rounded-2xl flex items-center gap-3 text-xs flex-wrap animate-in fade-in duration-150">
                <span className="font-semibold text-pink-900">Mỗi file chứa:</span>
                <select
                  value={batchSize}
                  onChange={(e) => setBatchSize(parseInt(e.target.value, 10))}
                  className="bg-white border border-pink-200 rounded-xl px-3 py-1 font-bold text-pink-900 focus:outline-none focus:border-pink-400 cursor-pointer"
                >
                  <option value={20}>20 chương / file</option>
                  <option value={50}>50 chương / file</option>
                  <option value={100}>100 chương / file</option>
                  <option value={200}>200 chương / file</option>
                </select>
                <span className="text-[11px] text-pink-500 font-medium">
                  Sẽ xuất thành file ZIP chứa các tệp txt theo từng khoảng và 1 tệp gộp tổng.
                </span>
              </div>
            )}

            {/* Toggles: Include intro & Strip author notes */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-pink-900 select-none">
                <input
                  type="checkbox"
                  checked={includeIntro}
                  onChange={(e) => setIncludeIntro(e.target.checked)}
                  className="w-4 h-4 rounded text-pink-500 focus:ring-pink-300 border-pink-300 accent-pink-500 cursor-pointer"
                />
                <span>Kèm tên truyện, tác giả, tag và phần giới thiệu ở đầu file</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-medium text-pink-900 select-none bg-pink-100/50 hover:bg-pink-100/80 px-2.5 py-1 rounded-xl border border-pink-200/60 transition-colors">
                <input
                  type="checkbox"
                  checked={stripAuthorNotes}
                  onChange={(e) => setStripAuthorNotes(e.target.checked)}
                  className="w-4 h-4 rounded text-pink-500 focus:ring-pink-300 border-pink-300 accent-pink-500 cursor-pointer"
                />
                <span className="font-semibold text-pink-950">Tự động bỏ lời tác giả (作话 / 题外话)</span>
              </label>
            </div>

            {/* Download Execution Buttons */}
            {!taskId && (
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleStartDownload(true)}
                  disabled={isStartingDownload}
                  className="flex-1 w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-md shadow-pink-200 transition-all cursor-pointer transform active:scale-[0.99] disabled:opacity-50"
                  title="Tải xong tự động thêm thẳng raw vào ô nhập liệu để bạn tự điều chỉnh cấu hình và chia chương"
                >
                  {isStartingDownload ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                  <span>Thêm raw vào Ping (Không cần tải file)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleStartDownload(false)}
                  disabled={isStartingDownload}
                  className="w-full sm:w-auto px-4 py-3 bg-pink-50 hover:bg-pink-100 text-pink-700 font-bold border border-pink-200/80 rounded-2xl text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  title="Tải và xuất file lưu về máy tính"
                >
                  <Download className="w-4 h-4 text-pink-500" />
                  <span>Chỉ tải file về máy</span>
                </button>
              </div>
            )}
          </div>

          {/* Download Progress & Realtime Status */}
          {taskStatus && (
            <div className="bg-pink-50/60 border border-pink-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {taskStatus.status === 'downloading' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-pulse" />
                  )}
                  {taskStatus.status === 'completed' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 font-bold" />
                  )}
                  {taskStatus.status === 'error' && (
                    <XCircle className="w-4 h-4 text-rose-500" />
                  )}
                  {taskStatus.status === 'cancelled' && (
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                  )}

                  <span className="text-xs font-bold text-pink-950">
                    {taskStatus.status === 'downloading' && 'Đang tải raw từ máy chủ Fanqie...'}
                    {taskStatus.status === 'completed' && 'Đã tải xong toàn bộ chương!'}
                    {taskStatus.status === 'error' && 'Có lỗi trong quá trình tải'}
                    {taskStatus.status === 'cancelled' && 'Đã hủy tải'}
                  </span>
                </div>

                <div className="text-xs font-bold text-pink-700">
                  {taskStatus.completedChapters} / {taskStatus.totalChapters} chương ({taskStatus.percent}%)
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-pink-200/60 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    taskStatus.status === 'completed'
                      ? 'bg-emerald-500'
                      : taskStatus.status === 'error'
                      ? 'bg-rose-500'
                      : 'bg-pink-500'
                  }`}
                  style={{ width: `${taskStatus.percent}%` }}
                />
              </div>

              {/* Live Info details */}
              <div className="flex items-center justify-between text-[11px] text-pink-700 flex-wrap gap-2">
                <div className="truncate max-w-[280px] sm:max-w-md">
                  <span className="text-pink-400">Đang xử lý: </span>
                  <span className="font-semibold text-pink-900">{taskStatus.currentChapterTitle || 'Đang kết nối...'}</span>
                </div>
                <div className="flex items-center gap-3">
                  {taskStatus.speed && (
                    <span>
                      Tốc độ: <strong className="text-pink-900">{taskStatus.speed}</strong>
                    </span>
                  )}
                  {taskStatus.failedChapters > 0 && (
                    <span className="text-rose-600 font-bold">
                      Lỗi: {taskStatus.failedChapters}
                    </span>
                  )}
                </div>
              </div>

              {/* Cancel button if running */}
              {taskStatus.status === 'downloading' && (
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={handleCancelDownload}
                    className="text-xs text-rose-500 hover:text-rose-700 font-semibold px-3 py-1 rounded-xl bg-white border border-rose-200 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    Hủy quá trình tải
                  </button>
                </div>
              )}

              {/* ACTION BUTTONS ON COMPLETION */}
              {taskStatus.status === 'completed' && (
                <div className="pt-2 border-t border-pink-200/80 space-y-2.5 animate-in fade-in duration-200">
                  {/* Highlight: Direct Transfer into Ping Splitter */}
                  <div className="bg-white p-3 rounded-2xl border border-pink-300 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="space-y-0.5 text-center sm:text-left">
                      <div className="text-xs font-bold text-pink-950 flex items-center justify-center sm:justify-start gap-1.5">
                        <Scissors className="w-3.5 h-3.5 text-pink-500" />
                        <span>Chuyển vào Bộ chia chương Ping</span>
                      </div>
                      <p className="text-[11px] text-pink-500">
                        Đưa ngay nội dung vừa tải vào công cụ chia chương, tự động đánh số và lọc tiêu đề
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleSendToPingSplitter}
                      className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer transform active:scale-95 shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Đưa vào bộ chia Ping</span>
                    </button>
                  </div>

                  {/* Export Options: TXT, ZIP, EPUB, PREVIEW */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={`/api/fanqie/download/export-txt/${taskId}`}
                      download
                      className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 py-2 px-3 bg-pink-100/80 hover:bg-pink-200 text-pink-900 border border-pink-300/80 rounded-xl text-xs font-bold transition-colors shadow-2xs"
                    >
                      <FileText className="w-3.5 h-3.5 text-pink-600" />
                      <span>Tải file .TXT</span>
                    </a>

                    <a
                      href={`/api/fanqie/download/export-zip/${taskId}`}
                      download
                      className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 py-2 px-3 bg-pink-100/80 hover:bg-pink-200 text-pink-900 border border-pink-300/80 rounded-xl text-xs font-bold transition-colors shadow-2xs"
                    >
                      <Archive className="w-3.5 h-3.5 text-pink-600" />
                      <span>Tải file .ZIP</span>
                    </a>

                    <a
                      href={`/api/fanqie/download/export-epub/${taskId}`}
                      download
                      className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 py-2 px-3 bg-pink-100/80 hover:bg-pink-200 text-pink-900 border border-pink-300/80 rounded-xl text-xs font-bold transition-colors shadow-2xs"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-pink-600" />
                      <span>Tải file .EPUB</span>
                    </a>

                    <button
                      type="button"
                      onClick={handleOpenPreview}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-pink-50 text-pink-800 border border-pink-300/80 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-pink-500" />
                      <span>Xem trước</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTaskId(null);
                        setTaskStatus(null);
                      }}
                      className="py-2 px-3 bg-white hover:bg-gray-50 text-gray-500 rounded-xl text-xs font-medium border border-gray-200 cursor-pointer"
                    >
                      Tải lại lượt khác
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CATALOG INSPECTOR MODAL */}
      {isCatalogOpen && catalog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-white w-full max-w-2xl max-h-[85vh] rounded-3xl border border-pink-200 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-pink-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-pink-950">
                  Mục lục: {bookInfo?.title}
                </h3>
                <p className="text-[11px] text-pink-500">
                  Tổng cộng {catalog.chapter_list?.length} chương
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsCatalogOpen(false)}
                className="p-1.5 rounded-full hover:bg-pink-50 text-pink-400 hover:text-pink-600 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Search chapter */}
            <div className="p-3 border-b border-pink-100/60 bg-pink-50/20">
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Tìm kiếm tên chương hoặc số thứ tự..."
                className="w-full bg-white border border-pink-200 rounded-xl px-3 py-1.5 text-xs text-pink-950 placeholder-pink-300 focus:outline-none focus:border-pink-400"
              />
            </div>

            {/* Chapter list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {filteredCatalog.map((ch: any, idx: number) => (
                <div
                  key={ch.item_id || idx}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-pink-50/60 text-xs border border-transparent hover:border-pink-100 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-8 text-[10px] text-pink-400 font-mono text-right">
                      {idx + 1}.
                    </span>
                    <span className="font-medium text-pink-950 truncate">{ch.title}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-[10px] text-pink-400">
                    {ch.char_count > 0 && <span>{ch.char_count} chữ</span>}
                    {ch.update_time && <span>{ch.update_time}</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-pink-100 flex items-center justify-end bg-pink-50/30">
              <button
                type="button"
                onClick={() => setIsCatalogOpen(false)}
                className="px-4 py-1.5 bg-pink-500 hover:bg-pink-600 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RAW TEXT PREVIEW MODAL */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-white w-full max-w-3xl max-h-[85vh] rounded-3xl border border-pink-200 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 border-b border-pink-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-pink-950 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-pink-500" />
                  <span>Xem trước nội dung Raw Fanqie</span>
                </h3>
                <p className="text-[11px] text-pink-500">
                  {bookInfo?.title} • {taskStatus?.completedChapters} chương đã tải
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyPreview}
                  className="flex items-center gap-1 px-3 py-1 bg-pink-50 hover:bg-pink-100 text-pink-800 border border-pink-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  {copySuccess ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-pink-500" />}
                  <span>{copySuccess ? 'Đã sao chép' : 'Sao chép'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="p-1.5 rounded-full hover:bg-pink-50 text-pink-400 hover:text-pink-600 transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content body */}
            <div className="flex-1 p-4 overflow-y-auto bg-pink-50/20 font-sans text-xs sm:text-sm text-pink-950 leading-relaxed whitespace-pre-wrap selection:bg-pink-200">
              {isLoadingPreview ? (
                <div className="flex items-center justify-center h-48 text-pink-400">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  <span>Đang tải nội dung...</span>
                </div>
              ) : (
                previewText
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-pink-100 flex items-center justify-between bg-pink-50/30">
              <span className="text-[11px] text-pink-500">
                {previewText.length.toLocaleString()} ký tự
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPreviewOpen(false);
                    handleSendToPingSplitter();
                  }}
                  className="px-4 py-1.5 bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>Đưa vào bộ chia Ping</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="px-3 py-1.5 bg-white border border-pink-200 hover:bg-pink-50 text-pink-800 rounded-xl text-xs font-semibold cursor-pointer"
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
