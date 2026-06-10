import React, { useState, useCallback } from 'react';

// ============================================
// 📊 INDICATOR TYPES & INTERFACES
// ============================================
export type IndicatorType = 'SMA' | 'EMA' | 'RSI' | 'MACD' | 'BBANDS';

export interface IndicatorConfig {
    id: string;
    type: IndicatorType;
    enabled: boolean;
    
    // ตั้งค่าทั่วไป
    period?: number;
    color?: string;
    width?: number;
    
    // MACD specific
    fastPeriod?: number;
    slowPeriod?: number;
    signalPeriod?: number;
    
    // Bollinger Bands specific
    bbPeriod?: number;
    stdDev?: number;
}

interface IndicatorPanelProps {
    indicators: IndicatorConfig[];
    onIndicatorsChange: (indicators: IndicatorConfig[]) => void;
}

// ============================================
// 🎯 ค่าตั้งต้นของแต่ละ indicator
// ============================================
const DEFAULT_CONFIGS: Record<IndicatorType, Partial<IndicatorConfig>> = {
    SMA: { period: 20, color: '#3b82f6', width: 2 },
    EMA: { period: 12, color: '#10b981', width: 2 },
    RSI: { period: 14, color: '#f59e0b', width: 2 },
    MACD: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, color: '#8b5cf6', width: 2 },
    BBANDS: { bbPeriod: 20, stdDev: 2, color: '#ec4899', width: 2 }
};

const INDICATOR_DESCRIPTIONS: Record<IndicatorType, string> = {
    SMA: 'Simple Moving Average - ค่าเฉลี่ยราคา',
    EMA: 'Exponential Moving Average - ถ่วงน้ำหนักให้แท่งล่าสุด',
    RSI: 'Relative Strength Index - วัดโมเมนตัม 0-100',
    MACD: 'Momentum oscillator - ความเร็ว + ทิศทาง',
    BBANDS: 'Bollinger Bands - ช่วงแกว่งของราคา'
};

const INDICATOR_CHART_TYPE: Record<IndicatorType, 'main' | 'sub'> = {
    SMA: 'main',
    EMA: 'main',
    RSI: 'sub',
    MACD: 'sub',
    BBANDS: 'main'
};

// ============================================
// 🎨 COLOR PALETTE (สีที่มี)
// ============================================
const COLOR_PALETTE = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
];

