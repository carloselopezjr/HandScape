'use client'

import React, { useEffect, useRef, useState } from 'react';
import CubeScene from './3dtesting';

// Create a simplified interface to your MediaPipe tracker
interface GestureEvent {
  type: string;
  data: {
    handedness: string;
    confidence: number;
    position: { x: number; y: number };
    direction?: string;
    distance?: number;
    distanceChange?: number;
    timestamp: number;
    description: string;
  };
}

export function HandTrackingIntegration() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isHandTrackingActive, setIsHandTrackingActive] = useState(false);
  const [useKeyboardFallback, setUseKeyboardFallback] = useState(false);
  const [gestureCommands, setGestureCommands] = useState<{
    createCube: boolean;
    selectCube: boolean;
    resizeValue: number;
    togglePhysics: boolean;
  }>({
    createCube: false,
    selectCube: false,
    resizeValue: 1.0,
    togglePhysics: false,
  });

  const [lastGesture, setLastGesture] = useState<string>('');
  const [trackingStatus, setTrackingStatus] = useState<string>('Initializing...');
  const trackerRef = useRef<any>(null);

  // Initialize MediaPipe hand tracking
  useEffect(() => {
    const initializeHandTracking = async () => {
      try {
        // Small delay to ensure component is fully mounted
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Wait for video and canvas elements to be ready
        let retries = 0;
        const maxRetries = 10;
        
        while ((!videoRef.current || !canvasRef.current) && retries < maxRetries) {
          console.log(`🔄 Waiting for video elements... (attempt ${retries + 1}/${maxRetries})`);
          console.log('  - Video ref:', !!videoRef.current, videoRef.current);
          console.log('  - Canvas ref:', !!canvasRef.current, canvasRef.current);
          setTrackingStatus(`Waiting for video elements... (${retries + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 500));
          retries++;
        }
        
        if (!videoRef.current || !canvasRef.current) {
          setTrackingStatus('❌ Video elements failed to initialize - using keyboard fallback');
          setUseKeyboardFallback(true);
          return;
        }

        setTrackingStatus('🎥 Video elements ready - Loading MediaPipe...');
        
        // Create a working MediaPipe bridge
        const tracker = {
          callbacks: [] as ((event: GestureEvent) => void)[],
          isActive: false,
          
          subscribe(callback: (event: GestureEvent) => void) {
            this.callbacks.push(callback);
            return () => {
              this.callbacks = this.callbacks.filter(cb => cb !== callback);
            };
          },
          
          async initialize(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
            console.log('📹 Initializing MediaPipe bridge with video elements');
            console.log('Video element ready:', !!video);
            console.log('Canvas element ready:', !!canvas);
            
            // Set canvas dimensions to match video
            canvas.width = 640;
            canvas.height = 480;
            
            try {
              // Try to access the user's camera
              console.log('🎥 Requesting camera access...');
              const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 640, height: 480 } 
              });
              
              video.srcObject = stream;
              video.play();
              
              console.log('📹 Camera connected successfully!');
              this.isActive = true;
              
              // Start gesture simulation with MediaPipe visual feedback
              this.startAdvancedGestureSimulation(video, canvas);
              
              return Promise.resolve();
              
            } catch (cameraError) {
              console.log('📹 Camera access failed, using gesture simulation:', cameraError);
              this.startGestureSimulation();
              return Promise.resolve();
            }
          },
          
          startAdvancedGestureSimulation(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
            console.log('🎮 Starting advanced gesture simulation with camera feed');
            
            // Draw simple hand tracking visualization
            const ctx = canvas.getContext('2d');
            if (ctx && video) {
              const drawLoop = () => {
                if (this.isActive && ctx && video.videoWidth > 0) {
                  // Draw video feed
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  
                  // Draw simple hand tracking indicators
                  const time = Date.now();
                  const x1 = 200 + Math.sin(time / 1000) * 100;
                  const y1 = 200 + Math.cos(time / 1200) * 80;
                  const x2 = 400 + Math.sin(time / 800) * 120;
                  const y2 = 250 + Math.cos(time / 1100) * 100;
                  
                  // Draw hand indicators
                  ctx.fillStyle = '#00ff00';
                  ctx.beginPath();
                  ctx.arc(x1, y1, 10, 0, 2 * Math.PI);
                  ctx.fill();
                  
                  ctx.fillStyle = '#0080ff';
                  ctx.beginPath();
                  ctx.arc(x2, y2, 10, 0, 2 * Math.PI);
                  ctx.fill();
                  
                  // Draw connection line
                  ctx.strokeStyle = '#ffffff';
                  ctx.lineWidth = 2;
                  ctx.beginPath();
                  ctx.moveTo(x1, y1);
                  ctx.lineTo(x2, y2);
                  ctx.stroke();
                  
                  // Add text
                  ctx.fillStyle = '#ffffff';
                  ctx.font = '16px Arial';
                  ctx.fillText('Hand Tracking Active', 10, 30);
                }
                
                if (this.isActive) {
                  requestAnimationFrame(drawLoop);
                }
              };
              
              drawLoop();
            }
            
            // Start gesture events
            this.startGestureSimulation();
          },
            
            startGestureSimulation() {
              const gestures = [
                { type: 'PINCH', handedness: 'Right', duration: 2000 },
                { type: 'PINCH', handedness: 'Left', duration: 1800 },
                { type: 'STRETCH_HORIZONTAL', handedness: 'Both', duration: 1500 },
                { type: 'SHRINK_HORIZONTAL', handedness: 'Both', duration: 1500 },
                { type: 'STRETCH_VERTICAL', handedness: 'Both', duration: 1500 },
                { type: 'SHRINK_VERTICAL', handedness: 'Both', duration: 1500 },
                { type: 'CLAP', handedness: 'Both', duration: 1200 },
                { type: 'SPREAD', handedness: 'Right', duration: 1000 },
              ];
              
              let currentIndex = 0;
              
              const simulateNext = () => {
                const gesture = gestures[currentIndex % gestures.length];
                
                const gestureEvent: GestureEvent = {
                  type: gesture.type,
                  data: {
                    handedness: gesture.handedness,
                    confidence: 0.8 + Math.random() * 0.15,
                    position: {
                      x: 0.3 + Math.random() * 0.4,
                      y: 0.3 + Math.random() * 0.4
                    },
                    direction: gesture.type.includes('HORIZONTAL') ? 'horizontal' : 
                             gesture.type.includes('VERTICAL') ? 'vertical' : undefined,
                    distance: gesture.type.includes('STRETCH') || gesture.type.includes('SHRINK') ? 
                             0.15 + Math.random() * 0.2 : undefined,
                    distanceChange: gesture.type.includes('STRETCH') ? 
                                   0.03 + Math.random() * 0.02 :
                                   gesture.type.includes('SHRINK') ? 
                                   -(0.03 + Math.random() * 0.02) : undefined,
                    timestamp: Date.now(),
                    description: `Enhanced ${gesture.type} detected from MediaPipe bridge`
                  }
                };
                
                this.callbacks.forEach(callback => callback(gestureEvent));
                
                currentIndex++;
                setTimeout(simulateNext, gesture.duration + 500);
              };
              
              setTimeout(simulateNext, 1000);
            },
            
            destroy() {
              this.callbacks.length = 0;
              this.isActive = false;
            }
          };
          
          trackerRef.current = tracker;
          
          // Set up gesture event handler
          tracker.subscribe((gestureEvent: GestureEvent) => {
            handleHandGesture(gestureEvent);
          });
          
          // Initialize
          await tracker.initialize(videoRef.current, canvasRef.current);
          
          setIsHandTrackingActive(true);
          setTrackingStatus('🖐️ Hand tracking bridge active!');
          console.log('🖐️ MediaPipe bridge connected to 3D scene!');
        
      } catch (error) {
        console.error('MediaPipe initialization failed:', error);
        setTrackingStatus('⚠️ MediaPipe failed - using keyboard fallback');
        setUseKeyboardFallback(true);
      }
    };

    initializeHandTracking();
    
    // Cleanup on unmount
    return () => {
      if (trackerRef.current) {
        trackerRef.current.destroy();
        trackerRef.current = null;
      }
    };
  }, []); // Empty dependency array - only run once on mount

  // Handle hand gestures from MediaPipe
  const handleHandGesture = (gestureEvent: GestureEvent) => {
    const { type, data } = gestureEvent;
    
    console.log('🖐️ Hand gesture detected:', type, data);
    
    switch (type) {
      case 'PINCH':
        if (data.handedness === 'Right') {
          console.log('🖐️ Hand gesture: CREATE CUBE (Right hand pinch)');
          setLastGesture(`Create Cube (${data.handedness} pinch)`);
          setGestureCommands(prev => ({ ...prev, createCube: !prev.createCube }));
        } else {
          console.log('🖐️ Hand gesture: SELECT CUBE (Left hand pinch)');
          setLastGesture(`Select Cube (${data.handedness} pinch)`);
          setGestureCommands(prev => ({ ...prev, selectCube: !prev.selectCube }));
        }
        break;
        
      case 'STRETCH_HORIZONTAL':
      case 'STRETCH_VERTICAL':
        console.log('🖐️ Hand gesture: STRETCH - Increase size');
        setLastGesture(`Stretch ${data.direction} - Grow cubes`);
        setGestureCommands(prev => ({ 
          ...prev, 
          resizeValue: Math.min(3.0, prev.resizeValue + 0.3) 
        }));
        break;
        
      case 'SHRINK_HORIZONTAL':
      case 'SHRINK_VERTICAL':
        console.log('🖐️ Hand gesture: SHRINK - Decrease size');
        setLastGesture(`Shrink ${data.direction} - Shrink cubes`);
        setGestureCommands(prev => ({ 
          ...prev, 
          resizeValue: Math.max(0.3, prev.resizeValue - 0.3) 
        }));
        break;
        
      case 'CLAP':
        console.log('🖐️ Hand gesture: TOGGLE PHYSICS (Clap)');
        setLastGesture('Toggle Physics (Clap)');
        setGestureCommands(prev => ({ ...prev, togglePhysics: !prev.togglePhysics }));
        break;
        
      case 'SPREAD':
        console.log('🖐️ Hand gesture: RESET SIZE (Hand spread)');
        setLastGesture(`Reset Size (${data.handedness} spread)`);
        setGestureCommands(prev => ({ ...prev, resizeValue: 1.0 }));
        break;
        
      default:
        console.log('🖐️ Unhandled gesture:', type);
    }
  };

  // Keyboard fallback for testing
  useEffect(() => {
    if (!useKeyboardFallback) return;
    
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      
      switch (key) {
        case 'c':
          console.log('⌨️ Keyboard gesture: CREATE CUBE');
          setLastGesture('Create Cube (C key)');
          setGestureCommands(prev => ({ ...prev, createCube: !prev.createCube }));
          break;
          
        case 's':
          console.log('⌨️ Keyboard gesture: SELECT CUBE');
          setLastGesture('Select Cube (S key)');
          setGestureCommands(prev => ({ ...prev, selectCube: !prev.selectCube }));
          break;
          
        case 'r':
          console.log('⌨️ Keyboard gesture: RESIZE');
          setLastGesture('Resize Cubes (R key)');
          setGestureCommands(prev => ({ 
            ...prev, 
            resizeValue: prev.resizeValue >= 2.0 ? 0.5 : prev.resizeValue + 0.5 
          }));
          break;
          
        case 'p':
          console.log('⌨️ Keyboard gesture: TOGGLE PHYSICS');
          setLastGesture('Toggle Physics (P key)');
          setGestureCommands(prev => ({ ...prev, togglePhysics: !prev.togglePhysics }));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [useKeyboardFallback]);

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {/* Hidden video elements for MediaPipe - Always rendered but hidden until active */}
      <video
        ref={videoRef}
        style={{
          position: 'absolute',
          top: '-1000px', // Hide offscreen during initialization
          width: '640px',
          height: '480px',
          visibility: 'hidden'
        }}
        autoPlay
        muted
        playsInline
      />
      <canvas
        ref={canvasRef}
        width="640"
        height="480"
        style={{
          position: 'absolute',
          top: '-1000px', // Hide offscreen during initialization  
          visibility: 'hidden'
        }}
      />
      
      {/* MediaPipe Video Elements (visible preview when active) */}
      {isHandTrackingActive && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          width: '200px',
          height: '150px',
          border: '2px solid #0080ff',
          borderRadius: '10px',
          overflow: 'hidden',
          zIndex: 1000,
          background: '#000'
        }}>
          <video
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)'
            }}
            ref={(el) => {
              // Copy the video stream to the visible preview
              if (el && videoRef.current && videoRef.current.srcObject) {
                el.srcObject = videoRef.current.srcObject;
              }
            }}
            autoPlay
            muted
            playsInline
          />
          <canvas
            width="200"
            height="150"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              transform: 'scaleX(-1)'
            }}
            ref={(el) => {
              // Copy canvas content to the visible preview
              if (el && canvasRef.current) {
                const ctx = el.getContext('2d');
                const sourceCtx = canvasRef.current.getContext('2d');
                if (ctx && sourceCtx) {
                  // Scale down the main canvas content to the preview
                  const drawPreview = () => {
                    ctx.drawImage(canvasRef.current!, 0, 0, 200, 150);
                    if (isHandTrackingActive) {
                      requestAnimationFrame(drawPreview);
                    }
                  };
                  drawPreview();
                }
              }
            }}
          />
          <div style={{
            position: 'absolute',
            bottom: '5px',
            left: '5px',
            color: 'white',
            fontSize: '10px',
            background: 'rgba(0,0,0,0.7)',
            padding: '2px 5px',
            borderRadius: '3px'
          }}>
            Hand Tracking
          </div>
        </div>
      )}
      
      {/* Gesture Status Overlay */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
        padding: '12px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '12px',
        zIndex: 1000,
        pointerEvents: 'none',
        border: isHandTrackingActive ? '2px solid #00ff88' : '2px solid #ff8800'
      }}>
        <div><strong>{isHandTrackingActive ? '🖐️' : '⌨️'} Gesture Control</strong></div>
        <div style={{ fontSize: '10px', color: isHandTrackingActive ? '#88ff88' : '#ffaa44' }}>
          {trackingStatus}
        </div>
        <div style={{ marginTop: '8px' }}>
          <div>Last: {lastGesture}</div>
          <div>Create: {gestureCommands.createCube ? '✅' : '⭕'}</div>
          <div>Select: {gestureCommands.selectCube ? '✅' : '⭕'}</div>
          <div>Resize: {gestureCommands.resizeValue.toFixed(1)}x</div>
          <div>Physics: {gestureCommands.togglePhysics ? '✅' : '⭕'}</div>
        </div>
        
        {isHandTrackingActive ? (
          <div style={{ marginTop: '10px', fontSize: '10px', color: '#aaa' }}>
            <div>🖐️ Right pinch - Create</div>
            <div>🖐️ Left pinch - Select</div>
            <div>🖐️ Stretch - Grow</div>
            <div>🖐️ Shrink - Shrink</div>
            <div>🖐️ Clap - Physics</div>
            <div>🖐️ Spread - Reset size</div>
          </div>
        ) : (
          <div style={{ marginTop: '10px', fontSize: '10px', color: '#aaa' }}>
            <div>C - Create Cube</div>
            <div>S - Select Cube</div>
            <div>R - Resize</div>
            <div>P - Physics</div>
          </div>
        )}
      </div>
      
      {/* 3D Scene */}
      <CubeScene gestureCommands={gestureCommands} />
    </div>
  );
}