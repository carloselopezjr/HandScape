/**

 */// MediaPipe Hands 
const mediapipe = require('@mediapipe/hands');
const Hands = mediapipe.Hands;

// Simple Camera implementation to replace MediaPipe Camera utility
class Camera {
  private video: HTMLVideoElement;
  private stream: MediaStream | null = null;
  private frameCallback: () => void;
  private rafId: number | null = null;

  constructor(video: HTMLVideoElement, options: { onFrame: () => void; width: number; height: number }) {
    this.video = video;
    this.frameCallback = options.onFrame;
    this.video.width = options.width;
    this.video.height = options.height;
  }

  async start(): Promise<void> {
    // Get user's camera
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { 
        width: 640, 
        height: 480, 
        facingMode: 'user' // Use front camera
      }
    });
    
    this.video.srcObject = this.stream;
    
    // Wait for video to load
    return new Promise((resolve) => {
      this.video.onloadedmetadata = () => {
        this.video.play();
        this.startFrameLoop();
        resolve();
      };
    });
  }

  private startFrameLoop(): void {
    const processFrame = () => {
      if (this.video.readyState === 4) { // HAVE_ENOUGH_DATA
        this.frameCallback();
      }
      this.rafId = requestAnimationFrame(processFrame);
    };
    processFrame();
  }

  stop(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    this.video.srcObject = null;
  }
}


  //Hand landmark point in 3D space (normalized coordinates 0-1)
 
export interface HandLandmark {
  x: number; // Horizontal position (0 = left, 1 = right)
  y: number; // Vertical position (0 = top, 1 = bottom)  
  z: number; // Depth position (relative to wrist)
}


export interface HandResults {
  multiHandLandmarks: HandLandmark[][];
  multiHandedness: Array<{
    index: number;
    score: number;
    label: string; // "Left" or "Right"
  }>;
}

/**
 * Gesture event emitted by the hand tracker
 */
export interface GestureEvent {
  type: 'SPAWN' | 'PINCH' | 'SPREAD' | 'CLAP' | 'GRAB' | 'RELEASE';
  data: {
    handedness: string;      // Which hand performed the gesture
    confidence: number;      // How confident we are (0-1)
    position: { x: number; y: number; z: number }; // 3D position
    distance?: number;       // Distance between fingers (for pinch/spread)
    timestamp: number;       // When the gesture occurred
  };
}

/**
 * Callback function type for gesture events
 */
export type GestureCallback = (event: GestureEvent) => void;

/**
 * MediaPipe Hand Tracker Class
 * This class manages the entire hand tracking pipeline:
 * 1. Camera initialization and video capture
 * 2. MediaPipe Hands model setup and processing
 * 3. Gesture recognition and event emission
 * 4. User calibration for different hand sizes
 */
class MediaPipeHandTracker {
  // Core MediaPipe components
  private hands: any = null;
  private camera: Camera | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  
  // State management
  private isInitialized = false;
  private callbacks: GestureCallback[] = [];
  private lastResults: HandResults | null = null;
  
  // Calibration data - adjusted per user for better accuracy
  private calibrationData = {
    pinchDistance: 0.05,    // Distance threshold for pinch gesture
    spreadDistance: 0.15,   // Distance threshold for spread gesture
    clapDistance: 0.1,      // Distance threshold for clap gesture
  };

