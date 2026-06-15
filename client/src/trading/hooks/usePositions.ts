import { useState, useEffect, useCallback } from 'react';
import type { RefObject, MutableRefObject } from 'react';
import type { ISeriesApi, CandlestickData, SeriesMarker, Time, SeriesMarkerPosition, SeriesMarkerShape } from 'lightweight-charts';
import { LineStyle } from 'lightweight-charts';
import type { Position, DBTrade, PriceLinesMap } from '../types';

interface UsePositionsProps {
    currentPrice: number;
    sessionId: number;
    seriesRef: RefObject<ISeriesApi<'Candlestick'> | null>;
    priceLinesRef: MutableRefObject<PriceLinesMap>;
    allData: CandlestickData[];
    currentIndex: number;
    lotSize: number;
    tpOffset: number;
    slOffset: number;
}

export function usePositions({
    currentPrice, sessionId, seriesRef, priceLinesRef,
    allData, currentIndex, lotSize, tpOffset, slOffset,
}: UsePositionsProps) {

    const [openPositions, setOpenPositions] = useState<Position[]>([]);
    const [tradeHistory, setTradeHistory] = useState<Position[]>([]);
    const [tradeMarkers, setTradeMarkers] = useState<SeriesMarker<Time>[]>([]);
    const [balance, setBalance] = useState(10000);

    const [editingPosId, setEditingPosId] = useState<string | null>(null);
    const [editTp, setEditTp] = useState(0);
    const [editSl, setEditSl] = useState(0);

    // ─── โหลดประวัติจาก DB เมื่อเข้าเซสชัน ──────────────────────────────────
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch(
                    `https://fx-replay-backend.onrender.com/api/trades?session_id=${sessionId}`
                );
                const dbTrades: DBTrade[] = await res.json();

                if (dbTrades?.length > 0) {
                    const loaded: Position[] = dbTrades.map(t => ({
                        id: t.trade_id.toString(),
                        type: t.trade_type,
                        entryPrice: Number(t.entry_price),
                        currentPrice: Number(t.close_price),
                        lotSize: Number(t.lot_size),
                        pnl: Number(t.pnl),
                        openTime: String(t.open_time),
                        tp: Number(t.tp_price || 0),
                        sl: Number(t.sl_price || 0),
                    }));
                    setTradeHistory(loaded);
                    setBalance(10000 + loaded.reduce((sum, t) => sum + t.pnl, 0));
                }
            } catch (err) {
                console.error('Load trade history failed:', err);
            }
        };
        fetchHistory();
    }, [sessionId]);

    // ─── อัปเดตชื่อ Price Line ด้วย PnL แบบ Real-time ────────────────────────
    useEffect(() => {
        openPositions.forEach(pos => {
            const pnl = pos.type === 'BUY'
                ? (currentPrice - pos.entryPrice) * pos.lotSize * 100
                : (pos.entryPrice - currentPrice) * pos.lotSize * 100;
            priceLinesRef.current.get(pos.id)?.entry.applyOptions({
                title: `${pos.type} ${pos.lotSize}  ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
            });
        });
    }, [currentPrice, openPositions, priceLinesRef]);

    // ─── ปิด Position ─────────────────────────────────────────────────────────
    const handleClosePosition = useCallback(async (id: string, reason = 'MANUAL') => {
        const pos = openPositions.find(p => p.id === id);
        if (!pos) return;

        const finalPnL = pos.type === 'BUY'
            ? (currentPrice - pos.entryPrice) * pos.lotSize * 100
            : (pos.entryPrice - currentPrice) * pos.lotSize * 100;
        const closed = { ...pos, currentPrice, pnl: finalPnL };

        // ลบ Price Lines ออกจากกราฟ
        const lines = priceLinesRef.current.get(id);
        if (lines && seriesRef.current) {
            seriesRef.current.removePriceLine(lines.entry);
            if (lines.tp) seriesRef.current.removePriceLine(lines.tp);
            if (lines.sl) seriesRef.current.removePriceLine(lines.sl);
            priceLinesRef.current.delete(id);
        }

        setOpenPositions(prev => prev.filter(p => p.id !== id));
        setBalance(b => b + finalPnL);
        setTradeHistory(th => [closed, ...th]);

        // บันทึกลง DB
        fetch('https://fx-replay-backend.onrender.com/api/trades', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: sessionId,
                type: closed.type,
                lot_size: closed.lotSize,
                entry_price: closed.entryPrice,
                close_price: closed.currentPrice,
                pnl: closed.pnl,
                open_time: closed.openTime,
                tp_price: closed.tp,
                sl_price: closed.sl,
            }),
        })
            .then(r => { if (!r.ok) throw new Error('API Save Failed'); })
            .catch(err => console.error(`${reason} save error:`, err));

    }, [currentPrice, sessionId, openPositions, seriesRef, priceLinesRef]);

    // ─── ตรวจ TP / SL ทุก Tick ────────────────────────────────────────────────
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

    // ─── เปิด Order ──────────────────────────────────────────────────────────
    const handleTrade = (type: 'BUY' | 'SELL') => {
        if (currentPrice === 0 || allData.length === 0) return;
        const currentTime = allData[currentIndex].time as number;
        const id = `trade-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

        const tpAbs = Math.abs(tpOffset);
        const slAbs = Math.abs(slOffset);
        const tpPrice = tpAbs > 0 ? (type === 'BUY' ? currentPrice + tpAbs : currentPrice - tpAbs) : 0;
        const slPrice = slAbs > 0 ? (type === 'BUY' ? currentPrice - slAbs : currentPrice + slAbs) : 0;

        const newPos: Position = {
            id, type, entryPrice: currentPrice, currentPrice,
            lotSize, pnl: 0,
            openTime: new Date(currentTime * 1000).toLocaleString('en-GB'),
            tp: tpPrice, sl: slPrice,
        };

        setOpenPositions(prev => [...prev, newPos]);
setTradeMarkers(prev =>
            [...prev, {
                time: currentTime as Time,
                // 🟢 เติมวงเล็บและ as Type เข้าไปตรงนี้ครับ
                position: (type === 'BUY' ? 'belowBar' : 'aboveBar') as SeriesMarkerPosition,
                color: type === 'BUY' ? '#089981' : '#f23645',
                // 🟢 เติมวงเล็บและ as Type เข้าไปตรงนี้ด้วยครับ
                shape: (type === 'BUY' ? 'arrowUp' : 'arrowDown') as SeriesMarkerShape,
                text: type,
            }].sort((a, b) => (a.time as number) - (b.time as number))
        );
        if (seriesRef.current) {
            const entry = seriesRef.current.createPriceLine({
                price: currentPrice, color: type === 'BUY' ? '#089981' : '#f23645',
                lineWidth: 2, lineStyle: LineStyle.Dashed, axisLabelVisible: true,
                title: `${type} ${lotSize}  $0.00`,
            });
            let tp, sl;
            if (tpPrice > 0) tp = seriesRef.current.createPriceLine({ price: tpPrice, color: '#089981', lineWidth: 2, lineStyle: LineStyle.Solid, title: 'TP Target' });
            if (slPrice > 0) sl = seriesRef.current.createPriceLine({ price: slPrice, color: '#f23645', lineWidth: 2, lineStyle: LineStyle.Solid, title: 'SL Limit' });
            priceLinesRef.current.set(id, { entry, tp, sl });
        }
    };

    // ─── Edit TP / SL ─────────────────────────────────────────────────────────
    const startEditing = (pos: Position) => {
        setEditingPosId(pos.id);
        setEditTp(pos.tp > 0 ? pos.tp : pos.entryPrice);
        setEditSl(pos.sl > 0 ? pos.sl : pos.entryPrice);
    };

    useEffect(() => {
        if (!editingPosId || !seriesRef.current) return;
        const lines = priceLinesRef.current.get(editingPosId);
        if (!lines) return;

        if (editTp > 0) {
            if (lines.tp) lines.tp.applyOptions({ price: editTp });
            else lines.tp = seriesRef.current.createPriceLine({ price: editTp, color: '#089981', lineWidth: 2, lineStyle: LineStyle.Solid, title: 'TP Target' });
        } else if (lines.tp) {
            seriesRef.current.removePriceLine(lines.tp);
            lines.tp = undefined;
        }

        if (editSl > 0) {
            if (lines.sl) lines.sl.applyOptions({ price: editSl });
            else lines.sl = seriesRef.current.createPriceLine({ price: editSl, color: '#f23645', lineWidth: 2, lineStyle: LineStyle.Solid, title: 'SL Limit' });
        } else if (lines.sl) {
            seriesRef.current.removePriceLine(lines.sl);
            lines.sl = undefined;
        }
    }, [editTp, editSl, editingPosId, seriesRef, priceLinesRef]);

    const cancelEdit = () => {
        if (!editingPosId) return;
        const pos = openPositions.find(p => p.id === editingPosId);
        if (pos && seriesRef.current) {
            const lines = priceLinesRef.current.get(editingPosId);
            if (lines) {
                if (pos.tp > 0) lines.tp?.applyOptions({ price: pos.tp });
                else if (lines.tp) { seriesRef.current.removePriceLine(lines.tp); lines.tp = undefined; }
                if (pos.sl > 0) lines.sl?.applyOptions({ price: pos.sl });
                else if (lines.sl) { seriesRef.current.removePriceLine(lines.sl); lines.sl = undefined; }
            }
        }
        setEditingPosId(null);
    };

    const saveEdit = (id: string) => {
        setOpenPositions(prev => prev.map(pos =>
            pos.id === id ? { ...pos, tp: editTp, sl: editSl } : pos
        ));
        setEditingPosId(null);
    };

    // ─── Computed ─────────────────────────────────────────────────────────────
    const activePositions = openPositions.map(pos => {
        const pnl = pos.type === 'BUY'
            ? (currentPrice - pos.entryPrice) * pos.lotSize * 100
            : (pos.entryPrice - currentPrice) * pos.lotSize * 100;
        return { ...pos, currentPrice, pnl };
    });

    const totalFloatingPnL = activePositions.reduce((sum, p) => sum + p.pnl, 0);

    return {
        openPositions, tradeHistory, tradeMarkers, balance,
        activePositions, totalFloatingPnL,
        editingPosId, editTp, editSl, setEditTp, setEditSl,
        handleTrade, handleClosePosition,
        startEditing, cancelEdit, saveEdit,
    };
}