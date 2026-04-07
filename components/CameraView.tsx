
import React, { useRef, useState, useEffect } from 'react';

interface CameraViewProps {
  onCapture: (mediaData: string, mimeType: string) => void;
  onCancel: () => void;
}

const CameraView: React.FC<CameraViewProps> = ({ onCapture, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: true, // Enable audio for video recording
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera access error:", err);
        setError("Unable to access camera. Please check permissions.");
      }
    };

    startCamera();

    if (isRecording) {
      timer = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (timer) clearInterval(timer);
    };
  }, [isRecording]);

  const handleCapture = () => {
    if (mode === 'photo') {
      capturePhoto();
    } else {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        onCapture(dataUrl, 'image/jpeg');
      }
    }
  };

  const startRecording = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const options = { mimeType: 'video/webm;codecs=vp9,opus' };
      
      // Fallback for Safari/iOS
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/mp4';
      }
      
      try {
        const recorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: options.mimeType });
          const reader = new FileReader();
          reader.onloadend = () => {
            onCapture(reader.result as string, options.mimeType);
          };
          reader.readAsDataURL(blob);
        };

        recorder.start();
        setIsRecording(true);
        setRecordingTime(0);
      } catch (err) {
        console.error("Recording error:", err);
        setError("Failed to start recording.");
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-lg aspect-[3/4] bg-neutral-900 rounded-2xl overflow-hidden shadow-2xl">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-white p-6 text-center">
            <p className="mb-4 text-red-400">{error}</p>
            <button 
              onClick={onCancel}
              className="px-6 py-2 bg-white text-black rounded-full font-medium"
            >
              Go Back
            </button>
          </div>
        ) : (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted={!isRecording}
              className="w-full h-full object-cover"
            />
            
            {isRecording && (
              <div className="absolute top-6 left-0 right-0 flex justify-center">
                <div className="bg-red-600 text-white px-4 py-1 rounded-full flex items-center space-x-2 animate-pulse">
                  <div className="w-2 h-2 bg-white rounded-full" />
                  <span className="text-sm font-bold">{formatTime(recordingTime)}</span>
                </div>
              </div>
            )}

            <div className="absolute top-6 right-6">
               <div className="bg-black/40 backdrop-blur-md rounded-full p-1 flex">
                  <button 
                    onClick={() => !isRecording && setMode('photo')}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${mode === 'photo' ? 'bg-white text-black' : 'text-white/70'}`}
                    disabled={isRecording}
                  >
                    PHOTO
                  </button>
                  <button 
                    onClick={() => !isRecording && setMode('video')}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${mode === 'video' ? 'bg-white text-black' : 'text-white/70'}`}
                    disabled={isRecording}
                  >
                    VIDEO
                  </button>
               </div>
            </div>

            <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center space-x-8 px-6">
              <button 
                onClick={onCancel}
                className="w-12 h-12 flex items-center justify-center bg-white/20 backdrop-blur-md rounded-full text-white border border-white/30"
                disabled={isRecording}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              <button 
                onClick={handleCapture}
                className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all ${isRecording ? 'bg-red-600' : 'bg-white'}`}
              >
                {mode === 'photo' ? (
                  <div className="w-16 h-16 border-4 border-black/5 rounded-full" />
                ) : (
                  <div className={`transition-all ${isRecording ? 'w-8 h-8 bg-white rounded-sm' : 'w-16 h-16 border-4 border-black/5 rounded-full'}`} />
                )}
              </button>

              <div className="w-12 h-12" /> {/* Spacer */}
            </div>
          </>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default CameraView;
