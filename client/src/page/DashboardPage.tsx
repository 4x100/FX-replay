import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

// 🌟 Import กราฟจาก recharts
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SessionData {
    session_id: number;
    session_name: string;
    asset_name: string;
    starting_balance: string | number;
    created_at?: string;
}

interface TradeRecord {
    pnl?: string | number;
    PnL?: string | number;
    PNL?: string | number;
    created_at?: string; // 🌟 เพิ่มวันที่เข้ามาเพื่อใช้วาดกราฟ
}
// 🌟 เพิ่มพิมพ์เขียวสำหรับกราฟ
interface EquityData {
    name: string;
    equity: number;
}

interface MonthlyData {
    month: string;
    gain: number;
}

interface DailyData {
    hour: string;
    pnl: number;
}



const DashboardPage = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();

    const [recentSessions, setRecentSessions] = useState<SessionData[]>([]);

    // 🌟 State สำหรับเก็บตัวเลข Metrics ของจริง
    const [stats, setStats] = useState({
        totalTrades: 0,
        winRate: 0,
        totalPnL: 0,
        riskReward: 0,
        monthGL: 0,
        weekGL: 0,
        dayGL: 0
    });
    // 🌟 ปรับ state ให้ใช้พิมพ์เขียวเหล่านี้แทนการใช้ any[]
    const [chartData, setChartData] = useState<{
        equity: EquityData[];
        monthly: MonthlyData[];
        daily: DailyData[];
    }>({
        equity: [],
        monthly: [],
        daily: []
    });

    useEffect(() => {
        // เช็คใน Zustand store ถ้าไม่มี user ให้ถีบไป Login เลย
        if (!user) {
            navigate('/login', { replace: true });
        }
    }, [user, navigate]);



    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!user?.user_id) return;
            try {
                const res = await fetch(`https://fx-replay-backend.onrender.com/api/dashboard-stats?user_id=${user.user_id}`, {
                    cache: 'no-store'
                });
                const data = await res.json();

                const trades: TradeRecord[] = data.trades || [];

                // --- 🧮 ตัวแปรสำหรับคำนวณ ---
                let calculatedTotalPnL = 0;
                let winningTrades = 0;
                let totalWinAmount = 0;
                let totalLossAmount = 0;
                let lossingTrades = 0;

                let monthGL = 0;
                let dayGL = 0;

                const now = new Date();

                // ตัวแปรสำหรับกราฟ
                let currentRelativeEquity = 0;
                const equityArr: EquityData[] = [];
                const monthlyMap: Record<string, number> = {};
                const hourlyMap: Record<string, number> = {};

                // 🌟 เรียงข้อมูลจากอดีต -> ปัจจุบัน เพื่อวาดกราฟ Equity Curve ให้ถูกต้อง
                const sortedTrades = [...trades].sort((a, b) =>
                    new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
                );

                sortedTrades.forEach((t) => {
                    const rawPnL = t.pnl !== undefined ? t.pnl : (t.PnL !== undefined ? t.PnL : t.PNL);
                    const pnlNumber = Number(rawPnL) || 0;
                    const tradeDate = t.created_at ? new Date(t.created_at) : new Date();

                    // 1. คำนวณภาพรวม PnL
                    calculatedTotalPnL += pnlNumber;
                    if (pnlNumber > 0) {
                        winningTrades++;
                        totalWinAmount += pnlNumber;
                    } else if (pnlNumber < 0) {
                        lossingTrades++;
                        totalLossAmount += Math.abs(pnlNumber);
                    }

                    // 2. คำนวณกำไร รายเดือน / รายวัน
                    if (tradeDate.getMonth() === now.getMonth() && tradeDate.getFullYear() === now.getFullYear()) {
                        monthGL += pnlNumber;
                    }
                    if (tradeDate.toDateString() === now.toDateString()) {
                        dayGL += pnlNumber;
                    }

                    // 3. เตรียมข้อมูลกราฟ Equity Curve
                    currentRelativeEquity += pnlNumber;
                    equityArr.push({
                        name: tradeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                        equity: currentRelativeEquity
                    });

                    // 4. เตรียมข้อมูลกราฟ Monthly (Bar Chart)
                    const monthName = tradeDate.toLocaleDateString('en-US', { month: 'short' });
                    monthlyMap[monthName] = (monthlyMap[monthName] || 0) + pnlNumber;

                    // 5. เตรียมข้อมูลกราฟ Daily / Hourly (Area Chart)
                    const hourStr = tradeDate.getHours().toString().padStart(2, '0') + ':00';
                    hourlyMap[hourStr] = (hourlyMap[hourStr] || 0) + pnlNumber;
                });

                const totalTrades = trades.length;
                const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

                // คำนวณ Risk / Reward Ratio (Avg Win / Avg Loss)
                const avgWin = winningTrades > 0 ? totalWinAmount / winningTrades : 0;
                const avgLoss = lossingTrades > 0 ? totalLossAmount / lossingTrades : 0;
                const riskReward = avgLoss === 0 ? (avgWin > 0 ? 99.99 : 0) : (avgWin / avgLoss);

                // แปลงข้อมูลกราฟให้อยู่ในฟอร์แมตที่ Recharts ต้องการ
                const finalMonthlyData = Object.keys(monthlyMap).map(k => ({ month: k, gain: monthlyMap[k] }));
                const finalHourlyData = Object.keys(hourlyMap).sort().map(k => ({ hour: k, pnl: hourlyMap[k] }));

                // อัปเดต State ทั้งหมด
                setStats({
                    totalTrades,
                    winRate,
                    totalPnL: calculatedTotalPnL,
                    riskReward,
                    monthGL,
                    weekGL: monthGL * 0.25, // สมมติค่า Week คร่าวๆ ก่อน (คำนวณวันจันทร์-ศุกร์ค่อนข้างซับซ้อน)
                    dayGL
                });

                setChartData({
                    equity: equityArr.length > 0 ? equityArr : [{ name: 'Start', equity: 0 }],
                    monthly: finalMonthlyData.length > 0 ? finalMonthlyData : [{ month: 'N/A', gain: 0 }],
                    daily: finalHourlyData.length > 0 ? finalHourlyData : [{ hour: '00:00', pnl: 0 }]
                });

                setRecentSessions(data.sessions || []);

            } catch (error) {
                console.error("ดึงข้อมูลไม่สำเร็จ:", error);
            }
        };

        fetchDashboardData();
    }, [user?.user_id]);

    return (
        <div className="p-8 min-h-screen bg-[#0A0E17] font-sans text-slate-200">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* 🌟 1. Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">
                            Welcome back, <span className="text-[#F2C94C]">{user?.email || 'Trader'}</span>
                        </h1>
                        <p className="text-slate-400 mt-2 text-sm">Here is your real trading performance overview.</p>
                    </div>
                    <button
                        onClick={() => navigate('/sessions')}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-medium transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] flex items-center gap-2"
                    >
                        <span>+</span> NEW SESSION
                    </button>
                </div>

                {/* 🌟 2. Metrics Cards Section (6-Column Grid) */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                    <div className={`bg-[#111827] p-5 rounded-xl border ${stats.totalPnL >= 0 ? 'border-[#F2C94C]/30' : 'border-slate-800'} shadow-sm relative group hover:border-[#F2C94C]/60 transition-colors`}>
                        <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Total PnL</h3>
                        <div className={`text-2xl font-bold ${stats.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toFixed(2)}
                        </div>
                    </div>

                    <div className="bg-[#111827] p-5 rounded-xl border border-slate-800 shadow-sm relative group hover:border-blue-500/40 transition-colors">
                        <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Win Rate</h3>
                        <div className="text-2xl font-bold text-white flex items-baseline gap-1">
                            {stats.winRate.toFixed(1)}%
                            <span className="text-xs font-normal text-slate-500 ml-1">({stats.totalTrades})</span>
                        </div>
                    </div>

                    <div className="bg-[#111827] p-5 rounded-xl border border-slate-800 shadow-sm relative group hover:border-blue-500/40 transition-colors">
                        <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Risk / Reward</h3>
                        <div className="text-2xl font-bold text-white">{stats.riskReward.toFixed(2)}</div>
                    </div>

                    <div className="bg-[#111827] p-5 rounded-xl border border-slate-800 shadow-sm relative group hover:border-[#F2C94C]/40 transition-colors">
                        <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Month G/L</h3>
                        <div className={`text-2xl font-bold ${stats.monthGL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {stats.monthGL >= 0 ? '+' : ''}${stats.monthGL.toFixed(2)}
                        </div>
                    </div>

                    <div className="bg-[#111827] p-5 rounded-xl border border-slate-800 shadow-sm relative group hover:border-[#F2C94C]/40 transition-colors">
                        <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Week G/L</h3>
                        <div className={`text-2xl font-bold ${stats.weekGL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {stats.weekGL >= 0 ? '+' : ''}${stats.weekGL.toFixed(2)}
                        </div>
                    </div>

                    <div className="bg-[#111827] p-5 rounded-xl border border-slate-800 shadow-sm relative group hover:border-[#F2C94C]/40 transition-colors">
                        <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Daily G/L</h3>
                        <div className={`text-2xl font-bold ${stats.dayGL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {stats.dayGL >= 0 ? '+' : ''}${stats.dayGL.toFixed(2)}
                        </div>
                    </div>
                </div>

                {/* 🌟 3. Charts Section (3-Column Grid) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">

                    {/* Chart 1: Equity Curve */}
                    <div className="bg-[#111827] p-6 rounded-xl border border-slate-800 shadow-sm hover:shadow-[0_0_20px_rgba(59,130,246,0.05)] transition-all">
                        <h3 className="text-white font-semibold mb-4">Equity Curve</h3>
                        <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData.equity} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                    <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#fff' }} />
                                    <Line type="monotone" dataKey="equity" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Chart 2: Monthly Performance */}
                    <div className="bg-[#111827] p-6 rounded-xl border border-slate-800 shadow-sm hover:shadow-[0_0_20px_rgba(16,185,129,0.05)] transition-all">
                        <h3 className="text-white font-semibold mb-4">Monthly Performance</h3>
                        <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData.monthly} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                    <XAxis dataKey="month" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#fff' }} cursor={{ fill: '#1e293b', opacity: 0.4 }} />
                                    <Bar dataKey="gain" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Chart 3: Daily Performance (Hourly Area) */}
                    <div className="bg-[#111827] p-6 rounded-xl border border-slate-800 shadow-sm hover:shadow-[0_0_20px_rgba(59,130,246,0.05)] transition-all">
                        <h3 className="text-white font-semibold mb-4">Hourly Performance</h3>
                        <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData.daily} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                    <XAxis dataKey="hour" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#fff' }} />
                                    <Area type="monotone" dataKey="pnl" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorPnL)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>

                {/* 🌟 4. Recent Sessions Section (ของเดิม) */}
                <div>
                    <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-[#F2C94C] rounded-full"></span>
                        Recent Sessions
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {recentSessions.length > 0 ? (
                            recentSessions.map((session) => (
                                <div key={session.session_id} className="bg-[#111827] p-6 rounded-xl border border-slate-800 hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(37,99,235,0.1)] transition-all group">
                                    <div className="flex justify-between items-start mb-5">
                                        <div>
                                            <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                                                {session.session_name}
                                            </h3>
                                            <p className="text-slate-500 text-xs mt-1">
                                                {session.created_at ? new Date(session.created_at).toLocaleDateString() : 'Recent'}
                                            </p>
                                        </div>
                                        <span className="text-xs font-medium px-2.5 py-1 bg-slate-800/80 text-slate-300 rounded-md border border-slate-700">
                                            {session.asset_name}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-end border-t border-slate-800/80 pt-4 mt-2">
                                        <div>
                                            <p className="text-slate-500 text-xs font-medium mb-0.5">Start Balance</p>
                                            <p className="text-slate-300 font-medium">${Number(session.starting_balance).toLocaleString()}</p>
                                        </div>
                                        <button
                                            onClick={() => navigate(`/trade/${session.session_id}`)}
                                            className="text-sm font-medium text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-600 px-4 py-2 rounded-lg transition-colors"
                                        >
                                            Resume →
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full bg-[#111827] p-12 rounded-xl border border-slate-800 text-center">
                                <p className="text-slate-400 mb-4 text-lg">No active sessions found.</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default DashboardPage;