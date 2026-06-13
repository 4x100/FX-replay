import { useEffect, useRef, useState, useCallback } from 'react';
import React from 'react';
import { useParams } from 'react-router-dom';
import { createChart, ColorType, LineStyle } from 'lightweight-charts';
import type { ISeriesApi, CandlestickData, SeriesMarker, Time, IPriceLine, IChartApi } from 'lightweight-charts';
import type { IndicatorConfig } from '../IndicatorPanel';
import { calculateSMA, calculateEMA, calculateRSI, calculateMACD } from '../indicatorUtils';
import type { CandleData, IndicatorData, MACDData } from '../indicatorUtils';

interface Position {
    id: string;
    type: 'BUY' | 'SELL';
    entryPrice: number;
    currentPrice: number;
    lotSize: number;
    pnl: number;
    openTime: string;
    tp: number;
    sl: number;
}

interface DBTrade {
    trade_id: string | number;
    trade_type: 'BUY' | 'SELL';
    entry_price: string | number;
    close_price: string | number;
    lot_size: string | number;
    pnl: string | number;
    open_time: string | number;
    tp_price?: string | number;
    sl_price?: string | number;
}

export default function TradingPage() {
    const { sessionId, startDate: paramStartDate } = useParams();
    const currentSessionId = sessionId ? parseInt(sessionId) : 1;

    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const priceLinesRef = useRef<Map<string, { entry: IPriceLine, tp?: IPriceLine, sl?: IPriceLine }>>(new Map());
    const indicatorSeriesRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
    const rsiContainerRef = useRef<HTMLDivElement>(null);
    const macdContainerRef = useRef<HTMLDivElement>(null);


    const [allData, setAllData] = useState<CandlestickData[]>([]);
    const [currentIndex, setCurrentIndex] = useState(100);
    const [isLoading, setIsLoading] = useState(true);

    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(500);

    const [balance, setBalance] = useState<number>(10000);
    const [lotSize, setLotSize] = useState<number>(0.1);
    const [currentPrice, setCurrentPrice] = useState<number>(0);
    const [openPositions, setOpenPositions] = useState<Position[]>([]);
    const [tradeHistory, setTradeHistory] = useState<Position[]>([]);
    const [tradeMarkers, setTradeMarkers] = useState<SeriesMarker<Time>[]>([]);

    const [tpOffset, setTpOffset] = useState<number>(0);
    const [slOffset, setSlOffset] = useState<number>(0);

    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [showIndicatorMenu, setShowIndicatorMenu] = useState(false);
    // ระบบเซฟ เวลาของ tf
    const [timeframe, setTimeframe] = useState<string>(() => {
        return localStorage.getItem('savedTimeframe') || '15M';
    });

    // 🌟 2. ทุกครั้งที่ Timeframe เปลี่ยน ให้มันจำลงกระเป๋า (localStorage) ทันที
    useEffect(() => {
        localStorage.setItem('savedTimeframe', timeframe);
    }, [timeframe]);
    const [startDate, setStartDate] = useState(paramStartDate || '2015-01-01');

    const [editingPosId, setEditingPosId] = useState<string | null>(null);
    const [editTp, setEditTp] = useState<number>(0);
    const [editSl, setEditSl] = useState<number>(0);

    // 🌟 INDICATORS SECTION
    const [indicators, setIndicators] = useState<IndicatorConfig[]>([]);
    const [indicatorResults, setIndicatorResults] = useState<{
        sma: Map<string, IndicatorData[]>;
        ema: Map<string, IndicatorData[]>;
        rsi: Map<string, IndicatorData[]>;
        macd: Map<string, MACDData[]>;
    }>({
        sma: new Map(),
        ema: new Map(),
        rsi: new Map(),
        macd: new Map()
    });

    // 🌟 2. โหลดข้อมูลกราฟจาก API อย่างเดียว (ไม่ต้องเซ็ต Index ตรงนี้แล้ว)
    useEffect(() => {
        const fetchChartData = async () => {
            try {
                setIsLoading(true);
                const response = await fetch(`http://localhost:3000/api/charts?tf=${timeframe}&start=${startDate}`);
                const data = await response.json();

                if (data && data.length > 0) {
                    setAllData(data);
                }
                setIsLoading(false);
            } catch (error) {
                console.error("เกิดข้อผิดพลาดในการโหลดกราฟ:", error);
                setIsLoading(false);
            }
        };
        fetchChartData();
    }, [timeframe, startDate]);


    // 🌟 2 & 3. โหลดกราฟ + โหลดความจำ (ใช้ตู้เซฟใบเดียวกันทุก TF)
    useEffect(() => {
        const loadChartAndMemory = async () => {
            try {
                setIsLoading(true);
                const response = await fetch(`http://localhost:3000/api/charts?tf=${timeframe}&start=${startDate}`);
                const data = await response.json();

                if (data && data.length > 0) {
                    let startingIndex = 100; // ค่าเริ่มต้น

                    // 🔍 ใช้ Key เดียวกันทุก Timeframe! (ตัด _${timeframe} ทิ้งไป)
                    const savedTime = localStorage.getItem(`replay_time_${currentSessionId}`);
                    if (savedTime) {
                        const parsedTime = Number(savedTime);

                        // 🧠 SA Logic: หาแท่งเทียนที่เวลา "น้อยกว่าหรือเท่ากับ" เวลาที่เซฟไว้
                        // (เผื่อกรณีสลับจาก 5M(10:05) ไป 15M(10:00) ระบบจะได้หาแท่งที่ใกล้ที่สุดเจอ)
                        let foundIndex = -1;
                        for (let i = data.length - 1; i >= 0; i--) {
                            if ((data[i].time as number) <= parsedTime) {
                                foundIndex = i;
                                break;
                            }
                        }

                        if (foundIndex !== -1) {
                            startingIndex = foundIndex;
                            console.log(`✅ ซิงค์เวลาข้าม TF สำเร็จ: ไปที่แท่ง index ${foundIndex}`);
                        }
                    }

                    // 📦 สั่งอัปเดต State ทีเดียว
                    setAllData(data);
                    setCurrentIndex(startingIndex);
                    setCurrentPrice(data[startingIndex].close as number);
                }
                setIsLoading(false);
            } catch (error) {
                console.error("เกิดข้อผิดพลาดในการโหลดกราฟ:", error);
                setIsLoading(false);
            }
        };

        loadChartAndMemory();
    }, [timeframe, startDate, currentSessionId]);
    // 🌟 3. ระบบ LOAD: ทำหน้าที่เซ็ตเวลาให้ตรงกับที่เคยหยุดไว้ (ทำครั้งเดียวต่อ 1 TF)


    // 🌟 5. ฟังก์ชันเปลี่ยน Timeframe ที่ปลอดภัย
    // 🌟 4. ฟังก์ชันเปลี่ยน Timeframe
    const handleTimeframeChange = (newTf: string) => {
        // 1. เซฟเวลาปัจจุบันของ TF เดิมลงตู้เซฟก่อน
        if (allData.length > 0 && currentIndex < allData.length) {
            localStorage.setItem(`replay_time_${currentSessionId}`, allData[currentIndex].time.toString());
        }
        // 2. เปลี่ยน TF
        setTimeframe(newTf);
    }

    // ดึงประวัติการเทรด
    useEffect(() => {
        const fetchTradeHistory = async () => {
            try {
                const response = await fetch(`http://localhost:3000/api/trades?session_id=${currentSessionId}`);
                const dbTrades = await response.json();

                if (dbTrades && dbTrades.length > 0) {
                    const loadedHistory: Position[] = dbTrades.map((dbTrade: DBTrade) => ({
                        id: dbTrade.trade_id.toString(),
                        type: dbTrade.trade_type,
                        entryPrice: Number(dbTrade.entry_price),
                        currentPrice: Number(dbTrade.close_price),
                        lotSize: Number(dbTrade.lot_size),
                        pnl: Number(dbTrade.pnl),
                        openTime: String(dbTrade.open_time),
                        tp: Number(dbTrade.tp_price || 0),
                        sl: Number(dbTrade.sl_price || 0),
                    }));
                    setTradeHistory(loadedHistory);
                    const totalRealized = loadedHistory.reduce((sum, trade) => sum + trade.pnl, 0);
                    setBalance(10000 + totalRealized);
                }
            } catch (error) {
                console.error("โหลดประวัติการเทรดไม่สำเร็จ:", error);
            }
        };
        fetchTradeHistory();
    }, [currentSessionId]);

    // 🌟 CALCULATE INDICATORS IN REALTIME
    const calculateIndicators = useCallback(() => {
        if (allData.length === 0 || indicators.length === 0) return;

        const candles: CandleData[] = allData.map(c => ({
            time: c.time as number,
            open: c.open as number,
            high: c.high as number,
            low: c.low as number,
            close: c.close as number
        }));

        const newResults = {
            sma: new Map<string, IndicatorData[]>(),
            ema: new Map<string, IndicatorData[]>(),
            rsi: new Map<string, IndicatorData[]>(),
            macd: new Map<string, MACDData[]>()
        };

        indicators.forEach(ind => {
            if (!ind.enabled) return;

            try {
                if (ind.type === 'SMA') {
                    const result = calculateSMA(candles, ind.period || 20);
                    newResults.sma.set(ind.id, result);
                } else if (ind.type === 'EMA') {
                    const result = calculateEMA(candles, ind.period || 12);
                    newResults.ema.set(ind.id, result);
                } else if (ind.type === 'RSI') {
                    const result = calculateRSI(candles, ind.period || 14);
                    newResults.rsi.set(ind.id, result);
                } else if (ind.type === 'MACD') {
                    const result = calculateMACD(candles, ind.fastPeriod || 12, ind.slowPeriod || 26, ind.signalPeriod || 9);
                    newResults.macd.set(ind.id, result);
                }
            } catch (error) {
                console.error(`Error calculating ${ind.type}:`, error);
            }
        });

        return newResults;
    }, [allData, indicators]);

    useEffect(() => {
        const results = calculateIndicators();
        if (results) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setIndicatorResults(results);
        }
    }, [calculateIndicators]);

    // 🌟 DRAW INDICATORS - ใช้ addLineSeries (ถูกต้อง) ไม่ใช่ createPriceLine
    useEffect(() => {
        if (!chartRef.current || allData.length === 0) return;

        // ลบ line series เก่าทั้งหมด
        indicatorSeriesRef.current.forEach((series) => {
            try { chartRef.current?.removeSeries(series); } catch {/* ... */ }
        });
        indicatorSeriesRef.current.clear();

        const currentTime = allData[Math.min(currentIndex, allData.length - 1)].time as number;

        // วาด SMA/EMA เป็น line series บนกราฟหลัก
        indicators
            .filter(i => ['SMA', 'EMA'].includes(i.type) && i.enabled)
            .forEach(ind => {
                if (!chartRef.current) return;

                const lineSeries = chartRef.current.addLineSeries({
                    color: ind.color || '#3b82f6',
                    lineWidth: 2,
                    priceLineVisible: false,
                    lastValueVisible: true,
                    crosshairMarkerVisible: false,
                    title: `${ind.type}(${ind.period})`,
                });

                const rawData = ind.type === 'SMA'
                    ? indicatorResults.sma.get(ind.id) || []
                    : indicatorResults.ema.get(ind.id) || [];

                const chartData = rawData
                    .filter(d => d.time <= currentTime)
                    .map(d => ({ time: d.time as Time, value: d.value }));

                if (chartData.length > 0) lineSeries.setData(chartData);
                indicatorSeriesRef.current.set(ind.id, lineSeries);
            });

    }, [indicatorResults, allData, indicators, currentIndex]);

    // 🌟 RSI sub-chart
    useEffect(() => {
        const container = rsiContainerRef.current;
        const rsiIndicator = indicators.find(i => i.type === 'RSI' && i.enabled);
        if (!container) return;

        container.innerHTML = '';
        if (!rsiIndicator || allData.length === 0) return;

        const rsiData = indicatorResults.rsi.get(rsiIndicator.id) || [];
        if (rsiData.length === 0) return;

        const currentTime = allData[Math.min(currentIndex, allData.length - 1)].time as number;
        const filtered = rsiData.filter(d => d.time <= currentTime);
        if (filtered.length === 0) return;

        const chart = createChart(container, {
            layout: { background: { type: ColorType.Solid, color: '#0b0e14' }, textColor: '#64748b' },
            grid: { vertLines: { color: '#1e222d' }, horzLines: { color: '#1e222d' } },
            width: container.clientWidth,
            height: container.clientHeight,
            timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#2a2e39' },
            rightPriceScale: { borderColor: '#2a2e39', scaleMargins: { top: 0.1, bottom: 0.1 } },
        });

        const rsiSeries = chart.addLineSeries({
            color: rsiIndicator.color || '#f59e0b',
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            title: `RSI(${rsiIndicator.period})`,
        });

        // เส้น overbought/oversold
        rsiSeries.createPriceLine({ price: 70, color: '#ef4444', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '70' });
        rsiSeries.createPriceLine({ price: 30, color: '#10b981', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '30' });

        rsiSeries.setData(filtered.map(d => ({ time: d.time as Time, value: d.value })));

        const obs = new ResizeObserver(() => {
            chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
        });
        obs.observe(container);

        return () => { obs.disconnect(); chart.remove(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [indicatorResults, indicators, currentIndex]);

    // 🌟 MACD sub-chart
    useEffect(() => {
        const container = macdContainerRef.current;
        const macdIndicator = indicators.find(i => i.type === 'MACD' && i.enabled);
        if (!container) return;

        container.innerHTML = '';
        if (!macdIndicator || allData.length === 0) return;

        const macdData = indicatorResults.macd.get(macdIndicator.id) || [];
        if (macdData.length === 0) return;

        const currentTime = allData[Math.min(currentIndex, allData.length - 1)].time as number;
        const filtered = macdData.filter(d => d.time <= currentTime);
        if (filtered.length === 0) return;

        const chart = createChart(container, {
            layout: { background: { type: ColorType.Solid, color: '#0b0e14' }, textColor: '#64748b' },
            grid: { vertLines: { color: '#1e222d' }, horzLines: { color: '#1e222d' } },
            width: container.clientWidth,
            height: container.clientHeight,
            timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#2a2e39' },
            rightPriceScale: { borderColor: '#2a2e39', scaleMargins: { top: 0.15, bottom: 0.15 } },
        });

        // MACD Line
        const macdLine = chart.addLineSeries({ color: '#8b5cf6', lineWidth: 2, priceLineVisible: false, lastValueVisible: true, title: 'MACD' });
        // Signal Line
        const signalLine = chart.addLineSeries({ color: '#f59e0b', lineWidth: 1, priceLineVisible: false, lastValueVisible: true, title: 'Signal' });
        // Histogram
        const histogram = chart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false });

        macdLine.setData(filtered.map(d => ({ time: d.time as Time, value: d.macd })));
        signalLine.setData(filtered.map(d => ({ time: d.time as Time, value: d.signal })));
        histogram.setData(filtered.map(d => ({
            time: d.time as Time,
            value: d.histogram,
            color: d.histogram >= 0 ? '#089981' : '#f23645',
        })));

        const obs = new ResizeObserver(() => {
            chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
        });
        obs.observe(container);

        return () => { obs.disconnect(); chart.remove(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [indicatorResults, indicators, currentIndex]);

    // วาดกราฟ TradingView
    useEffect(() => {
        const container = chartContainerRef.current;
        if (!container || allData.length === 0) return;

        container.innerHTML = '';
        priceLinesRef.current.clear();
        indicatorSeriesRef.current.clear();

        const chart = createChart(container, {
            layout: { background: { type: ColorType.Solid, color: '#000000' }, textColor: '#d1d4dc' },
            grid: { vertLines: { color: '#1e222d', style: 1 }, horzLines: { color: '#1e222d', style: 1 } },
            width: container.clientWidth,
            height: container.clientHeight,
            timeScale: { timeVisible: true, secondsVisible: false },
        });

        chartRef.current = chart;

        const candlestickSeries = chart.addCandlestickSeries({
            upColor: '#089981', downColor: '#f23645', borderVisible: false,
            wickUpColor: '#089981', wickDownColor: '#f23645',
        });

        candlestickSeries.setData(allData.slice(0, currentIndex + 1));
        candlestickSeries.setMarkers(tradeMarkers);
        seriesRef.current = candlestickSeries;

        openPositions.forEach(pos => {
            const entryLine = candlestickSeries.createPriceLine({
                price: pos.entryPrice, color: pos.type === 'BUY' ? '#089981' : '#f23645',
                lineWidth: 2, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: `${pos.type} ${pos.lotSize}`,
            });
            let tpLine, slLine;
            if (pos.tp) tpLine = candlestickSeries.createPriceLine({ price: pos.tp, color: '#089981', lineWidth: 2, lineStyle: LineStyle.Solid, title: 'TP Target' });
            if (pos.sl) slLine = candlestickSeries.createPriceLine({ price: pos.sl, color: '#f23645', lineWidth: 2, lineStyle: LineStyle.Solid, title: 'SL Limit' });

            priceLinesRef.current.set(pos.id, { entry: entryLine, tp: tpLine, sl: slLine });
        });

        const resizeObserver = new ResizeObserver(entries => {
            if (entries.length === 0 || entries[0].target !== container) return;
            const newRect = entries[0].contentRect;
            window.requestAnimationFrame(() => chart.applyOptions({ width: newRect.width, height: newRect.height }));
        });
        resizeObserver.observe(container);

        return () => {
            chartRef.current = null;
            resizeObserver.disconnect();
            chart.remove();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allData]);

    useEffect(() => {
        if (seriesRef.current) seriesRef.current.setMarkers(tradeMarkers);
    }, [tradeMarkers]);

    useEffect(() => {
        openPositions.forEach(pos => {
            const currentPnL = pos.type === 'BUY'
                ? (currentPrice - pos.entryPrice) * pos.lotSize * 100
                : (pos.entryPrice - currentPrice) * pos.lotSize * 100;

            const lines = priceLinesRef.current.get(pos.id);
            if (lines && lines.entry) {
                lines.entry.applyOptions({ title: `${pos.type} ${pos.lotSize}  ${currentPnL >= 0 ? '+' : ''}$${currentPnL.toFixed(2)}` });
            }
        });
    }, [currentPrice, openPositions]);

    const activePositions = openPositions.map(pos => {
        const pnl = pos.type === 'BUY'
            ? (currentPrice - pos.entryPrice) * pos.lotSize * 100
            : (pos.entryPrice - currentPrice) * pos.lotSize * 100;
        return { ...pos, currentPrice, pnl };
    });

    const handleClosePosition = useCallback(async (id: string, reason: string = 'MANUAL') => {
        const posToClose = openPositions.find(p => p.id === id);
        if (!posToClose) return;

        const finalPnL = posToClose.type === 'BUY'
            ? (currentPrice - posToClose.entryPrice) * posToClose.lotSize * 100
            : (posToClose.entryPrice - currentPrice) * posToClose.lotSize * 100;
        const closedPos = { ...posToClose, currentPrice, pnl: finalPnL };

        if (seriesRef.current) {
            const lines = priceLinesRef.current.get(id);
            if (lines) {
                seriesRef.current.removePriceLine(lines.entry);
                if (lines.tp) seriesRef.current.removePriceLine(lines.tp);
                if (lines.sl) seriesRef.current.removePriceLine(lines.sl);
                priceLinesRef.current.delete(id);
            }
        }

        setOpenPositions(prev => prev.filter(p => p.id !== id));
        setBalance(b => b + finalPnL);
        setTradeHistory(th => [closedPos, ...th]);

        fetch('http://localhost:3000/api/trades', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: currentSessionId,
                type: closedPos.type,
                lot_size: closedPos.lotSize,
                entry_price: closedPos.entryPrice,
                close_price: closedPos.currentPrice,
                pnl: closedPos.pnl,
                open_time: closedPos.openTime,
                tp_price: closedPos.tp,
                sl_price: closedPos.sl
            })
        }).then(r => {
            if (!r.ok) throw new Error("API Save Failed");
            console.log(`💾 Auto-Saved: ${reason} Close Success!`);
        }).catch(error => {
            console.error("Save Error:", error);
        });

    }, [currentPrice, currentSessionId, openPositions]);

    useEffect(() => {
        openPositions.forEach(pos => {
            if (pos.type === 'BUY') {
                if (pos.tp > 0 && currentPrice >= pos.tp) handleClosePosition(pos.id, 'HIT TP');
                if (pos.sl > 0 && currentPrice <= pos.sl) handleClosePosition(pos.id, 'HIT SL');
            } else {
                if (pos.tp > 0 && currentPrice <= pos.tp) handleClosePosition(pos.id, 'HIT TP');
                if (pos.sl > 0 && currentPrice >= pos.sl) handleClosePosition(pos.id, 'HIT SL');
            }
        });
    }, [currentPrice, openPositions, handleClosePosition]);

    const handleNextCandle = useCallback(() => {
        setCurrentIndex((prevIndex) => {
            const nextIndex = prevIndex + 1;
            if (nextIndex < allData.length) {
                const newCandle = allData[nextIndex];
                if (seriesRef.current) seriesRef.current.update(newCandle);
                setCurrentPrice(newCandle.close as number);
                return nextIndex;
            } else {
                setIsPlaying(false);
                return prevIndex;
            }
        });
    }, [allData]);

    const totalFloatingPnL = activePositions.reduce((sum, pos) => sum + pos.pnl, 0);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isPlaying) interval = setInterval(() => { handleNextCandle(); }, speed);
        return () => clearInterval(interval);
    }, [isPlaying, speed, handleNextCandle]);

    const handleTrade = (type: 'BUY' | 'SELL') => {
        if (currentPrice === 0) return;
        const currentTime = allData[currentIndex].time as number;

        const newId = `trade-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

        const safeTpOffset = Math.abs(tpOffset);
        const safeSlOffset = Math.abs(slOffset);

        const tpPrice = safeTpOffset > 0 ? (type === 'BUY' ? currentPrice + safeTpOffset : currentPrice - safeTpOffset) : 0;
        const slPrice = safeSlOffset > 0 ? (type === 'BUY' ? currentPrice - safeSlOffset : currentPrice + safeSlOffset) : 0;

        const newPosition: Position = {
            id: newId, type, entryPrice: currentPrice, currentPrice: currentPrice,
            lotSize, pnl: 0,
            openTime: new Date(currentTime * 1000).toLocaleString('en-GB'),
            tp: tpPrice, sl: slPrice
        };

        setOpenPositions(prev => [...prev, newPosition]);

        const newMarker: SeriesMarker<Time> = {
            time: currentTime as Time, position: type === 'BUY' ? 'belowBar' : 'aboveBar',
            color: type === 'BUY' ? '#089981' : '#f23645', shape: type === 'BUY' ? 'arrowUp' : 'arrowDown', text: type,
        };
        setTradeMarkers(prev => [...prev, newMarker].sort((a, b) => (a.time as number) - (b.time as number)));

        if (seriesRef.current) {
            const entryLine = seriesRef.current.createPriceLine({
                price: currentPrice, color: type === 'BUY' ? '#089981' : '#f23645',
                lineWidth: 2, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: `${type} ${lotSize}  $0.00`,
            });
            let tpLine, slLine;
            if (tpPrice > 0) tpLine = seriesRef.current.createPriceLine({ price: tpPrice, color: '#089981', lineWidth: 2, lineStyle: LineStyle.Solid, title: 'TP Target' });
            if (slPrice > 0) slLine = seriesRef.current.createPriceLine({ price: slPrice, color: '#f23645', lineWidth: 2, lineStyle: LineStyle.Solid, title: 'SL Limit' });

            priceLinesRef.current.set(newId, { entry: entryLine, tp: tpLine, sl: slLine });
        }
    };

    const startEditing = (pos: Position) => {
        setEditingPosId(pos.id);
        setEditTp(pos.tp > 0 ? pos.tp : pos.entryPrice);
        setEditSl(pos.sl > 0 ? pos.sl : pos.entryPrice);
    };

    useEffect(() => {
        if (editingPosId && seriesRef.current) {
            const lines = priceLinesRef.current.get(editingPosId);
            if (lines) {
                if (editTp > 0) {
                    if (lines.tp) {
                        lines.tp.applyOptions({ price: editTp });
                    } else {
                        lines.tp = seriesRef.current.createPriceLine({ price: editTp, color: '#089981', lineWidth: 2, lineStyle: LineStyle.Solid, title: 'TP Target' });
                    }
                } else if (lines.tp) {
                    seriesRef.current.removePriceLine(lines.tp);
                    lines.tp = undefined;
                }

                if (editSl > 0) {
                    if (lines.sl) {
                        lines.sl.applyOptions({ price: editSl });
                    } else {
                        lines.sl = seriesRef.current.createPriceLine({ price: editSl, color: '#f23645', lineWidth: 2, lineStyle: LineStyle.Solid, title: 'SL Limit' });
                    }
                } else if (lines.sl) {
                    seriesRef.current.removePriceLine(lines.sl);
                    lines.sl = undefined;
                }
            }
        }
    }, [editTp, editSl, editingPosId]);

    const cancelEdit = () => {
        if (!editingPosId) return;
        const pos = openPositions.find(p => p.id === editingPosId);
        if (pos && seriesRef.current) {
            const lines = priceLinesRef.current.get(editingPosId);
            if (lines) {
                if (pos.tp > 0) {
                    if (lines.tp) lines.tp.applyOptions({ price: pos.tp });
                } else if (lines.tp) {
                    seriesRef.current.removePriceLine(lines.tp);
                    lines.tp = undefined;
                }
                if (pos.sl > 0) {
                    if (lines.sl) lines.sl.applyOptions({ price: pos.sl });
                } else if (lines.sl) {
                    seriesRef.current.removePriceLine(lines.sl);
                    lines.sl = undefined;
                }
            }
        }
        setEditingPosId(null);
    };

    const saveEdit = (id: string) => {
        setOpenPositions(prev => prev.map(pos => {
            if (pos.id === id) {
                return { ...pos, tp: editTp, sl: editSl };
            }
            return pos;
        }));
        setEditingPosId(null);
    };



    return (
        <div className="h-screen bg-[#000000] text-[#d1d4dc] flex flex-col font-sans overflow-hidden">

            {/* TOP BAR */}
            <div className="h-12 bg-[#0b0e14] border-b border-[#2a2e39] flex justify-between items-center px-4 shrink-0 text-sm z-10">
                <div className="flex items-center space-x-4">
                    <span className="font-bold text-yellow-500">XAUUSD</span>
                    <span className="bg-[#1e222d] px-2 py-1 rounded text-xs text-gray-400">Session #{currentSessionId}</span>
                    <div className="flex items-center bg-[#1e222d] border border-[#2a2e39] rounded ml-2 overflow-hidden px-2">
                        <span className="text-gray-400 text-xs mr-2 uppercase font-bold">Start:</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            min="2015-01-01"
                            max="2025-12-31"
                            className="bg-transparent text-white text-xs py-1 focus:outline-none focus:text-blue-400 cursor-pointer"
                        />
                    </div>
                    <div className="flex bg-[#1e222d] rounded ml-2 shadow-sm border border-[#2a2e39] overflow-hidden">
                        <button onClick={() => handleTimeframeChange('5M')} className={`px-3 py-1 text-xs font-bold transition-colors ${timeframe === '5M' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-[#2a2e39]'}`}>5M</button>
                        <button onClick={() => handleTimeframeChange('15M')} className={`px-3 py-1 text-xs font-bold transition-colors border-l border-[#2a2e39] ${timeframe === '15M' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-[#2a2e39]'}`}>15M</button>
                    </div>

                    {/* 🌟 INDICATOR DROPDOWN */}
                    <div className="relative ml-2">
                        <button
                            onClick={() => setShowIndicatorMenu(prev => !prev)}
                            className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold border transition-colors ${showIndicatorMenu
                                ? 'bg-blue-600 border-blue-500 text-white'
                                : 'bg-[#1e222d] border-[#2a2e39] text-gray-400 hover:text-white hover:border-blue-500'
                                }`}
                        >
                            📈 Indicators
                            {indicators.filter(i => i.enabled).length > 0 && (
                                <span className="bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                                    {indicators.filter(i => i.enabled).length}
                                </span>
                            )}
                            <span className={`transition-transform ${showIndicatorMenu ? 'rotate-180' : ''}`}>▾</span>
                        </button>

                        {/* Dropdown Panel */}
                        {showIndicatorMenu && (
                            <div className="absolute top-full left-0 mt-2 w-72 bg-[#151e2e] border border-[#2a2e39] rounded-lg shadow-2xl z-50 overflow-hidden">
                                {/* Active Indicators */}
                                <div className="p-3 border-b border-[#2a2e39]">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Active Indicators</p>
                                    {indicators.length === 0 && (
                                        <p className="text-xs text-slate-500 italic">No indicators added</p>
                                    )}
                                    {indicators.map(ind => (
                                        <IndicatorRow
                                            key={ind.id}
                                            indicator={ind}
                                            onToggle={() => setIndicators(prev => prev.map(i => i.id === ind.id ? { ...i, enabled: !i.enabled } : i))}
                                            onRemove={() => setIndicators(prev => prev.filter(i => i.id !== ind.id))}
                                            onUpdate={(updates) => setIndicators(prev => prev.map(i => i.id === ind.id ? { ...i, ...updates } : i))}
                                        />
                                    ))}
                                </div>

                                {/* Add Indicator Menu */}
                                <div className="p-3">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Add Indicator</p>
                                    <div className="grid grid-cols-2 gap-1">
                                        {(['SMA', 'EMA', 'RSI', 'MACD'] as const).map(type => (
                                            <button
                                                key={type}
                                                onClick={() => setIndicators(prev => [...prev, {
                                                    id: `${type}-${Date.now()}`,
                                                    type,
                                                    enabled: true,
                                                    period: type === 'RSI' ? 14 : type === 'SMA' ? 20 : 12,
                                                    color: type === 'SMA' ? '#3b82f6' : type === 'EMA' ? '#10b981' : type === 'RSI' ? '#f59e0b' : '#8b5cf6',
                                                    fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
                                                }])}
                                                className="flex items-center gap-2 px-3 py-2 bg-[#1e222d] hover:bg-[#2a2e39] rounded text-xs font-bold text-white transition-colors"
                                            >
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: type === 'SMA' ? '#3b82f6' : type === 'EMA' ? '#10b981' : type === 'RSI' ? '#f59e0b' : '#8b5cf6' }} />
                                                + {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    <button onClick={() => setIsPlaying(!isPlaying)} className={`px-3 py-1 rounded transition-colors shadow-sm ${isPlaying ? 'bg-[#f23645] text-white' : 'bg-[#089981] text-white'}`}>
                        {isPlaying ? '⏸ PAUSE' : '▶ PLAY'}
                    </button>
                    <button onClick={handleNextCandle} disabled={isPlaying} className="px-3 py-1 bg-[#1e222d] hover:bg-[#2a2e39] rounded text-white disabled:opacity-50 transition-colors shadow-sm">
                        ⏭ NEXT
                    </button>
                    <div className="flex bg-[#1e222d] rounded ml-2 shadow-sm border border-[#2a2e39] overflow-hidden">
                        <button onClick={() => setSpeed(1000)} className={`px-3 py-1 text-xs transition-colors ${speed === 1000 ? 'bg-gray-600 text-white font-bold' : 'hover:bg-[#2a2e39]'}`}>1x</button>
                        <button onClick={() => setSpeed(500)} className={`px-3 py-1 text-xs transition-colors border-l border-r border-[#2a2e39] ${speed === 500 ? 'bg-gray-600 text-white font-bold' : 'hover:bg-[#2a2e39]'}`}>2x</button>
                        <button onClick={() => setSpeed(100)} className={`px-3 py-1 text-xs transition-colors ${speed === 100 ? 'bg-gray-600 text-white font-bold' : 'hover:bg-[#2a2e39]'}`}>5x</button>
                    </div>
                </div>
            </div>

            {/* MAIN CHART */}
            <div className="flex-1 relative w-full overflow-hidden bg-[#0b0e14]">
                <div ref={chartContainerRef} className="absolute inset-0 z-0" />
                {isLoading && (
                    <div className="absolute inset-0 flex justify-center items-center z-10 bg-[#0b0e14]/50 backdrop-blur-sm">
                        <div className="bg-[#1e222d] border border-[#2a2e39] px-6 py-3 rounded-lg shadow-2xl flex items-center space-x-3">
                            <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="animate-pulse text-gray-300 font-semibold tracking-widest text-sm">LOADING...</p>
                        </div>
                    </div>
                )}
            </div>

            {/* RSI SUB-CHART */}
            {indicators.some(i => i.type === 'RSI' && i.enabled) && (
                <div className="h-28 shrink-0 border-t border-[#2a2e39] bg-[#0b0e14] relative">
                    <div className="absolute top-1 left-2 text-[10px] font-bold text-amber-400 z-10 pointer-events-none">
                        RSI({indicators.find(i => i.type === 'RSI')?.period || 14})
                    </div>
                    <div ref={rsiContainerRef} className="w-full h-full" />
                </div>
            )}

            {/* MACD SUB-CHART */}
            {indicators.some(i => i.type === 'MACD' && i.enabled) && (
                <div className="h-28 shrink-0 border-t border-[#2a2e39] bg-[#0b0e14] relative">
                    <div className="absolute top-1 left-2 text-[10px] font-bold text-purple-400 z-10 pointer-events-none">
                        MACD({indicators.find(i => i.type === 'MACD')?.fastPeriod},{indicators.find(i => i.type === 'MACD')?.slowPeriod},{indicators.find(i => i.type === 'MACD')?.signalPeriod})
                    </div>
                    <div ref={macdContainerRef} className="w-full h-full" />
                </div>
            )}

            {/* TRADES PANEL */}
            <div className={`bg-[#0b0e14] border-t border-[#2a2e39] transition-all duration-300 ease-in-out ${isPanelOpen ? 'h-52' : 'h-0'} overflow-hidden flex shrink-0 relative z-20`}>
                <div className="w-full flex h-full">

                    {/* Left: Open Positions */}
                    <div className="flex-1 border-r border-[#2a2e39] flex flex-col">
                        <div className="p-2 border-b border-[#2a2e39] text-xs text-gray-400 font-semibold bg-[#0b0e14] uppercase tracking-wider">
                            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2 animate-pulse"></span>
                            Open Positions ({activePositions.length})
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 text-sm custom-scrollbar">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="text-gray-500 text-xs border-b border-[#2a2e39]">
                                        <th className="font-normal pb-2 pl-2">Type</th>
                                        <th className="font-normal pb-2">Entry</th>
                                        <th className="font-normal pb-2">TP / SL</th>
                                        <th className="font-normal pb-2">PnL</th>
                                        <th className="font-normal pb-2 text-right pr-2">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activePositions.length === 0 && (
                                        <tr><td colSpan={5} className="text-center py-4 text-gray-600 text-xs italic">No active trades.</td></tr>
                                    )}
                                    {activePositions.map((pos) => (
                                        <tr key={`open-${pos.id}`} className="border-b border-[#1e222d] hover:bg-[#1e222d] transition-colors group">
                                            <td className={`py-2 pl-2 font-bold ${pos.type === 'BUY' ? 'text-[#089981]' : 'text-[#f23645]'}`}>{pos.type} {pos.lotSize}</td>
                                            <td className="py-2 font-mono text-gray-300">{pos.entryPrice.toFixed(2)}</td>
                                            <td className="py-2 font-mono text-gray-500 text-xs">
                                                {editingPosId === pos.id ? (
                                                    <div className="flex items-center gap-1">
                                                        <input type="number" step="0.05" value={editTp} onChange={e => setEditTp(Number(e.target.value))} className="w-20 bg-[#0b0e14] border border-[#2a2e39] text-green-500 px-1 py-1 rounded focus:outline-none focus:border-blue-500 text-center font-bold" />
                                                        <span className="text-gray-600">/</span>
                                                        <input type="number" step="0.05" value={editSl} onChange={e => setEditSl(Number(e.target.value))} className="w-20 bg-[#0b0e14] border border-[#2a2e39] text-red-500 px-1 py-1 rounded focus:outline-none focus:border-blue-500 text-center font-bold" />
                                                    </div>
                                                ) : (
                                                    <span>
                                                        <span className="text-green-500">{pos.tp > 0 ? pos.tp.toFixed(2) : '-'}</span> / <span className="text-red-500">{pos.sl > 0 ? pos.sl.toFixed(2) : '-'}</span>
                                                    </span>
                                                )}
                                            </td>
                                            <td className={`py-2 font-mono font-bold ${pos.pnl >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}`}>{pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}</td>
                                            <td className="text-right py-2 pr-2">
                                                {editingPosId === pos.id ? (
                                                    <div className="flex justify-end gap-1">
                                                        <button onClick={() => saveEdit(pos.id)} className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-white text-xs transition-colors">Save</button>
                                                        <button onClick={cancelEdit} className="bg-gray-600 hover:bg-gray-500 px-3 py-1 rounded text-white text-xs transition-colors">Cancel</button>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => startEditing(pos)} className="bg-transparent hover:bg-blue-600/20 border border-blue-600/50 text-blue-400 px-3 py-1 rounded text-xs transition-colors">Edit</button>
                                                        <button onClick={() => handleClosePosition(pos.id)} className="bg-transparent hover:bg-red-500/20 border border-red-500/50 text-red-400 px-3 py-1 rounded text-xs transition-colors">Close</button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Right: Trade History */}
                    <div className="flex-1 flex flex-col">
                        <div className="p-2 border-b border-[#2a2e39] text-xs text-gray-400 font-semibold bg-[#0b0e14] uppercase tracking-wider">
                            <span className="inline-block w-2 h-2 rounded-full bg-gray-500 mr-2"></span>
                            Trade History
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 text-sm custom-scrollbar">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="text-gray-500 text-xs border-b border-[#2a2e39]">
                                        <th className="font-normal pb-2 pl-2">Type</th>
                                        <th className="font-normal pb-2">Entry</th>
                                        <th className="font-normal pb-2">Close</th>
                                        <th className="font-normal pb-2">TP / SL</th>
                                        <th className="font-normal pb-2 text-right pr-2">PnL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tradeHistory.length === 0 && (
                                        <tr><td colSpan={5} className="text-center py-4 text-gray-600 text-xs italic">Trade history is empty.</td></tr>
                                    )}
                                    {tradeHistory.map((pos) => (
                                        <tr key={`history-${pos.id}`} className="border-b border-[#1e222d] hover:bg-[#1e222d] transition-colors">
                                            <td className={`py-2 pl-2 ${pos.type === 'BUY' ? 'text-[#089981]' : 'text-[#f23645]'}`}>{pos.type} {pos.lotSize}</td>
                                            <td className="py-2 font-mono text-gray-400">{pos.entryPrice.toFixed(2)}</td>
                                            <td className="py-2 font-mono text-gray-300">{pos.currentPrice.toFixed(2)}</td>
                                            <td className="py-2 font-mono text-gray-600 text-xs">{pos.tp > 0 ? pos.tp.toFixed(2) : '-'} / {pos.sl > 0 ? pos.sl.toFixed(2) : '-'}</td>
                                            <td className={`text-right py-2 pr-2 font-mono font-bold ${pos.pnl >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}`}>{pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </div>

            <div className="h-16 bg-[#000000] border-t border-[#2a2e39] flex items-center justify-between px-6 shrink-0 relative z-30">
                <div className="flex items-center space-x-3">

                    <div className="flex items-center bg-[#0b0e14] border border-[#2a2e39] rounded overflow-hidden mr-2">
                        <span className="px-2 text-green-500 text-xs font-semibold">TP Dist.</span>
                        <input type="number" step="0.05" min="0" value={tpOffset} onChange={(e) => setTpOffset(Number(e.target.value))} className="bg-[#1e222d] text-white w-16 py-2 px-1 focus:outline-none text-center font-mono text-xs border-l border-[#2a2e39]" />
                    </div>
                    <div className="flex items-center bg-[#0b0e14] border border-[#2a2e39] rounded overflow-hidden mr-4">
                        <span className="px-2 text-red-500 text-xs font-semibold">SL Dist.</span>
                        <input type="number" step="0.05" min="0" value={slOffset} onChange={(e) => setSlOffset(Number(e.target.value))} className="bg-[#1e222d] text-white w-16 py-2 px-1 focus:outline-none text-center font-mono text-xs border-l border-[#2a2e39]" />
                    </div>

                    <button onClick={() => handleTrade('BUY')} className="bg-[#089981] hover:bg-[#067a67] text-white font-bold px-6 py-2 rounded transition-transform active:scale-95 shadow-md flex items-center gap-2">📈 Buy</button>
                    <button onClick={() => handleTrade('SELL')} className="bg-[#f23645] hover:bg-[#c22b37] text-white font-bold px-6 py-2 rounded transition-transform active:scale-95 shadow-md flex items-center gap-2">📉 Sell</button>

                    <div className="flex items-center bg-[#0b0e14] border border-[#2a2e39] rounded overflow-hidden ml-2">
                        <span className="px-3 text-gray-400 text-sm font-semibold uppercase tracking-wider">Lot</span>
                        <input type="number" step="0.01" value={lotSize} onChange={(e) => setLotSize(Number(e.target.value))} className="bg-[#1e222d] text-white w-20 py-2 px-2 focus:outline-none text-center font-mono border-l border-[#2a2e39]" />
                    </div>
                </div>

                <div className="flex items-center space-x-8 text-sm">
                    <div className="flex flex-col items-end">
                        <span className="text-gray-500 text-xs uppercase tracking-wider">Balance</span>
                        <span className="font-bold text-white font-mono text-base">${balance.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-gray-500 text-xs uppercase tracking-wider">Floating PnL</span>
                        <span className={`font-bold font-mono text-base ${totalFloatingPnL >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                            {totalFloatingPnL >= 0 ? '+' : ''}${totalFloatingPnL.toFixed(2)}
                        </span>
                    </div>

                    <div className="border-l border-[#2a2e39] pl-6 ml-2">
                        <button onClick={() => setIsPanelOpen(!isPanelOpen)} className={`p-2 rounded bg-[#1e222d] hover:bg-[#2a2e39] border border-[#2a2e39] transition-all flex items-center justify-center w-10 h-10 ${isPanelOpen ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'text-gray-400'}`} title="Toggle Trade Panel">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 ${isPanelOpen ? 'rotate-180' : ''}`}><polyline points="18 15 12 9 6 15"></polyline></svg>
                        </button>
                    </div>
                </div>
            </div>

            <style>{` .custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: #0b0e14; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #2a2e39; border-radius: 10px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3f4555; } `}</style>
        </div>
    );
}

// ============================================
// 🎛️ IndicatorRow - แถวตั้งค่าแต่ละ Indicator
// ============================================
const COLOR_PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

interface IndicatorRowProps {
    indicator: IndicatorConfig;
    onToggle: () => void;
    onRemove: () => void;
    onUpdate: (updates: Partial<IndicatorConfig>) => void;
}

const IndicatorRow: React.FC<IndicatorRowProps> = ({ indicator, onToggle, onRemove, onUpdate }) => {
    const [expanded, setExpanded] = useState(false);
    return (
        <div className="mb-2">
            {/* Row header */}
            <div className="flex items-center gap-2 px-2 py-1.5 bg-[#1e222d] rounded hover:bg-[#2a2e39] transition-colors group">
                <input type="checkbox" checked={indicator.enabled} onChange={onToggle} className="w-3 h-3 cursor-pointer" />
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: indicator.color }} />
                <span className="text-xs font-bold text-white flex-1">
                    {indicator.type}
                    <span className="text-slate-400 font-normal ml-1">
                        {indicator.type === 'MACD'
                            ? `(${indicator.fastPeriod},${indicator.slowPeriod},${indicator.signalPeriod})`
                            : `(${indicator.period})`}
                    </span>
                </span>
                <button onClick={() => setExpanded(p => !p)} className="text-slate-400 hover:text-white text-xs px-1">⚙</button>
                <button onClick={onRemove} className="text-slate-500 hover:text-red-400 text-xs px-1 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
            </div>

            {/* Expanded settings */}
            {expanded && (
                <div className="mt-1 p-2 bg-[#0f1623] border border-[#2a2e39] rounded space-y-2">
                    {indicator.type !== 'MACD' && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 w-12">Period</span>
                            <input
                                type="number"
                                value={indicator.period}
                                onChange={e => onUpdate({ period: parseInt(e.target.value) || 14 })}
                                min="2" max="200"
                                className="w-16 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                    )}
                    {indicator.type === 'MACD' && (
                        <div className="flex gap-2">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] text-slate-400">Fast</span>
                                <input type="number" value={indicator.fastPeriod} onChange={e => onUpdate({ fastPeriod: parseInt(e.target.value) || 12 })} className="w-12 px-1 py-1 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] text-slate-400">Slow</span>
                                <input type="number" value={indicator.slowPeriod} onChange={e => onUpdate({ slowPeriod: parseInt(e.target.value) || 26 })} className="w-12 px-1 py-1 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] text-slate-400">Signal</span>
                                <input type="number" value={indicator.signalPeriod} onChange={e => onUpdate({ signalPeriod: parseInt(e.target.value) || 9 })} className="w-12 px-1 py-1 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none" />
                            </div>
                        </div>
                    )}
                    <div>
                        <span className="text-xs text-slate-400 block mb-1">Color</span>
                        <div className="flex gap-1 flex-wrap">
                            {COLOR_PALETTE.map(c => (
                                <button
                                    key={c}
                                    onClick={() => onUpdate({ color: c })}
                                    className={`w-5 h-5 rounded-full border-2 transition-all ${indicator.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

