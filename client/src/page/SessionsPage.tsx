import React, { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';
import { useNavigate } from 'react-router-dom';

// สร้างพิมพ์เขียว (Interface)
interface SessionData {
    session_id: number;
    user_id: number;
    session_name: string;
    asset_name: string;
    starting_balance: string | number;
    start_date: string;
    created_at?: string;
}

const SessionsPage = () => {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [sessions, setSessions] = useState<SessionData[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // State สำหรับฟอร์ม
    const [sessionName, setSessionName] = useState('');
    const [assetName, setAssetName] = useState('EURUSD');
    const [startingBalance, setStartingBalance] = useState(10000);
    const [startDate, setStartDate] = useState('2015-01-01'); // 🌟 เริ่มต้นที่ 2015 ตามที่คุณปรับข้อมูล

    // 1. ดึงข้อมูล (อยู่ใน useEffect)
    useEffect(() => {
        const loadData = async () => {
            if (!user?.user_id) return;
            try {
                const res = await fetch(`http://localhost:3000/api/sessions?user_id=${user.user_id}`);
                const data = await res.json();
                setSessions(data);
            } catch (error) {
                console.error("ดึงข้อมูลไม่สำเร็จ:", error);
            }
        }; loadData();
    }, [user?.user_id, refreshTrigger]);

    // 2. ฟังก์ชันกดสร้าง Session
    const handleCreateSession = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // 🌟 เพิ่มคำสั่ง Console.log เพื่อเช็คข้อมูล user_id
        console.log("ข้อมูล User ปัจจุบันใน Zustand:", user);

        if (!user || !user.user_id) {
            alert("เซสชันหมดอายุ กรุณาล็อกอินใหม่อีกครั้ง!");
            navigate('/login');
            return;
        }

        try {
            const res = await fetch('http://localhost:3000/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user?.user_id,
                    session_name: sessionName,
                    asset_name: assetName,
                    starting_balance: startingBalance,
                    start_date: startDate // 🌟 ส่งวันที่ไปบันทึก
                })
            });

            if (res.ok) {
                setRefreshTrigger(prev => prev + 1); 
                setIsModalOpen(false); 
                setSessionName(''); 
            }
        } catch (error) {
            console.error("สร้างไม่สำเร็จ:", error);
        }
    };
    <div className="mb-4">
        <label className="block text-slate-400 mb-2">Start Date</label>
        <input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
            required
        />
    </div>

    // 3. ฟังก์ชันกดลบ Session
    const handleDeleteSession = async (sessionId: number) => {
        if (!window.confirm("แน่ใจหรือไม่ที่จะลบเซสชันนี้?")) return;
        try {
            const res = await fetch(`http://localhost:3000/api/sessions/${sessionId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setRefreshTrigger(prev => prev + 1);
            }
        } catch (error) {
            console.error("ลบไม่สำเร็จ:", error);
        }
    };

    // 🌟 ส่วนแสดงผล HTML + TAILWIND (Dark Theme)
    return (
        <div className="p-8 min-h-screen bg-[#0b1120]"> {/* 🌟 พื้นหลังดำเท่ๆ */}
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-white">Replay Sessions</h1>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-semibold transition-colors shadow-lg"
                >
                    + ADD SESSION
                </button>
            </div>

            {/* แสดงการ์ดเซสชัน (จัดทรง Grid สวยๆ) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sessions.map((session) => (
                    // 🌟 การ์ดสีดำเข้มพร้อมขอบเทาจางๆ
                    <div key={session.session_id} className="bg-[#151e2e] p-7 rounded-2xl border border-slate-700/50 hover:border-slate-500 transition-colors shadow-lg group">
                        <div className="flex justify-between items-start mb-5">
                            <h3 className="text-xl font-bold text-white">{session.session_name}</h3>
                            <button
                                onClick={() => handleDeleteSession(session.session_id)}
                                className="text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" // 🌟 แสดงปุ่มลบเมื่อเอาเมาส์มาชี้
                                title="ลบเซสชัน"
                            >
                                🗑️
                            </button>
                        </div>
                        <div className="text-slate-400 mb-2">Asset: <span className="text-white font-medium">{session.asset_name}</span></div>
                        <div className="text-slate-400 mb-8">Balance: <span className="text-white font-medium">${Number(session.starting_balance).toLocaleString()}</span></div>
                        <button onClick={() => navigate(`/trading/${session.session_id}/${session.start_date}`)} className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-semibold transition-colors">
                            ENTER SESSION
                        </button>
                    </div>
                ))}
            </div>

            {/* Modal ฟอร์ม (ธีม Dark Mode เป๊ะๆ) */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center p-4 z-50 transition-opacity">
                    <div className="bg-[#151e2e] rounded-2xl p-8 w-full max-w-md border border-slate-700 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-white">Create New Session</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
                        </div>
                        <form onSubmit={handleCreateSession} className="space-y-4">
                            <div>
                                <label className="block text-slate-400 mb-2">Session Name</label>
                                <input
                                    type="text"
                                    value={sessionName}
                                    onChange={(e) => setSessionName(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-slate-400 mb-2">Asset</label>
                                <select
                                    value={assetName}
                                    onChange={(e) => setAssetName(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                                >
                                    <option value="EURUSD">EUR/USD</option>
                                    <option value="GBPUSD">GBP/USD</option>
                                    <option value="XAUUSD">Gold (XAU/USD)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-slate-400 mb-2">Starting Balance ($)</label>
                                <input
                                    type="number"
                                    value={startingBalance}
                                    onChange={(e) => setStartingBalance(Number(e.target.value))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white"
                                    min="100"
                                    required
                                />
                            </div>
                            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold mt-6 transition-colors text-lg shadow-lg">
                                START REPLAY
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SessionsPage;