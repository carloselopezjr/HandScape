'use client'

import React, { useEffect, useRef, useState } from 'react';
import CubeScene from './3dtesting';

export function SimpleHandTrackingTest() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastGestureTime = useRef<number>(0);
  const [status, setStatus] = useState('Initializing...');
  const [handsDetected, setHandsDetected] = useState<{
    count: number;
    leftHand: boolean;
    rightHand: boolean;
  }>({ count: 0, leftHand: false, rightHand: false });
  const [gestureCommands, setGestureCommands] = useState({
    createCube: false,
    selectCube: false,
    resizeValue: 1.0,
    moveCube: false,
    handPosition: { x: 0, y: 0, z: 0 },
    leftHandStretch: false,
    stretchDirection: 'none' as 'horizontal' | 'vertical' | 'none',
    stretchIntensity: 1.0,
  });
  const [lastGesture, setLastGesture] = useState('');

  useEffect(() => {
    const testVideoElements = () => {
      if (videoRef.current && canvasRef.current) {
        startCamera();
      } else {
        setTimeout(testVideoElements, 1000); // Try again after 1 second
      }
    };

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 320, height: 240 } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          initializeRealHandTracking();
        }
      } catch (error) {
        console.error('Camera error:', error);
        setStatus('⚠️ Camera failed - hand tracking disabled');
      }
    };

    const initializeRealHandTracking = async () => {
      try {
        
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
        setStatus('⚠️ MediaPipe failed - hand tracking disabled');
      }
    };

    const processHandResults = (results: any) => {
      // Clear canvas
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Update hand detection state
      let leftDetected = false;
      let rightDetected = false;
      
      // Draw hand landmarks if hands detected
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
          const landmarks = results.multiHandLandmarks[i];
          const handedness = results.multiHandedness[i]?.label || 'Unknown';
          
          // Track which hands are detected
          if (handedness === 'Left') leftDetected = true;
          if (handedness === 'Right') rightDetected = true;
          
          // Check for gestures with hand-specific filtering
          const fistGesture = detectFist(landmarks, handedness);
          const pointGesture = detectIndexFingerPointing(landmarks, handedness);
          const palmGesture = detectPalmOpen(landmarks, handedness);
          const leftStretchGesture = detectLeftHandStretch(landmarks, handedness);
          
          // Execute gestures with hand-specific rules:
          // - Left hand: Fist gestures (for moving cubes) and stretch gestures (for resizing)
          // - Right hand: Only palm open (for selecting) and pointing (for creating)
          if (fistGesture && handedness === 'Left') {
            executeGesture(fistGesture);
          } else if (leftStretchGesture && handedness === 'Left') {
            executeGesture(leftStretchGesture);
          } else if (pointGesture && handedness === 'Right') {
            executeGesture(pointGesture);
          } else if (palmGesture && handedness === 'Right') {
            executeGesture(palmGesture);
          }
          
          // Draw hand skeleton
          drawHand(ctx, landmarks, handedness === 'Left' ? '#00ff00' : '#9c52c7');
        }
        
        // Update hands detected state
        setHandsDetected({
          count: results.multiHandLandmarks.length,
          leftHand: leftDetected,
          rightHand: rightDetected
        });
      } else {
        // No hands detected
        setHandsDetected({ count: 0, leftHand: false, rightHand: false });
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

    const detectIndexFingerPointing = (landmarks: any[], handedness: string) => {
      // MediaPipe hand landmarks indices:
      // 8 = Index finger tip, 6 = Index finger middle joint, 5 = Index finger base
      // 12 = Middle finger tip, 16 = Ring finger tip, 20 = Pinky tip
      // 4 = Thumb tip
      
      const indexTip = landmarks[8];
      const indexMiddle = landmarks[6];
      const indexBase = landmarks[5];
      const middleTip = landmarks[12];
      const ringTip = landmarks[16];
      const pinkyTip = landmarks[20];
      const thumbTip = landmarks[4];
      const wrist = landmarks[0];
      
      // Check if index finger is extended (tip above middle joint)
      const indexExtended = indexTip.y < indexMiddle.y && indexMiddle.y < indexBase.y;
      
      // Check if other fingers are folded (tips below their middle joints)
      const middleFolded = middleTip.y > landmarks[10].y; // Middle finger middle joint
      const ringFolded = ringTip.y > landmarks[14].y; // Ring finger middle joint
      const pinkyFolded = pinkyTip.y > landmarks[18].y; // Pinky middle joint
      
      // Check if thumb is not extended upward (to distinguish from "thumbs up")
      const thumbNotPointing = Math.abs(thumbTip.y - wrist.y) < Math.abs(indexTip.y - wrist.y);
      
      // Check if index finger is pointing roughly upward (y coordinate smaller = higher up)
      const pointingUp = indexTip.y < indexBase.y - 0.05; // Some threshold for upward direction
      
      if (indexExtended && middleFolded && ringFolded && pinkyFolded && thumbNotPointing && pointingUp) {
        return { type: 'INDEX_POINT_UP', handedness };
      }
      
      return null;
    };

    const detectPalmOpen = (landmarks: any[], handedness: string) => {
      // MediaPipe hand landmarks indices for fingertips and joints
      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];
      const middleTip = landmarks[12];
      const ringTip = landmarks[16];
      const pinkyTip = landmarks[20];
      
      // Finger middle joints for extension check
      const thumbMiddle = landmarks[3];
      const indexMiddle = landmarks[6];
      const middleMiddle = landmarks[10];
      const ringMiddle = landmarks[14];
      const pinkyMiddle = landmarks[18];
      
      const wrist = landmarks[0];
      
      // Check if all fingers are extended (tips further from wrist than middle joints)
      const thumbExtended = Math.sqrt(
        Math.pow(thumbTip.x - wrist.x, 2) + Math.pow(thumbTip.y - wrist.y, 2)
      ) > Math.sqrt(
        Math.pow(thumbMiddle.x - wrist.x, 2) + Math.pow(thumbMiddle.y - wrist.y, 2)
      );
      
      const indexExtended = indexTip.y < indexMiddle.y;
      const middleExtended = middleTip.y < middleMiddle.y;
      const ringExtended = ringTip.y < ringMiddle.y;
      const pinkyExtended = pinkyTip.y < pinkyMiddle.y;
      
      // Check finger spread - calculate distances between fingertips
      const indexPinkySpread = Math.sqrt(
        Math.pow(indexTip.x - pinkyTip.x, 2) + Math.pow(indexTip.y - pinkyTip.y, 2)
      );
      
      const thumbIndexSpread = Math.sqrt(
        Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2)
      );
      
      // Minimum spread thresholds for palm open detection
      const sufficientFingerSpread = indexPinkySpread > 0.15; // Fingers spread wide
      const sufficientThumbSpread = thumbIndexSpread > 0.08; // Thumb separated from fingers
      
      if (thumbExtended && indexExtended && middleExtended && ringExtended && pinkyExtended && 
          sufficientFingerSpread && sufficientThumbSpread) {
        return { type: 'PALM_OPEN', handedness };
      }
      
      return null;
    };

    const detectFist = (landmarks: any[], handedness: string) => {
      // MediaPipe hand landmarks indices for fingertips and joints
      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];
      const middleTip = landmarks[12];
      const ringTip = landmarks[16];
      const pinkyTip = landmarks[20];
      
      // Finger middle joints for fold check
      const thumbMiddle = landmarks[3];
      const indexMiddle = landmarks[6];
      const middleMiddle = landmarks[10];
      const ringMiddle = landmarks[14];
      const pinkyMiddle = landmarks[18];
      
      const wrist = landmarks[0];
      
      // Calculate hand center for position tracking
      const handCenter = {
        x: (landmarks[0].x + landmarks[9].x + landmarks[13].x + landmarks[17].x) / 4,
        y: (landmarks[0].y + landmarks[9].y + landmarks[13].y + landmarks[17].y) / 4,
        z: (landmarks[0].z + landmarks[9].z + landmarks[13].z + landmarks[17].z) / 4
      };
      
      // Check if fingers are folded (tips closer to wrist than middle joints)
      const indexFolded = Math.sqrt(
        Math.pow(indexTip.x - wrist.x, 2) + Math.pow(indexTip.y - wrist.y, 2)
      ) < Math.sqrt(
        Math.pow(indexMiddle.x - wrist.x, 2) + Math.pow(indexMiddle.y - wrist.y, 2)
      );
      
      const middleFolded = Math.sqrt(
        Math.pow(middleTip.x - wrist.x, 2) + Math.pow(middleTip.y - wrist.y, 2)
      ) < Math.sqrt(
        Math.pow(middleMiddle.x - wrist.x, 2) + Math.pow(middleMiddle.y - wrist.y, 2)
      );
      
      const ringFolded = Math.sqrt(
        Math.pow(ringTip.x - wrist.x, 2) + Math.pow(ringTip.y - wrist.y, 2)
      ) < Math.sqrt(
        Math.pow(ringMiddle.x - wrist.x, 2) + Math.pow(ringMiddle.y - wrist.y, 2)
      );
      
      const pinkyFolded = Math.sqrt(
        Math.pow(pinkyTip.x - wrist.x, 2) + Math.pow(pinkyTip.y - wrist.y, 2)
      ) < Math.sqrt(
        Math.pow(pinkyMiddle.x - wrist.x, 2) + Math.pow(pinkyMiddle.y - wrist.y, 2)
      );
      
      // Thumb should also be tucked in for a proper fist
      const thumbFolded = Math.sqrt(
        Math.pow(thumbTip.x - wrist.x, 2) + Math.pow(thumbTip.y - wrist.y, 2)
      ) < Math.sqrt(
        Math.pow(thumbMiddle.x - wrist.x, 2) + Math.pow(thumbMiddle.y - wrist.y, 2)
      ) * 1.2; // Slightly more lenient for thumb
      
      if (indexFolded && middleFolded && ringFolded && pinkyFolded && thumbFolded) {
        return { type: 'FIST', handedness, handCenter };
      }
      
      return null;
    };

    const detectLeftHandStretch = (landmarks: any[], handedness: string) => {
      // Only process left hand for this gesture
      if (handedness !== 'Left') return null;
      
      // MediaPipe hand landmarks: 4 = Thumb tip, 8 = Index finger tip
      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];
      const wrist = landmarks[0];
      
      // Calculate the distance between thumb and index finger
      const thumbIndexDistance = Math.sqrt(
        Math.pow(thumbTip.x - indexTip.x, 2) + 
        Math.pow(thumbTip.y - indexTip.y, 2) + 
        Math.pow(thumbTip.z - indexTip.z, 2)
      );
      
      // Check if the stretch is significant (threshold for activation)
      const stretchThreshold = 0.08; // Adjust this value as needed
      const baseDistance = 0.05; // Base distance when fingers are close
      
      if (thumbIndexDistance > stretchThreshold) {
        // Calculate stretch intensity (how far apart the fingers are)
        const stretchIntensity = Math.min((thumbIndexDistance - baseDistance) / 0.1, 3.0); // Cap at 3x
        
        // Determine stretch direction based on the vector between thumb and index
        const deltaX = Math.abs(thumbTip.x - indexTip.x);
        const deltaY = Math.abs(thumbTip.y - indexTip.y);
        
        // If horizontal separation is greater than vertical, it's horizontal stretching
        const direction = deltaX > deltaY ? 'horizontal' : 'vertical';
        
        return { 
          type: 'LEFT_HAND_STRETCH', 
          handedness, 
          direction, 
          intensity: 1.0 + stretchIntensity // Base scale 1.0 + stretch factor
        };
      }
      
      return null;
    };

    const executeGesture = (gesture: { type: string, handedness: string, handCenter?: any, direction?: string, intensity?: number }) => {
      const currentTime = Date.now();
      
      // For fist and stretch gestures, allow continuous updates (no debounce for movement/resizing)
      if (gesture.type === 'FIST') {
        // Convert normalized coordinates to 3D space with improved control and boundary constraints
        const rawX = (gesture.handCenter.x - 0.5) * 80; 
        const rawY = (0.5 - gesture.handCenter.y) * 50;
        const rawZ = (gesture.handCenter.z - 0.5) * 80; 
        // Apply boundary constraints to keep cubes above baseplate and within reasonable bounds
        const handPosition = {
          x: Math.max(-45, Math.min(45, rawX)), // Constrain to baseplate X bounds
          y: Math.max(2.5, Math.min(50, rawY)), // Keep above baseplate (y=0) with 2.5 unit clearance
          z: Math.max(-45, Math.min(45, rawZ))  // Constrain to baseplate Z bounds
        };
        
        setLastGesture(`MOVE CUBE (LEFT hand fist)`);
        setGestureCommands(prev => ({ 
          ...prev, 
          moveCube: true,
          handPosition: handPosition,
          leftHandStretch: false, // Reset stretch when fist is detected
          stretchDirection: 'none',
          stretchIntensity: 1.0
        }));
        return;
      }
      
      // For stretch gesture, allow continuous updates
      if (gesture.type === 'LEFT_HAND_STRETCH') {
        const direction = gesture.direction || 'none';
        const intensity = gesture.intensity || 1.0;
        setLastGesture(`STRETCH CUBE (LEFT hand ${direction} stretch)`);
        setGestureCommands(prev => ({ 
          ...prev, 
          leftHandStretch: true,
          stretchDirection: direction as 'horizontal' | 'vertical' | 'none',
          stretchIntensity: intensity,
          moveCube: false // Reset movement when stretch is detected
        }));
        return;
      }
      
      // Reset movement and stretch when not making fist or stretch
      setGestureCommands(prev => ({ 
        ...prev, 
        moveCube: false,
        handPosition: { x: 0, y: 0, z: 0 },
        leftHandStretch: false,
        stretchDirection: 'none',
        stretchIntensity: 1.0
      }));
      
      // Debounce other gestures (prevent rapid firing)
      if (currentTime - lastGestureTime.current < 1000) return; // 1 second debounce
      
      lastGestureTime.current = currentTime;
      
      switch (gesture.type) {
        case 'INDEX_POINT_UP':
          setLastGesture(`CREATE CUBE (RIGHT hand index point up)`);
          setGestureCommands(prev => ({ ...prev, createCube: !prev.createCube }));
          break;
        case 'PALM_OPEN':
          setLastGesture(`SELECT CUBE (RIGHT hand palm open)`);
          setGestureCommands(prev => ({ ...prev, selectCube: !prev.selectCube }));
          break;
        case 'LEFT_HAND_STRETCH':
          const direction = gesture.direction || 'none';
          const intensity = gesture.intensity || 1.0;
          setLastGesture(`STRETCH CUBE (LEFT hand ${direction} stretch)`);
          setGestureCommands(prev => ({ 
            ...prev, 
            leftHandStretch: true,
            stretchDirection: direction as 'horizontal' | 'vertical' | 'none',
            stretchIntensity: intensity
          }));
          break;
      }
    };

    // Start the test after a short delay
    setTimeout(testVideoElements, 500);
  }, []);

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative'  }}>
      {/* Always render video elements */}
      <video
        ref={videoRef}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          width: '200px',
          height: '150px',
          borderRadius: '4px',
          transform: 'scaleX(-1)',
          background: '#000',
          zIndex: 100
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
          border: '1px solid #140d30',
          backdropFilter: 'blur(10px)',
          borderRadius: '4px',
          zIndex: 100
        }}
      />
      
      
      
      <div className="flex border-[#140d30] border-2 flex-col p-2 text-xs text-white backdrop-blur-xl bg-opacity-50 rounded-md absolute mt-2 ml-2 w-48 z-50">
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#ffaa44', marginBottom: '4px' }}>
            Detection Status:
          </div>
          <div style={{ marginLeft: '8px', lineHeight: '1.3' }}>
            <div> <strong>Left Hand:</strong> {handsDetected.leftHand ? '✅ Detected' : '❌ Not Found'}</div>
            <div> <strong>Right Hand:</strong> {handsDetected.rightHand ? '✅ Detected' : '❌ Not Found'}</div>
            <div> <strong>Hands Detected:</strong> {handsDetected.count}</div>
          </div>
        </div>
        
        <div style={{ marginBottom: '6px' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#88aaff', marginBottom: '4px' }}>
            Gestures:
          </div>
          <div className="ml-2">
            <div> <strong>Right Index Finger Point Up</strong> → Create Cube </div>
            <div> <strong>Open Right Palm</strong> → Select Cube </div>
            <div> <strong>Left Hand Fist</strong> → Move Selected Cube </div>
            <div> <strong>Left Hand Pinch</strong> → Resize Selected Cube </div>
          </div>
        </div>
      </div>
      
      
      {/* 3D Scene */}
      <CubeScene gestureCommands={gestureCommands} />
    </div>
  );
}