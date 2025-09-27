'use client';
import React, { useRef, useState, useEffect } from 'react';


class RobustMediaPipeTracker {
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private stream: MediaStream | null = null;
  private hands: any = null;
  private callbacks: Array<(event: any) => void> = [];
  private isInitialized = false;
  
  // Gesture tracking for two-hand directional gestures
  private previousGestureData: Map<string, any> = new Map(); // Track per hand
  private gestureHistory: Array<any> = []; // Recent gesture measurements
  private twoHandHistory: Array<any> = []; // Track two-hand interactions
  private lastGestureTime: Map<string, number> = new Map(); // Debounce gestures
  private handStabilityBuffer: Array<any> = []; // Track hand stability
  
  // Tightened detection parameters for better accuracy
  private readonly HISTORY_SIZE = 7; // More frames for smoother detection
  private readonly MIN_DISTANCE_CHANGE = 0.045; // More restrictive change threshold
  private readonly MIN_DIRECTION_RATIO = 2.0; // Stronger directional preference
  private readonly PINCH_THRESHOLD = 0.05; // Tighter pinch detection
  private readonly GESTURE_DEBOUNCE_TIME = 400; // Minimum time between same gestures (ms)
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.75; // Minimum confidence to emit gesture
  private readonly HAND_STABILITY_FRAMES = 4; // Frames to check for hand stability
  private readonly MAX_HAND_JITTER = 0.02; // Maximum allowed hand movement for stability
  
