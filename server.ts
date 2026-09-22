import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

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
