import MediaPipeTest from '@/components/MediaPipeTest';


export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm p-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900"> HandScape - Gesture Recognition</h1>
          <p className="text-gray-600">Test MediaPipe integration and gesture simulation</p>
        </div>
      </header>
      
      <main className="py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Advanced MediaPipe Two-Hand Gesture System */}
          <MediaPipeTest />
        </div>
      </main>
    </div>
  );
}