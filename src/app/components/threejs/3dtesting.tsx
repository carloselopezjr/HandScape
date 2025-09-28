import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Edges, Environment, ContactShadows, TransformControls } from '@react-three/drei';
import { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Physics, useBox } from '@react-three/cannon';

// Function to create a new cube object, depracated
/*
function Cube({
    position,
    size,
    isSelected,
    onSelect
}: {
    position: [number, number, number];
    size: [number, number, number];
    isSelected: boolean;
    onSelect: () => void;
}) {

    // Adjust if clicked
    return (
        <mesh position={position} onClick={onSelect}>
            <boxGeometry args={size} />
            <meshStandardMaterial color={isSelected ? "red" : "royalblue"} />
            <Edges color={isSelected ? "white" : "black"} />
        </mesh>
    );
}
*/

// Rotating cube button (temp)
function RotatingCube() {
    const ref = useRef<any>(null);

    useFrame((state, delta) => {
        ref.current.rotation.x += delta * 0.5; // smoother rotation
        ref.current.rotation.y += delta * 0.5;
    });

    return (
        <mesh ref={ref}>
            <boxGeometry args={[2.5, 2.5, 2.5]} />
            <meshStandardMaterial 
                color={"#3742fa"} 
                roughness={0.3}
                metalness={0.1}
            />
            <Edges color={"#2f3542"} />
        </mesh>
    );
}

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
            
            // Check if the position has changed significantly to avoid constant re-animation
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

