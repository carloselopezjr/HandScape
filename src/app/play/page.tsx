"use client";

import { SimpleHandTrackingTest } from '../components/threejs/SimpleHandTrackingTest';

export default function Play() {
    return (
        <div className="fade-in-world">
            <div className="flex justify-center">
                <SimpleHandTrackingTest />
            </div>
        </div>
    )
}