import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  X, Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  RotateCw, Maximize2, Share2, AlertCircle, FileText, RefreshCw, ExternalLink
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function PDFViewerModal({
  isOpen,
  onClose,
  document: docItem,
  onDownloadOrShare,
  lang = 'bn'
}) {
  const isBn = lang === 'bn';
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rendering, setRendering] = useState(false);

  // Helper to extract clean binary data from base64, blob, or URL
  const getPdfData = useCallback(async () => {
    if (!docItem) return null;
    const src = docItem.fileData || docItem.cloudUrl || docItem.localUri || '';

    // If data URL (Base64)
    if (typeof src === 'string' && src.startsWith('data:')) {
      const base64Data = src.replace(/^data:.*?;base64,/, '');
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }

    // If pure base64 string
    if (typeof src === 'string' && src.length > 200 && !src.startsWith('http')) {
      try {
        const binaryString = atob(src);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
      } catch (e) {}
    }

    // If HTTP / Cloudinary URL
    if (typeof src === 'string' && src.startsWith('http')) {
      const response = await fetch(src);
      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    }

    return src;
  }, [docItem]);

  // Load PDF document
  useEffect(() => {
    if (!isOpen || !docItem) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setCurrentPage(1);
    setRotation(0);

    getPdfData()
      .then(async (data) => {
        if (!data) throw new Error('No PDF content available');
        const loadingTask = pdfjsLib.getDocument(data.buffer ? { data: data.buffer } : { data });
        const loadedPdf = await loadingTask.promise;
        if (isMounted) {
          setPdfDoc(loadedPdf);
          setTotalPages(loadedPdf.numPages);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('PDF loading error:', err);
        if (isMounted) {
          setError(err.message || 'Failed to load PDF');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, docItem, getPdfData]);

  // Render current page onto Canvas
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || rendering) return;

    try {
      setRendering(true);
      const page = await pdfDoc.getPage(currentPage);
      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      
      // Calculate responsive viewport scale
      let actualScale = scale;
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth - 24;
        const unscaledViewport = page.getViewport({ scale: 1, rotation });
        if (containerWidth > 0 && unscaledViewport.width > 0) {
          const fitScale = containerWidth / unscaledViewport.width;
          actualScale = fitScale * scale;
        }
      }

      const viewport = page.getViewport({ scale: actualScale, rotation });
      const pixelRatio = window.devicePixelRatio || 1;

      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const renderContext = {
        canvasContext: context,
        viewport
      };

      await page.render(renderContext).promise;
    } catch (err) {
      console.warn('PDF page rendering warning:', err);
    } finally {
      setRendering(false);
    }
  }, [pdfDoc, currentPage, scale, rotation, rendering]);

  useEffect(() => {
    if (pdfDoc) {
      renderPage();
    }
  }, [pdfDoc, currentPage, scale, rotation]);

  if (!isOpen || !docItem) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(5, 10, 20, 0.96)',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)'
      }}
      onClick={onClose}
    >
      {/* ===== Header Toolbar ===== */}
      <div
        style={{
          padding: '12px 16px',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95), rgba(15, 23, 42, 0.8))',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          zIndex: 10
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <h4 style={{
            fontSize: '0.94rem',
            color: '#ffffff',
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontWeight: 700
          }}>
            📄 {docItem.title || 'PDF Document'}
          </h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
            <span style={{
              fontSize: '0.72rem',
              color: '#38bdf8',
              background: 'rgba(56, 189, 248, 0.15)',
              padding: '1px 7px',
              borderRadius: '6px',
              fontWeight: 700
            }}>
              {isBn ? `পৃষ্ঠা ${currentPage} / ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
            </span>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              {Math.round(scale * 100)}%
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Download / Share */}
          <button
            type="button"
            className="btn btn-icon"
            onClick={() => onDownloadOrShare?.(docItem)}
            title={isBn ? 'ডাউনলোড বা শেয়ার করুন' : 'Download or Share'}
            style={{
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              width: 36,
              height: 36,
              borderRadius: '10px'
            }}
          >
            <Download size={17} />
          </button>

          {/* Close */}
          <button
            type="button"
            className="btn btn-icon"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              width: 36,
              height: 36,
              borderRadius: '10px'
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ===== PDF Canvas Viewer Body ===== */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px 12px 90px',
          position: 'relative',
          WebkitOverflowScrolling: 'touch'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#38bdf8' }}>
            <RefreshCw size={28} className="animate-spin" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>
              {isBn ? 'PDF লোড হচ্ছে...' : 'Loading PDF...'}
            </span>
          </div>
        )}

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '14px',
            padding: '24px 20px',
            maxWidth: '360px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}>
            <AlertCircle size={36} color="#ef4444" />
            <h4 style={{ fontSize: '1rem', color: '#f87171', margin: 0, fontWeight: 700 }}>
              {isBn ? 'PDF লোড করা যায়নি' : 'Failed to display PDF'}
            </h4>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
              {isBn
                ? 'ফাইলটি আপনার ডিভাইসের এক্সটারনাল PDF রিডার দিয়ে সহজে দেখতে ও ওপেন করতে পারবেন।'
                : 'You can open and view this file directly using your device external PDF reader.'}
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => onDownloadOrShare?.(docItem)}
              style={{
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.82rem',
                padding: '10px 18px',
                borderRadius: '10px',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <ExternalLink size={15} />
              <span>{isBn ? 'PDF রিডার দিয়ে খুলুন' : 'Open in PDF Reader'}</span>
            </button>
          </div>
        )}

        {/* Canvas Display */}
        <canvas
          ref={canvasRef}
          style={{
            display: loading || error ? 'none' : 'block',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
            borderRadius: '6px',
            background: '#ffffff',
            maxWidth: '100%'
          }}
        />
      </div>

      {/* ===== Floating Bottom Control Bar ===== */}
      {!loading && !error && (
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.92)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: '30px',
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            zIndex: 20
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Previous Page */}
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            style={{
              background: 'transparent',
              border: 'none',
              color: currentPage <= 1 ? '#475569' : '#38bdf8',
              cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center'
            }}
            title={isBn ? 'পূর্ববর্তী পৃষ্ঠা' : 'Previous Page'}
          >
            <ChevronLeft size={20} />
          </button>

          <span style={{ fontSize: '0.78rem', color: '#ffffff', fontWeight: 700, minWidth: '45px', textAlign: 'center' }}>
            {currentPage} / {totalPages}
          </span>

          {/* Next Page */}
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            style={{
              background: 'transparent',
              border: 'none',
              color: currentPage >= totalPages ? '#475569' : '#38bdf8',
              cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center'
            }}
            title={isBn ? 'পরবর্তী পৃষ্ঠা' : 'Next Page'}
          >
            <ChevronRight size={20} />
          </button>

          <div style={{ width: 1, height: 18, background: 'rgba(255, 255, 255, 0.15)' }} />

          {/* Zoom Out */}
          <button
            type="button"
            onClick={() => setScale(s => Math.max(0.6, s - 0.2))}
            style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: '6px' }}
            title={isBn ? 'জুম আউট' : 'Zoom Out'}
          >
            <ZoomOut size={17} />
          </button>

          {/* Zoom In */}
          <button
            type="button"
            onClick={() => setScale(s => Math.min(3.0, s + 0.2))}
            style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: '6px' }}
            title={isBn ? 'জুম ইন' : 'Zoom In'}
          >
            <ZoomIn size={17} />
          </button>

          {/* Rotate */}
          <button
            type="button"
            onClick={() => setRotation(r => (r + 90) % 360)}
            style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: '6px' }}
            title={isBn ? 'ঘোরান (Rotate)' : 'Rotate'}
          >
            <RotateCw size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
