import React, { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';

interface TradeHistoryItem {
    trade_id: number;
    session_name: string;
    asset_name: string;
    action: string; // 'BUY' หรือ 'SELL'
    entry_price: string | number;
    exit_price: string | number;
    pnl: string | number;
    created_at: string;
}

const HistoryPage = () => {
    const { user } = useAuthStore();
    const [trades, setTrades] = useState<TradeHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchTradeHistory = async () => {
            if (!user?.user_id) return;
            try {
                // 🌟 เรียกใช้ API ดึงประวัติเทรดทั้งหมดของ User คนนี้
                // (ถ้ายังไม่มี API เส้นนี้ เดี๋ยวเราไปเขียนหลังบ้านเพิ่มกันได้ครับ)
                const res = await fetch(`https://fx-replay-backend.onrender.com/api/trades?user_id=${user.user_id}`, {
                    cache: 'no-store'
                });
                const data = await res.json();
                
                // สมมติว่าหลังบ้านส่งมาเป็น Array ตรงๆ หรืออยู่ใน data.trades
                setTrades(data.trades || data || []);
            } catch (error) {
                console.error("ดึงประวัติการเทรดไม่สำเร็จ:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTradeHistory();
    }, [user?.user_id]);

    return (
        <div className="p-8 min-h-screen bg-[#0A0E17] font-sans text-slate-200">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Header */}
                <div className="border-b border-slate-800 pb-4">
                    <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-[#F2C94C] rounded-full"></span>
                        Trade History Journal
                    </h1>
                    <p className="text-slate-400 text-sm">บันทึกและทบทวนรายละเอียดคำสั่งซื้อขายทั้งหมดของคุณ</p>
                </div>

                {/* Table Container */}
                <div className="bg-[#111827] rounded-xl border border-slate-800 overflow-hidden shadow-xl">
                    {isLoading ? (
                        <div className="p-12 text-center text-slate-500">กำลังโหลดประวัติการเทรด...</div>
                    ) : trades.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#1F2937]/50 border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                                        <th className="p-4">ID</th>
                                        <th className="p-4">Date/Time</th>
                                        <th className="p-4">Session Name</th>
                                        <th className="p-4">Asset</th>
                                        <th className="p-4">Type</th>
                                        <th className="p-4 text-right">Entry Price</th>
                                        <th className="p-4 text-right">Exit Price</th>
                                        <th className="p-4 text-right">Net PnL</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60 text-sm">
                                    {trades.map((trade, index) => {
                                        const pnlNum = parseFloat(String(trade.pnl)) || 0;
                                        const isWin = pnlNum >= 0;
                                        const isBuy = String(trade.action).toUpperCase() === 'BUY';

                                        return (
                                            <tr key={trade.trade_id} className="hover:bg-slate-800/30 transition-colors">
                                                <td className="p-4 text-slate-500 font-mono">#{trade.trade_id || index + 1}</td>
                                                <td className="p-4 text-slate-400 text-xs">
                                                    {trade.created_at ? new Date(trade.created_at).toLocaleString() : 'N/A'}
                                                </td>
                                                <td className="p-4 font-medium text-white max-w-[180px] truncate">
                                                    {trade.session_name || 'General Session'}
                                                </td>
                                                <td className="p-4">
                                                    <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded border border-slate-700 font-mono">
                                                        {trade.asset_name || 'XAUUSD'}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                                        isBuy ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'
                                                    }`}>
                                                        {isBuy ? 'LONG 🟢' : 'SHORT 🔴'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right font-mono text-slate-300">${Number(trade.entry_price).toFixed(2)}</td>
                                                <td className="p-4 text-right font-mono text-slate-300">${Number(trade.exit_price).toFixed(2)}</td>
                                                <td className={`p-4 text-right font-mono font-semibold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {isWin ? '+' : ''}${pnlNum.toFixed(2)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-16 text-center">
                            <p className="text-slate-500 text-lg mb-2">ยังไม่มีประวัติการบันทึกการเทรด</p>
                            <p className="text-slate-600 text-sm">เมื่อคุณเข้าเปิดเซสชันและปิดออเดอร์ รายการจะมาปรากฏที่นี่อัตโนมัติ</p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default HistoryPage;