export default function UI() {
    return (

        <div className="border-2 rounded-xl border-[#140d30] text-white w-64 min-h-[150px] shadow-lg p-3 space-y-4 backdrop-blur-md hover:border-[#262544]  ">
            {/* Tools Section */}
                <h1 className="font-bold text-lg">Tools</h1>
                <ul className="space-y-1">
                    <li>Rotate</li>
                    <li>Structure</li>
                    <li>Scale</li>
                </ul>

                {/* Actions Section */}
                    <h2 className="font-bold text-lg">Actions</h2>
                    <ul className="space-y-1">
                        <li>Undo</li>
                        <li>Redo</li>
                        <li>Reset</li>
                    </ul>
            </div>
            );
}
