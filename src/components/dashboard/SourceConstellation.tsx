'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

export type NodeStatus = 'pending' | 'fetching' | 'done' | 'failed';

export interface ConstellationSource {
    id: string;
    name: string;
    icon: string;
    category: string;
    status: NodeStatus;
}

interface SourceConstellationProps {
    sources: ConstellationSource[];
    percent: number;
    isDone: boolean;
    mode: 'skeleton' | 'refresh';
    onTransitionComplete?: () => void;
}

interface NodePosition {
    x: number;
    y: number;
    id: string;
    category: string;
}

/** Compute radial positions for source nodes arranged in category clusters */
function useConstellationLayout(
    sources: ConstellationSource[],
    containerRef: React.RefObject<HTMLDivElement | null>
) {
    const [positions, setPositions] = useState<NodePosition[]>([]);
    const [center, setCenter] = useState({ x: 0, y: 0 });
    const [size, setSize] = useState({ width: 0, height: 0 });

    const calculateLayout = useCallback(() => {
        const el = containerRef.current;
        if (!el) return;

        const w = el.clientWidth;
        const h = el.clientHeight;
        if (w === 0 || h === 0) return;

        const cx = w / 2;
        const cy = h / 2;
        setCenter({ x: cx, y: cy });
        setSize({ width: w, height: h });

        // Group by category
        const groups: Record<string, ConstellationSource[]> = {};
        for (const s of sources) {
            if (!groups[s.category]) groups[s.category] = [];
            groups[s.category].push(s);
        }

        const categoryKeys = Object.keys(groups);
        const categoryCount = categoryKeys.length;
        if (categoryCount === 0) return;

        // Add padding so nodes don't clip at edges
        const pad = 30;
        const minDim = Math.min(w - pad * 2, h - pad * 2);
        const orbitRadius = minDim * 0.32;
        const clusterSpread = minDim * 0.07;

        const newPositions: NodePosition[] = [];

        categoryKeys.forEach((cat, catIdx) => {
            const angle = (catIdx / categoryCount) * Math.PI * 2 - Math.PI / 2;
            const catCx = cx + Math.cos(angle) * orbitRadius;
            const catCy = cy + Math.sin(angle) * orbitRadius;

            const catSources = groups[cat];
            const count = catSources.length;

            catSources.forEach((source, srcIdx) => {
                let nx: number, ny: number;

                if (count === 1) {
                    nx = catCx;
                    ny = catCy;
                } else {
                    const subAngle = (srcIdx / count) * Math.PI * 2 - Math.PI / 2;
                    const subRadius = clusterSpread * Math.min(1, count / 5);
                    nx = catCx + Math.cos(subAngle) * subRadius;
                    ny = catCy + Math.sin(subAngle) * subRadius;
                }

                newPositions.push({ x: nx, y: ny, id: source.id, category: cat });
            });
        });

        setPositions(newPositions);
    }, [sources, containerRef]);

    useEffect(() => {
        calculateLayout();
        const el = containerRef.current;
        if (!el) return;

        const observer = new ResizeObserver(() => calculateLayout());
        observer.observe(el);
        return () => observer.disconnect();
    }, [calculateLayout]);

    return { positions, center, size };
}

