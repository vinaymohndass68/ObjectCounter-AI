
import React, { useState, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import { AppState, AnalysisResult } from './types';
import { analyzeImage, analyzeVideo } from './services/geminiService';
import CameraView from './components/CameraView';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>('idle');
  const [mediaData, setMediaData] = useState<string | null>(null);
  const [mediaMimeType, setMediaMimeType] = useState<string>('image/jpeg');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<{ message: string; isQuota?: boolean } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [targetObject, setTargetObject] = useState('');

  const reset = () => {
    setState('idle');
    setMediaData(null);
    setMediaMimeType('image/jpeg');
    setResult(null);
    setError(null);
    setTargetObject('');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setMediaData(base64);
        setMediaMimeType(file.type);
        performAnalysis(base64, file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCameraCapture = (capturedMedia: string, mimeType: string) => {
    setMediaData(capturedMedia);
    setMediaMimeType(mimeType);
    setState('idle'); // Close camera view
    performAnalysis(capturedMedia, mimeType);
  };

  const performAnalysis = async (data: string, mimeType: string) => {
    setState('analyzing');
    setError(null);
    try {
      const analysis = mimeType.startsWith('video/') 
        ? await analyzeVideo(data, mimeType, targetObject.trim() || undefined)
        : await analyzeImage(data, targetObject.trim() || undefined);
      setResult(analysis);
      setState('result');
    } catch (err: any) {
      console.error("Analysis error:", err);
      const errorMessage = err.message || "";
      const isQuotaError = errorMessage.includes("429") || errorMessage.toLowerCase().includes("quota") || errorMessage.includes("RESOURCE_EXHAUSTED");
      
      setError({
        message: isQuotaError 
          ? "API Quota exceeded. Please wait a moment or use your own API key to continue."
          : "Something went wrong during analysis. Please try again.",
        isQuota: isQuotaError
      });
      setState('idle');
    }
  };

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      if (mediaData) performAnalysis(mediaData, mediaMimeType);
    }
  };

  const downloadPDF = async () => {
    if (!result || !mediaData) return;
    setIsExporting(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let y = 20;

      // Header
      doc.setFontSize(22);
      doc.setTextColor(79, 70, 229); // Indigo 600
      doc.text('ObjectCounter AI Report', margin, y);
      y += 10;

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated on ${new Date().toLocaleString()}`, margin, y);
      if (targetObject) {
        y += 5;
        doc.text(`Target: ${targetObject}`, margin, y);
      }
      y += 15;

      // Summary
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text('Analysis Summary', margin, y);
      y += 7;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'italic');
      const splitSummary = doc.splitTextToSize(result.summary, pageWidth - margin * 2);
      doc.text(splitSummary, margin, y);
      y += splitSummary.length * 5 + 10;

      // Media
      if (mediaMimeType.startsWith('image/')) {
        try {
          const imgProps = doc.getImageProperties(mediaData);
          const imgWidth = pageWidth - margin * 2;
          const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
          
          const maxHeight = 80;
          const finalImgHeight = Math.min(imgHeight, maxHeight);
          const finalImgWidth = (imgProps.width * finalImgHeight) / imgProps.height;
          
          doc.addImage(mediaData, 'JPEG', margin, y, finalImgWidth, finalImgHeight);
          y += finalImgHeight + 15;
        } catch (e) {
          console.error("PDF Image add error:", e);
        }
      } else {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(10);
        doc.text('[Video Analysis Report - Media content not embeddable in PDF]', margin, y);
        y += 15;
      }

      // Findings
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Observation List', margin, y);
      y += 10;

      const living = result.items.filter(i => i.type === 'living');
      const nonLiving = result.items.filter(i => i.type === 'non-living');

      if (living.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(16, 185, 129); // Emerald 500
        doc.text('Living Beings', margin, y);
        y += 7;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(0);
        living.forEach(item => {
          doc.text(`• ${item.name}: ${item.count}`, margin + 5, y);
          y += 6;
        });
        y += 5;
      }

      if (nonLiving.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(59, 130, 246); // Blue 500
        doc.setFont('helvetica', 'bold');
        doc.text('Non-Living Objects', margin, y);
        y += 7;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(0);
        nonLiving.forEach(item => {
          doc.text(`• ${item.name}: ${item.count}`, margin + 5, y);
          y += 6;
        });
      }

      doc.save('object-counter-report.pdf');
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 px-4 py-4 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">ObjectCounter AI</h1>
          </div>
          {(state !== 'idle' || mediaData) && (
            <button 
              onClick={reset}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              Start Over
            </button>
          )}
        </div>
      </header>

      <main className="flex-grow max-w-4xl mx-auto w-full p-4 sm:p-6 pb-24">
        {state === 'idle' && !mediaData && (
          <div className="mt-8 text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-md mx-auto space-y-4">
              <h2 className="text-4xl font-extrabold text-gray-900">What's in your frame?</h2>
              <p className="text-lg text-gray-600">
                Instantly count living and non-living objects in any image or video using advanced AI.
              </p>
            </div>

            <div className="max-w-md mx-auto relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input 
                type="text"
                placeholder="Search for something specific? (e.g. people, cars...)"
                value={targetObject}
                onChange={(e) => setTargetObject(e.target.value)}
                className="w-full pl-11 pr-4 py-4 bg-white border-2 border-gray-100 rounded-2xl shadow-sm focus:border-indigo-500 focus:ring-0 transition-all text-gray-900 placeholder-gray-400"
              />
              {targetObject && (
                <button 
                  onClick={() => setTargetObject('')}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              <button 
                onClick={() => setState('capturing')}
                className="group p-8 bg-white border-2 border-dashed border-gray-300 rounded-3xl hover:border-indigo-500 hover:bg-indigo-50/30 transition-all duration-300 flex flex-col items-center justify-center space-y-4 shadow-sm"
              >
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="text-center">
                  <span className="block text-lg font-semibold text-gray-900">Capture Media</span>
                  <span className="text-sm text-gray-500">Photo or Video</span>
                </div>
              </button>

              <label className="group p-8 bg-white border-2 border-dashed border-gray-300 rounded-3xl hover:border-indigo-500 hover:bg-indigo-50/30 transition-all duration-300 flex flex-col items-center justify-center space-y-4 shadow-sm cursor-pointer">
                <input 
                  type="file" 
                  accept="image/*,video/*" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <div className="text-center">
                  <span className="block text-lg font-semibold text-gray-900">Upload Media</span>
                  <span className="text-sm text-gray-500">From your library</span>
                </div>
              </label>
            </div>
          </div>
        )}

        {state === 'idle' && mediaData && error && (
          <div className="mt-8 max-w-md mx-auto animate-in fade-in slide-in-from-top-4">
             <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-red-900">Analysis Failed</h3>
                  <p className="text-red-700 mt-1">{error.message}</p>
                </div>
                <div className="flex flex-col space-y-2">
                  <button 
                    onClick={() => performAnalysis(mediaData, mediaMimeType)}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-all"
                  >
                    Try Again
                  </button>
                  {error.isQuota && (
                    <button 
                      onClick={handleSelectKey}
                      className="w-full bg-white border border-red-200 text-red-700 hover:bg-red-50 font-semibold py-3 rounded-xl transition-all flex items-center justify-center space-x-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      <span>Use my own API Key</span>
                    </button>
                  )}
                  <button onClick={reset} className="text-gray-500 text-sm hover:underline">Cancel</button>
                </div>
             </div>
          </div>
        )}

        {state === 'analyzing' && (
          <div className="mt-12 flex flex-col items-center justify-center space-y-6 animate-pulse">
            <div className="relative w-full max-w-sm aspect-square rounded-3xl overflow-hidden bg-gray-200 shadow-inner">
               {mediaData && (
                 mediaMimeType.startsWith('video/') ? (
                   <video src={mediaData} className="w-full h-full object-cover opacity-50 grayscale" muted />
                 ) : (
                   <img src={mediaData} className="w-full h-full object-cover opacity-50 grayscale" alt="Analyzing" />
                 )
               )}
               <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-4 text-indigo-700 font-semibold tracking-wide">
                    {targetObject ? `Counting ${targetObject}...` : `Analyzing ${mediaMimeType.startsWith('video/') ? 'Video' : 'Image'}...`}
                  </p>
               </div>
            </div>
            <p className="text-gray-500 max-w-xs text-center">Identifying people, animals, and objects. This usually takes {mediaMimeType.startsWith('video/') ? '5-10' : '2-4'} seconds.</p>
          </div>
        )}

        {state === 'result' && result && mediaData && (
          <div className="mt-4 space-y-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
                {mediaMimeType.startsWith('video/') ? (
                  <video src={mediaData} className="w-full h-auto object-contain max-h-[500px]" controls />
                ) : (
                  <img src={mediaData} className="w-full h-auto object-contain max-h-[500px]" alt="Source" />
                )}
                <div className="p-6 bg-gray-50 border-t border-gray-100">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">AI Summary</h3>
                  <p className="text-gray-700 leading-relaxed italic">"{result.summary}"</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">Observation Report</h2>
                  <div className="flex items-center space-x-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm font-semibold">
                    <span>{result.items.reduce((acc, i) => acc + i.count, 0)} Total Objects</span>
                  </div>
                </div>

                {targetObject && (
                  <div className="p-4 bg-indigo-600 rounded-2xl shadow-md text-white">
                    <span className="text-xs uppercase font-bold tracking-wider opacity-80">Requested Focus</span>
                    <p className="text-xl font-bold">"{targetObject}"</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center space-x-2 mb-4">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <h3 className="font-semibold text-gray-900">Living Beings</h3>
                    </div>
                    <div className="space-y-3">
                      {result.items.filter(i => i.type === 'living').map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                          <span className="font-medium text-emerald-900 capitalize">{item.name}</span>
                          <span className="bg-emerald-500 text-white px-3 py-0.5 rounded-full font-bold shadow-sm">{item.count}</span>
                        </div>
                      ))}
                      {result.items.filter(i => i.type === 'living').length === 0 && (
                        <p className="text-sm text-gray-400 italic">No living things detected.</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center space-x-2 mb-4">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <h3 className="font-semibold text-gray-900">Non-Living Objects</h3>
                    </div>
                    <div className="space-y-3">
                      {result.items.filter(i => i.type === 'non-living').map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                          <span className="font-medium text-blue-900 capitalize">{item.name}</span>
                          <span className="bg-blue-500 text-white px-3 py-0.5 rounded-full font-bold shadow-sm">{item.count}</span>
                        </div>
                      ))}
                      {result.items.filter(i => i.type === 'non-living').length === 0 && (
                        <p className="text-sm text-gray-400 italic">No static objects detected.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {state === 'result' && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-gray-200 z-20">
          <div className="max-w-4xl mx-auto flex space-x-4">
            <button 
              onClick={reset}
              className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold py-4 rounded-2xl shadow-sm transition-all active:scale-[0.98]"
            >
              Scan New
            </button>
            <button 
              onClick={downloadPDF}
              disabled={isExporting}
              className="flex-[2] bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] flex items-center justify-center space-x-2"
            >
              {isExporting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Download PDF Report</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {state === 'capturing' && (
        <CameraView 
          onCapture={handleCameraCapture} 
          onCancel={() => setState('idle')} 
        />
      )}
    </div>
  );
};

export default App;
