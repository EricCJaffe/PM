"use client";

import { useRef } from "react";

interface DocumentPreviewProps {
  compiledHtml: string;
  onPrint?: () => void;
}

export function DocumentPreview({ compiledHtml, onPrint }: DocumentPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  function handlePrint() {
    if (onPrint) {
      onPrint();
      return;
    }
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      iframe.contentWindow.print();
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-pm-text">Preview</h3>
        <button
          onClick={handlePrint}
          className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
        >
          Print / Save PDF
        </button>
      </div>
      <div className="flex-1 bg-white rounded-lg overflow-hidden border border-pm-border min-h-[600px]">
        <iframe
          ref={iframeRef}
          srcDoc={compiledHtml}
          className="w-full h-full min-h-[600px]"
          title="Document Preview"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}
