import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Edges, Environment, ContactShadows, TransformControls } from '@react-three/drei';
import { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';



// Dynamic cam orientation
function CamOrientation({ 
    selectedCubePosition, 
    isMovingCube 
}: { 
    selectedCubePosition: [number, number, number] | null;
    isMovingCube: boolean;
}) {
    const { camera } = useThree();
    const orbitControlsRef = useRef<any>(null);
    const lastTargetRef = useRef<[number, number, number] | null>(null);
    const isAnimatingRef = useRef(false);

    useEffect(() => {
        // Prevent animation if we're already animating, if cube is being moved via gesture, 
        // or if the target hasn't significantly changed
        if (isAnimatingRef.current || isMovingCube) return;
        
        if (selectedCubePosition && orbitControlsRef.current) {
            const [x, y, z] = selectedCubePosition;
            
            // Increase threshold to 5 units to prevent camera updates during small movements
            if (lastTargetRef.current) {
                const [lastX, lastY, lastZ] = lastTargetRef.current;
                const distance = Math.sqrt((x - lastX) ** 2 + (y - lastY) ** 2 + (z - lastZ) ** 2);
                if (distance < 5) return; // Don't animate for small movements (increased threshold)
            }
            
            lastTargetRef.current = [x, y, z];
            isAnimatingRef.current = true;
            
            const distance = 25;
            const height = 15;
            const cameraPosition = new THREE.Vector3(
                x + distance * Math.cos(Math.PI / 4),
                y + height,
                z + distance * Math.sin(Math.PI / 4)
            );

            const startPosition = camera.position.clone();
            const startTarget = orbitControlsRef.current.target.clone();
            const targetPosition = new THREE.Vector3(x, y, z);
            let progress = 0;
            const duration = 1.5;
            const startTime = Date.now();

            const animateCamera = () => {
                const elapsed = (Date.now() - startTime) / 1000;
                progress = Math.min(elapsed / duration, 1);
                const easedProgress = 1 - Math.pow(1 - progress, 3);

                if (progress < 1) {
                    camera.position.lerpVectors(startPosition, cameraPosition, easedProgress);
                    orbitControlsRef.current.target.lerpVectors(startTarget, targetPosition, easedProgress);
                    orbitControlsRef.current.update();
                    requestAnimationFrame(animateCamera);
                } else {
                    camera.position.copy(cameraPosition);
                    orbitControlsRef.current.target.copy(targetPosition);
                    orbitControlsRef.current.update();
                    isAnimatingRef.current = false;
                }
            };

            animateCamera();
        } else if (!selectedCubePosition && orbitControlsRef.current && !isAnimatingRef.current) {
            lastTargetRef.current = null;
            isAnimatingRef.current = true;
            
            const defaultPosition = new THREE.Vector3(50, 30, 50);
            const defaultTarget = new THREE.Vector3(0, 0, 0);
            const startPosition = camera.position.clone();
            const startTarget = orbitControlsRef.current.target.clone();
            let progress = 0;
            const duration = 1;
            const startTime = Date.now();

            const resetCamera = () => {
                const elapsed = (Date.now() - startTime) / 1000;
                progress = Math.min(elapsed / duration, 1);
                const easedProgress = 1 - Math.pow(1 - progress, 3);

                if (progress < 1) {
                    camera.position.lerpVectors(startPosition, defaultPosition, easedProgress);
                    orbitControlsRef.current.target.lerpVectors(startTarget, defaultTarget, easedProgress);
                    orbitControlsRef.current.update();
                    requestAnimationFrame(resetCamera);
                } else {
                    camera.position.copy(defaultPosition);
                    orbitControlsRef.current.target.copy(defaultTarget);
                    orbitControlsRef.current.update();
                    isAnimatingRef.current = false;
                }
            };

            resetCamera();
        }
    }, [selectedCubePosition, camera, isMovingCube]);

    return <OrbitControls ref={orbitControlsRef} enablePan={true} enableZoom={true} enableRotate={true} />;
}

function Cube({ 
    position, 
    size, 
    isSelected, 
    onSelect, 
    onPositionUpdate, 
    index, 
    isMoving,
    meshRef
}: {
    position: [number, number, number],
    size: [number, number, number],
    isSelected: boolean,
    onSelect: () => void,
    onPositionUpdate: (index: number, position: [number, number, number]) => void,
    index: number,
    isMoving?: boolean,
    meshRef?: React.RefObject<THREE.Mesh | null>
}) {
    const ref = useRef<THREE.Mesh>(null);

    // Assign mesh ref for TransformControls
    useEffect(() => {
        if (meshRef && ref.current) {
            meshRef.current = ref.current;
        }
    }, [meshRef]);

    // Update position and notify parent when position changes
    useEffect(() => {
        if (ref.current && !isMoving) {
            ref.current.position.set(position[0], position[1], position[2]);
            onPositionUpdate(index, position);
        }
    }, [position, index, onPositionUpdate, isMoving]);

    return (
        <mesh ref={ref} onClick={onSelect} castShadow receiveShadow>
            <boxGeometry args={size} />
            <meshStandardMaterial 
                color={isSelected ? "#ff4757" : "#3742fa"} 
                roughness={0.3}
                metalness={0.1}
            />
            <Edges color={isSelected ? "white" : "black"} />
        </mesh>
    )
}

function Baseplate() {
    return (
        <mesh position={[0, -1.25, 0]} receiveShadow>
            <boxGeometry args={[100, 2.5, 100]} />
            <meshStandardMaterial 
                color="black" 
                roughness={0.8}
                metalness={0.05}
            />
            <Edges color="#34495e" lineWidth={1} />
        </mesh>
    )
}

// Transform Controls for selected cube movement
function CubeTransformControls({ 
    isActive, 
    targetRef, 
    handPosition,
    onPositionChange,
    initialCubePosition
}: { 
    isActive: boolean;
    targetRef: React.RefObject<THREE.Mesh | null>;
    handPosition: { x: number; y: number; z: number };
    onPositionChange: (position: [number, number, number]) => void;
    initialCubePosition?: [number, number, number];
}) {
    const transformRef = useRef<any>(null);
    const initialHandPos = useRef<{ x: number; y: number; z: number } | null>(null);
    const baseCubePos = useRef<[number, number, number] | null>(null);
    
    // Initialize reference positions when movement starts
    useEffect(() => {
        if (isActive && !initialHandPos.current && initialCubePosition) {
            initialHandPos.current = { ...handPosition };
            baseCubePos.current = [...initialCubePosition];
        } else if (!isActive) {
            // Reset when movement stops
            initialHandPos.current = null;
            baseCubePos.current = null;
        }
    }, [isActive, handPosition, initialCubePosition]);
    
    useEffect(() => {
        if (isActive && targetRef.current && initialHandPos.current && baseCubePos.current) {
            // Calculate relative movement from initial hand position
            const deltaX = handPosition.x - initialHandPos.current.x;
            const deltaY = handPosition.y - initialHandPos.current.y;
            const deltaZ = handPosition.z - initialHandPos.current.z;
            
            // Apply movement scaling for better control (reduce sensitivity)
            const sensitivity = 0.8;
            const targetX = baseCubePos.current[0] + (deltaX * sensitivity);
            const targetY = baseCubePos.current[1] + (deltaY * sensitivity);
            const targetZ = baseCubePos.current[2] + (deltaZ * sensitivity);
            
            // Apply boundary constraints
            const constrainedTarget = [
                Math.max(-45, Math.min(45, targetX)),   // X bounds
                Math.max(2.5, Math.min(50, targetY)),   // Y bounds (above baseplate)
                Math.max(-45, Math.min(45, targetZ))    // Z bounds
            ];
            
            // Direct position update on the mesh
            targetRef.current.position.set(constrainedTarget[0], constrainedTarget[1], constrainedTarget[2]);
            
            onPositionChange(constrainedTarget as [number, number, number]);
        }
    }, [isActive, handPosition, targetRef, onPositionChange, initialHandPos, baseCubePos]);

    if (!isActive || !targetRef.current) return null;

    return (
        <TransformControls
            ref={transformRef}
            object={targetRef.current}
            mode="translate"
            showX={false}
            showY={false} 
            showZ={false}
            enabled={false} // Disable manual dragging, control via hand
        />
    );
}

interface GestureCommands {
    createCube: boolean;
    selectCube: boolean;
    resizeValue: number;
    moveCube: boolean;
    handPosition: { x: number; y: number; z: number };
    leftHandStretch: boolean;
    stretchDirection: 'horizontal' | 'vertical' | 'none';
    stretchIntensity: number;
}

export default function CubeScene({ gestureCommands }: { gestureCommands?: GestureCommands }) {
    // State to manage cubes, storing position & size
    const [cubes, setCubes] = useState<Array<{ position: [number, number, number]; size: [number, number, number] }>>([]);
    const [selectedCube, setSelectedCube] = useState<number | null>(null);

    // Sliders state for selected cube (default size)
    const [width, setWidth] = useState(5);
    const [height, setHeight] = useState(5);
    const [length, setLength] = useState(5);

    // Track current positions of cubes
    const [currentPositions, setCurrentPositions] = useState<Array<[number, number, number]>>([]);

    // Ref for selected cube mesh (for TransformControls)
    const selectedCubeMeshRef = useRef<THREE.Mesh | null>(null);

    // Track the initial position of selected cube for camera targeting (doesn't update during movement)
    const [selectedCubeInitialPosition, setSelectedCubeInitialPosition] = useState<[number, number, number] | null>(null);

    // Gesture command handlers
    useEffect(() => {
        if (gestureCommands?.createCube) {
            createCube();
        }
    }, [gestureCommands?.createCube]);

    useEffect(() => { // Selecting cube based on gesture
        if (gestureCommands?.selectCube && cubes.length > 0) {
            const nextIndex = selectedCube === null ? 0 : (selectedCube + 1) % cubes.length;
            handleCubeSelection(nextIndex);
        }
    }, [gestureCommands?.selectCube]);

    useEffect(() => { // Resizing cube based on gesture
        if (gestureCommands && selectedCube !== null && gestureCommands.resizeValue !== 1.0) {
            const newSize = gestureCommands.resizeValue * 5; // Base size of 5
            updateSelectedCubeSize(newSize, newSize, newSize);
        }
    }, [gestureCommands?.resizeValue]);

    // Handle stretch gesture for resizing
    useEffect(() => {
        if (gestureCommands?.leftHandStretch && selectedCube !== null) {
            
            const currentCube = cubes[selectedCube];
            if (!currentCube) return;
            
            const baseSize = 5; // Base cube size
            const intensity = gestureCommands.stretchIntensity;
            
            if (gestureCommands.stretchDirection === 'horizontal') {
                // Horizontal stretch affects width (X) and depth (Z)
                updateSelectedCubeSize(
                    baseSize * intensity,  // width
                    currentCube.size[1],   // keep height same
                    baseSize * intensity   // depth
                );
                setWidth(baseSize * intensity);
                setLength(baseSize * intensity);
            } else if (gestureCommands.stretchDirection === 'vertical') {
                // Vertical stretch affects height (Y)
                updateSelectedCubeSize(
                    currentCube.size[0],   // keep width same
                    baseSize * intensity,  // height
                    currentCube.size[2]    // keep depth same
                );
                setHeight(baseSize * intensity);
            }
        }
    }, [gestureCommands?.leftHandStretch, gestureCommands?.stretchDirection, gestureCommands?.stretchIntensity, selectedCube, cubes]);

    // Handle cube movement via fist gesture
    const handleGesturePositionUpdate = (position: [number, number, number]) => {
        if (selectedCube !== null) {
            setCurrentPositions(prev => {
                const updated = [...prev];
                updated[selectedCube] = position;
                return updated;
            });

            // Update cube position in the cubes array
            setCubes(prev => {
                const updated = [...prev];
                updated[selectedCube] = {
                    ...updated[selectedCube],
                    position: position
                };
                return updated;
            });
        }
    };

    const createCube = () => {
        // Spawn within baseplate bounds (100x100 centered at origin)
        // Baseplate is at y=-1.25 with height 2.5, so top surface is at y=0
        const baseplateSize = 45; // Use smaller area within the 100x100 baseplate for better UX
        const x = (Math.random() - 0.5) * baseplateSize; // -22.5 to 22.5
        const y = 10; // Start cubes at a reasonable height above the baseplate
        const z = (Math.random() - 0.5) * baseplateSize; // -22.5 to 22.5
        const newPosition: [number, number, number] = [x, y, z];
        setCubes([...cubes, { position: newPosition, size: [5, 5, 5] }]);
        setCurrentPositions([...currentPositions, newPosition]);
    };

    // Handle position updates from physics cubes
    const handlePositionUpdate = (index: number, position: [number, number, number]) => {
        setCurrentPositions(prev => {
            const updated = [...prev];
            updated[index] = position;
            return updated;
        });
    };

    const handleCubeSelection = (index: number) => {
        setSelectedCube(index);
        // Store the initial position for camera targeting (won't change during movement)
        setSelectedCubeInitialPosition(cubes[index].position);
        // Load sliders values from selected cube
        setWidth(cubes[index].size[0]);
        setHeight(cubes[index].size[1]);
        setLength(cubes[index].size[2]);
    };

    // Update size of selected cube
    const updateSelectedCubeSize = (newWidth: number, newHeight: number, newLength: number) => {
        if (selectedCube === null) return;
        const newCubes = [...cubes];
        newCubes[selectedCube] = {
            ...newCubes[selectedCube],
            size: [newWidth, newHeight, newLength]
        };
        setCubes(newCubes);
    };

    return (
        

            <Canvas shadows camera={{ position: [50, 30, 50], fov: 90 }}>
                
                {/* Key Light - Main directional light (sun) */}
                <directionalLight
                    position={[15, 20, 10]}
                    intensity={1.0}
                    castShadow
                    shadow-mapSize-width={2048}
                    shadow-mapSize-height={2048}
                    shadow-camera-far={50}
                    shadow-camera-left={-25}
                    shadow-camera-right={25}
                    shadow-camera-top={25}
                    shadow-camera-bottom={-25}
                    color="#ffffff"
                />
                
                {/* Fill Light - Softer light to fill shadows */}
                <directionalLight
                    position={[-10, 15, -5]}
                    intensity={0.3}
                    color="#e6f3ff"
                />
                
                {/* Rim Light - Accent lighting for edge definition */}
                <spotLight
                    position={[5, 25, -15]}
                    angle={0.3}
                    penumbra={0.5}
                    intensity={0.6}
                    color="#fff5e6"
                    castShadow
                />
                
                {/* Ambient base lighting - replaces harsh ambientLight */}
                <ambientLight intensity={0.15} color="#f0f4ff" />
                
                {/* Environment lighting for realistic reflections */}
                <Environment preset="city" background={false} />
                
                {/* Contact shadows for ground interaction */}
                <ContactShadows 
                    position={[0, -1.24, 0]} 
                    opacity={0.5} 
                    scale={50} 
                    blur={2.5} 
                    far={10} 
                />
                
                {/* Baseplate + cubes */}
                <Baseplate />
                {cubes.map((cube, index) => (
                    <Cube
                        key={index}
                        index={index}
                        position={cube.position}
                        size={cube.size}
                        isSelected={selectedCube === index}
                        onSelect={() => handleCubeSelection(index)}
                        onPositionUpdate={handlePositionUpdate}
                        isMoving={selectedCube === index && gestureCommands?.moveCube}
                        meshRef={selectedCube === index ? selectedCubeMeshRef : undefined}
                    />
                ))}

                {/* Transform Controls for selected cube when moving */}
                {selectedCube !== null && gestureCommands?.moveCube && (
                    <CubeTransformControls
                        isActive={true}
                        targetRef={selectedCubeMeshRef}
                        handPosition={gestureCommands.handPosition}
                        onPositionChange={handleGesturePositionUpdate}
                        initialCubePosition={selectedCubeInitialPosition || undefined}
                    />
                )}

                <CamOrientation 
                    selectedCubePosition={selectedCubeInitialPosition} 
                    isMovingCube={selectedCube !== null && gestureCommands?.moveCube || false}
                />
            </Canvas>
        
    );
}
