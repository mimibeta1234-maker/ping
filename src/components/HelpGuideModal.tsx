import React from 'react';
import { X, CheckCircle2, Split, ArrowRight, Lightbulb, ShieldCheck } from 'lucide-react';

interface HelpGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpGuideModal: React.FC<HelpGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-950/70">
          <div className="flex items-center space-x-2">
            <Lightbulb className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-stone-100">Quy tắc &amp; Hướng dẫn Tách Chương Truyện</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-sm text-stone-300">
          {/* Card 1: Main Split Rule */}
          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 space-y-2">
            <h3 className="font-semibold text-amber-300 text-sm flex items-center space-x-2">
              <Split className="w-4 h-4 text-amber-400" />
              <span>1. Quy tắc chia chương chuẩn ({'>'} 2300 từ → 2 phần {'>'} 1100 từ)</span>
            </h3>
            <p className="text-xs text-stone-300 leading-relaxed">
              Hệ thống tự động quét toàn bộ các chương trong văn bản. Nếu một chương có tổng số từ từ <strong className="text-amber-300">2300 từ trở lên</strong>, thuật toán sẽ tự động phân tách thành <strong className="text-amber-300">2 chương mới</strong> sao cho cả 2 phần đều đảm bảo đạt tối thiểu <strong className="text-amber-300">1100 từ</strong>.
            </p>
          </div>

          {/* Card 2: Paragraph boundary logic */}
          <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800 space-y-2">
            <h3 className="font-semibold text-stone-100 text-sm flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>2. Chia theo đoạn văn tự nhiên (Không cắt ngang câu)</span>
            </h3>
            <p className="text-xs text-stone-300 leading-relaxed">
              Thuật toán duyệt qua từng đoạn văn (<code className="text-stone-300 bg-stone-800 px-1 py-0.5 rounded">paragraph</code>) và tìm điểm ngắt lý tưởng nhất tại ranh giới giữa 2 đoạn. Không bao giờ ngắt ngang giữa câu thoại, lời dẫn hay cảnh giao tranh đang diễn ra dở dang.
            </p>
          </div>

          {/* Card 3: Auto renumbering */}
          <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800 space-y-3">
            <h3 className="font-semibold text-stone-100 text-sm flex items-center space-x-2">
              <ArrowRight className="w-4 h-4 text-amber-400" />
              <span>3. Tự động đổi và đồng bộ số thứ tự chương</span>
            </h3>
            <div className="bg-stone-900 p-3 rounded-lg border border-stone-800 text-xs font-mono space-y-1.5 text-stone-300">
              <div className="text-stone-400"># Trước khi tách:</div>
              <div className="pl-2 border-l-2 border-stone-700 space-y-1">
                <div>Chương 1: Thiếu Niên Xuất Thôn (1,500 từ)</div>
                <div className="text-amber-400">Chương 2: Quyết Chiến Đỉnh Côn Lôn (2,800 từ) ➔ Cần tách</div>
                <div>Chương 3: Trở Về Sơn Môn (1,400 từ)</div>
              </div>
              <div className="text-stone-400 pt-2"># Sau khi tách &amp; đánh số lại:</div>
              <div className="pl-2 border-l-2 border-amber-500/60 text-emerald-300 space-y-1">
                <div>Chương 1: Thiếu Niên Xuất Thôn (1,500 từ)</div>
                <div>Chương 2: Quyết Chiến Đỉnh Côn Lôn (Thượng) (1,420 từ)</div>
                <div>Chương 3: Quyết Chiến Đỉnh Côn Lôn (Hạ) (1,380 từ)</div>
                <div>Chương 4: Trở Về Sơn Môn (1,400 từ) <span className="text-stone-400 text-[11px]">(tự động tăng từ 3 lên 4)</span></div>
              </div>
            </div>
          </div>

          {/* Card 4: Flexible Naming & AI Naming */}
          <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800 space-y-2">
            <h3 className="font-semibold text-stone-100 text-sm flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>4. Đặt tên &amp; Tinh chỉnh thủ công</span>
            </h3>
            <p className="text-xs text-stone-300 leading-relaxed">
              Bạn có thể lựa chọn nhiều mẫu đặt tên khác nhau (Thượng/Hạ, Phần 1/2, 1/2, v.v.), hoặc sử dụng AI để gợi ý tiêu đề theo ngữ cảnh từng đoạn, hoặc nhấp đúp vào bất kỳ tiêu đề nào trong danh sách để chỉnh sửa trực tiếp trước khi tải về.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-800 bg-stone-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-stone-950 bg-amber-400 hover:bg-amber-300 transition-colors"
          >
            Đã hiểu, tiếp tục
          </button>
        </div>
      </div>
    </div>
  );
};
