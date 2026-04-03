"use client";

import { GlobeInteractive } from "@/components/ui/cobe-globe-interactive";

export default function GlobeInteractiveDemo() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center overflow-hidden bg-[var(--bg)] p-8">
      <div className="w-full max-w-lg">
        <GlobeInteractive />
      </div>
    </div>
  );
}
