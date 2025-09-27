import { Canvas } from '@react-three/fiber';
import { OrbitControls, Edges } from '@react-three/drei';
import { use, useState } from 'react';

// Function to create a new cube object
function Cube({position, isSelected, onSelect}: {position: [number, number, number], isSelected: boolean, onSelect: () => void}) {
    return ( 
        <mesh position = {position} onClick={onSelect}>
            <boxGeometry args = {[5,5,5]} />
            <meshStandardMaterial color={isSelected ? "hotpink" : "orange"} />
            <Edges color={isSelected ? "orange" : "black"} />
        </mesh>
    )
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
        <button onClick={createCube} className="bg-blue-500 text-white p-2 rounded">
            Create Cube
        </button>
      <Canvas>
        {/* Lighting */}
        <ambientLight intensity={1} />
        <directionalLight position={[5,5,5]} />

        {/* Render cubes */}
        {cubes.map((position, index) => (
          <Cube 
          key={index} 
          position={position}
          isSelected={selectedCube === index}
          onSelect={() => handleCubeSelection(index)}
          />
        ))}

        {/* Camera Controls */}
        <OrbitControls />
      </Canvas>
    
    
        </div>
  );
}