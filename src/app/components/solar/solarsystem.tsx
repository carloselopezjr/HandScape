import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Edges } from '@react-three/drei';
import { useRef } from 'react';
import * as THREE from 'three';

// Central rotating cube
function RotatingCube() {
    const ref = useRef<THREE.Mesh>(null!);

    useFrame((state, delta) => {
        ref.current.rotation.x += delta * 0.4;
        ref.current.rotation.y += delta * 0.4;
    });

    return (
        <mesh ref={ref}>
            <boxGeometry args={[2, 2, 2]} />
            <meshStandardMaterial color="blue" />
            <Edges color="black" />
        </mesh>
    );
}

// Orbiting cube
function OrbitingCube({ position }: { position: [number, number, number] }) {
    const groupRef = useRef<THREE.Group>(null!);

    useFrame((_, delta) => {
        groupRef.current.rotation.y += delta * 0.3; // controls orbit speed
    });

    const ref = useRef<THREE.Mesh>(null!);

    useFrame((state, delta) => {
        // orbit slower than central cube
        ref.current.rotation.x += delta * 0.2; 
        ref.current.rotation.y += delta * 0.2;
    });

    return (
        <group ref={groupRef}>
            {/* This cube starts offset on the x-axis */}
            <mesh position={position} ref={ref}>
                <boxGeometry args={[0.1, 0.1, 0.1]} />
                <meshStandardMaterial color="darkblue" />
                <Edges color="black" />
            </mesh>
        </group>
    );
}

export default function CubeOrbit() {

    const orbitCubes = Array.from({length: 200}).map(() => {
        const x = Math.random() * 10 -5;
        const y = Math.random() * 10 -5;
        const z = Math.random() * 10 -5;
        return [x, y, z] as [number, number, number];
    });


    return (
        <div className="fade-in-world w-screen h-screen">
            <Canvas>
                <directionalLight position={[3, 3, 3]} intensity={1.5} castShadow={true} />
                <RotatingCube />
                {orbitCubes.map((position, index) => (
                    <OrbitingCube key={index} position={position} />
                ))}
                <OrbitControls enableZoom={false} />
            </Canvas>
        </div>
    );
}
