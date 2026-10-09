import JSZip from 'jszip';

export interface EpubOptions {
  title: string;
  author: string;
  description?: string;
  coverUrl?: string;
  chapters: {
    title: string;
    content: string;
  }[];
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function generateEpub(options: EpubOptions): Promise<Buffer> {
  const { title, author, description, coverUrl, chapters } = options;
  const zip = new JSZip();

  // 1. mimetype (must be uncompressed)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. META-INF/container.xml
  zip.folder('META-INF')?.file(
    'container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  const oebps = zip.folder('OEBPS') || zip;

  // 3. Styles
  oebps.file(
    'styles.css',
    `body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
  margin: 1.5em;
  line-height: 1.8;
  color: #1a1a1a;
}
h1, h2 {
  text-align: center;
  margin-top: 1.5em;
  margin-bottom: 1em;
  color: #0f172a;
}
p {
  text-indent: 2em;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}
.intro {
  font-style: italic;
  color: #475569;
  border-left: 3px solid #cbd5e1;
  padding-left: 1em;
  margin: 1.5em 0;
}`
  );

  // Download cover image if available
  let hasCover = false;
  if (coverUrl) {
    try {
      const coverRes = await fetch(coverUrl);
      if (coverRes.ok) {
        const coverBuf = await coverRes.arrayBuffer();
        oebps.file('cover.jpg', coverBuf);
        hasCover = true;
      }
    } catch (e) {
      console.warn('Failed to embed cover image in EPUB:', e);
    }
  }

  // 4. Chapter files
  const manifestItems: string[] = [
    `<item id="css" href="styles.css" media-type="text/css"/>`,
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`
  ];
  if (hasCover) {
    manifestItems.push(`<item id="cover-image" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/>`);
  }

  const spineRefs: string[] = [];
  const navList: string[] = [];
  const ncxNavPoints: string[] = [];

  chapters.forEach((chap, idx) => {
    const fileId = `chapter_${idx + 1}`;
    const fileName = `chapter_${idx + 1}.xhtml`;
    manifestItems.push(`<item id="${fileId}" href="${fileName}" media-type="application/xhtml+xml"/>`);
    spineRefs.push(`<itemref idref="${fileId}"/>`);

    const cleanTitle = escapeXml(chap.title || `Chương ${idx + 1}`);
    navList.push(`<li><a href="${fileName}">${cleanTitle}</a></li>`);
    ncxNavPoints.push(`
    <navPoint id="np_${idx + 1}" playOrder="${idx + 1}">
      <navLabel><text>${cleanTitle}</text></navLabel>
      <content src="${fileName}"/>
    </navPoint>`);

    const paragraphs = (chap.content || '')
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => `<p>${escapeXml(p)}</p>`)
      .join('\n    ');

    const htmlContent = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <title>${cleanTitle}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <h2>${cleanTitle}</h2>
  <div class="chapter-content">
    ${paragraphs}
  </div>
</body>
</html>`;

    oebps.file(fileName, htmlContent);
  });

  // Nav document
  const navXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <title>Mục lục - ${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Mục lục</h1>
    <ol>
      ${navList.join('\n      ')}
    </ol>
  </nav>
</body>
</html>`;
  oebps.file('nav.xhtml', navXhtml);

  // TOC.ncx
  const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${Date.now()}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(title)}</text></docTitle>
  <docAuthor><text>${escapeXml(author)}</text></docAuthor>
  <navMap>
    ${ncxNavPoints.join('')}
  </navMap>
</ncx>`;
  oebps.file('toc.ncx', tocNcx);

  // Content.opf
  const contentOpf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">urn:uuid:${Date.now()}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:language>zh-CN</dc:language>
    <dc:description>${escapeXml(description || '')}</dc:description>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.[0-9]+Z$/, 'Z')}</meta>
    ${hasCover ? '<meta name="cover" content="cover-image"/>' : ''}
  </metadata>
  <manifest>
    ${manifestItems.join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${spineRefs.join('\n    ')}
  </spine>
</package>`;
  oebps.file('content.opf', contentOpf);

  return await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
}