// Physics-enabled cube with individual physics control
function PhysicsCube({ 
    position, 
    size, 
    isSelected, 
    onSelect, 
    onPositionUpdate, 
    index, 
    physicsEnabled,
    isMoving,
    meshRef
}: {
    position: [number, number, number],
    size: [number, number, number],
    isSelected: boolean,
    onSelect: () => void,
    onPositionUpdate: (index: number, position: [number, number, number]) => void,
    index: number,
    physicsEnabled: boolean,
    isMoving?: boolean,
    meshRef?: React.MutableRefObject<THREE.Mesh | null>
}) {
    // mass = 1 means it will fall under gravity, mass = 0 means static
    const [ref, api] = useBox(() => ({
        mass: physicsEnabled && !isMoving ? 1 : 0, // Disable physics during gesture movement
        position,
        args: size
    }));

    // Update mass when physics enabled/disabled or when moving via gesture
    useEffect(() => {
        if (isMoving) {
            api.mass.set(0); // Make static during gesture movement
        } else if (physicsEnabled) {
            api.mass.set(1);
        } else {
            api.mass.set(0);
        }
    }, [physicsEnabled, isMoving, api.mass]);

    // Subscribe to position updates and report back to parent (only when not moving via gesture)
    useEffect(() => {
        if (!isMoving) {
            const unsubscribe = api.position.subscribe((pos) => {
                onPositionUpdate(index, [pos[0], pos[1], pos[2]]);
            });
            return unsubscribe;
        }
    }, [api.position, onPositionUpdate, index, isMoving]);

    // Update physics position when moved via gesture
    useEffect(() => {
        if (!isMoving && ref.current) {
            const currentPos = ref.current.position;
            api.position.set(currentPos.x, currentPos.y, currentPos.z);
            api.velocity.set(0, 0, 0); // Stop any residual velocity
        }
    }, [isMoving, api.position, api.velocity]);

    // Assign mesh ref for TransformControls
    useEffect(() => {
        if (meshRef && ref.current) {
            meshRef.current = ref.current as THREE.Mesh;
        }
    }, [meshRef, ref]);

    // When moving via gesture, continuously update physics body to match mesh position
    useFrame(() => {
        if (isMoving && ref.current) {
            const meshPos = ref.current.position;
            // Force physics body to follow mesh position during gesture movement
            api.position.set(meshPos.x, meshPos.y, meshPos.z);
            api.velocity.set(0, 0, 0); // Prevent physics from interfering
        }
    });

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

// Baseplate for cubes to land on (static)
function Baseplate() {
    const [ref] = useBox(() => ({
        mass: 0, // static
        position: [0, -1.25, 0],
        args: [100, 2.5, 100]
    }));

    return (
        <mesh ref={ref} receiveShadow>
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

// Static baseplate (no physics)
function StaticBaseplate() {
    return (
        <mesh position={[0, -1.25, 0]}>
            <boxGeometry args={[100, 2.5, 100]} />
            <meshStandardMaterial color="black" />
            <Edges color="black" />
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
    targetRef: React.MutableRefObject<THREE.Mesh | null>;
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
            console.log('🎯 Movement started - Initial hand:', initialHandPos.current, 'Initial cube:', baseCubePos.current);
        } else if (!isActive) {
            // Reset when movement stops
            console.log('🛑 Movement stopped');
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
            
            // Debug logging
            console.log('🔄 Moving cube to:', constrainedTarget, 'Delta:', [deltaX, deltaY, deltaZ]);
            
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
    togglePhysics: boolean;
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

    // Track which cubes have physics enabled (per-cube basis)
    const [cubePhysicsEnabled, setCubePhysicsEnabled] = useState<Array<boolean>>([]);

    // Track current positions of physics cubes
    const [currentPositions, setCurrentPositions] = useState<Array<[number, number, number]>>([]);

    // Ref for selected cube mesh (for TransformControls)
    const selectedCubeMeshRef = useRef<THREE.Mesh | null>(null);

    // Track the initial position of selected cube for camera targeting (doesn't update during movement)
    const [selectedCubeInitialPosition, setSelectedCubeInitialPosition] = useState<[number, number, number] | null>(null);

    // Gesture command handlers
    useEffect(() => {
        if (gestureCommands?.createCube) {
            console.log('🖐️ Gesture command: Create cube');
            createCube();
        }
    }, [gestureCommands?.createCube]);

    useEffect(() => {
        if (gestureCommands?.selectCube && cubes.length > 0) {
            console.log('🖐️ Gesture command: Select cube');
            const nextIndex = selectedCube === null ? 0 : (selectedCube + 1) % cubes.length;
            handleCubeSelection(nextIndex);
        }
    }, [gestureCommands?.selectCube]);

    useEffect(() => {
        if (gestureCommands?.togglePhysics && selectedCube !== null) {
            console.log('🖐️ Gesture command: Toggle physics for cube', selectedCube);
            toggleSelectedCubePhysics();
        }
    }, [gestureCommands?.togglePhysics]);

    useEffect(() => {
        if (gestureCommands && selectedCube !== null && gestureCommands.resizeValue !== 1.0) {
            console.log('🖐️ Gesture command: Resize cube to', gestureCommands.resizeValue);
            const newSize = gestureCommands.resizeValue * 5; // Base size of 5
            updateSelectedCubeSize(newSize, newSize, newSize);
        }
    }, [gestureCommands?.resizeValue]);

    // Handle stretch gesture for resizing
    useEffect(() => {
        if (gestureCommands?.leftHandStretch && selectedCube !== null) {
            console.log('🖐️ Gesture command: Stretch resize cube', gestureCommands.stretchDirection, gestureCommands.stretchIntensity);
            
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
        setCubePhysicsEnabled([...cubePhysicsEnabled, false]); // New cubes start with gravity disabled for better UX
    };

    // Handle position updates from physics cubes
    const handlePositionUpdate = (index: number, position: [number, number, number]) => {
        setCurrentPositions(prev => {
            const updated = [...prev];
            updated[index] = position;
            return updated;
        });
    };

    // Toggle physics for the selected cube only
    const toggleSelectedCubePhysics = () => {
        if (selectedCube !== null) {
            setCubePhysicsEnabled(prev => {
                const updated = [...prev];
                updated[selectedCube] = !updated[selectedCube];
                return updated;
            });
        }
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
                {/* Professional Blender-inspired lighting setup */}
                
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
                
                {/* Baseplate + cubes with individual physics control */}
                <Physics gravity={[0, -9.8, 0]}>
                    <Baseplate />
                    {cubes.map((key, index) => (
                        <PhysicsCube
                            key={index}
                            index={index}
                            position={key.position}
                            size={key.size}
                            isSelected={selectedCube === index}
                            onSelect={() => handleCubeSelection(index)}
                            onPositionUpdate={handlePositionUpdate}
                            physicsEnabled={cubePhysicsEnabled[index] ?? false}
                            isMoving={selectedCube === index && gestureCommands?.moveCube}
                            meshRef={selectedCube === index ? selectedCubeMeshRef : undefined}
                        />
                    ))}

                {/* Transform Controls for selected cube when moving */}
                {selectedCube !== null && gestureCommands?.moveCube && (
                    <>
                        <CubeTransformControls
                            isActive={true}
                            targetRef={selectedCubeMeshRef}
                            handPosition={gestureCommands.handPosition}
                            onPositionChange={handleGesturePositionUpdate}
                            initialCubePosition={selectedCubeInitialPosition || undefined}
                        />
                        
                    </>
                )}
                </Physics>

                <CamOrientation 
                    selectedCubePosition={selectedCubeInitialPosition} 
                    isMovingCube={selectedCube !== null && gestureCommands?.moveCube || false}
                />
            </Canvas>
        
    );
}
