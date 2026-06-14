import type { IPriceLine } from 'lightweight-charts';

export interface Position {
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

export interface DBTrade {
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

export type PriceLinesMap = Map<string, {
    entry: IPriceLine;
    tp?: IPriceLine;
    sl?: IPriceLine;
}>;