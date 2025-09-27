"use client";

import { useState, useRef, useEffect } from 'react';
import CubeScene from './3dtesting';

// We'll create a simple gesture bridge that uses your working MediaPipe system
export default function GestureControlledCubeScene() {
  // State for gesture commands that will control the 3D scene
  const [gestureCommands, setGestureCommands] = useState<{
    createCube?: boolean;
    selectCube?: boolean;  
    resizeValue?: number;
    togglePhysics?: boolean;
  }>({});

  const [gestureLog, setGestureLog] = useState<string[]>([]);
  const [isHandTrackingReady, setIsHandTrackingReady] = useState(false);
  const trackerRef = useRef<any>(null); // Will hold reference to your MediaPipe tracker

  // Initialize MediaPipe using your existing RobustMediaPipeTracker
  useEffect(() => {
    const initializeGestureControl = async () => {
      try {
        // Import your existing MediaPipeTest component's tracker class
        // For now, we'll simulate gesture detection with keyboard as a test
        console.log('🔄 Setting up gesture controls...');
        
        // Add keyboard simulation for testing (temporary)
        const handleKeyPress = (event: KeyboardEvent) => {
          switch(event.key.toLowerCase()) {
            case 'c':
              setGestureLog(prev => [...prev.slice(-4), 'CREATE gesture detected']);
              setGestureCommands(prev => ({ ...prev, createCube: true }));
              setTimeout(() => setGestureCommands(prev => ({ ...prev, createCube: false })), 100);
              break;
            case 's':
              setGestureLog(prev => [...prev.slice(-4), 'SELECT gesture detected']);
              setGestureCommands(prev => ({ ...prev, selectCube: true }));
              setTimeout(() => setGestureCommands(prev => ({ ...prev, selectCube: false })), 100);
              break;
            case 'r':
              const size = Math.random() * 10 + 2;
              setGestureLog(prev => [...prev.slice(-4), `RESIZE to ${size.toFixed(1)}`]);
              setGestureCommands(prev => ({ ...prev, resizeValue: size }));
              break;
            case 'p':
              setGestureLog(prev => [...prev.slice(-4), 'TOGGLE PHYSICS']);
              setGestureCommands(prev => ({ ...prev, togglePhysics: true }));
              setTimeout(() => setGestureCommands(prev => ({ ...prev, togglePhysics: false })), 100);
              break;
          }
        };

        window.addEventListener('keypress', handleKeyPress);
        setIsHandTrackingReady(true);
        
        console.log('✅ Gesture control ready (test mode)');
        
        return () => {
          window.removeEventListener('keypress', handleKeyPress);
        };
      } catch (error) {
        console.error('❌ Failed to initialize gesture controls:', error);
      }
    };

    initializeGestureControl();
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* Gesture Control Panel */}
      <div className="absolute top-4 right-4 z-20 bg-black/80 text-white p-4 rounded-lg max-w-xs">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold text-sm">Gesture Controls</h3>
          <div className={`w-2 h-2 rounded-full ${isHandTrackingReady ? 'bg-green-500' : 'bg-red-500'}`}></div>
        </div>
        
        <div className="text-xs space-y-1 mb-3">
          <p className="text-yellow-300 font-semibold">Test Mode - Use Keyboard:</p>
          <p><strong>C:</strong> Create cube</p>
          <p><strong>S:</strong> Select/cycle cube</p>
          <p><strong>R:</strong> Random resize</p>
          <p><strong>P:</strong> Toggle physics</p>
        </div>
        
        <div className="text-xs">
          <p className="font-semibold mb-1">Recent commands:</p>
          {gestureLog.length === 0 ? (
            <div className="text-gray-400">Press keys to test gestures</div>
          ) : (
            gestureLog.map((gesture, i) => (
              <div key={i} className="text-green-400">{gesture}</div>
            ))
          )}
        </div>
        
        <div className="mt-3 pt-2 border-t border-gray-600">
          <p className="text-xs text-blue-300">
            Next: Add real hand tracking
          </p>
        </div>
      </div>

      {/* The 3D Scene - controlled by gestures */}
      <CubeScene gestureCommands={gestureCommands} />
    </div>
  );
}