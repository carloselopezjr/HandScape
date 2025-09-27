import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Edges, Wireframe } from '@react-three/drei';
import { use, useState, useRef, useEffect } from 'react';
import * as THREE from 'three';

// Function to create a new cube object
function Cube({ position, isSelected, onSelect }: { position: [number, number, number], isSelected: boolean, onSelect: () => void }) {
    return (
        <mesh position={position} onClick={onSelect}>
            <boxGeometry args={[5, 5, 5]} />
            <meshStandardMaterial color={isSelected ? "" : "royalblue"} />
            <Edges color={isSelected ? "white" : "black"} />
        </mesh>
    )
}

function CamOrientation({ selectedCubePosition }: { selectedCubePosition: [number, number, number] | null }) {
    const { camera } = useThree();
    const orbitControlsRef = useRef<any>(null);

    useEffect(() => {
        if (selectedCubePosition && orbitControlsRef.current) {
            const [x, y, z] = selectedCubePosition;

            // Calculate camera position
            const distance = 25;
            const height = 15;

            // Create a camera position that gives a nice view of the cube
            const cameraPosition = new THREE.Vector3(
                x + distance * Math.cos(Math.PI / 4),
                y + height,
                z + distance * Math.sin(Math.PI / 4)
            );

            // Animate camera to new position
            const startPosition = camera.position.clone();
            const startTarget = orbitControlsRef.current.target.clone();
            const targetPosition = new THREE.Vector3(x, y, z);

            let progress = 0;
            const duration = 1.5; // Animation duration in seconds
            const startTime = Date.now();

            const animateCamera = () => {
                const elapsed = (Date.now() - startTime) / 1000;
                progress = Math.min(elapsed / duration, 1);

                // Use easing function for smoother animation
                const easedProgress = 1 - Math.pow(1 - progress, 3);

                if (progress < 1) {
                    // Interpolate camera position
                    camera.position.lerpVectors(startPosition, cameraPosition, easedProgress);

                    // Interpolate target (what the camera looks at)
                    orbitControlsRef.current.target.lerpVectors(startTarget, targetPosition, easedProgress);

                    orbitControlsRef.current.update();
                    requestAnimationFrame(animateCamera);
                } else {
                    // Ensure final position is exact
                    camera.position.copy(cameraPosition);
                    orbitControlsRef.current.target.copy(targetPosition);
                    orbitControlsRef.current.update();
                }
            };

            animateCamera();
        } else if (!selectedCubePosition && orbitControlsRef.current) {
            // Reset to default view when no cube is selected
            const defaultPosition = new THREE.Vector3(10, 10, 10);
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
                }
            };

            resetCamera();
        }
    }, [selectedCubePosition, camera]);

    return <OrbitControls ref={orbitControlsRef} enablePan={true} enableZoom={true} enableRotate={true} />;
}

export default function CubeScene() {
    // State to manage cubes
    const [cubes, setCubes] = useState<Array<[number, number, number]>>([]);

    // State to manage selected cube
    const [selectedCube, setSelectedCube] = useState<number | null>(null);

    // Create a cube in a random position for now
    const createCube = () => {
        const x = Math.random() * 100; // random x pos
        const y = Math.random() * 100; // random y pos
        const z = Math.random() * 100; // random z pos
        setCubes([...cubes, [x, y, z]]);
    };

    const handleCubeSelection = (index: number) => {
        setSelectedCube(index);
    };

    return (
        <div className="w-screen h-screen">
            <div className="ml-10 mt-5 top-4 left-4 z-10 flex flex-col gap-2">
                <div className="flex gap-2">
                    <button onClick={createCube} className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600 transition-all">
                        Create Cube
                    </button>
                    <button
                        onClick={() => setSelectedCube(null)}
                        className="bg-black text-white p-2 rounded hover:bg-gray-600 transition-all"
                    >
                        Reset Camera
                    </button>
                </div>
                {/*
            {selectedCube !== null && (
                <div className="bg-black bg-opacity-50 text-white p-2 rounded">
                    Selected Cube: {selectedCube + 1} / {cubes.length}
                    <br />
                    Position: ({cubes[selectedCube][0].toFixed(1)}, {cubes[selectedCube][1].toFixed(1)}, {cubes[selectedCube][2].toFixed(1)})
                </div>
            )}
            */}
            </div>
            <Canvas>
                {/* Lighting */}
                <ambientLight intensity={1} />
                <directionalLight position={[5, 5, 5]} />

                {/* Render cubes */}
                {cubes.map((position, index) => (
                    <Cube
                        key={index}
                        position={position}
                        isSelected={selectedCube === index}
                        onSelect={() => handleCubeSelection(index)}
                    />
                ))}

                {/* Dynamic camera orientation based on selected object */}
                <CamOrientation
                    selectedCubePosition={selectedCube !== null ? cubes[selectedCube] : null}
                />
            </Canvas>
        </div>
    );
}