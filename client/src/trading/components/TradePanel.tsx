import React from 'react';
import type { Position } from '../types';

interface TradePanelProps {
    isOpen: boolean;
    activePositions: Position[];
    tradeHistory: Position[];
    editingPosId: string | null;
    editTp: number;
    editSl: number;
    onSetEditTp: (v: number) => void;
    onSetEditSl: (v: number) => void;
    onStartEditing: (pos: Position) => void;
    onSaveEdit: (id: string) => void;
    onCancelEdit: () => void;
    onClosePosition: (id: string) => void;
}

export function TradePanel({
    isOpen, activePositions, tradeHistory,
    editingPosId, editTp, editSl,
    onSetEditTp, onSetEditSl,
    onStartEditing, onSaveEdit, onCancelEdit, onClosePosition,
}: TradePanelProps) {
    return (
        <div className={`bg-[#0b0e14] border-t border-[#2a2e39] transition-all duration-300 ease-in-out ${isOpen ? 'h-64' : 'h-0'} overflow-hidden flex shrink-0 relative z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]`}>
            <div className="w-full flex h-full">

                {/* ── Open Positions ────────────────────────────── */}
                <div className="flex-1 border-r border-[#2a2e39] flex flex-col">
                    <div className="p-2 border-b border-[#2a2e39] text-xs text-gray-400 font-semibold sticky top-0 bg-[#0b0e14] uppercase tracking-wider">
                        <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2 animate-pulse" />
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
                                {activePositions.map(pos => (
                                    <tr key={pos.id} className="border-b border-[#1e222d] hover:bg-[#1e222d] transition-colors group">
                                        <td className={`py-2 pl-2 font-bold ${pos.type === 'BUY' ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                                            {pos.type} {pos.lotSize}
                                        </td>
                                        <td className="py-2 font-mono text-gray-300">{pos.entryPrice.toFixed(2)}</td>
                                        <td className="py-2 font-mono text-gray-500 text-xs">
                                            {editingPosId === pos.id ? (
                                                <div className="flex items-center gap-1">
                                                    <input type="number" step="0.05" value={editTp} onChange={e => onSetEditTp(Number(e.target.value))}
                                                        className="w-20 bg-[#0b0e14] border border-[#2a2e39] text-green-500 px-1 py-1 rounded focus:outline-none focus:border-blue-500 text-center font-bold" />
                                                    <span className="text-gray-600">/</span>
                                                    <input type="number" step="0.05" value={editSl} onChange={e => onSetEditSl(Number(e.target.value))}
                                                        className="w-20 bg-[#0b0e14] border border-[#2a2e39] text-red-500 px-1 py-1 rounded focus:outline-none focus:border-blue-500 text-center font-bold" />
                                                </div>
                                            ) : (
                                                <span>
                                                    <span className="text-green-500">{pos.tp > 0 ? pos.tp.toFixed(2) : '-'}</span>
                                                    {' / '}
                                                    <span className="text-red-500">{pos.sl > 0 ? pos.sl.toFixed(2) : '-'}</span>
                                                </span>
                                            )}
                                        </td>
                                        <td className={`py-2 font-mono font-bold ${pos.pnl >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                                            {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                                        </td>
                                        <td className="text-right py-2 pr-2">
                                            {editingPosId === pos.id ? (
                                                <div className="flex justify-end gap-1">
                                                    <button onClick={() => onSaveEdit(pos.id)} className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-white text-xs transition-colors">Save</button>
                                                    <button onClick={onCancelEdit} className="bg-gray-600 hover:bg-gray-500 px-3 py-1 rounded text-white text-xs transition-colors">Cancel</button>
                                                </div>
                                            ) : (
                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => onStartEditing(pos)} className="bg-transparent hover:bg-blue-600/20 border border-blue-600/50 text-blue-400 px-3 py-1 rounded text-xs transition-colors">Edit</button>
                                                    <button onClick={() => onClosePosition(pos.id)} className="bg-transparent hover:bg-red-500/20 border border-red-500/50 text-red-400 px-3 py-1 rounded text-xs transition-colors">Close</button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ── Trade History ─────────────────────────────── */}
                <div className="flex-1 flex flex-col">
                    <div className="p-2 border-b border-[#2a2e39] text-xs text-gray-400 font-semibold sticky top-0 bg-[#0b0e14] uppercase tracking-wider">
                        <span className="inline-block w-2 h-2 rounded-full bg-gray-500 mr-2" />
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
                                {tradeHistory.map(pos => (
                                    <tr key={pos.id} className="border-b border-[#1e222d] hover:bg-[#1e222d] transition-colors">
                                        <td className={`py-2 pl-2 ${pos.type === 'BUY' ? 'text-[#089981]' : 'text-[#f23645]'}`}>{pos.type} {pos.lotSize}</td>
                                        <td className="py-2 font-mono text-gray-400">{pos.entryPrice.toFixed(2)}</td>
                                        <td className="py-2 font-mono text-gray-300">{pos.currentPrice.toFixed(2)}</td>
                                        <td className="py-2 font-mono text-gray-600 text-xs">{pos.tp > 0 ? pos.tp.toFixed(2) : '-'} / {pos.sl > 0 ? pos.sl.toFixed(2) : '-'}</td>
                                        <td className={`text-right py-2 pr-2 font-mono font-bold ${pos.pnl >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                                            {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}