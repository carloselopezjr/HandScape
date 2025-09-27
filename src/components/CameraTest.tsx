'use client';
import React, { useRef, useState } from 'react';
import { handTracker } from '@/app/components/hand-tracking/handTracking';

export default function CameraTest() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState('Ready to start');
  const [isRunning, setIsRunning] = useState(false);

  const startCamera = async () => {
    if (!videoRef.current || !canvasRef.current) {
      setStatus(' Video elements not ready, merph...');
      return;
    }

    try {
      setStatus('🚀 Starting camera...');
      setIsRunning(true);
      
      await handTracker.initialize(videoRef.current, canvasRef.current);
      
      setStatus(' Camera started! Show your hand to test.');
      
      // Subscribe to any events
      handTracker.subscribe((event) => {
        console.log('Hand event:', event);
      });
      
    } catch (error) {
      setStatus(' Failed to start camera: ' + error);
      setIsRunning(false);
    }
  };

  const stopCamera = () => {
    handTracker.destroy();
    setStatus('⏹️ Camera stopped');
    setIsRunning(false);
  };

  const testCalibration = () => {
    handTracker.calibrate();
    setStatus(' Calibration done! Check console for details.');
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Camera Test</h1>
      
      <div className="mb-4 p-3 bg-gray-100 rounded">
        <p><strong>Status:</strong> {status}</p>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={startCamera}
          disabled={isRunning}
          className="px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-400"
        >
          📹 Start Camera
        </button>
        
        <button
          onClick={stopCamera}
          disabled={!isRunning}
          className="px-4 py-2 bg-red-500 text-white rounded disabled:bg-gray-400"
        >
          ⏹️ Stop Camera
        </button>
        
        <button
          onClick={testCalibration}
          disabled={!isRunning}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400"
        >
          📏 Test Calibration
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="font-semibold mb-2">Your Camera</h3>
          <video
            ref={videoRef}
            className="w-full border rounded bg-black"
            autoPlay
            muted
            playsInline
          />
        </div>
        
        <div>
          <h3 className="font-semibold mb-2">Processing Canvas</h3>
          <canvas
            ref={canvasRef}
            className="w-full border rounded bg-gray-200"
            width={640}
            height={480}
          />
        </div>
      </div>

      <div className="mt-4 p-3 bg-blue-50 rounded">
        <h3 className="font-semibold">Instructions:</h3>
        <ol className="list-decimal list-inside mt-2 space-y-1">
          <li>Click "Start Camera" and allow camera permissions</li>
          <li>You should see your camera feed</li>
          <li>Show your hand to the camera</li>
          <li>Check browser console (F12) for MediaPipe logs</li>
          <li>Try "Test Calibration" with your hand visible</li>
        </ol>
      </div>

      <div className="mt-4 p-3 bg-yellow-50 rounded">
        <p><strong>Expected console output:</strong></p>
        <code className="text-sm"> MediaPipe Hand Tracker initialized successfully</code>
      </div>
    </div>
  );
}