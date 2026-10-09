// Stub and helper for Qimao novel provider
export async function getQimaoChapter(
  bookId: string,
  itemId: string,
  title: string,
  bookName?: string,
  index?: number,
  author?: string
): Promise<{ content: string; title: string }> {
  try {
    const url = `https://api-bc.qmkeji.com/chapter/detail?book_id=${bookId}&chapter_id=${itemId}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.data?.content) {
        return {
          title: data?.data?.title || title,
          content: data?.data?.content
        };
      }
    }
  } catch (e) {
    console.warn('[Qimao] Fallback error for chapter', itemId, e);
  }

  return {
    title: title || 'Chương không tên',
    content: ''
  };
}
