import React from 'react';
import type { IndicatorConfig } from '../../IndicatorPanel';
import { IndicatorRow } from '../../IndicatorPanel';

interface TopBarProps {
    sessionId: number;
    timeframe: string;
    startDate: string;
    isPlaying: boolean;
    speed: number;
    indicators: IndicatorConfig[];
    showIndicatorMenu: boolean;
    onTimeframeChange: (tf: string) => void;
    onStartDateChange: (date: string) => void;
    onPlayToggle: () => void;
    onNextCandle: () => void;
    onSpeedChange: (ms: number) => void;
    onSetIndicators: React.Dispatch<React.SetStateAction<IndicatorConfig[]>>;
    onToggleIndicatorMenu: () => void;
}

export function TopBar({
    sessionId, timeframe, startDate, isPlaying, speed,
    indicators, showIndicatorMenu,
    onTimeframeChange, onStartDateChange, onPlayToggle, onNextCandle, onSpeedChange,
    onSetIndicators, onToggleIndicatorMenu,
}: TopBarProps) {

    const INDICATOR_DEFAULTS = {
        SMA: { period: 20, color: '#3b82f6' },
        EMA: { period: 12, color: '#10b981' },
        RSI: { period: 14, color: '#f59e0b' },
        MACD: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, color: '#8b5cf6' },
    } as const;

    const addIndicator = (type: IndicatorConfig['type']) => {
        const defaults = INDICATOR_DEFAULTS[type];
        onSetIndicators(prev => [...prev, {
            id: `${type}-${Date.now()}`,
            type,
            enabled: true,
            ...defaults,
        }]);
    };

    return (
        <div className="h-12 bg-[#0b0e14] border-b border-[#2a2e39] flex justify-between items-center px-4 shrink-0 text-sm z-10">

            {/* Left: Symbol + Session + Date + TF + Indicators */}
            <div className="flex items-center space-x-4">
                <span className="font-bold text-yellow-500">XAUUSD</span>
                <span className="bg-[#1e222d] px-2 py-1 rounded text-xs text-gray-400">
                    Session #{sessionId}
                </span>

                <div className="flex items-center bg-[#1e222d] border border-[#2a2e39] rounded ml-2 overflow-hidden px-2">
                    <span className="text-gray-400 text-xs mr-2 uppercase font-bold">Start:</span>
                    <input
                        type="date" value={startDate} min="2015-01-01" max="2025-12-31"
                        onChange={e => onStartDateChange(e.target.value)}
                        className="bg-transparent text-white text-xs py-1 focus:outline-none focus:text-blue-400 cursor-pointer"
                    />
                </div>

                {/* Timeframe buttons */}
                <div className="flex bg-[#1e222d] rounded ml-2 shadow-sm border border-[#2a2e39] overflow-hidden">
                    {['5M', '15M'].map((tf, i) => (
                        <button key={tf} onClick={() => onTimeframeChange(tf)}
                            className={`px-3 py-1 text-xs font-bold transition-colors ${i > 0 ? 'border-l border-[#2a2e39]' : ''} ${timeframe === tf ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-[#2a2e39]'}`}>
                            {tf}
                        </button>
                    ))}
                </div>

                {/* Indicator Dropdown */}
                <div className="relative ml-2">
                    <button onClick={onToggleIndicatorMenu}
                        className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold border transition-colors ${showIndicatorMenu ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#1e222d] border-[#2a2e39] text-gray-400 hover:text-white hover:border-blue-500'}`}>
                        📈 Indicators
                        {indicators.filter(i => i.enabled).length > 0 && (
                            <span className="bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                                {indicators.filter(i => i.enabled).length}
                            </span>
                        )}
                        <span className={`transition-transform ${showIndicatorMenu ? 'rotate-180' : ''}`}>▾</span>
                    </button>

                    {showIndicatorMenu && (
                        <div className="absolute top-full left-0 mt-2 w-72 bg-[#151e2e] border border-[#2a2e39] rounded-lg shadow-2xl z-50 overflow-hidden">
                            {/* Active Indicators */}
                            <div className="p-3 border-b border-[#2a2e39]">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Active Indicators</p>
                                {indicators.length === 0 && <p className="text-xs text-slate-500 italic">No indicators added</p>}
                                {indicators.map(ind => (
                                    <IndicatorRow
                                        key={ind.id}
                                        indicator={ind}
                                        isEditing={false}      // 👈 เติมบรรทัดนี้: บอกว่าไม่ได้กำลังแก้อยู่
                                        onEdit={() => { }}      // 👈 เติมบรรทัดนี้: ฟังก์ชันว่าง
                                        onSave={() => { }}      // 👈 เติมบรรทัดนี้: ฟังก์ชันว่างF
                                        onToggle={() => onSetIndicators(prev => prev.map(i => i.id === ind.id ? { ...i, enabled: !i.enabled } : i))}
                                        onRemove={() => onSetIndicators(prev => prev.filter(i => i.id !== ind.id))}
                                        onUpdate={updates => onSetIndicators(prev => prev.map(i => i.id === ind.id ? { ...i, ...updates } : i))}
                                    />
                                ))}
                            </div>

                            {/* Add Indicator */}
                            <div className="p-3">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Add Indicator</p>
                                <div className="grid grid-cols-2 gap-1">
                                    {(['SMA', 'EMA', 'RSI', 'MACD'] as const).map(type => (
                                        <button key={type} onClick={() => addIndicator(type)}
                                            className="flex items-center gap-2 px-3 py-2 bg-[#1e222d] hover:bg-[#2a2e39] rounded text-xs font-bold text-white transition-colors">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: INDICATOR_DEFAULTS[type].color }} />
                                            + {type}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Play + Next + Speed */}
            <div className="flex items-center space-x-2">
                <button onClick={onPlayToggle}
                    className={`px-3 py-1 rounded transition-colors shadow-sm ${isPlaying ? 'bg-[#f23645] text-white' : 'bg-[#089981] text-white'}`}>
                    {isPlaying ? '⏸ PAUSE' : '▶ PLAY'}
                </button>
                <button onClick={onNextCandle} disabled={isPlaying}
                    className="px-3 py-1 bg-[#1e222d] hover:bg-[#2a2e39] rounded text-white disabled:opacity-50 transition-colors shadow-sm">
                    ⏭ NEXT
                </button>
                <div className="flex bg-[#1e222d] rounded ml-2 shadow-sm border border-[#2a2e39] overflow-hidden">
                    {[{ label: '1x', ms: 1000 }, { label: '2x', ms: 500 }, { label: '5x', ms: 100 }].map(({ label, ms }, i) => (
                        <button key={label} onClick={() => onSpeedChange(ms)}
                            className={`px-3 py-1 text-xs transition-colors ${i === 1 ? 'border-l border-r border-[#2a2e39]' : ''} ${speed === ms ? 'bg-gray-600 text-white font-bold' : 'hover:bg-[#2a2e39]'}`}>
                            {label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}