// ============================================
// 📋 COMPONENT
// ============================================
export const IndicatorPanel: React.FC<IndicatorPanelProps> = ({ indicators, onIndicatorsChange }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showAddMenu, setShowAddMenu] = useState(false);

    // เพิ่ม indicator ใหม่
    const handleAddIndicator = useCallback((type: IndicatorType) => {
        const newId = `${type}-${Date.now()}`;
        const defaultConfig = DEFAULT_CONFIGS[type];
        
        const newIndicator: IndicatorConfig = {
            id: newId,
            type,
            enabled: true,
            ...defaultConfig
        };
        
        onIndicatorsChange([...indicators, newIndicator]);
        setShowAddMenu(false);
    }, [indicators, onIndicatorsChange]);

    // ลบ indicator
    const handleRemoveIndicator = useCallback((id: string) => {
        onIndicatorsChange(indicators.filter(ind => ind.id !== id));
    }, [indicators, onIndicatorsChange]);

    // สลับการเปิด/ปิด indicator
    const handleToggle = useCallback((id: string) => {
        onIndicatorsChange(
            indicators.map(ind =>
                ind.id === id ? { ...ind, enabled: !ind.enabled } : ind
            )
        );
    }, [indicators, onIndicatorsChange]);

    // อัปเดตค่าของ indicator
    const handleUpdateIndicator = useCallback((id: string, updates: Partial<IndicatorConfig>) => {
        onIndicatorsChange(
            indicators.map(ind =>
                ind.id === id ? { ...ind, ...updates } : ind
            )
        );
    }, [indicators, onIndicatorsChange]);

    const activeCount = indicators.filter(i => i.enabled).length;
    const mainIndicators = indicators.filter(i => INDICATOR_CHART_TYPE[i.type] === 'main');
    const subIndicators = indicators.filter(i => INDICATOR_CHART_TYPE[i.type] === 'sub');

    return (
        <div className="bg-[#0b0e14] border border-slate-700 rounded-lg shadow-lg font-sans text-slate-200">
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-3 border-b border-slate-700 cursor-pointer hover:bg-slate-800/50 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <span className="text-lg">📊</span>
                    <div>
                        <h3 className="text-sm font-bold text-white">Technical Indicators</h3>
                        <p className="text-xs text-slate-400">{activeCount} active</p>
                    </div>
                </div>
                <button
                    className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(!isExpanded);
                    }}
                >
                    ▼
                </button>
            </div>

            {/* Content */}
            {isExpanded && (
                <div className="p-4 max-h-[500px] overflow-y-auto space-y-4">
                    {/* Main Chart Indicators */}
                    {mainIndicators.length > 0 && (
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Main Chart</p>
                            <div className="space-y-2">
                                {mainIndicators.map(indicator => (
                                    <IndicatorRow
                                        key={indicator.id}
                                        indicator={indicator}
                                        isEditing={editingId === indicator.id}
                                        onToggle={() => handleToggle(indicator.id)}
                                        onRemove={() => handleRemoveIndicator(indicator.id)}
                                        onEdit={() => setEditingId(indicator.id)}
                                        onSave={() => setEditingId(null)}
                                        onUpdate={(updates) => handleUpdateIndicator(indicator.id, updates)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Sub Chart Indicators */}
                    {subIndicators.length > 0 && (
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Sub Chart</p>
                            <div className="space-y-2">
                                {subIndicators.map(indicator => (
                                    <IndicatorRow
                                        key={indicator.id}
                                        indicator={indicator}
                                        isEditing={editingId === indicator.id}
                                        onToggle={() => handleToggle(indicator.id)}
                                        onRemove={() => handleRemoveIndicator(indicator.id)}
                                        onEdit={() => setEditingId(indicator.id)}
                                        onSave={() => setEditingId(null)}
                                        onUpdate={(updates) => handleUpdateIndicator(indicator.id, updates)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Add Button + Menu */}
                    <div className="relative pt-2 border-t border-slate-700">
                        <button
                            onClick={() => setShowAddMenu(!showAddMenu)}
                            className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded transition-colors flex items-center justify-center gap-2"
                        >
                            <span>+</span> ADD INDICATOR
                        </button>

                        {showAddMenu && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-[#151e2e] border border-slate-700 rounded shadow-xl z-50">
                                <div className="p-2 space-y-1">
                                    {(Object.keys(DEFAULT_CONFIGS) as IndicatorType[]).map(type => (
                                        <button
                                            key={type}
                                            onClick={() => handleAddIndicator(type)}
                                            className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded transition-colors text-sm"
                                        >
                                            <div className="font-bold text-white">{type}</div>
                                            <div className="text-xs text-slate-400">{INDICATOR_DESCRIPTIONS[type]}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* No Indicators Message */}
                    {indicators.length === 0 && (
                        <div className="text-center py-6 text-slate-500">
                            <p className="text-sm">No indicators added yet</p>
                            <p className="text-xs mt-1">Click "+ ADD INDICATOR" to get started</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================
// 📌 INDICATOR ROW COMPONENT
// ============================================
interface IndicatorRowProps {
    indicator: IndicatorConfig;
    isEditing: boolean;
    onToggle: () => void;
    onRemove: () => void;
    onEdit: () => void;
    onSave: () => void;
    onUpdate: (updates: Partial<IndicatorConfig>) => void;
}

const IndicatorRow: React.FC<IndicatorRowProps> = ({
    indicator,
    isEditing,
    onToggle,
    onRemove,
    onEdit,
    onSave,
    onUpdate
}) => {
    if (isEditing) {
        return (
            <IndicatorEditor
                indicator={indicator}
                onUpdate={onUpdate}
                onSave={onSave}
                onCancel={onSave}
            />
        );
    }

    return (
        <div className="flex items-center gap-2 p-3 bg-slate-800/50 rounded border border-slate-700 hover:border-slate-600 transition-colors group">
            {/* Checkbox */}
            <input
                type="checkbox"
                checked={indicator.enabled}
                onChange={onToggle}
                className="w-4 h-4 cursor-pointer"
            />

            {/* Color & Type */}
            <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: indicator.color || '#3b82f6' }}
                title="Indicator color"
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">{indicator.type}</p>
                <p className="text-xs text-slate-400">
                    {indicator.type === 'MACD'
                        ? `${indicator.fastPeriod}-${indicator.slowPeriod}-${indicator.signalPeriod}`
                        : indicator.type === 'BBANDS'
                        ? `Period ${indicator.bbPeriod}, StdDev ${indicator.stdDev}`
                        : `Period ${indicator.period}`}
                </p>
            </div>

            {/* Actions */}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={onEdit}
                    className="p-1.5 text-blue-400 hover:bg-blue-600/20 rounded transition-colors"
                    title="Edit"
                >
                    <i className="ti ti-edit text-sm" />
                </button>
                <button
                    onClick={onRemove}
                    className="p-1.5 text-red-400 hover:bg-red-600/20 rounded transition-colors"
                    title="Remove"
                >
                    <i className="ti ti-trash text-sm" />
                </button>
            </div>
        </div>
    );
};

// ============================================
// ✏️ INDICATOR EDITOR COMPONENT
// ============================================
interface IndicatorEditorProps {
    indicator: IndicatorConfig;
    onUpdate: (updates: Partial<IndicatorConfig>) => void;
    onSave: () => void;
    onCancel: () => void;
}

const IndicatorEditor: React.FC<IndicatorEditorProps> = ({
    indicator,
    onUpdate,
    onSave,
    onCancel
}) => {
    return (
        <div className="p-3 bg-slate-800 border border-blue-500 rounded space-y-3">
            {/* Type Name */}
            <p className="text-sm font-bold text-white">{indicator.type}</p>

            {/* Period Input (for SMA, EMA, RSI) */}
            {(indicator.type === 'SMA' || indicator.type === 'EMA' || indicator.type === 'RSI') && (
                <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">Period</label>
                    <input
                        type="number"
                        value={indicator.period || 20}
                        onChange={(e) => onUpdate({ period: parseInt(e.target.value) || 20 })}
                        min="2"
                        max="200"
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
                    />
                </div>
            )}

            {/* MACD Settings */}
            {indicator.type === 'MACD' && (
                <>
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="text-xs font-bold text-slate-400 block mb-1">Fast</label>
                            <input
                                type="number"
                                value={indicator.fastPeriod || 12}
                                onChange={(e) => onUpdate({ fastPeriod: parseInt(e.target.value) || 12 })}
                                min="1"
                                max="50"
                                className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 block mb-1">Slow</label>
                            <input
                                type="number"
                                value={indicator.slowPeriod || 26}
                                onChange={(e) => onUpdate({ slowPeriod: parseInt(e.target.value) || 26 })}
                                min="1"
                                max="100"
                                className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 block mb-1">Signal</label>
                            <input
                                type="number"
                                value={indicator.signalPeriod || 9}
                                onChange={(e) => onUpdate({ signalPeriod: parseInt(e.target.value) || 9 })}
                                min="1"
                                max="50"
                                className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                    </div>
                </>
            )}

            {/* Bollinger Bands Settings */}
            {indicator.type === 'BBANDS' && (
                <>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs font-bold text-slate-400 block mb-1">Period</label>
                            <input
                                type="number"
                                value={indicator.bbPeriod || 20}
                                onChange={(e) => onUpdate({ bbPeriod: parseInt(e.target.value) || 20 })}
                                min="2"
                                max="100"
                                className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 block mb-1">Std Dev</label>
                            <input
                                type="number"
                                value={indicator.stdDev || 2}
                                onChange={(e) => onUpdate({ stdDev: parseFloat(e.target.value) || 2 })}
                                min="0.5"
                                max="5"
                                step="0.5"
                                className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                    </div>
                </>
            )}

            {/* Color Picker */}
            <div>
                <label className="text-xs font-bold text-slate-400 block mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                    {COLOR_PALETTE.map(color => (
                        <button
                            key={color}
                            onClick={() => onUpdate({ color })}
                            className={`w-6 h-6 rounded border-2 transition-all ${
                                indicator.color === color ? 'border-white' : 'border-transparent hover:border-slate-500'
                            }`}
                            style={{ backgroundColor: color }}
                            title={color}
                        />
                    ))}
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
                <button
                    onClick={onSave}
                    className="flex-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded transition-colors"
                >
                    ✓ Save
                </button>
                <button
                    onClick={onCancel}
                    className="flex-1 py-1.5 px-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold rounded transition-colors"
                >
                    ✕ Cancel
                </button>
            </div>
        </div>
    );
};

export default IndicatorPanel;