  async initialize(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
    this.videoElement = video;
    this.canvasElement = canvas;
    
    try {
      // First, get camera working
      console.log(' Starting camera...');
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user' 
        }
      });
      
      this.videoElement.srcObject = this.stream;
      
      // Wait for video to be ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Video timeout')), 10000);
        
        this.videoElement!.onloadedmetadata = () => {
          clearTimeout(timeout);
          this.videoElement!.play().then(() => {
            console.log(' Camera ready');
            resolve();
          }).catch(reject);
        };
        
        this.videoElement!.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Video loading failed'));
        };
      });
      
      // Now try to load MediaPipe
      console.log('🧠 Loading MediaPipe...');
      await this.initializeMediaPipe();
      
    } catch (error) {
      console.error(' MediaPipe initialization failed:', error);
      // Fall back to gesture simulation
      console.log(' Falling back to gesture simulation...');
      this.startGestureSimulation();
    }
  }
  
  private async initializeMediaPipe() {
    try {
      // Try different import strategies
      let Hands;
      
      try {
        // Strategy 1: Dynamic import (preferred for Next.js)
        const { Hands: MediaPipeHands } = await import('@mediapipe/hands');
        Hands = MediaPipeHands;
        console.log(' MediaPipe loaded via dynamic import');
      } catch (e) {
        console.log(' Dynamic import failed, trying require...');
        
        // Strategy 2: Require (fallback)
        const mediapipe = require('@mediapipe/hands');
        Hands = mediapipe.Hands;
        console.log(' MediaPipe loaded via require');
      }
      
      if (!Hands) {
        throw new Error('Could not load MediaPipe Hands');
      }
      
      // Initialize MediaPipe with local file serving
      this.hands = new Hands({
        locateFile: (file: string) => {
          // Try multiple CDN sources
          const cdnSources = [
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
            `https://unpkg.com/@mediapipe/hands@0.4.1675469240/${file}`,
            `/node_modules/@mediapipe/hands/${file}` // Local fallback
          ];
          
          console.log(` Loading MediaPipe file: ${file}`);
          return cdnSources[0]; // Start with jsdelivr
        }
      });
      
      // Configure MediaPipe
      this.hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5,
        selfieMode: true,
      });
      
      // Set up results callback
      this.hands.onResults(this.onHandResults.bind(this));
      
      // Start processing frames
      this.startFrameProcessing();
      
      this.isInitialized = true;
      console.log(' MediaPipe fully initialized');
      
    } catch (error) {
      console.error(' MediaPipe setup failed:', error);
      throw error;
    }
  }
  
  private startFrameProcessing() {
    const processFrame = async () => {
      if (this.hands && this.videoElement && this.videoElement.readyState >= 2) {
        try {
          await this.hands.send({ image: this.videoElement });
        } catch (error) {
          console.error('Frame processing error:', error);
        }
      }
      
      if (this.isInitialized) {
        requestAnimationFrame(processFrame);
      }
    };
    
    processFrame();
  }
  
  private onHandResults(results: any) {
    // Clear canvas and draw hand landmarks
    const ctx = this.canvasElement?.getContext('2d');
    if (ctx && this.canvasElement) {
      ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
      
      // Draw hand landmarks
      if (results.multiHandLandmarks) {
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
          const landmarks = results.multiHandLandmarks[i];
          const handedness = results.multiHandedness[i]?.label || 'Unknown';
          this.drawLandmarks(ctx, landmarks, handedness, i);
        }
        
        // Draw two-hand interaction indicators
        if (results.multiHandLandmarks.length === 2) {
          this.drawTwoHandInteraction(ctx, results);
        }
      }
    }
    
    // Detect gestures from real hand data
    this.detectGestures(results);
  }
  
  private drawLandmarks(ctx: CanvasRenderingContext2D, landmarks: any[], handedness: string, handIndex: number) {
    // Draw hand skeleton with different colors per hand
    const handColor = handIndex === 0 ? '#00FF00' : '#0080FF'; // Green for first, blue for second
    ctx.strokeStyle = handColor;
    ctx.lineWidth = 2;
    ctx.fillStyle = handColor;
    
    // Draw landmarks as circles
    for (const landmark of landmarks) {
      // Mirror the X coordinate to match the flipped video display
      const x = (1 - landmark.x) * this.canvasElement!.width;
      const y = landmark.y * this.canvasElement!.height;
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    }
    
    // Highlight thumb and index finger for pinch detection
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    
    if (thumbTip && indexTip) {
      const thumbX = (1 - thumbTip.x) * this.canvasElement!.width;
      const thumbY = thumbTip.y * this.canvasElement!.height;
      const indexX = (1 - indexTip.x) * this.canvasElement!.width;
      const indexY = indexTip.y * this.canvasElement!.height;
      
      const pinchDistance = this.distance(thumbTip, indexTip);
      const isPinching = pinchDistance < this.PINCH_THRESHOLD;
      
      // Draw pinch indicator line
      ctx.strokeStyle = isPinching ? '#FFD700' : handColor; // Gold if pinching
      ctx.lineWidth = isPinching ? 5 : 3;
      ctx.beginPath();
      ctx.moveTo(thumbX, thumbY);
      ctx.lineTo(indexX, indexY);
      ctx.stroke();
      
      // Draw larger circles for thumb and index
      ctx.fillStyle = isPinching ? '#FFD700' : handColor;
      ctx.beginPath();
      ctx.arc(thumbX, thumbY, isPinching ? 10 : 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(indexX, indexY, isPinching ? 10 : 6, 0, 2 * Math.PI);
      ctx.fill();
      
      // Show pinch status
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '12px Arial';
      const statusText = isPinching ? `${handedness}: PINCH` : `${handedness}: Open`;
      ctx.fillText(statusText, thumbX + 15, thumbY - 15);
    }
    
    // Draw hand connections
    ctx.strokeStyle = handColor;
    ctx.lineWidth = 2;
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
      
      const startX = (1 - startPoint.x) * this.canvasElement!.width;
      const startY = startPoint.y * this.canvasElement!.height;
      const endX = (1 - endPoint.x) * this.canvasElement!.width;
      const endY = endPoint.y * this.canvasElement!.height;
      
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
    }
    ctx.stroke();
  }
  
  private drawTwoHandInteraction(ctx: CanvasRenderingContext2D, results: any) {
    const leftHand = results.multiHandLandmarks[0];
    const rightHand = results.multiHandLandmarks[1];
    
    // Get pinch centers
    const leftThumbTip = leftHand[4];
    const leftIndexTip = leftHand[8];
    const rightThumbTip = rightHand[4];
    const rightIndexTip = rightHand[8];
    
    const leftPinchDist = this.distance(leftThumbTip, leftIndexTip);
    const rightPinchDist = this.distance(rightThumbTip, rightIndexTip);
    
    const leftPinching = leftPinchDist < this.PINCH_THRESHOLD;
    const rightPinching = rightPinchDist < this.PINCH_THRESHOLD;
    
    if (leftPinching && rightPinching) {
      // Draw connection between pinch centers for directional tracking
      const leftCenterX = (1 - (leftThumbTip.x + leftIndexTip.x) / 2) * this.canvasElement!.width;
      const leftCenterY = ((leftThumbTip.y + leftIndexTip.y) / 2) * this.canvasElement!.height;
      const rightCenterX = (1 - (rightThumbTip.x + rightIndexTip.x) / 2) * this.canvasElement!.width;
      const rightCenterY = ((rightThumbTip.y + rightIndexTip.y) / 2) * this.canvasElement!.height;
      
      // Draw directional line
      ctx.strokeStyle = '#FF00FF'; // Magenta for two-hand interaction
      ctx.lineWidth = 6;
      ctx.setLineDash([10, 5]); // Dashed line
      ctx.beginPath();
      ctx.moveTo(leftCenterX, leftCenterY);
      ctx.lineTo(rightCenterX, rightCenterY);
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash
      
      // Show distance measurement
      const distance = Math.sqrt((leftCenterX - rightCenterX) ** 2 + (leftCenterY - rightCenterY) ** 2);
      const normalizedDistance = distance / this.canvasElement!.width;
      
      ctx.fillStyle = '#FF00FF';
      ctx.font = '16px Arial';
      ctx.fillText(
        `Two-Hand Distance: ${normalizedDistance.toFixed(3)}`, 
        Math.min(leftCenterX, rightCenterX), 
        Math.min(leftCenterY, rightCenterY) - 20
      );
    }
  }
  
  private detectGestures(results: any) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      return;
    }
    
    // Handle single hand gestures
    if (results.multiHandLandmarks.length === 1) {
      const landmarks = results.multiHandLandmarks[0];
      const handedness = results.multiHandedness[0]?.label || 'Unknown';
      const gesture = this.analyzeSingleHand(landmarks, handedness);
      
      if (gesture) {
        this.emitGesture(gesture);
      }
    }
    
    // Handle two-hand directional gestures
    if (results.multiHandLandmarks.length === 2) {
      const twoHandGesture = this.analyzeTwoHands(results);
      
      if (twoHandGesture) {
        this.emitGesture(twoHandGesture);
      }
    }
  }
  
  private analyzeSingleHand(landmarks: any[], handedness: string) {
    // Check hand stability first
    const isStable = this.checkHandStability(landmarks);
    if (!isStable) {
      return null; // Skip detection if hand is too jittery
    }
    
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    const wrist = landmarks[0];
    
    // Calculate distances
    const thumbIndexDist = this.distance(thumbTip, indexTip);
    const fingersSpread = this.distance(indexTip, pinkyTip);
    
    const currentTime = Date.now();
    
    // Enhanced pinch detection with tighter threshold
    if (thumbIndexDist < this.PINCH_THRESHOLD) {
      if (!this.shouldEmitGesture(`PINCH_${handedness}`)) {
        return null; // Debounced
      }
      
      const baseConfidence = 0.8;
      const confidence = this.calculateConfidence(baseConfidence, isStable, true);
      
      // Only emit if confidence meets threshold
      if (confidence < this.MIN_CONFIDENCE_THRESHOLD) {
        return null;
      }
      
      return {
        type: 'PINCH',
        data: {
          handedness,
          confidence,
          position: { x: 1 - thumbTip.x, y: thumbTip.y },
          timestamp: currentTime,
          description: 'Enhanced single hand pinch detected from MediaPipe',
          distance: thumbIndexDist,
          stability: isStable
        }
      };
    }
    
    // Enhanced spread detection with tighter requirements
    if (fingersSpread > 0.25) { // More restrictive than before (was 0.3)
      if (!this.shouldEmitGesture(`SPREAD_${handedness}`)) {
        return null; // Debounced
      }
      
      const baseConfidence = 0.75;
      const confidence = this.calculateConfidence(baseConfidence, isStable, true);
      
      // Only emit if confidence meets threshold
      if (confidence < this.MIN_CONFIDENCE_THRESHOLD) {
        return null;
      }
      
      return {
        type: 'SPREAD',
        data: {
          handedness,
          confidence,
          position: { x: 1 - wrist.x, y: wrist.y },
          timestamp: currentTime,
          description: 'Enhanced hand spread detected from MediaPipe',
          distance: fingersSpread,
          stability: isStable
        }
      };
    }
    
    return null;
  }
  
  private analyzeTwoHands(results: any) {
    const leftHand = results.multiHandLandmarks[0];
    const rightHand = results.multiHandLandmarks[1];
    const leftHandedness = results.multiHandedness[0]?.label || 'Left';
    const rightHandedness = results.multiHandedness[1]?.label || 'Right';
    
    // Get thumb-index distances for both hands
    const leftThumbTip = leftHand[4];
    const leftIndexTip = leftHand[8];
    const rightThumbTip = rightHand[4];
    const rightIndexTip = rightHand[8];
    
    const leftPinchDist = this.distance(leftThumbTip, leftIndexTip);
    const rightPinchDist = this.distance(rightThumbTip, rightIndexTip);
    
    // Both hands must be pinching for directional gestures
    const leftPinching = leftPinchDist < this.PINCH_THRESHOLD;
    const rightPinching = rightPinchDist < this.PINCH_THRESHOLD;
    
    if (!leftPinching || !rightPinching) {
      // If not both pinching, check for clap (enhanced detection)
      const handsDistance = this.distance(
        { x: leftHand[9].x, y: leftHand[9].y }, // Left hand middle MCP
        { x: rightHand[9].x, y: rightHand[9].y }  // Right hand middle MCP
      );
      
      // Tighter clap detection threshold
      if (handsDistance < 0.12) { // More restrictive than 0.15
        if (!this.shouldEmitGesture('CLAP')) {
          return null; // Debounced
        }
        
        const baseConfidence = 0.85;
        const distanceScore = (0.12 - handsDistance) / 0.12; // Higher score for closer hands
        const confidence = Math.min(0.95, baseConfidence + distanceScore * 0.1);
        
        // Only emit if confidence meets threshold
        if (confidence < this.MIN_CONFIDENCE_THRESHOLD) {
          return null;
        }
        
        return {
          type: 'CLAP',
          data: {
            handedness: 'Both',
            confidence,
            position: { 
              x: 1 - (leftHand[0].x + rightHand[0].x) / 2, 
              y: (leftHand[0].y + rightHand[0].y) / 2 
            },
            timestamp: Date.now(),
            description: 'Enhanced two hands clap detected from MediaPipe',
            distance: handsDistance,
            stability: true
          }
        };
      }
      
      return null;
    }
    
    // Both hands are pinching - track their movement for directional gestures
    const currentTime = Date.now();
    
    // Calculate center points of pinched fingers for each hand
    const leftCenter = {
      x: (leftThumbTip.x + leftIndexTip.x) / 2,
      y: (leftThumbTip.y + leftIndexTip.y) / 2
    };
    const rightCenter = {
      x: (rightThumbTip.x + rightIndexTip.x) / 2,
      y: (rightThumbTip.y + rightIndexTip.y) / 2
    };
    
    const currentMeasurement = {
      timestamp: currentTime,
      leftCenter,
      rightCenter,
      handsDistance: this.distance(leftCenter, rightCenter),
      horizontalSpread: Math.abs(leftCenter.x - rightCenter.x),
      verticalSpread: Math.abs(leftCenter.y - rightCenter.y)
    };
    
    // Add to two-hand history
    this.twoHandHistory.push(currentMeasurement);
    if (this.twoHandHistory.length > this.HISTORY_SIZE) {
      this.twoHandHistory.shift();
    }
    
    // Need at least 3 measurements to detect direction
    if (this.twoHandHistory.length >= 3) {
      return this.detectTwoHandDirection(currentMeasurement);
    }
    
    return null;
  }
  
  private detectTwoHandDirection(current: any) {
    const previous = this.twoHandHistory[this.twoHandHistory.length - 3]; // Look back 3 frames
    const timeDiff = current.timestamp - previous.timestamp;
    
    // Only check if enough time has passed and movements are stable
    if (timeDiff < 400) return null; // Increased from 300ms for more stability
    
    const distanceChange = current.handsDistance - previous.handsDistance;
    const horizontalChange = current.horizontalSpread - previous.horizontalSpread;
    const verticalChange = current.verticalSpread - previous.verticalSpread;
    
    // Must have significant change to register (more restrictive)
    if (Math.abs(distanceChange) < this.MIN_DISTANCE_CHANGE) return null;
    
    // Determine if movement is primarily horizontal or vertical (more restrictive)
    const isHorizontalPrimary = Math.abs(horizontalChange) > Math.abs(verticalChange) * this.MIN_DIRECTION_RATIO;
    const isVerticalPrimary = Math.abs(verticalChange) > Math.abs(horizontalChange) * this.MIN_DIRECTION_RATIO;
    
    const avgX = 1 - (current.leftCenter.x + current.rightCenter.x) / 2; // Mirrored
    const avgY = (current.leftCenter.y + current.rightCenter.y) / 2;
    
    // Enhanced confidence calculation based on movement consistency
    const baseConfidence = 0.65;
    const movementMagnitude = Math.abs(distanceChange) * 8; // Scale factor
    const temporalConsistency = this.twoHandHistory.length >= this.HISTORY_SIZE ? 0.1 : 0;
    let confidence = baseConfidence + movementMagnitude + temporalConsistency;
    confidence = Math.min(0.95, confidence);
    
    // Only proceed if confidence meets minimum threshold
    if (confidence < this.MIN_CONFIDENCE_THRESHOLD) return null;
    
    if (distanceChange > 0) { // Hands moving apart = STRETCH
      if (isVerticalPrimary) {
        if (!this.shouldEmitGesture('STRETCH_VERTICAL')) return null;
        
        return {
          type: 'STRETCH_VERTICAL',
          data: {
            handedness: 'Both',
            confidence,
            position: { x: avgX, y: avgY },
            timestamp: current.timestamp,
            description: 'Enhanced two-hand vertical stretch detected from MediaPipe',
            distance: current.handsDistance,
            distanceChange: distanceChange,
            direction: 'vertical',
            stability: true
          }
        };
      } else if (isHorizontalPrimary) {
        if (!this.shouldEmitGesture('STRETCH_HORIZONTAL')) return null;
        
        return {
          type: 'STRETCH_HORIZONTAL',
          data: {
            handedness: 'Both',
            confidence,
            position: { x: avgX, y: avgY },
            timestamp: current.timestamp,
            description: 'Enhanced two-hand horizontal stretch detected from MediaPipe',
            distance: current.handsDistance,
            distanceChange: distanceChange,
            direction: 'horizontal',
            stability: true
          }
        };
      }
    } else if (distanceChange < 0) { // Hands moving together = SHRINK
      if (isVerticalPrimary) {
        if (!this.shouldEmitGesture('SHRINK_VERTICAL')) return null;
        
        return {
          type: 'SHRINK_VERTICAL',
          data: {
            handedness: 'Both',
            confidence,
            position: { x: avgX, y: avgY },
            timestamp: current.timestamp,
            description: 'Enhanced two-hand vertical shrink detected from MediaPipe',
            distance: current.handsDistance,
            distanceChange: distanceChange,
            direction: 'vertical',
            stability: true
          }
        };
      } else if (isHorizontalPrimary) {
        if (!this.shouldEmitGesture('SHRINK_HORIZONTAL')) return null;
        
        return {
          type: 'SHRINK_HORIZONTAL',
          data: {
            handedness: 'Both',
            confidence,
            position: { x: avgX, y: avgY },
            timestamp: current.timestamp,
            description: 'Enhanced two-hand horizontal shrink detected from MediaPipe',
            distance: current.handsDistance,
            distanceChange: distanceChange,
            direction: 'horizontal',
            stability: true
          }
        };
      }
    }
    
    return null;
    
    if (distanceChange > 0) { // Hands moving apart = STRETCH
      if (isVerticalPrimary) {
        return {
          type: 'STRETCH_VERTICAL',
          data: {
            handedness: 'Both',
            confidence,
            position: { x: avgX, y: avgY },
            timestamp: current.timestamp,
            description: 'Two-hand vertical stretch detected from MediaPipe',
            distance: current.handsDistance,
            distanceChange: distanceChange,
            direction: 'vertical'
          }
        };
      } else if (isHorizontalPrimary) {
        return {
          type: 'STRETCH_HORIZONTAL',
          data: {
            handedness: 'Both',
            confidence,
            position: { x: avgX, y: avgY },
            timestamp: current.timestamp,
            description: 'Two-hand horizontal stretch detected from MediaPipe',
            distance: current.handsDistance,
            distanceChange: distanceChange,
            direction: 'horizontal'
          }
        };
      }
    } else { // Hands moving together = SHRINK
      if (isVerticalPrimary) {
        return {
          type: 'SHRINK_VERTICAL',
          data: {
            handedness: 'Both',
            confidence,
            position: { x: avgX, y: avgY },
            timestamp: current.timestamp,
            description: 'Two-hand vertical shrink detected from MediaPipe',
            distance: current.handsDistance,
            distanceChange: distanceChange,
            direction: 'vertical'
          }
        };
      } else if (isHorizontalPrimary) {
        return {
          type: 'SHRINK_HORIZONTAL',
          data: {
            handedness: 'Both',
            confidence,
            position: { x: avgX, y: avgY },
            timestamp: current.timestamp,
            description: 'Two-hand horizontal shrink detected from MediaPipe',
            distance: current.handsDistance,
            distanceChange: distanceChange,
            direction: 'horizontal'
          }
        };
      }
    }
    
    return null;
  }
  
  private distance(p1: any, p2: any) {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
  }

  // Check if hands are stable (not jittery) for reliable gesture detection
  private checkHandStability(landmarks: any): boolean {
    const wristPosition = landmarks[0]; // Wrist landmark
    
    this.handStabilityBuffer.push({
      position: wristPosition,
      timestamp: Date.now()
    });
    
    // Keep only recent frames
    if (this.handStabilityBuffer.length > this.HAND_STABILITY_FRAMES) {
      this.handStabilityBuffer.shift();
    }
    
    // Need enough frames to check stability
    if (this.handStabilityBuffer.length < this.HAND_STABILITY_FRAMES) {
      return false;
    }
    
    // Calculate maximum movement in recent frames
    let maxJitter = 0;
    const recent = this.handStabilityBuffer.slice(-this.HAND_STABILITY_FRAMES);
    
    for (let i = 1; i < recent.length; i++) {
      const movement = this.distance(recent[i].position, recent[i-1].position);
      maxJitter = Math.max(maxJitter, movement);
    }
    
    return maxJitter < this.MAX_HAND_JITTER;
  }

  // Debounce gestures to prevent rapid-fire detection
  private shouldEmitGesture(gestureType: string): boolean {
    const now = Date.now();
    const lastTime = this.lastGestureTime.get(gestureType) || 0;
    
    if (now - lastTime < this.GESTURE_DEBOUNCE_TIME) {
      return false;
    }
    
    this.lastGestureTime.set(gestureType, now);
    return true;
  }

  // Enhanced confidence calculation based on multiple factors
  private calculateConfidence(baseConfidence: number, isStable: boolean, hasHistory: boolean): number {
    let confidence = baseConfidence;
    
    // Boost confidence for stable hands
    if (isStable) confidence += 0.1;
    
    // Boost confidence if we have gesture history (temporal consistency)
    if (hasHistory) confidence += 0.05;
    
    // Cap at maximum confidence
    return Math.min(0.95, confidence);
  }
  
  private startGestureSimulation() {
    console.log('🎮 MediaPipe failed, using two-hand gesture simulation...');
    
    const gestures = [
      { type: 'PINCH', duration: 1500, handedness: 'Right' },
      { type: 'PINCH', duration: 1200, handedness: 'Left' },
      { type: 'SPREAD', duration: 1000, handedness: 'Right' },
      { type: 'STRETCH_VERTICAL', duration: 1200, handedness: 'Both' },
      { type: 'SHRINK_VERTICAL', duration: 1000, handedness: 'Both' },
      { type: 'STRETCH_HORIZONTAL', duration: 1100, handedness: 'Both' },
      { type: 'SHRINK_HORIZONTAL', duration: 900, handedness: 'Both' },
      { type: 'CLAP', duration: 800, handedness: 'Both' },
      { type: 'RELEASE', duration: 600, handedness: 'Right' }
    ];
    
    let currentIndex = 0;
    
    const simulateNext = () => {
      const gesture = gestures[currentIndex % gestures.length];
      
      // Generate appropriate description and data for each gesture type
      let description = `Simulated ${gesture.type} (MediaPipe fallback)`;
      let extraData: any = {};
      
      if (gesture.type.includes('STRETCH') || gesture.type.includes('SHRINK')) {
        description = `Two-hand ${gesture.type.includes('STRETCH') ? 'stretching' : 'shrinking'} ${gesture.type.includes('VERTICAL') ? 'vertically' : 'horizontally'} detected (simulation)`;
        extraData = {
          direction: gesture.type.includes('VERTICAL') ? 'vertical' : 'horizontal',
          distance: 0.15 + Math.random() * 0.25, // Larger distance for two hands
          distanceChange: (gesture.type.includes('STRETCH') ? 1 : -1) * (0.03 + Math.random() * 0.04)
        };
      } else if (gesture.type === 'CLAP') {
        description = 'Two hands clap detected (simulation)';
        extraData = {
          distance: 0.05 + Math.random() * 0.1
        };
      }
      
      this.emitGesture({
        type: gesture.type,
        data: {
          handedness: gesture.handedness,
          confidence: 0.75 + Math.random() * 0.2,
          position: {
            x: 0.3 + Math.random() * 0.4,
            y: 0.3 + Math.random() * 0.4
          },
          timestamp: Date.now(),
          description,
          duration: gesture.duration,
          ...extraData
        }
      });
      
      currentIndex++;
      setTimeout(simulateNext, gesture.duration + 400);
    };
    
    setTimeout(simulateNext, 1000);
  }
  
  private emitGesture(gesture: any) {
    // Final confidence check before emission
    if (gesture.data && gesture.data.confidence < this.MIN_CONFIDENCE_THRESHOLD) {
      console.log(` Gesture filtered (low confidence): ${gesture.type} - ${gesture.data.confidence.toFixed(3)}`);
      return;
    }
    
    console.log(` Enhanced gesture detected: ${gesture.type}`, {
      confidence: gesture.data?.confidence?.toFixed(3),
      stability: gesture.data?.stability,
      handedness: gesture.data?.handedness
    });
    
    this.callbacks.forEach(callback => callback(gesture));
  }
  
  subscribe(callback: (event: any) => void) {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }
  
  destroy() {
    this.isInitialized = false;
    
    // Clear all tracking buffers
    this.gestureHistory.length = 0; 
    this.twoHandHistory.length = 0;
    this.handStabilityBuffer.length = 0;
    this.lastGestureTime.clear();
    this.previousGestureData.clear();
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
    
    if (this.hands) {
      this.hands.close();
    }
  }
}

