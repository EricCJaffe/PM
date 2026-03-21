"use client";

import { useState, useEffect } from "react";

interface FilePreviewModalProps {
  fileName: string;
  contentType: string;
  /** The attachment type for the download API */
  attachmentType: "task" | "note" | "document" | "engagement";
  /** The attachment/document ID */
  attachmentId: string;
  onClose: () => void;
}

/**
 * Modal for previewing and downloading file attachments.
 *
 * - Images: rendered inline
 * - PDFs: rendered in an iframe
 * - Text/code: fetched and shown as preformatted text
 * - Other: download prompt with file info
 */
export function FilePreviewModal({ fileName, contentType, attachmentType, attachmentId, onClose }: FilePreviewModalProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isImage = contentType.startsWith("image/");
  const isPdf = contentType === "application/pdf";
  const isText = contentType.startsWith("text/") || [
    "application/json", "application/xml", "application/javascript",
    "application/typescript", "application/x-yaml", "application/x-sh",
  ].includes(contentType);
  const isPreviewable = isImage || isPdf || isText;

  useEffect(() => {
    async function fetchUrl() {
      try {
        const res = await fetch(
          `/api/pm/attachments/download?type=${attachmentType}&id=${attachmentId}`
        );
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setSignedUrl(data.download_url);

        // For text files, fetch content for inline preview
        if (isText && data.download_url) {
          try {
            const textRes = await fetch(data.download_url);
            const text = await textRes.text();
            setTextContent(text.slice(0, 100_000)); // cap at 100KB of text
          } catch {
            // fall through — will show download link instead
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load file");
      } finally {
        setLoading(false);
      }
    }
    fetchUrl();
  }, [attachmentType, attachmentId, isText]);

  function handleDownload() {
    if (!signedUrl) return;
    const a = document.createElement("a");
    a.href = signedUrl;
    a.download = fileName;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function handleOpenExternal() {
    if (signedUrl) window.open(signedUrl, "_blank");
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-pm-card border border-pm-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-pm-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <FileTypeIcon contentType={contentType} />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-pm-text truncate">{fileName}</h3>
              <p className="text-xs text-pm-muted">{contentType}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {signedUrl && (
              <>
                <button
                  onClick={handleOpenExternal}
                  className="p-2 text-pm-muted hover:text-pm-text hover:bg-pm-bg rounded-lg transition-colors"
                  title="Open in new tab"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 text-pm-muted hover:text-pm-text hover:bg-pm-bg rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-pm-muted text-sm">Loading preview...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-red-400 text-sm">{error}</div>
            </div>
          ) : isImage && signedUrl ? (
            <div className="flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={signedUrl}
                alt={fileName}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          ) : isPdf && signedUrl ? (
            <iframe
              src={signedUrl}
              className="w-full h-[70vh] rounded-lg border border-pm-border"
              title={fileName}
            />
          ) : isText && textContent !== null ? (
            <pre className="bg-pm-bg rounded-lg p-4 text-sm text-pm-text overflow-auto max-h-[70vh] font-mono whitespace-pre-wrap break-words">
              {textContent}
            </pre>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <FileTypeIcon contentType={contentType} large />
              <div className="text-center">
                <p className="text-pm-text font-medium">{fileName}</p>
                <p className="text-sm text-pm-muted mt-1">
                  This file type cannot be previewed in the browser.
                </p>
              </div>
              {signedUrl && (
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={handleOpenExternal}
                    className="px-4 py-2 border border-pm-border text-pm-text hover:bg-pm-bg rounded-lg text-sm font-medium transition-colors"
                  >
                    Open in New Tab
                  </button>
                  <button
                    onClick={handleDownload}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Download File
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FileTypeIcon({ contentType, large }: { contentType: string; large?: boolean }) {
  const size = large ? "w-12 h-12" : "w-5 h-5";
  const strokeW = large ? 1.5 : 2;

  if (contentType.startsWith("image/")) {
    return (
      <svg className={`${size} text-green-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeW} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  if (contentType === "application/pdf") {
    return (
      <svg className={`${size} text-red-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeW} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  }
  if (contentType.startsWith("text/") || contentType.includes("json") || contentType.includes("xml")) {
    return (
      <svg className={`${size} text-blue-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeW} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    );
  }
  return (
    <svg className={`${size} text-pm-muted`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeW} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}