  /**
   * Initialize the hand tracker with video and canvas elements
   * 
   * @param videoElement - HTML video element for camera feed
   * @param canvasElement - HTML canvas element for drawing (optional)
   * @returns Promise that resolves when initialization is complete
   * 
   * @example
   * ```typescript
   * const video = document.createElement('video');
   * const canvas = document.createElement('canvas');
   * await handTracker.initialize(video, canvas);
   * ```
   */
  async initialize(videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement): Promise<void> {
    this.videoElement = videoElement;
    this.canvasElement = canvasElement;

    try {
      // Initialize MediaPipe Hands model
      this.hands = new Hands({
        locateFile: (file: string) => {
          // Load MediaPipe files from CDN for web compatibility
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
      });

      // Configure MediaPipe settings for optimal performance and accuracy
      this.hands.setOptions({
        maxNumHands: 2,              // Track up to 2 hands
        modelComplexity: 1,          // Balance between speed and accuracy (0-2)
        minDetectionConfidence: 0.7, // Minimum confidence to detect hand
        minTrackingConfidence: 0.5,  // Minimum confidence to track hand
        selfieMode: true,            // Mirror the camera view
      });

      // Set up result processing callback
      this.hands.onResults(this.onResults.bind(this));

      // Initialize camera with optimal settings
      this.camera = new Camera(this.videoElement, {
        onFrame: async () => {
          if (this.hands && this.videoElement) {
            await this.hands.send({ image: this.videoElement });
          }
        },
        width: 640,    // Camera resolution width
        height: 480,   // Camera resolution height
      });

      // Start the camera
      await this.camera.start();
      this.isInitialized = true;
      
      console.log(' MediaPipe Hand Tracker initialized successfully');
    } catch (error) {
      console.error(' Failed to initialize MediaPipe Hand Tracker:', error);
      throw error;
    }
  }

  /**
   * Process results from MediaPipe and trigger gesture recognition
   * This method is called automatically by MediaPipe for each frame
   * 
   * @param results - Raw results from MediaPipe Hands model
   */
  private onResults(results: any): void {
    // Ensure we have valid hand detection results
    if (!results.multiHandLandmarks || !results.multiHandedness) {
      return;
    }

    // Store results for gesture processing
    this.lastResults = {
      multiHandLandmarks: results.multiHandLandmarks as HandLandmark[][],
      multiHandedness: results.multiHandedness,
    };

    // Process gestures for each detected hand
    results.multiHandLandmarks.forEach((landmarks: any, index: any) => {
      const handedness = results.multiHandedness[index];
      this.processGestures(landmarks as HandLandmark[], handedness);
    });
  }

  /**
   * Process gestures for a single hand
   * This is where the main gesture recognition logic happens
   * 
   * @param landmarks - Array of hand landmarks (21 points)
   * @param handedness - Information about which hand this is
   */
  private processGestures(landmarks: HandLandmark[], handedness: any): void {
    
    //  include detectPinch(), detectSpread(), detectClap()
    console.log(`Processing gestures for ${handedness.label} hand`);
  }

  
  calibrate(): void {
    if (!this.lastResults || !this.lastResults.multiHandLandmarks.length) {
      console.warn('  No hand detected for calibration. Please show your hand to the camera.');
      return;
    }

    const landmarks = this.lastResults.multiHandLandmarks[0];
    
    // Get key landmarks for hand size calculation
    const thumbTip = landmarks[4];     // Thumb tip
    const pinkyTip = landmarks[20];    // Pinky tip
    const indexTip = landmarks[8];     // Index finger tip
    
    if (thumbTip && pinkyTip && indexTip) {
      // Calculate hand span (thumb to pinky distance)
      const handSpan = this.calculateDistance(thumbTip, pinkyTip);
      
      // Adjust gesture thresholds based on hand size
      this.calibrationData.pinchDistance = handSpan * 0.15;  // 15% of hand span
      this.calibrationData.spreadDistance = handSpan * 0.8;  // 80% of hand span  
      this.calibrationData.clapDistance = handSpan * 0.5;    // 50% of hand span
      
      console.log(' Calibrated gesture thresholds for hand span:', handSpan.toFixed(3));
      console.log(' Pinch threshold:', this.calibrationData.pinchDistance.toFixed(3));
      console.log(' Spread threshold:', this.calibrationData.spreadDistance.toFixed(3));
    }
  }

  /**
   * Calculate 3D distance between two landmarks
   * 
   * @param point1 - First landmark point
   * @param point2 - Second landmark point
   * @returns Euclidean distance between the points
   */
  private calculateDistance(point1: HandLandmark, point2: HandLandmark): number {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    const dz = point1.z - point2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Emit a gesture event to all subscribers
   * 
   * @param event - The gesture event to emit
   */
  private emitGestureEvent(event: GestureEvent): void {
    this.callbacks.forEach(callback => callback(event));
  }

  /**
   * Subscribe to gesture events
   * 
   * @param callback - Function to call when gestures are detected
   * @returns Unsubscribe function
   * 
   * @example
   * ```typescript
   * const unsubscribe = handTracker.subscribe((event) => {
   *   if (event.type === 'PINCH') {
   *     console.log('Pinch detected!', event.data.position);
   *   }
   * });
   * 
   * // Later, unsubscribe
   * unsubscribe();
   * ```
   */
  subscribe(callback: GestureCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Clean up resources and stop tracking
   * Call this when  done with hand tracking
   */
  destroy(): void {
    if (this.camera) {
      this.camera.stop();
    }
    if (this.hands) {
      this.hands.close();
    }
    this.callbacks = [];
    this.isInitialized = false;
    console.log(' Hand tracker destroyed');
  }

  /**
   * Get initialization status
   */
  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get current calibration settings
   */
  get calibrationSettings() {
    return { ...this.calibrationData };
  }
}

// Export singleton instance for easy use across the app
export const handTracker = new MediaPipeHandTracker();

/**
  * --- IGNORE ---
 */