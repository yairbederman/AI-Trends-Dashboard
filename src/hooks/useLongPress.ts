import { useRef, useCallback } from 'react';

interface UseLongPressOptions {
    threshold?: number;
    onStart?: () => void;
    onFinish?: () => void;
}

interface UseLongPressHandlers {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchCancel: () => void;
}

export function useLongPress(
    onLongPress: () => void,
    options: UseLongPressOptions = {}
): UseLongPressHandlers {
    const { threshold = 500, onStart, onFinish } = options;
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const startPosRef = useRef<{ x: number; y: number } | null>(null);
    const firedRef = useRef(false);

    const cancel = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (!firedRef.current) {
            onFinish?.();
        }
        startPosRef.current = null;
    }, [onFinish]);

    const onTouchStart = useCallback(
        (e: React.TouchEvent) => {
            firedRef.current = false;
            const touch = e.touches[0];
            startPosRef.current = { x: touch.clientX, y: touch.clientY };
            onStart?.();

            timerRef.current = setTimeout(() => {
                firedRef.current = true;
                onLongPress();
                onFinish?.();
            }, threshold);
        },
        [onLongPress, threshold, onStart, onFinish]
    );

    const onTouchMove = useCallback(
        (e: React.TouchEvent) => {
            if (!startPosRef.current) return;
            const touch = e.touches[0];
            const dx = touch.clientX - startPosRef.current.x;
            const dy = touch.clientY - startPosRef.current.y;
            if (Math.sqrt(dx * dx + dy * dy) > 10) {
                cancel();
            }
        },
        [cancel]
    );

    const onTouchEnd = useCallback(() => {
        cancel();
    }, [cancel]);

    const onTouchCancel = useCallback(() => {
        cancel();
    }, [cancel]);

    return { onTouchStart, onTouchEnd, onTouchMove, onTouchCancel };
}
