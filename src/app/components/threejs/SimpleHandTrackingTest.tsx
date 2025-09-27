'use client'

import React, { useEffect, useRef, useState } from 'react';
import CubeScene from './3dtesting';

export function SimpleHandTrackingTest() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastGestureTime = useRef<{[key: string]: number}>({});
  const [status, setStatus] = useState('Initializing...');
  const [gestureCommands, setGestureCommands] = useState({
    createCube: false,
    selectCube: false,
    resizeValue: 1.0,
    togglePhysics: false,
  });
  const [lastGesture, setLastGesture] = useState('');

  useEffect(() => {
    const testVideoElements = () => {
      console.log('🔍 Testing video elements...');
      console.log('Video ref:', videoRef.current);
      console.log('Canvas ref:', canvasRef.current);
      
      if (videoRef.current && canvasRef.current) {
        setStatus('✅ Video elements ready! Starting camera...');
        startCamera();
      } else {
        setStatus('❌ Video elements not found');
        setTimeout(testVideoElements, 1000); // Try again in 1 second
      }
    };

    const startCamera = async () => {
      try {
        console.log('📹 Requesting camera access...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 320, height: 240 } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStatus('📹 Camera active! Initializing real hand tracking...');
          initializeRealHandTracking();
        }
      } catch (error) {
        console.error('Camera error:', error);
        setStatus('⚠️ Camera failed - using keyboard controls only');
        setupKeyboardControls();
      }
    };

    const initializeRealHandTracking = async () => {
      try {
        console.log('🖐️ Loading MediaPipe for real hand detection...');
        
        // Try to load MediaPipe
        const { Hands } = await import('@mediapipe/hands');
        
        const hands = new Hands({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;
          }
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.5,
          selfieMode: true,
        });

        hands.onResults((results: any) => {
          processHandResults(results);
        });

        setStatus('🖐️ Real hand tracking active! Show your hands to the camera');
        
        // Start processing video frames
        const processFrame = async () => {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            try {
              await hands.send({ image: videoRef.current });
            } catch (error) {
              console.error('Frame processing error:', error);
            }
          }
          requestAnimationFrame(processFrame);
        };
        
        processFrame();
        
      } catch (error) {
        console.error('MediaPipe failed to load:', error);
        setStatus('⚠️ MediaPipe failed - using keyboard controls only');
        setupKeyboardControls();
      }
    };

    const processHandResults = (results: any) => {
      // Clear canvas
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw hand landmarks if hands detected
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
          const landmarks = results.multiHandLandmarks[i];
          const handedness = results.multiHandedness[i]?.label || 'Unknown';
          
          // Draw hand skeleton
          drawHand(ctx, landmarks, i === 0 ? '#00ff00' : '#0080ff');
        }
        
        // Handle single hand gestures
        if (results.multiHandLandmarks.length === 1) {
          const landmarks = results.multiHandLandmarks[0];
          const handedness = results.multiHandedness[0]?.label || 'Unknown';
          const gesture = detectSingleHandGesture(landmarks, handedness);
          
          if (gesture) {
            executeGesture(gesture);
          }
        }
        
        // Handle two-hand gestures (stretch/shrink)
        if (results.multiHandLandmarks.length === 2) {
          const twoHandGesture = detectTwoHandGesture(results);
          
          if (twoHandGesture) {
            executeGesture(twoHandGesture);
          }
        }
      }
    };

    const drawHand = (ctx: CanvasRenderingContext2D, landmarks: any[], color: string) => {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      
      // Draw landmarks as circles
      for (const landmark of landmarks) {
        const x = landmark.x * canvasRef.current!.width;
        const y = landmark.y * canvasRef.current!.height;
        
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fill();
      }
      
      // Draw hand connections
      const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8], // Index
        [0, 9], [9, 10], [10, 11], [11, 12], // Middle
        [0, 13], [13, 14], [14, 15], [15, 16], // Ring
        [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
      ];
      
      ctx.beginPath();
      for (const [start, end] of connections) {
        const startPoint = landmarks[start];
        const endPoint = landmarks[end];
        
        const startX = startPoint.x * canvasRef.current!.width;
        const startY = startPoint.y * canvasRef.current!.height;
        const endX = endPoint.x * canvasRef.current!.width;
        const endY = endPoint.y * canvasRef.current!.height;
        
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
      }
      ctx.stroke();
    };

    const detectSingleHandGesture = (landmarks: any[], handedness: string) => {
      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];
      const middleTip = landmarks[12];
      const ringTip = landmarks[16];
      const pinkyTip = landmarks[20];
      
      // Calculate distances
      const thumbIndexDist = Math.sqrt(
        (thumbTip.x - indexTip.x) ** 2 + (thumbTip.y - indexTip.y) ** 2
      );
      
      const fingersSpread = Math.sqrt(
        (indexTip.x - pinkyTip.x) ** 2 + (indexTip.y - pinkyTip.y) ** 2
      );
      
      // Pinch detection
      if (thumbIndexDist < 0.05) {
        return { type: 'PINCH', handedness };
      }
      
      // Spread detection
      if (fingersSpread > 0.2) {
        return { type: 'SPREAD', handedness };
      }
      
      return null;
    };

    const detectTwoHandGesture = (results: any) => {
      const leftHand = results.multiHandLandmarks[0];
      const rightHand = results.multiHandLandmarks[1];
      const leftHandedness = results.multiHandedness[0]?.label || 'Left';
      const rightHandedness = results.multiHandedness[1]?.label || 'Right';
      
      // Get thumb-index distances for both hands
      const leftThumbTip = leftHand[4];
      const leftIndexTip = leftHand[8];
      const rightThumbTip = rightHand[4];
      const rightIndexTip = rightHand[8];
      
      const leftPinchDist = Math.sqrt(
        (leftThumbTip.x - leftIndexTip.x) ** 2 + (leftThumbTip.y - leftIndexTip.y) ** 2
      );
      const rightPinchDist = Math.sqrt(
        (rightThumbTip.x - rightIndexTip.x) ** 2 + (rightThumbTip.y - rightIndexTip.y) ** 2
      );
      
      // Both hands must be pinching for stretch/shrink gestures
      const leftPinching = leftPinchDist < 0.08;
      const rightPinching = rightPinchDist < 0.08;
      
      if (leftPinching && rightPinching) {
        // Calculate hand positions for direction detection
        const leftCenter = {
          x: (leftThumbTip.x + leftIndexTip.x) / 2,
          y: (leftThumbTip.y + leftIndexTip.y) / 2
        };
        const rightCenter = {
          x: (rightThumbTip.x + rightIndexTip.x) / 2,
          y: (rightThumbTip.y + rightIndexTip.y) / 2
        };
        
        const horizontalSpread = Math.abs(leftCenter.x - rightCenter.x);
        const verticalSpread = Math.abs(leftCenter.y - rightCenter.y);
        const totalDistance = Math.sqrt(
          (leftCenter.x - rightCenter.x) ** 2 + (leftCenter.y - rightCenter.y) ** 2
        );
        
        // Determine if movement is primarily horizontal or vertical
        const isHorizontalPrimary = horizontalSpread > verticalSpread * 1.2;
        const isVerticalPrimary = verticalSpread > horizontalSpread * 1.2;
        
        // Store current measurement for comparison
        if (!detectTwoHandGesture.lastMeasurement) {
          detectTwoHandGesture.lastMeasurement = { totalDistance, timestamp: Date.now() };
          return null;
        }
        
        const timeDiff = Date.now() - detectTwoHandGesture.lastMeasurement.timestamp;
        if (timeDiff < 300) return null; // Wait for stable measurement
        
        const distanceChange = totalDistance - detectTwoHandGesture.lastMeasurement.totalDistance;
        
        // Update last measurement
        detectTwoHandGesture.lastMeasurement = { totalDistance, timestamp: Date.now() };
        
        // Must have significant change to register
        if (Math.abs(distanceChange) < 0.03) return null;
        
        if (distanceChange > 0) { // Hands moving apart = STRETCH
          if (isVerticalPrimary) {
            return { type: 'STRETCH_VERTICAL', handedness: 'Both' };
          } else if (isHorizontalPrimary) {
            return { type: 'STRETCH_HORIZONTAL', handedness: 'Both' };
          }
        } else { // Hands moving together = SHRINK
          if (isVerticalPrimary) {
            return { type: 'SHRINK_VERTICAL', handedness: 'Both' };
          } else if (isHorizontalPrimary) {
            return { type: 'SHRINK_HORIZONTAL', handedness: 'Both' };
          }
        }
      } else {
        // Reset measurement when hands are not both pinching
        detectTwoHandGesture.lastMeasurement = null;
      }
      
      return null;
    };

    const executeGesture = (gesture: { type: string, handedness: string }) => {
      const currentTime = Date.now();
      const key = `${gesture.type}_${gesture.handedness}`;
      
      // Debounce gestures (prevent rapid firing)
      const lastTime = lastGestureTime.current[key] || 0;
      if (currentTime - lastTime < 800) return; // 800ms debounce for two-hand gestures
      
      lastGestureTime.current[key] = currentTime;
      
      console.log('🖐️ Real gesture detected:', gesture);
      
      switch (gesture.type) {
        case 'PINCH':
          if (gesture.handedness === 'Right') {
            setLastGesture('CREATE (right pinch)');
            setGestureCommands(prev => ({ ...prev, createCube: !prev.createCube }));
          } else {
            setLastGesture('SELECT (left pinch)');
            setGestureCommands(prev => ({ ...prev, selectCube: !prev.selectCube }));
          }
          break;
          
        case 'STRETCH_HORIZONTAL':
          setLastGesture('STRETCH HORIZONTAL (both hands)');
          setGestureCommands(prev => ({ 
            ...prev, 
            resizeValue: Math.min(3.0, prev.resizeValue + 0.4) 
          }));
          break;
          
        case 'STRETCH_VERTICAL':
          setLastGesture('STRETCH VERTICAL (both hands)');
          setGestureCommands(prev => ({ 
            ...prev, 
            resizeValue: Math.min(3.0, prev.resizeValue + 0.4) 
          }));
          break;
          
        case 'SHRINK_HORIZONTAL':
          setLastGesture('SHRINK HORIZONTAL (both hands)');
          setGestureCommands(prev => ({ 
            ...prev, 
            resizeValue: Math.max(0.3, prev.resizeValue - 0.4) 
          }));
          break;
          
        case 'SHRINK_VERTICAL':
          setLastGesture('SHRINK VERTICAL (both hands)');
          setGestureCommands(prev => ({ 
            ...prev, 
            resizeValue: Math.max(0.3, prev.resizeValue - 0.4) 
          }));
          break;
          
        case 'SPREAD':
          if (gesture.handedness === 'Right') {
            setLastGesture('RESET SIZE (right spread)');
            setGestureCommands(prev => ({ ...prev, resizeValue: 1.0 }));
          } else {
            setLastGesture('PHYSICS (left spread)');
            setGestureCommands(prev => ({ ...prev, togglePhysics: !prev.togglePhysics }));
          }
          break;
      }
    };

    const setupKeyboardControls = () => {
      const handleKeyDown = (e: KeyboardEvent) => {
        switch (e.key.toLowerCase()) {
          case 'c':
            setLastGesture('CREATE (keyboard)');
            setGestureCommands(prev => ({ ...prev, createCube: !prev.createCube }));
            break;
          case 's':
            setLastGesture('SELECT (keyboard)');
            setGestureCommands(prev => ({ ...prev, selectCube: !prev.selectCube }));
            break;
          case 'r':
            setLastGesture('RESIZE (keyboard)');
            setGestureCommands(prev => ({ 
              ...prev, 
              resizeValue: prev.resizeValue >= 2 ? 0.5 : prev.resizeValue + 0.5 
            }));
            break;
          case 'p':
            setLastGesture('PHYSICS (keyboard)');
            setGestureCommands(prev => ({ ...prev, togglePhysics: !prev.togglePhysics }));
            break;
        }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    };

    // Start the test after a short delay
    setTimeout(testVideoElements, 500);
  }, []);

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {/* Always render video elements */}
      <video
        ref={videoRef}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          width: '200px',
          height: '150px',
          border: '2px solid #0080ff',
          borderRadius: '8px',
          transform: 'scaleX(-1)',
          background: '#000'
        }}
        autoPlay
        muted
        playsInline
      />
      
      <canvas
        ref={canvasRef}
        width="200"
        height="150"
        style={{
          position: 'absolute',
          top: '180px',
          right: '10px',
          border: '1px solid #ccc',
          borderRadius: '4px'
        }}
      />
      
      {/* Status Panel */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        background: 'rgba(0, 0, 0, 0.85)',
        color: 'white',
        padding: '8px 10px',
        borderRadius: '6px',
        fontFamily: 'monospace',
        fontSize: '11px',
        zIndex: 1000,
        minWidth: '200px',
        maxWidth: '220px'
      }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold' }}>🧪 Hand Tracking</div>
        <div style={{ marginTop: '3px', fontSize: '10px' }}>{status}</div>
        <div style={{ marginTop: '6px', fontSize: '10px' }}>
          <div><strong>Last:</strong> {lastGesture || 'None'}</div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
            <span>C:{gestureCommands.createCube ? '✅' : '⭕'}</span>
            <span>S:{gestureCommands.selectCube ? '✅' : '⭕'}</span>
            <span>R:{gestureCommands.resizeValue.toFixed(1)}x</span>
            <span>P:{gestureCommands.togglePhysics ? '✅' : '⭕'}</span>
          </div>
        </div>
        <div style={{ marginTop: '6px', fontSize: '9px', color: '#aaa', lineHeight: '1.2' }}>
          <div>✊ Pinch: R=Create, L=Select</div>
          <div>� Two-hand pinch + move: Stretch/Shrink</div>
          <div>🖐 Spread: R=Reset size, L=Physics</div>
        </div>
      </div>
      
      {/* Gesture Legend Panel */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
        padding: '12px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '10px',
        zIndex: 1000,
        minWidth: '280px',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#00ff88' }}>
          🖐️ Gesture Legend
        </div>
        
        {/* Single Hand Gestures */}
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#ffaa44', marginBottom: '4px' }}>
            Single Hand:
          </div>
          <div style={{ marginLeft: '8px', lineHeight: '1.3' }}>
            <div>✊ <strong>Right Pinch</strong> → Create Cube 🟦</div>
            <div>✊ <strong>Left Pinch</strong> → Select Cube 🎯</div>
            <div>🖐 <strong>Right Spread</strong> → Reset Size 📏</div>
            <div>🖐 <strong>Left Spread</strong> → Toggle Physics ⚡</div>
          </div>
        </div>
        
        {/* Two Hand Gestures */}
        <div style={{ marginBottom: '6px' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#88aaff', marginBottom: '4px' }}>
            Two Hands (both pinching):
          </div>
          <div style={{ marginLeft: '8px', lineHeight: '1.3' }}>
            <div>🤏 <strong>Move Apart ↔️</strong> → Stretch Horizontal 📈</div>
            <div>🤏 <strong>Move Apart ↕️</strong> → Stretch Vertical 📈</div>
            <div>🤏 <strong>Move Together ↔️</strong> → Shrink Horizontal 📉</div>
            <div>🤏 <strong>Move Together ↕️</strong> → Shrink Vertical 📉</div>
          </div>
        </div>
        
        {/* Keyboard Fallback */}
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.2)', paddingTop: '6px' }}>
          <div style={{ fontSize: '9px', color: '#aaa' }}>
            <strong>Keyboard:</strong> C=Create, S=Select, R=Resize, P=Physics
          </div>
        </div>
      </div>
      
      {/* 3D Scene */}
      <CubeScene gestureCommands={gestureCommands} />
    </div>
  );
}