export function SourceConstellation({
    sources,
    percent,
    isDone,
    mode,
    onTransitionComplete,
}: SourceConstellationProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { positions, center, size } = useConstellationLayout(sources, containerRef);
    const [phase, setPhase] = useState<'active' | 'completing' | 'fading'>('active');

    // Skeleton mode: simulate random fetching animation
    const [simStatuses, setSimStatuses] = useState<Record<string, NodeStatus>>({});

    useEffect(() => {
        if (mode !== 'skeleton') return;

        const initial: Record<string, NodeStatus> = {};
        sources.forEach(s => { initial[s.id] = 'pending'; });
        setSimStatuses(initial);

        const timers: ReturnType<typeof setTimeout>[] = [];
        const shuffled = [...sources].sort(() => Math.random() - 0.5);

        shuffled.forEach((source) => {
            const fetchDelay = 300 + Math.random() * 2500;
            timers.push(setTimeout(() => {
                setSimStatuses(prev => ({ ...prev, [source.id]: 'fetching' }));
            }, fetchDelay));

            const doneDelay = fetchDelay + 600 + Math.random() * 2000;
            timers.push(setTimeout(() => {
                setSimStatuses(prev => ({ ...prev, [source.id]: 'done' }));
            }, doneDelay));
        });

        // Loop: restart simulation after all done
        const totalDuration = 6000;
        const loopTimer = setTimeout(() => {
            const fresh: Record<string, NodeStatus> = {};
            sources.forEach(s => { fresh[s.id] = 'pending'; });
            setSimStatuses(fresh);
        }, totalDuration);
        timers.push(loopTimer);

        const intervalId = setInterval(() => {
            // Restart cycle
            const reset: Record<string, NodeStatus> = {};
            sources.forEach(s => { reset[s.id] = 'pending'; });
            setSimStatuses(reset);

            const reshuffled = [...sources].sort(() => Math.random() - 0.5);
            reshuffled.forEach((source) => {
                const fetchDelay = 300 + Math.random() * 2500;
                timers.push(setTimeout(() => {
                    setSimStatuses(prev => ({ ...prev, [source.id]: 'fetching' }));
                }, fetchDelay));

                const doneDelay = fetchDelay + 600 + Math.random() * 2000;
                timers.push(setTimeout(() => {
                    setSimStatuses(prev => ({ ...prev, [source.id]: 'done' }));
                }, doneDelay));
            });
        }, totalDuration);

        return () => {
            timers.forEach(clearTimeout);
            clearInterval(intervalId);
        };
    }, [mode, sources]);

    // Get the effective status for a source
    const getStatus = useCallback((id: string): NodeStatus => {
        if (phase === 'completing') return 'done';
        if (mode === 'skeleton') return simStatuses[id] || 'pending';
        return sources.find(s => s.id === id)?.status || 'pending';
    }, [mode, simStatuses, sources, phase]);

    // Transition out when done
    useEffect(() => {
        if (!isDone || mode === 'skeleton') return;

        setPhase('completing');

        const fadeTimer = setTimeout(() => setPhase('fading'), 1600);
        const completeTimer = setTimeout(() => {
            onTransitionComplete?.();
        }, 2200);

        return () => {
            clearTimeout(fadeTimer);
            clearTimeout(completeTimer);
        };
    }, [isDone, mode, onTransitionComplete]);

    // Progress ring calculations
    const hubRadius = 26;
    const hubCircumference = 2 * Math.PI * hubRadius;
    const displayPercent = mode === 'skeleton' ? 0 : percent;
    const progressOffset = hubCircumference - (displayPercent / 100) * hubCircumference;

    // Group positions by category for intra-cluster lines
    const categoryGroups = useMemo(() => {
        const groups: Record<string, NodePosition[]> = {};
        for (const pos of positions) {
            if (!groups[pos.category]) groups[pos.category] = [];
            groups[pos.category].push(pos);
        }
        return groups;
    }, [positions]);

    // Derive line status between two nodes
    const getLineStatus = useCallback((id1: string, id2: string): NodeStatus => {
        const s1 = getStatus(id1);
        const s2 = getStatus(id2);
        if (s1 === 'done' && s2 === 'done') return 'done';
        if (s1 === 'fetching' || s2 === 'fetching') return 'fetching';
        return 'pending';
    }, [getStatus]);

    return (
        <div
            ref={containerRef}
            className={`constellation-container constellation-phase-${phase}`}
            role="status"
            aria-label={mode === 'skeleton' ? 'Loading dashboard...' : `Updating sources: ${percent}%`}
        >
            {size.width > 0 && (
                <svg
                    className="constellation-svg"
                    width={size.width}
                    height={size.height}
                    viewBox={`0 0 ${size.width} ${size.height}`}
                >
                    {/* Connection lines: each node to center hub */}
                    {positions.map((pos) => (
                        <line
                            key={`hub-${pos.id}`}
                            x1={center.x}
                            y1={center.y}
                            x2={pos.x}
                            y2={pos.y}
                            className={`constellation-line constellation-line-${getStatus(pos.id)}`}
                        />
                    ))}

                    {/* Intra-cluster ring lines */}
                    {Object.values(categoryGroups).map((group) =>
                        group.length > 1
                            ? group.map((pos, i) => {
                                  const next = group[(i + 1) % group.length];
                                  return (
                                      <line
                                          key={`cl-${pos.id}-${next.id}`}
                                          x1={pos.x}
                                          y1={pos.y}
                                          x2={next.x}
                                          y2={next.y}
                                          className={`constellation-cluster-line constellation-line-${getLineStatus(pos.id, next.id)}`}
                                      />
                                  );
                              })
                            : null
                    )}

                    {/* Central hub background glow */}
                    <circle
                        cx={center.x}
                        cy={center.y}
                        r={hubRadius + 6}
                        className="constellation-hub-glow"
                    />

                    {/* Hub track */}
                    <circle
                        cx={center.x}
                        cy={center.y}
                        r={hubRadius}
                        className="constellation-hub-track"
                    />

                    {/* Hub progress arc */}
                    <circle
                        cx={center.x}
                        cy={center.y}
                        r={hubRadius}
                        className="constellation-hub-progress"
                        strokeDasharray={hubCircumference}
                        strokeDashoffset={progressOffset}
                        transform={`rotate(-90 ${center.x} ${center.y})`}
                    />

                    {/* Center text */}
                    <text
                        x={center.x}
                        y={center.y}
                        className="constellation-hub-text"
                        textAnchor="middle"
                        dominantBaseline="central"
                    >
                        {mode === 'skeleton' ? '...' : `${displayPercent}%`}
                    </text>
                </svg>
            )}

            {/* Source emoji nodes */}
            {positions.map((pos) => {
                const status = getStatus(pos.id);
                return (
                    <div
                        key={`node-${pos.id}`}
                        className={`constellation-node constellation-node-${status}`}
                        style={{
                            left: `${pos.x}px`,
                            top: `${pos.y}px`,
                        }}
                        title={sources.find(s => s.id === pos.id)?.name || pos.id}
                    >
                        <span className="constellation-node-icon">
                            {sources.find(s => s.id === pos.id)?.icon || '?'}
                        </span>
                        <span className="constellation-node-ring" />
                    </div>
                );
            })}

            <span className="sr-only">
                {mode === 'skeleton'
                    ? 'Loading dashboard content...'
                    : `Updating sources: ${displayPercent}% complete`}
            </span>
        </div>
    );
}
