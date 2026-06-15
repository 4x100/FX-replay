import { useState, useEffect, useCallback } from 'react';
import type { RefObject } from 'react';
import type { ISeriesApi, CandlestickData } from 'lightweight-charts';

export function useReplayControls(
    allData: CandlestickData[],
    seriesRef: RefObject<ISeriesApi<'Candlestick'> | null>,
    setCurrentIndex: React.Dispatch<React.SetStateAction<number>>,
    setCurrentPrice: (p: number) => void,
) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(500);

    const handleNextCandle = useCallback(() => {
        setCurrentIndex(prev => {
            const next = prev + 1;
            if (next < allData.length) {
                const candle = allData[next];
                seriesRef.current?.update(candle);
                setCurrentPrice(candle.close as number);
                return next;
            }
            setIsPlaying(false);
            return prev;
        });
    }, [allData, seriesRef, setCurrentIndex, setCurrentPrice]);

    useEffect(() => {
        if (!isPlaying) return;
        const id = setInterval(handleNextCandle, speed);
        return () => clearInterval(id);
    }, [isPlaying, speed, handleNextCandle]);

    return { isPlaying, setIsPlaying, speed, setSpeed, handleNextCandle };
}