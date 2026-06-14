import React from 'react';

interface OrderBarProps {
    lotSize: number;
    tpOffset: number;
    slOffset: number;
    balance: number;
    floatingPnL: number;
    isPanelOpen: boolean;
    onLotSizeChange: (v: number) => void;
    onTpOffsetChange: (v: number) => void;
    onSlOffsetChange: (v: number) => void;
    onTogglePanel: () => void;
    onTrade: (type: 'BUY' | 'SELL') => void;
}

export function OrderBar({
    lotSize, tpOffset, slOffset, balance, floatingPnL, isPanelOpen,
    onLotSizeChange, onTpOffsetChange, onSlOffsetChange, onTogglePanel, onTrade,
}: OrderBarProps) {
    return (
        <div className="h-16 bg-[#000000] border-t border-[#2a2e39] flex items-center justify-between px-6 shrink-0 relative z-30">

            {/* Left: TP/SL + Buy/Sell + Lot */}
            <div className="flex items-center space-x-3">
                <div className="flex items-center bg-[#0b0e14] border border-[#2a2e39] rounded overflow-hidden mr-2">
                    <span className="px-2 text-green-500 text-xs font-semibold">TP Dist.</span>
                    <input type="number" step="0.05" min="0" value={tpOffset}
                        onChange={e => onTpOffsetChange(Number(e.target.value))}
                        className="bg-[#1e222d] text-white w-16 py-2 px-1 focus:outline-none text-center font-mono text-xs border-l border-[#2a2e39]" />
                </div>
                <div className="flex items-center bg-[#0b0e14] border border-[#2a2e39] rounded overflow-hidden mr-4">
                    <span className="px-2 text-red-500 text-xs font-semibold">SL Dist.</span>
                    <input type="number" step="0.05" min="0" value={slOffset}
                        onChange={e => onSlOffsetChange(Number(e.target.value))}
                        className="bg-[#1e222d] text-white w-16 py-2 px-1 focus:outline-none text-center font-mono text-xs border-l border-[#2a2e39]" />
                </div>

                <button onClick={() => onTrade('BUY')}
                    className="bg-[#089981] hover:bg-[#067a67] text-white font-bold px-6 py-2 rounded transition-transform active:scale-95 shadow-md flex items-center gap-2">
                    📈 Buy
                </button>
                <button onClick={() => onTrade('SELL')}
                    className="bg-[#f23645] hover:bg-[#c22b37] text-white font-bold px-6 py-2 rounded transition-transform active:scale-95 shadow-md flex items-center gap-2">
                    📉 Sell
                </button>

                <div className="flex items-center bg-[#0b0e14] border border-[#2a2e39] rounded overflow-hidden ml-2">
                    <span className="px-3 text-gray-400 text-sm font-semibold uppercase tracking-wider">Lot</span>
                    <input type="number" step="0.01" value={lotSize}
                        onChange={e => onLotSizeChange(Number(e.target.value))}
                        className="bg-[#1e222d] text-white w-20 py-2 px-2 focus:outline-none text-center font-mono border-l border-[#2a2e39]" />
                </div>
            </div>

            {/* Right: Balance + FloatingPnL + Panel Toggle */}
            <div className="flex items-center space-x-8 text-sm">
                <div className="flex flex-col items-end">
                    <span className="text-gray-500 text-xs uppercase tracking-wider">Balance</span>
                    <span className="font-bold text-white font-mono text-base">${balance.toFixed(2)}</span>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-gray-500 text-xs uppercase tracking-wider">Floating PnL</span>
                    <span className={`font-bold font-mono text-base ${floatingPnL >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                        {floatingPnL >= 0 ? '+' : ''}${floatingPnL.toFixed(2)}
                    </span>
                </div>

                <div className="border-l border-[#2a2e39] pl-6 ml-2">
                    <button
                        onClick={onTogglePanel}
                        className={`p-2 rounded bg-[#1e222d] hover:bg-[#2a2e39] border border-[#2a2e39] transition-all flex items-center justify-center w-10 h-10 ${isPanelOpen ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'text-gray-400'}`}
                        title="Toggle Trade Panel"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            className={`transition-transform duration-300 ${isPanelOpen ? 'rotate-180' : ''}`}>
                            <polyline points="18 15 12 9 6 15" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}