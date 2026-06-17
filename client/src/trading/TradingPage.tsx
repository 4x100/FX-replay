import { useRef, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { createChart, ColorType, LineStyle } from 'lightweight-charts';
import type { ISeriesApi, IChartApi } from 'lightweight-charts';

import { useChartData } from './hooks/useChartData';
import { useReplayControls } from './hooks/useReplayControls';
import { usePositions } from './hooks/usePositions';
import { useIndicators } from './hooks/useIndicators';
import { TopBar } from './components/TopBar';
import { ChartContainer } from './components/ChartContainer';
import { TradePanel } from './components/TradePanel';
import { OrderBar } from './components/OrderBar';
import type { PriceLinesMap } from './types';

export default function TradingPage() {
    const { sessionId, startDate: paramStartDate } = useParams();
    const currentSessionId = sessionId ? parseInt(sessionId) : 1;

    // ─── Refs ────────────────────────────────────────────────────────────────
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);           // ← ใหม่
    const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const priceLinesRef = useRef<PriceLinesMap>(new Map());

    // ─── Shared State ────────────────────────────────────────────────────────
    const [currentPrice, setCurrentPrice] = useState(0);
    const [currentIndex, setCurrentIndex] = useState(100);
    const [lotSize, setLotSize] = useState(0.1);
    const [tpOffset, setTpOffset] = useState(0);
    const [slOffset, setSlOffset] = useState(0);
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    // ─── Hooks ───────────────────────────────────────────────────────────────
    const { allData, isLoading, timeframe, startDate, handleTimeframeChange } =
        useChartData(currentSessionId, paramStartDate || '2015-01-01', setCurrentIndex, setCurrentPrice);

    const { isPlaying, setIsPlaying, speed, setSpeed, handleNextCandle } =
        useReplayControls(allData, seriesRef, setCurrentIndex, setCurrentPrice);

    const positions = usePositions({
        currentPrice, sessionId: currentSessionId,
        seriesRef, priceLinesRef,
        allData, currentIndex,
        lotSize, tpOffset, slOffset,
    });

    const {
        indicators, setIndicators,
        showIndicatorMenu, setShowIndicatorMenu,
        rsiContainerRef, macdContainerRef,
    } = useIndicators(allData, currentIndex, chartRef);  // ← ส่ง chartRef ให้ indicator วาดบนกราฟหลักได้
    // ─── 🌟 State ควบคุมความสูงของ Indicator Panel ─────────────────────────
    const [macdHeight, setMacdHeight] = useState(140);
    const [rsiHeight, setRsiHeight] = useState(120);

    // ฟังก์ชันดึงขอบบน MACD
    const startMacdResize = (e: React.MouseEvent) => {
        e.preventDefault();
        const startY = e.clientY;
        const startHeight = macdHeight;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            // ลากขึ้น = ความสูงเพิ่มขึ้น
            const newHeight = startHeight + (startY - moveEvent.clientY);
            setMacdHeight(Math.max(60, Math.min(400, newHeight))); // จำกัดความสูง 60px ถึง 400px
        };
        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // ฟังก์ชันดึงขอบบน RSI
    const startRsiResize = (e: React.MouseEvent) => {
        e.preventDefault();
        const startY = e.clientY;
        const startHeight = rsiHeight;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const newHeight = startHeight + (startY - moveEvent.clientY);
            setRsiHeight(Math.max(60, Math.min(400, newHeight)));
        };
        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // ─── Chart Setup ─────────────────────────────────────────────────────────
    // ─── Chart Setup ─────────────────────────────────────────────────────────
    useEffect(() => {
        const container = chartContainerRef.current;
        if (!container || allData.length === 0) return;

        // ❌ ห้ามใช้ container.innerHTML = ''; เด็ดขาด! มันคือตัวการทำให้ Canvas พัง
        priceLinesRef.current.clear();

        const chart = createChart(container, {
            layout: { background: { type: ColorType.Solid, color: '#000000' }, textColor: '#d1d4dc' },
            grid: { vertLines: { color: '#1e222d', style: 1 }, horzLines: { color: '#1e222d', style: 1 } },
            width: container.clientWidth,
            height: container.clientHeight,
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                rightOffset: 15,
                fixLeftEdge: false,
                fixRightEdge: false,
            },
        });

        chartRef.current = chart;

        const series = chart.addCandlestickSeries({
            upColor: '#089981', downColor: '#f23645', borderVisible: false,
            wickUpColor: '#089981', wickDownColor: '#f23645',
        });

        series.setData(allData.slice(0, currentIndex + 1));
        series.setMarkers(positions.tradeMarkers);
        seriesRef.current = series;

        positions.openPositions.forEach(pos => {
            const entry = series.createPriceLine({
                price: pos.entryPrice, color: pos.type === 'BUY' ? '#089981' : '#f23645',
                lineWidth: 2, lineStyle: LineStyle.Dashed, axisLabelVisible: true,
                title: `${pos.type} ${pos.lotSize}`,
            });
            let tp, sl;
            if (pos.tp) tp = series.createPriceLine({ price: pos.tp, color: '#089981', lineWidth: 2, lineStyle: LineStyle.Solid, title: 'TP Target' });
            if (pos.sl) sl = series.createPriceLine({ price: pos.sl, color: '#f23645', lineWidth: 2, lineStyle: LineStyle.Solid, title: 'SL Limit' });
            priceLinesRef.current.set(pos.id, { entry, tp, sl });
        });

        let reqId: number;
        const ro = new ResizeObserver(([e]) => {
            const { width, height } = e.contentRect;
            if (reqId) window.cancelAnimationFrame(reqId);
            reqId = window.requestAnimationFrame(() => {
                // 🌟 ป้องกันไม่ให้กราฟที่โดนลบไปแล้วมาอัปเดตขนาด
                if (chartRef.current) {
                    try { chart.applyOptions({ width, height }); } catch  { //
                        }
                }
            });
        });
        ro.observe(container);

        // 🌟 THE MASTER CLEANUP: วิธีทำลายกราฟที่ถูกต้องใน React
        return () => {
            if (reqId) window.cancelAnimationFrame(reqId);
            ro.disconnect();

            // 1. ถอดปลั๊กออกให้หมด! เพื่อให้ไฟล์อื่นๆ (เช่น usePositions) รู้ว่ากราฟตายแล้ว
            chartRef.current = null;
            seriesRef.current = null;

            // 2. ท่าไม้ตาย! เอา setTimeout มาครอบ chart.remove() ไว้ 
            // เพื่อหน่วงเวลาให้ React สะสาง State ทุกอย่างให้จบก่อน ค่อยกดระเบิดทิ้ง!
            setTimeout(() => {
                try {
                    chart.remove();
                } catch  { //
                     }
            }, 0);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allData]);

    useEffect(() => {
        seriesRef.current?.setMarkers(positions.tradeMarkers);
    }, [positions.tradeMarkers]);

    // ─── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="h-screen bg-[#000000] text-[#d1d4dc] flex flex-col font-sans overflow-hidden">

            <TopBar
                sessionId={currentSessionId}
                timeframe={timeframe}
                startDate={startDate}
                isPlaying={isPlaying}
                speed={speed}
                indicators={indicators}
                showIndicatorMenu={showIndicatorMenu}
                onTimeframeChange={tf => handleTimeframeChange(tf, currentIndex)}
                onPlayToggle={() => setIsPlaying(p => !p)}
                onNextCandle={handleNextCandle}
                onSpeedChange={setSpeed}
                onSetIndicators={setIndicators}
                onToggleIndicatorMenu={() => setShowIndicatorMenu(p => !p)}
            />

            <ChartContainer ref={chartContainerRef} isLoading={isLoading} />

            {/* RSI Sub-chart (แสดงเมื่อเปิด RSI) */}
            {/* RSI Sub-chart */}
            {indicators.some(i => i.type === 'RSI' && i.enabled) && (
                <div
                    className="shrink-0 bg-[#0b0e14] relative flex flex-col border-t border-[#2a2e39]"
                    style={{ height: `${rsiHeight}px` }} // 🌟 ใช้ความสูงจาก State
                >
                    {/* 🌟 ตัวจับลากขอบบน (Drag Handle) */}
                    <div
                        className="absolute top-0 left-0 w-full h-1.5 cursor-row-resize z-20 hover:bg-blue-500/50 transition-colors"
                        onMouseDown={startRsiResize}
                    />

                    <div className="absolute top-3 left-2 text-[10px] font-bold text-amber-400 z-10 pointer-events-none">
                        RSI({indicators.find(i => i.type === 'RSI')?.period || 14})
                    </div>
                    <div ref={rsiContainerRef} className="w-full flex-1" />
                </div>
            )}

            {/* MACD Sub-chart */}
            {/* MACD Sub-chart */}
            {indicators.some(i => i.type === 'MACD' && i.enabled) && (
                <div
                    className="shrink-0 bg-[#0b0e14] relative flex flex-col border-t border-[#2a2e39]"
                    style={{ height: `${macdHeight}px` }} // 🌟 ใช้ความสูงจาก State
                >
                    {/* 🌟 ตัวจับลากขอบบน (Drag Handle) */}
                    <div
                        className="absolute top-0 left-0 w-full h-1.5 cursor-row-resize z-20 hover:bg-blue-500/50 transition-colors"
                        onMouseDown={startMacdResize}
                    />

                    <div className="absolute top-3 left-2 text-[10px] font-bold text-purple-400 z-10 pointer-events-none">
                        MACD({indicators.find(i => i.type === 'MACD')?.fastPeriod},{indicators.find(i => i.type === 'MACD')?.slowPeriod},{indicators.find(i => i.type === 'MACD')?.signalPeriod})
                    </div>
                    <div ref={macdContainerRef} className="w-full flex-1" />
                </div>
            )}
            <TradePanel
                isOpen={isPanelOpen}
                activePositions={positions.activePositions}
                tradeHistory={positions.tradeHistory}
                editingPosId={positions.editingPosId}
                editTp={positions.editTp}
                editSl={positions.editSl}
                onSetEditTp={positions.setEditTp}
                onSetEditSl={positions.setEditSl}
                onStartEditing={positions.startEditing}
                onSaveEdit={positions.saveEdit}
                onCancelEdit={positions.cancelEdit}
                onClosePosition={positions.handleClosePosition}
            />

            <OrderBar
                lotSize={lotSize} onLotSizeChange={setLotSize}
                tpOffset={tpOffset} onTpOffsetChange={setTpOffset}
                slOffset={slOffset} onSlOffsetChange={setSlOffset}
                balance={positions.balance}
                floatingPnL={positions.totalFloatingPnL}
                isPanelOpen={isPanelOpen}
                onTogglePanel={() => setIsPanelOpen(p => !p)}
                onTrade={positions.handleTrade}
            />

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #0b0e14; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #2a2e39; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3f4555; }
            `}</style>
        </div>
    );
}