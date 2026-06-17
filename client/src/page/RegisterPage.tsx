import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

const RegisterPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // เช็คก่อนว่าพิมพ์รหัสผ่านสองช่องตรงกันไหม
    if (password !== confirmPassword) {
      alert("รหัสผ่านไม่ตรงกัน กรุณาพิมพ์ใหม่ครับ");
      return;
    }

    try {
      // ส่งข้อมูลไปหา API พนักงานต้อนรับ (Backend) ที่พอร์ต 3000
      const response = await fetch('https://fx-replay-backend.onrender.com/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password }),
      });

      const data = await response.json();

      if (response.ok) {
        alert("สมัครสมาชิกสำเร็จแล้ว!");
        navigate('/');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
      } else {
        alert("❌ เกิดข้อผิดพลาด: " + data.error);
      }
    } catch (err) {
        console.error(err);
      alert("❌ ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์หลังบ้านได้ (ลืมรัน Node หรือเปล่า?)");
    }
  };

  return (
    // พื้นหลังไล่สีโทนดาร์กแบบเดียวกับหน้า Login
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-slate-900 to-blue-950 px-4">
      
      {/* กล่องกระจก Glassmorphism */}
      <div className="max-w-md w-full p-8 bg-slate-800/80 backdrop-blur-md rounded-2xl shadow-[0_0_40px_rgba(37,99,235,0.15)] border border-slate-700">
        
        <h2 className="text-3xl font-extrabold mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
          CREATE ACCOUNT
        </h2>
        
        <form onSubmit={handleRegister} className="space-y-5">
          {/* ช่อง Email */}
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
          
          {/* ช่อง Password */}
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

          {/* ช่อง Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Confirm Password</label>
            <input 
              type="password" 
              placeholder="•••••••" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          {/* ปุ่มเรืองแสงสีน้ำเงิน */}
          <button 
            type="submit" 
            className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-lg shadow-[0_0_15px_rgba(37,99,235,0.5)] hover:shadow-[0_0_25px_rgba(37,99,235,0.7)] transition-all duration-300"
          >
            REGISTER
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link to="/" className="text-blue-400 hover:text-blue-300 hover:underline font-semibold transition-colors">
            Log in instead
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;