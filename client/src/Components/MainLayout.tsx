import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore'; // ปรับ path ให้ตรงกับของคุณด้วยนะครับ

const MainLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { logout } = useAuthStore(); // สมมติว่าคุณมีฟังก์ชัน logout ใน store

    // รายการเมนูใน Sidebar
    const menuItems = [
        { name: 'Dashboard', path: '/dashboard', icon: '📊' },
        { name: 'Sessions', path: '/sessions', icon: '📈' },
        { name: 'Trade History', path: '/history', icon: '📓' },
        { name: 'Account Settings', path: '/settings', icon: '⚙️' },
    ];

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        // 🌟 ใช้ Grid 12 Columns ตามสเปก: พื้นหลัง Dark Theme
        <div className="grid grid-cols-1 md:grid-cols-12 min-h-screen bg-[#0A0E17] font-sans text-slate-200">
            
            {/* 🌟 Sidebar (ซ้าย): กินพื้นที่ 2 คอลัมน์ */}
            <aside className="hidden md:flex md:col-span-2 border-r border-slate-800 bg-[#0D131F] flex-col justify-between">
                
                {/* ส่วนหัว Logo */}
                <div>
                    <div className="p-6 border-b border-slate-800 flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-[#F2C94C] rounded-lg flex items-center justify-center font-bold text-white shadow-lg">
                            TR
                        </div>
                        <h1 className="text-xl font-bold tracking-wider text-white">
                            TRADE<span className="text-[#F2C94C]">SIM</span>
                        </h1>
                    </div>

                    {/* Navigation Menu */}
                    <nav className="p-4 space-y-2 mt-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-3">
                            Main Menu
                        </p>
                        {menuItems.map((item) => {
                            // เช็คว่าหน้าปัจจุบันตรงกับเมนูนี้ไหม (เพื่อทำสี Active)
                            const isActive = location.pathname.includes(item.path);
                            return (
                                <Link
                                    key={item.name}
                                    to={item.path}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                                        isActive 
                                            ? 'bg-blue-600/10 text-blue-400 border border-blue-500/30 shadow-[0_0_10px_rgba(37,99,235,0.1)]' 
                                            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                                    }`}
                                >
                                    <span className={isActive ? 'opacity-100' : 'opacity-60 grayscale'}>
                                        {item.icon}
                                    </span>
                                    {item.name}
                                    {isActive && (
                                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#F2C94C] shadow-[0_0_5px_#F2C94C]"></div>
                                    )}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {/* ปุ่ม Logout ด้านล่างสุด */}
                <div className="p-4 border-t border-slate-800">
                    <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors font-medium"
                    >
                        <span>🚪</span> Logout
                    </button>
                </div>
            </aside>

            {/* 🌟 Main Content (ขวา): กินพื้นที่ 10 คอลัมน์ */}
            {/* ใส่ overflow-y-auto เพื่อให้ฝั่งเนื้อหาสกอร์ลลงได้อิสระ โดย Sidebar ยังคงที่ */}
            <main className="col-span-1 md:col-span-10 max-h-screen overflow-y-auto bg-[#0A0E17]">
                {/* <Outlet /> คือท่อส่งผ่านเนื้อหา หน้า Dashboard, Session จะมาโผล่ตรงนี้ครับ! */}
                <Outlet />
            </main>

        </div>
    );
};

export default MainLayout;