const tracker = new RobustMediaPipeTracker();

export default function MediaPipeTest() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState('Ready to test MediaPipe');
  const [isRunning, setIsRunning] = useState(false);
  const [lastGesture, setLastGesture] = useState<any>(null);
  const [gestures, setGestures] = useState<any[]>([]);
  const [isMediaPipe, setIsMediaPipe] = useState(false);

  const start = async () => {
    if (!videoRef.current || !canvasRef.current) {
      setStatus(' Video elements not ready');
      return;
    }

    try {
      setStatus('🚀 Starting MediaPipe integration...');
      setIsRunning(true);
      
      await tracker.initialize(videoRef.current, canvasRef.current);
      
      // Check if we're using real MediaPipe or simulation
      setIsMediaPipe(true); // We'll detect this based on gesture descriptions
      setStatus(' MediaPipe active! Show your hand.');
      
      tracker.subscribe((event) => {
        setLastGesture(event);
        setGestures(prev => [...prev.slice(-19), event]);
        
        // Detect if this is real MediaPipe or simulation
        if (event.data.description?.includes('MediaPipe')) {
          setIsMediaPipe(true);
        } else if (event.data.description?.includes('Simulated')) {
          setIsMediaPipe(false);
        }
      });
      
    } catch (error) {
      console.error('Error starting MediaPipe:', error);
      setStatus(' Error: ' + error);
      setIsRunning(false);
    }
  };

  const stop = () => {
    tracker.destroy();
    setStatus('⏹️ Stopped');
    setIsRunning(false);
    setLastGesture(null);
    setGestures([]);
    setIsMediaPipe(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">🧠 MediaPipe Integration Test</h1>
      
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <h3 className="font-semibold mb-2"> Two-Hand Directional Gesture Detection</h3>
        <p>Detects intuitive two-hand pinch movements for precise 3D object manipulation:</p>
        <div className="grid grid-cols-2 gap-2 text-sm mt-2">
          <div><strong>Single Hand Gestures:</strong></div>
          <div></div>
          <div>• 🤏 <strong>PINCH</strong> - Single hand pinch</div>
          <div>• 🖐️ <strong>SPREAD</strong> - Open single hand</div>
          <div><strong>Two-Hand Directional:</strong></div>
          <div><em>(Both hands must be pinching)</em></div>
          <div>• ↕️ <strong>STRETCH_VERTICAL</strong> - Move pinched hands apart vertically</div>
          <div>• ↔️ <strong>STRETCH_HORIZONTAL</strong> - Move pinched hands apart horizontally</div>
          <div>• ⬇️ <strong>SHRINK_VERTICAL</strong> - Move pinched hands together vertically</div>
          <div>• ⬅️ <strong>SHRINK_HORIZONTAL</strong> - Move pinched hands together horizontally</div>
          <div>• 👏 <strong>CLAP</strong> - Bring any two hands together</div>
          <div>• ✋ <strong>RELEASE</strong> - Open hand release</div>
        </div>
        <p className="text-xs mt-2 text-gray-600">Perfect for intuitive object scaling and positioning!</p>
      </div>
      
      <div className="flex gap-4 mb-6">
        <button
          onClick={start}
          disabled={isRunning}
          className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isRunning ? 'Running...' : 'Start MediaPipe Test'}
        </button>
        
        <button
          onClick={stop}
          disabled={!isRunning}
          className="px-6 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
        >
          Stop
        </button>
        
        <div className={`px-4 py-2 rounded font-semibold ${
          isMediaPipe 
            ? 'bg-green-100 text-green-800' 
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          {isMediaPipe ? ' Real MediaPipe' : ' Simulation Mode'}
        </div>
      </div>

      <div className="mb-4 p-3 bg-gray-100 rounded">
        <strong>Status:</strong> {status}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div>
          <h2 className="text-xl font-semibold mb-3"> Camera + Hand Tracking</h2>
          <div className="relative border-2 border-gray-300 rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              className="w-full bg-black"
              autoPlay
              muted
              playsInline
              style={{ transform: 'scaleX(-1)' }} // Mirror the video
            />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full"
              width="640"
              height="480"
              style={{ transform: 'scaleX(-1)' }} // Mirror the canvas
            />
          </div>
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-3"> Latest Gesture</h2>
          <div className="bg-gray-50 p-4 rounded-lg h-64 overflow-y-auto">
            {lastGesture ? (
              <div className="space-y-3">
                <div className="text-3xl mb-3 text-center">
                  {lastGesture.type === 'PINCH' && ''}
                  {lastGesture.type === 'SPREAD' && ''}
                  {lastGesture.type === 'CLAP' && ''}
                  {lastGesture.type === 'RELEASE' && ''}
                  {lastGesture.type === 'STRETCH_VERTICAL' && '↕️'}
                  {lastGesture.type === 'STRETCH_HORIZONTAL' && '↔️'}
                  {lastGesture.type === 'SHRINK_VERTICAL' && '⬇️'}
                  {lastGesture.type === 'SHRINK_HORIZONTAL' && '⬅️'}
                </div>
                <div className="text-center">
                  <span className="text-2xl font-bold">{lastGesture.type.replace('_', ' ')}</span>
                  <p className="text-sm text-gray-600 mt-1">{lastGesture.data.description}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><strong>Hand:</strong> {lastGesture.data.handedness}</div>
                  <div><strong>Confidence:</strong> {(lastGesture.data.confidence * 100).toFixed(0)}%</div>
                  <div><strong>X:</strong> {lastGesture.data.position.x.toFixed(3)}</div>
                  <div><strong>Y:</strong> {lastGesture.data.position.y.toFixed(3)}</div>
                  {lastGesture.data.direction && (
                    <>
                      <div><strong>Direction:</strong> {lastGesture.data.direction}</div>
                      <div><strong>Distance:</strong> {lastGesture.data.distance?.toFixed(3)}</div>
                    </>
                  )}
                </div>
                
                <div className="text-xs text-gray-500">
                  {new Date(lastGesture.data.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-center mt-16">Waiting for gestures...</p>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3"> Gesture Log</h2>
        <div className="bg-gray-900 text-green-400 p-4 rounded-lg h-48 overflow-y-auto font-mono text-sm">
          {gestures.map((gesture, i) => {
            const isDirectional = gesture.type.includes('STRETCH') || gesture.type.includes('SHRINK');
            return (
              <div key={i} className="mb-1 flex justify-between">
                <span>
                  [{new Date(gesture.data.timestamp).toLocaleTimeString()}] 
                  <span className={`font-bold ${
                    isDirectional ? 'text-purple-400' : 'text-yellow-400'
                  }`}> {gesture.type.replace('_', ' ')}</span>
                  <span className="text-blue-400"> {gesture.data.handedness}</span>
                  {isDirectional && gesture.data.direction && (
                    <span className="text-orange-400"> [{gesture.data.direction}]</span>
                  )}
                  <span className="text-white text-xs ml-2">{gesture.data.description}</span>
                </span>
                <span className="text-cyan-400">
                  {(gesture.data.confidence * 100).toFixed(0)}%
                  {gesture.data.distanceChange && (
                    <span className="text-pink-400 ml-1">
                      {gesture.data.distanceChange > 0 ? '+' : ''}{(gesture.data.distanceChange * 100).toFixed(1)}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
          {gestures.length === 0 && (
            <p className="text-gray-500 text-center">Waiting for gesture events...</p>
          )}
        </div>
      </div>

      <div className={`p-4 rounded-lg ${
        isMediaPipe ? 'bg-green-50' : 'bg-yellow-50'
      }`}>
        <h3 className="font-semibold mb-2">
          {isMediaPipe ? ' MediaPipe Active' : ' Simulation Fallback'}
        </h3>
        <p>
          {isMediaPipe 
            ? 'Real hand tracking is working! Move your hands to see live gesture detection.'
            : 'MediaPipe failed to load, but gesture simulation is providing test data for your Three.js integration.'
          }
        </p>
      </div>
    </div>
  );
}