import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Edges } from '@react-three/drei';
import { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Physics, useBox } from '@react-three/cannon';

// Function to create a new cube object
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
            <meshStandardMaterial color={"blue"} />
            <Edges color={"grey"} />
        </mesh>
    );
}

// Dynamic cam orientation
function CamOrientation({ selectedCubePosition }: { selectedCubePosition: [number, number, number] | null }) {
    const { camera } = useThree();
    const orbitControlsRef = useRef<any>(null);

    useEffect(() => {
        if (selectedCubePosition && orbitControlsRef.current) {
            const [x, y, z] = selectedCubePosition;
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
                }
            };

            animateCamera();
        } else if (!selectedCubePosition && orbitControlsRef.current) {
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

// Physics-enabled cube
function PhysicsCube({ position, size, isSelected, onSelect }: {
    position: [number, number, number],
    size: [number, number, number],
    isSelected: boolean,
    onSelect: () => void
}) {
    // mass = 1 means it will fall under gravity
    const [ref] = useBox(() => ({
        mass: 1,
        position,
        args: size
    }));

    return (
        <mesh ref={ref} onClick={onSelect}>
            <boxGeometry args={size} />
            <meshStandardMaterial color={isSelected ? "red" : "royalblue"} />
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
        <mesh ref={ref}>
            <boxGeometry args={[100, 2.5, 100]} />
            <meshStandardMaterial color="grey" />
            <Edges color="black" />
        </mesh>
    )
}

export default function CubeScene() {
    // State to manage cubes, storing position & size
    const [cubes, setCubes] = useState<Array<{ position: [number, number, number]; size: [number, number, number] }>>([]);
    const [selectedCube, setSelectedCube] = useState<number | null>(null);

    // Sliders state for selected cube (default size)
    const [width, setWidth] = useState(5);
    const [height, setHeight] = useState(5);
    const [length, setLength] = useState(5);

    const createCube = () => {
        const x = Math.random() * 5;
        const y = Math.random() * 25;
        const z = Math.random() * 100;
        setCubes([...cubes, { position: [x, y, z], size: [5, 5, 5] }]);
    };

    const handleCubeSelection = (index: number) => {
        setSelectedCube(index);
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
        <div className="w-screen h-screen">
            {/* UI overlay */}
            <div className="absolute ml-10 mt-5 top-4 left-4 z-10">
                <div className="rounded-xl border w-20 h-20 backdrop-blur-md border-[#140d30]">
                    <Canvas onClick={createCube}>
                        <ambientLight intensity={Math.PI / 2} />
                        <RotatingCube />
                    </Canvas>
                </div>

                <button
                    onClick={() => setSelectedCube(null)}
                    className="text-white pt-2 rounded hover:bg-gray-600 transition-all"
                >
                    Reset Camera
                </button>

                {selectedCube !== null && (
                    <div className="mt-2 text-white">
                        <div className="">
                            Width: {width.toFixed(1)}
                            <input
                                className=""
                                type="range"
                                min={1}
                                max={30}
                                step={0.1}
                                value={width}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setWidth(val);
                                    updateSelectedCubeSize(val, height, length);
                                }}
                            />
                        </div>
                        <div>
                            Height: {height.toFixed(1)}
                            <input
                                type="range"
                                min={1}
                                max={30}
                                step={0.1}
                                value={height}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setHeight(val);
                                    updateSelectedCubeSize(width, val, length);
                                }}
                            />
                        </div>
                        <div>
                            Length: {length.toFixed(1)}
                            <input
                                type="range"
                                min={1}
                                max={30}
                                step={0.1}
                                value={length}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setLength(val);
                                    updateSelectedCubeSize(width, height, val);
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>

            <Canvas>
                {/* Lighting */}
                <ambientLight intensity={Math.PI / 2} />
                <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} decay={0} intensity={Math.PI} />
                <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />

                {/* Baseplate not affected by gravity */}
                <Physics gravity={[0, -9.8, 0]}>
                    <Baseplate />

                    {/* Render cubes with physics */}
                    {cubes.map((key, index) => (
                        <PhysicsCube
                            key={index}
                            position={key.position}
                            size={key.size}
                            isSelected={selectedCube === index}
                            onSelect={() => handleCubeSelection(index)}
                        />
                    ))}
                </Physics>

                <CamOrientation selectedCubePosition={selectedCube !== null ? cubes[selectedCube].position : null} />
            </Canvas>
        </div>
    );
}
