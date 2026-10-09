import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import {
  parseBookId,
  searchBooks,
  getBookInfo,
  getCatalog,
  extractFanqieHdCover,
  parseFanqieCoverFromUrl,
} from "./fanqieCore";
import { CURATED_FANQIE_DANMEI_BOOKS } from "./src/data/curatedDanmeiDatabase";
import { downloadManager } from "./downloadManager";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// Server-side Gemini initialization
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || "",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// API endpoint to generate creative titles for split novel chapters
app.post("/api/generate-titles", async (req, res) => {
  try {
    const { originalTitle, part1Preview, part2Preview, namingStyle } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({
        error: "GEMINI_API_KEY is not configured in environment.",
      });
    }

    const ai = getGeminiClient();
    const prompt = `Bạn là biên tập viên truyện dịch/sáng tác kỳ cựu.
Tôi vừa chia một chương truyện dài có tựa gốc: "${originalTitle || 'Không tên'}" thành 2 chương.
Dưới đây là tóm tắt nội dung 2 phần:

--- PHẦN 1 (Đầu chương):
${(part1Preview || "").slice(0, 1500)}

--- PHẦN 2 (Cuối chương):
${(part2Preview || "").slice(0, 1500)}

Phong cách mong muốn: ${namingStyle || "Hấp dẫn, đúng phong thái truyện kiếm hiệp/tiên hiệp/đô thị/ngôn tình"}.

Nhiệm vụ:
Đặt tựa đề ngắn gọn, súc tích và hấp dẫn cho cả 2 phần (không bao gồm tiền tố "Chương X", chỉ lấy tên tiêu đề).
Đồng thời đưa ra gợi ý theo định dạng Thượng/Hạ và gợi ý tiêu đề theo diễn biến thực tế.

Trả về kết quả JSON theo mẫu:
{
  "part1Title": "Tên tiêu đề phần 1",
  "part2Title": "Tên tiêu đề phần 2",
  "explanation": "Lý do đặt tên ngắn gọn"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text || "{}";
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = {
        part1Title: `${originalTitle} (Thượng)`,
        part2Title: `${originalTitle} (Hạ)`,
        explanation: "Tự động đặt theo phân khúc",
      };
    }

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error("Error generating chapter titles:", error);
    return res.status(500).json({
      error: error?.message || "Failed to generate titles with AI",
    });
  }
});

// API endpoint for batch chapter title generation
app.post("/api/batch-generate-titles", async (req, res) => {
  try {
    const { chapters } = req.body;
    if (!Array.isArray(chapters) || chapters.length === 0) {
      return res.status(400).json({ error: "No chapters provided" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({
        error: "GEMINI_API_KEY is not configured.",
      });
    }

    const ai = getGeminiClient();
    const prompt = `Bạn là biên tập viên tiểu thuyết chuyên nghiệp. Hãy gợi ý tiêu đề ngắn gọn cho các cặp chương được phân tách sau:
${JSON.stringify(chapters.slice(0, 10), null, 2)}

Trả về JSON mảng các đối tượng:
[
  {
    "id": 1,
    "part1Title": "...",
    "part2Title": "..."
  }
]`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "[]");
    return res.json({ success: true, results: parsed });
  } catch (error: any) {
    console.error("Batch title error:", error);
    return res.status(500).json({ error: error?.message || "Batch error" });
  }
});

// ==================== FANQIE NOVEL RAW DOWNLOADER ROUTES ====================

// 1. Search books by query or keyword
app.get("/api/fanqie/search", async (req, res) => {
  try {
    const query = String(req.query.query || req.query.q || "").trim();
    if (!query) {
      return res.status(400).json({ error: "Vui lòng nhập từ khóa tìm kiếm" });
    }
    const count = parseInt(String(req.query.count || "10"), 10) || 10;
    const books = await searchBooks(query, count);
    return res.json({ success: true, books });
  } catch (err: any) {
    console.error("Fanqie search error:", err);
    return res.status(500).json({ error: err.message || "Lỗi tìm kiếm truyện Fanqie" });
  }
});

// Cache for curated Danmei + Infinite Flow ranking
interface CuratedCache {
  timestamp: number;
  data: any[];
}
const curatedDanmeiCache: Record<string, CuratedCache> = {};

// 1.5. Curated Leaderboard & Aggregator for Danmei & Infinite Flow novels
app.get("/api/fanqie/ranking/danmei-vohan", async (req, res) => {
  try {
    const category = String(req.query.category || "vohan"); // 'vohan' | 'escape' | 'rules' | 'matthe' | 'cuongcuong' | 'vongdu'
    const sort = String(req.query.sort || "score"); // 'score' | 'hot' | 'newest' | 'updated' | 'completed' | 'ongoing' | 'chapters'
    const searchQuery = String(req.query.search || "").trim().toLowerCase();
    const forceFresh = req.query.fresh === "true" || req.query.live === "true";

    const cacheKey = `${category}_${sort}`;
    const now = Date.now();
    // Real-time cache: 60 seconds TTL, or bypassed immediately if forceFresh is requested
    const CACHE_TTL = 60 * 1000;

    let books: any[] = [];
    if (!forceFresh && curatedDanmeiCache[cacheKey] && now - curatedDanmeiCache[cacheKey].timestamp < CACHE_TTL) {
      books = curatedDanmeiCache[cacheKey].data;
    } else {
      let queries: string[] = [];
      if (category === "all") {
        // Tất cả Đam Mỹ: Tổng hợp toàn sàn Fanqie
        queries = [
          "双男主",
          "双男主 快穿",
          "双男主 无限流",
          "双男主 穿书",
          "双男主 重生",
          "双男主 校园",
          "双男主 末世",
          "双男主 强强",
          "双男主 修仙",
          "双男主 豪门",
          "双男主 娱乐圈",
          "双男主 甜宠",
          "双男主 规则怪谈",
          "双男主 万人迷",
          "双男主 疯批",
          "耽美 无限流"
        ];
        if (sort === "newest") {
          queries.unshift("双男主 新书", "双男主 最新", "双男主 刚开");
        } else if (sort === "updated") {
          queries.unshift("双男主 连载", "双男主 刚更新");
        }
      } else if (category === "escape") {
        // Đam mỹ: Trò chơi trốn thoát / Sinh tồn
        queries = [
          "双男主 逃生游戏",
          "双男主 生存游戏",
          "双男主 逃生",
          "双男主 大逃杀",
          "双男主 绝地求生"
        ];
        if (sort === "newest") {
          queries.unshift("双男主 逃生 新书", "双男主 逃生 最新");
        } else if (sort === "updated") {
          queries.unshift("双男主 逃生游戏 连载", "双男主 逃生 刚更新");
        }
      } else if (category === "rules") {
        // Đam mỹ: Quy tắc quái đàm / Kinh dị
        queries = [
          "双男主 规则怪谈",
          "双男主 诡异降临",
          "双男主 惊悚游戏",
          "双男主 克苏鲁",
          "双男主 灵异怪谈"
        ];
        if (sort === "newest") {
          queries.unshift("双男主 规则怪谈 新书", "双男主 诡异 最新");
        } else if (sort === "updated") {
          queries.unshift("双男主 规则怪谈 连载", "双男主 诡异 刚更新");
        }
      } else if (category === "khoaixuyen") {
        // Đam mỹ: Khoái xuyên / Xuyên thư / Trọng sinh
        queries = [
          "双男主 快穿",
          "双男主 穿书",
          "双男主 重生",
          "双男主 系统",
          "双男主 万人迷 快穿",
          "双男主 快穿 甜宠"
        ];
        if (sort === "newest") {
          queries.unshift("双男主 快穿 新书", "双男主 穿书 最新");
        } else if (sort === "updated") {
          queries.unshift("双男主 快穿 连载", "双男主 快穿 刚更新");
        }
      } else if (category === "matthe") {
        // Đam mỹ: Mạt thế / Tang thi / Dị năng đánh nhau
        queries = [
          "双男主 末世",
          "双男主 丧尸",
          "双男主 异能",
          "双男主 末日",
          "双男主 废土",
          "双男主 基地"
        ];
        if (sort === "newest") {
          queries.unshift("双男主 末世 新书", "双男主 末日 最新");
        } else if (sort === "updated") {
          queries.unshift("双男主 末世 连载", "双男主 丧尸 刚更新");
        }
      } else if (category === "cuongcuong") {
        // Đam mỹ: Cường cường / Đánh quái / Vượt ải / Thăng cấp
        queries = [
          "双男主 强强",
          "双男主 强强 打怪",
          "双男主 升级流",
          "双男主 满级大佬",
          "双男主 战力",
          "双男主 爽文"
        ];
        if (sort === "newest") {
          queries.unshift("双男主 强强 新书", "双男主 升级流 最新");
        } else if (sort === "updated") {
          queries.unshift("双男主 强强 连载", "双男主 满级大佬 刚更新");
        }
      } else if (category === "dothi") {
        // Đam mỹ: Đô thị / Vườn trường / Hào môn / Giới giải trí
        queries = [
          "双男主 校园",
          "双男主 现代",
          "双男主 豪门",
          "双男主 娱乐圈",
          "双男主 甜宠",
          "双男主 破镜重圆"
        ];
        if (sort === "newest") {
          queries.unshift("双男主 校园 新书", "双男主 现代 最新");
        } else if (sort === "updated") {
          queries.unshift("双男主 现代 连载", "双男主 豪门 刚更新");
        }
      } else if (category === "cotrang") {
        // Đam mỹ: Cổ trang / Tiên hiệp / Tu chân
        queries = [
          "双男主 修仙",
          "双男主 古代",
          "双男主 师徒",
          "双男主 仙侠",
          "双男主 穿书 修真",
          "双男主 宫廷",
          "双男主 剑修",
          "双男主 魔尊",
          "双男主 师尊",
          "双男主 权谋 古代",
          "双男主 重生 修仙",
          "耽美 修仙",
          "耽美 古风"
        ];
        if (sort === "newest") {
          queries.unshift("双男主 修仙 新书", "双男主 古代 最新");
        } else if (sort === "updated") {
          queries.unshift("双男主 修仙 连载", "双男主 仙侠 刚更新");
        }
      } else if (category === "vongdu") {
        // Đam mỹ: Toàn tức võng du / Game PK / E-Sports
        queries = [
          "双男主 全息网游",
          "双男主 网游 PK",
          "双男主 游戏入侵",
          "双男主 竞技",
          "双男主 电竞",
          "双男主 游戏 甜宠",
          "双男主 全服第一",
          "双男主 刺客 网游",
          "双男主 战队",
          "双男主 职业选手",
          "耽美 电竞",
          "耽美 网游"
        ];
        if (sort === "newest") {
          queries.unshift("双男主 全息网游 新书", "双男主 网游 最新");
        } else if (sort === "updated") {
          queries.unshift("双男主 全息网游 连载", "双男主 网游 刚更新");
        }
      } else {
        // Default / vohan: Đam mỹ Vô Hạn Lưu / Phó Bản
        queries = [
          "双男主 无限流",
          "双男主 副本",
          "双男主 轮回",
          "双男主 惊悚游戏",
          "耽美 无限流"
        ];
        if (sort === "newest") {
          queries.unshift("双男主 无限流 新书", "双男主 副本 最新");
        } else if (sort === "updated") {
          queries.unshift("双男主 无限流 连载", "双男主 副本 刚更新");
        }
      }

      const map = new Map<string, any>();

      // Category matcher helper function - strictly matches genre keywords and excludes non-matching genres
      const matchesCategory = (b: any, cat: string): boolean => {
        if (cat === "all") return true;
        
        const text = `${b.book_name || ''} ${b.abstract || ''} ${b.category || ''}`.toLowerCase();
        const hasVhlTag = text.includes("无限流") || text.includes("逃生游戏") || text.includes("规则怪谈") || text.includes("惊悚游戏");

        if (cat === "cotrang") {
          // Strictly Cổ trang / Tiên hiệp / Tu chân: reject pure VHL/escape unless it's genuinely Xianxia
          if (hasVhlTag && !text.includes("修仙") && !text.includes("仙侠") && !text.includes("修真") && !text.includes("师尊")) {
            return false;
          }
          if (b.sub_categories?.includes("cotrang")) return true;
          return (
            text.includes("修仙") || text.includes("古代") || text.includes("师徒") || text.includes("仙侠") ||
            text.includes("修真") || text.includes("宫廷") || text.includes("剑修") || text.includes("魔尊") ||
            text.includes("师尊") || text.includes("权谋") || text.includes("王爷") || text.includes("陛下") ||
            text.includes("宗门") || text.includes("长老") || text.includes("道侣") || text.includes("江山") ||
            text.includes("灵气") || text.includes("飞升") || text.includes("天尊") || text.includes("神君") ||
            text.includes("妖皇") || text.includes("灵兽") || text.includes("古风")
          );
        }

        if (cat === "vongdu") {
          // Võng du / E-Sports
          if (hasVhlTag && !text.includes("网游") && !text.includes("电竞")) return false;
          if (b.sub_categories?.includes("vongdu")) return true;
          return (
            text.includes("网游") || text.includes("全息") || text.includes("竞技") || text.includes("电竞") ||
            text.includes("职业选手") || text.includes("战队") || text.includes("全服") || text.includes("游戏入侵")
          );
        }

        if (cat === "dothi") {
          // Đô thị / Hào môn / Vườn trường / Giới giải trí
          if (hasVhlTag) return false;
          if (b.sub_categories?.includes("dothi")) return true;
          return (
            text.includes("校园") || text.includes("现代") || text.includes("豪门") || text.includes("娱乐圈") ||
            text.includes("甜宠") || text.includes("破镜重圆") || text.includes("总裁") || text.includes("金主") ||
            text.includes("学霸") || text.includes("影帝")
          );
        }

        if (cat === "matthe") {
          // Mạt thế / Dị năng / Tang thi
          if (b.sub_categories?.includes("matthe")) return true;
          return (
            text.includes("末世") || text.includes("丧尸") || text.includes("异能") || text.includes("末日") ||
            text.includes("废土") || text.includes("基地")
          );
        }

        if (cat === "khoaixuyen") {
          // Khoái xuyên / Xuyên thư / Trọng sinh
          if (b.sub_categories?.includes("khoaixuyen")) return true;
          return (
            text.includes("快穿") || text.includes("穿书") || text.includes("重生") || text.includes("系统") ||
            text.includes("万人迷") || text.includes("切片")
          );
        }

        if (cat === "cuongcuong") {
          // Cường cường / Sảng văn / Thăng cấp
          if (b.sub_categories?.includes("cuongcuong")) return true;
          return (
            text.includes("强强") || text.includes("打怪") || text.includes("升级") || text.includes("大佬") ||
            text.includes("爽文") || text.includes("满级") || text.includes("战力")
          );
        }

        if (cat === "escape") {
          // Trốn thoát / Sinh tồn / Đa tẩu sát
          if (b.sub_categories?.includes("escape")) return true;
          return (
            text.includes("逃生") || text.includes("生存") || text.includes("逃亡") || text.includes("大逃杀") ||
            text.includes("绝地") || text.includes("求生")
          );
        }

        if (cat === "rules") {
          // Quy tắc quái đàm / Kinh dị
          if (b.sub_categories?.includes("rules")) return true;
          return (
            text.includes("规则") || text.includes("怪谈") || text.includes("诡异") || text.includes("克苏鲁") ||
            text.includes("惊悚") || text.includes("异闻")
          );
        }

        if (cat === "vohan") {
          // Vô Hạn Lưu / Phó bản
          if (b.sub_categories?.includes("vohan")) return true;
          return (
            text.includes("无限") || text.includes("副本") || text.includes("轮回") || text.includes("通关") ||
            text.includes("惊悚")
          );
        }

        return false;
      };

      // 1. Seed with curated high-rated books strictly matching category
      for (const b of CURATED_FANQIE_DANMEI_BOOKS) {
        if (matchesCategory(b, category)) {
          map.set(b.book_id, { ...b });
        }
      }

      // 2. Fetch live Fanqie search results in parallel to enrich the leaderboard
      await Promise.all(
        queries.map(async (q) => {
          try {
            // Fetch offset 0 and offset 20 in parallel to expand reach
            const [p0, p1] = await Promise.all([
              searchBooks(q, 25, 0),
              searchBooks(q, 25, 20)
            ]);
            for (const b of [...p0, ...p1]) {
              if (b.book_id && b.book_name && !b.book_name.includes("Chưa có tên") && !map.has(b.book_id)) {
                const combined = ((b.book_name || '') + ' ' + (b.abstract || '') + ' ' + (b.category || '')).toLowerCase();
                const isHetero = combined.includes('校花') || combined.includes('女总裁') || combined.includes('同桌她') || combined.includes('女友') || combined.includes('学姐');
                if (!isHetero || b.category === '双男主' || b.category === '耽美') {
                  if (matchesCategory(b, category)) {
                    map.set(b.book_id, b);
                  }
                }
              }
            }
          } catch (e) {
            console.error(`Error querying ${q}:`, e);
          }
        })
      );

      books = Array.from(map.values());
      curatedDanmeiCache[cacheKey] = {
        timestamp: now,
        data: books
      };
    }

    // Search filter if provided
    let result = [...books];
    if (searchQuery) {
      const sq = searchQuery.toLowerCase();
      // Translate Vietnamese search keywords to Chinese tags/terms
      const termMap: Record<string, string[]> = {
        "vô hạn": ["无限", "副本"],
        "vohan": ["无限", "副本"],
        "trốn thoát": ["逃生", "大逃杀"],
        "sinh tồn": ["生存"],
        "quái đàm": ["怪谈", "规则"],
        "quy tắc": ["规则"],
        "khoái xuyên": ["快穿", "穿书"],
        "khoaixuyen": ["快穿", "穿书"],
        "trọng sinh": ["重生"],
        "mạt thế": ["末世", "丧尸"],
        "matthe": ["末世"],
        "cường cường": ["强强"],
        "dị năng": ["异能"],
        "đô thị": ["现代", "豪门", "校园"],
        "cổ trang": ["古代", "修仙", "仙侠"],
        "võng du": ["网游", "全息", "电竞"],
        "vongdu": ["网游", "全息", "电竞"],
        "game": ["游戏", "网游"],
        "e-sports": ["电竞"],
        "đam mỹ": ["双男主", "耽美"],
        "hoàn thành": ["完结"],
        "đang ra": ["连载"]
      };

      const extraKeywords: string[] = [sq];
      for (const [key, targets] of Object.entries(termMap)) {
        if (sq.includes(key)) {
          extraKeywords.push(...targets);
        }
      }

      const filteredBySearch = result.filter(b => {
        const text = `${b.book_id || ''} ${b.book_name || ''} ${b.author || ''} ${b.abstract || ''} ${b.category || ''} ${b.sub_categories?.join(' ') || ''}`.toLowerCase();
        return extraKeywords.some(kw => text.includes(kw));
      });

      if (filteredBySearch.length > 0) {
        result = filteredBySearch;
      } else {
        // Fallback: substring check or partial word matching
        result = result.filter(b => {
          const text = `${b.book_id || ''} ${b.book_name || ''} ${b.author || ''}`.toLowerCase();
          return sq.split(/\s+/).some(term => term.length >= 2 && text.includes(term));
        });
      }
    }

    // Ensure result is never empty if books existed
    if (result.length === 0 && books.length > 0) {
      result = [...books];
    }

    // Sort order
    if (sort === "newest") {
      // Mới nhất: Sắp xếp theo ngày tạo hoặc ID truyện mới nhất (Snowflake timestamp lớn nhất)
      result.sort((a, b) => {
        const timeA = Number(a.create_time || 0);
        const timeB = Number(b.create_time || 0);
        if (timeA && timeB && timeA !== timeB) {
          return timeB - timeA;
        }
        try {
          return BigInt(b.book_id) > BigInt(a.book_id) ? 1 : -1;
        } catch (e) {
          return String(b.book_id).localeCompare(String(a.book_id));
        }
      });
    } else if (sort === "updated") {
      // Mới cập nhật: Sắp xếp theo chương vừa phát hành gần đây nhất
      result.sort((a, b) => {
        const timeA = Number(a.last_chapter_first_pass_time || 0);
        const timeB = Number(b.last_chapter_first_pass_time || 0);
        if (timeA && timeB && timeA !== timeB) {
          return timeB - timeA;
        }
        // Fallback to word number / chapter count
        return (Number(b.chapter_count) || 0) - (Number(a.chapter_count) || 0);
      });
    } else if (sort === "completed") {
      const filtered = result.filter(b => String(b.creation_status).includes("完结") || String(b.creation_status) === "0" || String(b.creation_status).includes("Hoàn thành"));
      if (filtered.length > 0) {
        result = filtered;
      }
      result.sort((a, b) => parseFloat(b.score || "0") - parseFloat(a.score || "0"));
    } else if (sort === "ongoing") {
      const filtered = result.filter(b => (!String(b.creation_status).includes("完结") && String(b.creation_status) !== "0") || String(b.creation_status).includes("Đang ra") || String(b.creation_status).includes("连载"));
      if (filtered.length > 0) {
        result = filtered;
      }
      result.sort((a, b) => parseFloat(b.score || "0") - parseFloat(a.score || "0"));
    } else if (sort === "chapters") {
      result.sort((a, b) => (Number(b.chapter_count) || 0) - (Number(a.chapter_count) || 0));
    } else if (sort === "hot") {
      result.sort((a, b) => (Number(b.word_number) || 0) - (Number(a.word_number) || 0));
    } else {
      // Default: sort by score descending
      result.sort((a, b) => parseFloat(b.score || "0") - parseFloat(a.score || "0"));
    }

    return res.json({
      success: true,
      category,
      sort,
      total: result.length,
      lastUpdated: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
      isLive: true,
      books: result
    });
  } catch (err: any) {
    console.error("Danmei ranking error:", err);
    return res.status(500).json({ error: err.message || "Lỗi lấy BXH Đam Mỹ Vô Hạn Lưu" });
  }
});

// 2. Get book info by ID or URL
app.get("/api/fanqie/book-info", async (req, res) => {
  try {
    const rawInput = String(req.query.bookId || req.query.id || "").trim();
    const bookId = parseBookId(rawInput);
    if (!bookId) {
      return res.status(400).json({ error: "ID truyện hoặc link không hợp lệ" });
    }
    const bookInfo = await getBookInfo(bookId);
    return res.json({ success: true, bookInfo, bookId });
  } catch (err: any) {
    console.error("Fanqie book info error:", err);
    return res.status(500).json({ error: err.message || "Không thể lấy thông tin truyện hoặc truyện đã bị gỡ" });
  }
});

// 3. Get catalog (directory of chapters) by ID or URL
app.get("/api/fanqie/catalog", async (req, res) => {
  try {
    const rawInput = String(req.query.bookId || req.query.id || "").trim();
    const bookId = parseBookId(rawInput);
    if (!bookId) {
      return res.status(400).json({ error: "ID truyện hoặc link không hợp lệ" });
    }
    const catalog = await getCatalog(bookId);
    return res.json({ success: true, catalog, bookId });
  } catch (err: any) {
    console.error("Fanqie catalog error:", err);
    return res.status(500).json({ error: err.message || "Không thể lấy mục lục truyện" });
  }
});

// 4. Create and start download task
app.post("/api/fanqie/download/create", async (req, res) => {
  try {
    const { bookId: rawId, ranges, includeIntro = true, stripAuthorNotes = true, provider = 'fanqie' } = req.body;
    const bookId = parseBookId(rawId);
    if (!bookId) {
      return res.status(400).json({ error: "ID truyện không hợp lệ" });
    }

    let bookInfo = req.body.bookInfo;
    if (!bookInfo) {
      bookInfo = await getBookInfo(bookId);
    }

    let catalog = req.body.catalog;
    if (!catalog) {
      catalog = await getCatalog(bookId);
    }

    const task = downloadManager.createTask(
      bookId,
      bookInfo,
      catalog,
      ranges,
      provider,
      includeIntro,
      stripAuthorNotes
    );

    // Launch download asynchronously
    downloadManager.runDownload(task.taskId).catch((err) => {
      console.error(`Task ${task.taskId} background download error:`, err);
    });

    return res.json({
      success: true,
      taskId: task.taskId,
      task: {
        taskId: task.taskId,
        bookId: task.bookId,
        bookInfo: task.bookInfo,
        totalChapters: task.totalChapters,
        status: task.status,
        ranges: task.ranges,
      },
    });
  } catch (err: any) {
    console.error("Download create error:", err);
    return res.status(500).json({ error: err.message || "Lỗi tạo tác vụ tải truyện" });
  }
});

// 5. Get download progress status
app.get("/api/fanqie/download/status/:taskId", (req, res) => {
  const { taskId } = req.params;
  const task = downloadManager.getTask(taskId);
  if (!task) {
    return res.status(404).json({ error: "Không tìm thấy tác vụ tải" });
  }

  return res.json({
    success: true,
    taskId: task.taskId,
    status: task.status,
    percent: task.percent,
    completedChapters: task.completedChapters,
    failedChapters: task.failedChapters,
    totalChapters: task.totalChapters,
    speed: task.speed,
    currentChapterTitle: task.currentChapterTitle,
    errorMessage: task.errorMessage,
    startTime: task.startTime,
    endTime: task.endTime,
    ranges: task.ranges,
    bookInfo: {
      title: task.bookInfo?.title || task.bookInfo?.book_name,
      author: task.bookInfo?.author,
      cover_url: task.bookInfo?.cover_url || task.bookInfo?.thumb_url,
    },
  });
});

// 6. Cancel download task
app.post("/api/fanqie/download/cancel/:taskId", (req, res) => {
  const { taskId } = req.params;
  const success = downloadManager.cancelTask(taskId);
  return res.json({ success });
});

// 7. Get raw text for direct injection into Ping Chapter Splitter
app.get("/api/fanqie/download/get-raw-text/:taskId", (req, res) => {
  try {
    const { taskId } = req.params;
    const task = downloadManager.getTask(taskId);
    if (!task) {
      return res.status(404).json({ error: "Không tìm thấy tác vụ tải" });
    }
    const rangeIndex = req.query.rangeIndex !== undefined ? parseInt(String(req.query.rangeIndex), 10) : undefined;
    const text = downloadManager.generateTxt(taskId, rangeIndex);
    return res.json({
      success: true,
      title: task.bookInfo?.book_name || task.bookInfo?.title || "Truyện Fanqie",
      author: task.bookInfo?.author,
      rawText: text,
      chapterCount: task.completedChapters,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Lỗi lấy nội dung raw" });
  }
});

// 8. Export TXT file download
app.get("/api/fanqie/download/export-txt/:taskId", (req, res) => {
  try {
    const { taskId } = req.params;
    const task = downloadManager.getTask(taskId);
    if (!task) {
      return res.status(404).json({ error: "Không tìm thấy tác vụ tải" });
    }
    const rangeIndex = req.query.rangeIndex !== undefined ? parseInt(String(req.query.rangeIndex), 10) : undefined;
    const text = downloadManager.generateTxt(taskId, rangeIndex);

    const bookName = (task.bookInfo?.book_name || task.bookInfo?.title || "novel").replace(/[\\/:*?"<>|]/g, "_");
    let filename = `${bookName}.txt`;
    if (rangeIndex !== undefined && task.ranges && task.ranges[rangeIndex]) {
      const r = task.ranges[rangeIndex];
      filename = `${bookName}_[Chương_${r.start}-${r.end}].txt`;
    }

    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.send(text);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Lỗi xuất file TXT" });
  }
});

// 9. Export ZIP file download
app.get("/api/fanqie/download/export-zip/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = downloadManager.getTask(taskId);
    if (!task) {
      return res.status(404).json({ error: "Không tìm thấy tác vụ tải" });
    }
    const zipBuffer = await downloadManager.generateZip(taskId);
    const bookName = (task.bookInfo?.book_name || task.bookInfo?.title || "novel").replace(/[\\/:*?"<>|]/g, "_");
    const filename = `${bookName}.zip`;

    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader("Content-Type", "application/zip");
    return res.send(zipBuffer);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Lỗi tạo file ZIP" });
  }
});

// 10. Export EPUB file download
app.get("/api/fanqie/download/export-epub/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = downloadManager.getTask(taskId);
    if (!task) {
      return res.status(404).json({ error: "Không tìm thấy tác vụ tải" });
    }
    const epubBuffer = await downloadManager.generateEpub(taskId);
    const bookName = (task.bookInfo?.book_name || task.bookInfo?.title || "novel").replace(/[\\/:*?"<>|]/g, "_");
    const filename = `${bookName}.epub`;

    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader("Content-Type", "application/epub+zip");
    return res.send(epubBuffer);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Lỗi tạo file EPUB" });
  }
});

// 11. Extract HD Cover info
app.get("/api/fanqie/cover", async (req, res) => {
  try {
    const url = String(req.query.url || "");
    if (!url) return res.status(400).json({ error: "Thiếu link ảnh bìa hoặc ID" });
    const coverInfo = await extractFanqieHdCover(url);
    return res.json({ success: true, coverInfo });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Lỗi lấy link ảnh bìa HD" });
  }
});

// 12. Streaming Image Proxy with Anti-Hotlink Bypassing & Fallbacks
app.get("/api/fanqie/image-proxy", async (req, res) => {
  try {
    let targetUrl = String(req.query.url || "").trim();
    const bookId = String(req.query.book_id || req.query.id || "").trim();

    // If no URL but bookId is provided, try getting book info cover
    if (!targetUrl && bookId) {
      try {
        const info = await getBookInfo(bookId);
        if (info?.cover_url) {
          targetUrl = info.cover_url;
        }
      } catch (e) {}
    }

    if (!targetUrl) {
      return res.status(404).send("Missing image URL");
    }

    // Fix relative or protocol-relative paths
    if (!targetUrl.startsWith("http")) {
      if (targetUrl.startsWith("//")) {
        targetUrl = "https:" + targetUrl;
      } else {
        targetUrl = `https://p3-novel.byteimg.com/origin/${targetUrl.replace(/^\/+/, "")}`;
      }
    }

    const defaultHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Referer": "https://fanqienovel.com/",
      "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "Sec-Fetch-Dest": "image",
      "Sec-Fetch-Mode": "no-cors",
      "Sec-Fetch-Site": "cross-site"
    };

    let response = await fetch(targetUrl, {
      headers: defaultHeaders,
    });

    if (!response.ok) {
      // Try fallback byteimg hosts if reading-sign CDN returned 403/404
      const parsed = parseFanqieCoverFromUrl(targetUrl);
      if (parsed?.hash && parsed.hash !== "direct") {
        const fallbackUrls = [
          `https://p3-novel.byteimg.com/origin/${parsed.folder}/${parsed.hash}`,
          `https://p6-novel.byteimg.com/origin/${parsed.folder}/${parsed.hash}`,
          `https://p9-novel.byteimg.com/origin/${parsed.folder}/${parsed.hash}`,
          `https://p3-novel.byteimg.com/origin/novel-pic-r/${parsed.hash}`,
          `https://p3-novel.byteimg.com/origin/novel-pic/${parsed.hash}`
        ];

        for (const fb of fallbackUrls) {
          try {
            const fbRes = await fetch(fb, { headers: defaultHeaders });
            if (fbRes.ok) {
              const buffer = await fbRes.arrayBuffer();
              res.setHeader("Content-Type", fbRes.headers.get("content-type") || "image/jpeg");
              res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
              return res.send(Buffer.from(buffer));
            }
          } catch (err) {}
        }
      }
      return res.status(response.status).send("Failed to load image");
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = await response.arrayBuffer();

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
    return res.send(Buffer.from(buffer));
  } catch (err: any) {
    console.error("Image proxy error:", err);
    return res.status(500).send("Image proxy failed");
  }
});

async function startServer() {
  // Vite middleware in dev
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Novel Chapter Splitter Server running at http://localhost:${PORT}`);
  });
}

startServer();
