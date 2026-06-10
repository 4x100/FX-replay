import React, { useState } from 'react';
import useAuthStore from '../store/authStore';
import { Link, useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const { login, isLoading, error } = useAuthStore();
  const navigate = useNavigate(); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await login(email, password);

    const currentState = useAuthStore.getState();
    if (currentState.isAuthenticated) {
      // 🌟 เปลี่ยนจาก navigate('/dashboard') เป็นแบบนี้ครับ:
      navigate('/dashboard', { replace: true }); 
    }
  };
  return (
    // 1. พื้นหลังหน้าจอ: ไล่สีดำไปหาน้ำเงินเข้ม คลุมเต็มจอ
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-slate-900 to-blue-950 px-4">
      
      {/* 2. กล่อง Login: ทำเป็นสไตล์กระจกขุ่น (Glassmorphism) ขอบมน */}
      <div className="max-w-md w-full p-8 bg-slate-800/80 backdrop-blur-md rounded-2xl shadow-[0_0_40px_rgba(37,99,235,0.15)] border border-slate-700">
        
        {/* 3. โลโก้/หัวข้อ: ไล่สีตัวอักษรให้ดูล้ำๆ */}
        <h2 className="text-3xl font-extrabold mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
          FX REPLAY
        </h2>
        
        <form onSubmit={handleLogin} className="space-y-6">
          {/* ช่องกรอก Email */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Email Address</label>
            <input 
              type="email" 
              placeholder="Enter your email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>
          
          {/* ช่องกรอก Password */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Password</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          {/* ข้อความ Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}

          {/* ปุ่ม Login: สีน้ำเงินสว่าง มีแสงเงา (Glow Effect) */}
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-lg shadow-[0_0_15px_rgba(37,99,235,0.5)] hover:shadow-[0_0_25px_rgba(37,99,235,0.7)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Authenticating...' : 'LOG IN'}
          </button>
        </form>

        {/* ลิงก์สมัครสมาชิก */}
        <div className="mt-6 text-center text-sm text-slate-400">
          New to FX Replay?{' '}
          <Link to="/register" className="text-blue-400 hover:text-blue-300 hover:underline font-semibold transition-colors">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;