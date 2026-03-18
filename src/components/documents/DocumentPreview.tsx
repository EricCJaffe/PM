"use client";

import { useRef, useState } from "react";

interface DocumentPreviewProps {
  compiledHtml: string;
  documentTitle?: string;
}

export function DocumentPreview({ compiledHtml, documentTitle }: DocumentPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const filename = (documentTitle ?? "document").replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-");

  function downloadHtml() {
    const blob = new Blob([compiledHtml], { type: "text/html" });
    triggerDownload(blob, `${filename}.html`);
    setMenuOpen(false);
  }

  function downloadMarkdown() {
    // Strip HTML to rough markdown
    const md = htmlToMarkdown(compiledHtml);
    const blob = new Blob([md], { type: "text/markdown" });
    triggerDownload(blob, `${filename}.md`);
    setMenuOpen(false);
  }

  function downloadDocx() {
    // Generate a simple .docx (Word) via HTML-in-OOXML wrapper
    const docxBlob = buildDocxBlob(compiledHtml);
    triggerDownload(docxBlob, `${filename}.docx`);
    setMenuOpen(false);
  }

  function handlePrintPdf() {
    // Open a new window with ONLY the document content to avoid printing the app shell
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(compiledHtml);
      printWindow.document.close();
      // Wait for content to render before triggering print
      printWindow.onload = () => {
        printWindow.print();
      };
      // Fallback for browsers that don't fire onload for document.write
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
    setMenuOpen(false);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-pm-text">Preview</h3>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-1.5"
          >
            Download
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-pm-card border border-pm-border rounded-lg shadow-lg overflow-hidden">
                <button
                  onClick={handlePrintPdf}
                  className="w-full text-left px-3 py-2 text-sm text-pm-text hover:bg-pm-bg flex items-center gap-2"
                >
                  <span className="w-5 text-center text-pm-muted">PDF</span>
                  Save as PDF (Print)
                </button>
                <button
                  onClick={downloadDocx}
                  className="w-full text-left px-3 py-2 text-sm text-pm-text hover:bg-pm-bg flex items-center gap-2"
                >
                  <span className="w-5 text-center text-pm-muted">DOC</span>
                  Word Document (.docx)
                </button>
                <button
                  onClick={downloadHtml}
                  className="w-full text-left px-3 py-2 text-sm text-pm-text hover:bg-pm-bg flex items-center gap-2"
                >
                  <span className="w-5 text-center text-pm-muted">HTM</span>
                  HTML File
                </button>
                <button
                  onClick={downloadMarkdown}
                  className="w-full text-left px-3 py-2 text-sm text-pm-text hover:bg-pm-bg flex items-center gap-2"
                >
                  <span className="w-5 text-center text-pm-muted">MD</span>
                  Markdown
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="flex-1 bg-white rounded-lg overflow-hidden border border-pm-border min-h-[600px]">
        <iframe
          ref={iframeRef}
          srcDoc={compiledHtml}
          className="w-full h-full min-h-[600px]"
          title="Document Preview"
          sandbox="allow-same-origin allow-modals"
        />
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function htmlToMarkdown(html: string): string {
  // Extract body content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  let content = bodyMatch ? bodyMatch[1] : html;

  // Strip style/script tags
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

  // Convert headings
  content = content.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n");
  content = content.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n");
  content = content.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n");

  // Convert paragraphs
  content = content.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n");

  // Convert lists
  content = content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1");
  content = content.replace(/<\/?[uo]l[^>]*>/gi, "\n");

  // Convert table rows (basic)
  content = content.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_, row: string) => {
    const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) ?? [];
    const vals = cells.map((c: string) => c.replace(/<\/?t[dh][^>]*>/gi, "").trim());
    return "| " + vals.join(" | ") + " |\n";
  });
  content = content.replace(/<\/?table[^>]*>/gi, "\n");
  content = content.replace(/<\/?thead[^>]*>/gi, "");
  content = content.replace(/<\/?tbody[^>]*>/gi, "");

  // Convert bold/italic
  content = content.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**");
  content = content.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**");
  content = content.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*");
  content = content.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*");

  // Convert line breaks
  content = content.replace(/<br\s*\/?>/gi, "\n");

  // Strip remaining tags
  content = content.replace(/<[^>]+>/g, "");

  // Decode entities
  content = content.replace(/&amp;/g, "&");
  content = content.replace(/&lt;/g, "<");
  content = content.replace(/&gt;/g, ">");
  content = content.replace(/&quot;/g, '"');
  content = content.replace(/&#39;/g, "'");
  content = content.replace(/&nbsp;/g, " ");

  // Clean up whitespace
  content = content.replace(/\n{3,}/g, "\n\n").trim();

  return content;
}

function buildDocxBlob(html: string): Blob {
  // Word can open HTML wrapped in OOXML MIME multipart format
  // This is the simplest way to create a .docx-compatible file without a library
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : html;

  // Extract CSS
  const cssMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const css = cssMatch ? cssMatch[1] : "";

  const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="BusinessOS PM">
<style>
@page { size: 8.5in 11in; margin: 1in; }
${css}
</style>
</head>
<body>
${bodyContent}
</body>
</html>`;

  return new Blob([wordHtml], {
    type: "application/vnd.ms-word;charset=utf-8",
  });
}
