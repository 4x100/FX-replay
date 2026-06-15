import { useState, useEffect } from 'react';
import type { CandlestickData } from 'lightweight-charts';

export function useChartData(
    sessionId: number,
    paramStartDate: string,
    setCurrentIndex: (i: number) => void,
    setCurrentPrice: (p: number) => void,
) {
    // บันทึก Timeframe ลง localStorage ให้จำข้าม session
    const [timeframe, setTimeframe] = useState<string>(
        () => localStorage.getItem('savedTimeframe') || '15M'
    );
    const [startDate, setStartDate] = useState(paramStartDate);
    const [allData, setAllData] = useState<CandlestickData[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        localStorage.setItem('savedTimeframe', timeframe);
    }, [timeframe]);

    // โหลดข้อมูลกราฟ + ซิงค์ตำแหน่งจาก localStorage
    useEffect(() => {
        const load = async () => {
            try {
                setIsLoading(true);
                const res = await fetch(
                    `https://fx-replay-backend.onrender.com/api/charts?tf=${timeframe}&start=${startDate}`
                );
                const data: CandlestickData[] = await res.json();

                if (data?.length > 0) {
                    let startingIndex = 100;
                    const savedTime = localStorage.getItem(`replay_time_${sessionId}`);
                    if (savedTime) {
                        const parsedTime = Number(savedTime);
                        for (let i = data.length - 1; i >= 0; i--) {
                            if ((data[i].time as number) <= parsedTime) {
                                startingIndex = i;
                                break;
                            }
                        }
                    }
                    setAllData(data);
                    setCurrentIndex(startingIndex);
                    setCurrentPrice(data[startingIndex].close as number);
                }
            } catch (err) {
                console.error('Chart load error:', err);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [timeframe, startDate, sessionId]);

    const handleTimeframeChange = (newTf: string, currentIndex: number) => {
        if (allData.length > 0 && currentIndex < allData.length) {
            localStorage.setItem(`replay_time_${sessionId}`, allData[currentIndex].time.toString());
        }
        setTimeframe(newTf);
    };

    return { allData, isLoading, timeframe, startDate, setStartDate, handleTimeframeChange };
}