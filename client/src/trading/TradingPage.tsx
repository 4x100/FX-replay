import  { useRef, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { createChart, ColorType, LineStyle } from 'lightweight-charts';
import type { ISeriesApi, IPriceLine, IChartApi } from 'lightweight-charts';

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
    const { allData, isLoading, timeframe, startDate, setStartDate, handleTimeframeChange } =
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

    // ─── Chart Setup ─────────────────────────────────────────────────────────
    useEffect(() => {
        const container = chartContainerRef.current;
        if (!container || allData.length === 0) return;

        container.innerHTML = '';
        priceLinesRef.current.clear();

        const chart = createChart(container, {
            layout: { background: { type: ColorType.Solid, color: '#000000' }, textColor: '#d1d4dc' },
            grid: { vertLines: { color: '#1e222d', style: 1 }, horzLines: { color: '#1e222d', style: 1 } },
            width: container.clientWidth,
            height: container.clientHeight,
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                // 🌟 [แก้ไขจุดนี้] เพื่อความยืดหยุ่นในการ Backtest
                rightOffset: 15,          // 👈 เว้นช่องว่างขวาไว้ 15 แท่งเทียน จะได้ไม่ชิดขอบจนอึดอัดมองไม่เห็น
                fixLeftEdge: false,
                fixRightEdge: false,      // 👈 ปิดการล็อกขอบขวาถาวร ไม่ให้มันฝืนมือตอนเราลากกราฟ
            },
        });

        chartRef.current = chart;  // ← สำคัญ: ให้ useIndicators เข้าถึงกราฟหลักได้

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
            let tp: IPriceLine | undefined, sl: IPriceLine | undefined;
            if (pos.tp) tp = series.createPriceLine({ price: pos.tp, color: '#089981', lineWidth: 2, lineStyle: LineStyle.Solid, title: 'TP Target' });
            if (pos.sl) sl = series.createPriceLine({ price: pos.sl, color: '#f23645', lineWidth: 2, lineStyle: LineStyle.Solid, title: 'SL Limit' });
            priceLinesRef.current.set(pos.id, { entry, tp, sl });
        });

        const ro = new ResizeObserver(([e]) => {
            const { width, height } = e.contentRect;
            window.requestAnimationFrame(() => chart.applyOptions({ width, height }));
        });
        ro.observe(container);

        return () => {
            chartRef.current = null;
            ro.disconnect();
            chart.remove();
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
                onStartDateChange={setStartDate}
                onPlayToggle={() => setIsPlaying(p => !p)}
                onNextCandle={handleNextCandle}
                onSpeedChange={setSpeed}
                onSetIndicators={setIndicators}
                onToggleIndicatorMenu={() => setShowIndicatorMenu(p => !p)}
            />

            <ChartContainer ref={chartContainerRef} isLoading={isLoading} />

            {/* RSI Sub-chart (แสดงเมื่อเปิด RSI) */}
            {indicators.some(i => i.type === 'RSI' && i.enabled) && (
                <div className="h-28 shrink-0 border-t border-[#2a2e39] bg-[#0b0e14] relative">
                    <div className="absolute top-1 left-2 text-[10px] font-bold text-amber-400 z-10 pointer-events-none">
                        RSI({indicators.find(i => i.type === 'RSI')?.period || 14})
                    </div>
                    <div ref={rsiContainerRef} className="w-full h-full" />
                </div>
            )}

            {/* MACD Sub-chart (แสดงเมื่อเปิด MACD) */}
            {indicators.some(i => i.type === 'MACD' && i.enabled) && (
                <div className="h-28 shrink-0 border-t border-[#2a2e39] bg-[#0b0e14] relative">
                    <div className="absolute top-1 left-2 text-[10px] font-bold text-purple-400 z-10 pointer-events-none">
                        MACD({indicators.find(i => i.type === 'MACD')?.fastPeriod},{indicators.find(i => i.type === 'MACD')?.slowPeriod},{indicators.find(i => i.type === 'MACD')?.signalPeriod})
                    </div>
                    <div ref={macdContainerRef} className="w-full h-full" />
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