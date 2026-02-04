"use client"

import { LiquidButton } from "@/components/ui/liquid-glass-button";

export default function DemoOne() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-8 bg-zinc-950 p-8 rounded-xl border border-white/10">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Liquid Glass Button Integration</h2>
                <p className="text-white/60">Using the provided component with pill-shape synchronization and transparent default state.</p>
            </div>

            <div className="relative h-[200px] w-full flex items-center justify-center border border-dashed border-white/20 rounded-lg">
                <LiquidButton className="z-10">
                    Liquid Glass
                </LiquidButton>
            </div>
        </div>
    )
}
