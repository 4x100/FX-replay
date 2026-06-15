
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// 1. นำเข้าหน้าต่างๆ ของคุณ
import LoginPage from './page/LoginPage'; 
import RegisterPage from './page/RegisterPage';
import DashboardPage from './page/DashboardPage';
import SessionsPage from './page/SessionsPage';
import TradingPage from './trading/TradingPage';
import HistoryPage from './page/HistoryPage';

// 🌟 นำเข้า MainLayout (เช็ค Path โฟลเดอร์ให้ตรงกับที่คุณสร้างไว้นะครับ)
import MainLayout from './Components/MainLayout';

const App = () => {
  return (
    <Router>
      <Routes>
        {/* ==========================================
            กลุ่มที่ 1: หน้าจอแบบ Full Screen (ไม่มี Sidebar) 
            ========================================== */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        {/* หน้าเทรดกราฟ (รวมทุกรูปแบบ Path ที่คุณมี) */}
        <Route path="/trading/:sessionId/:startDate" element={<TradingPage />} />
        <Route path="/trade/:sessionId/:startDate/:timeframe" element={<TradingPage />} />
        <Route path="/trade/:sessionId" element={<TradingPage />} />

        {/* ==========================================
            กลุ่มที่ 2: หน้าจอที่มี Sidebar (ครอบด้วย MainLayout) 
            ========================================== */}
        <Route element={<MainLayout />}>
          {/* ถ้าพิมพ์แค่ '/' ให้เด้งไปหน้า '/dashboard' อัตโนมัติ */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          {/* หน้าเนื้อหาหลัก */}
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          
          {/* หน้าที่เตรียมไว้ทำในอนาคต (ป้องกัน Error 404) */}
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<div className="p-8 text-white text-2xl font-bold">Account Settings (Coming Soon)</div>} />
        </Route>

      </Routes>
    </Router>
  );
};

export default App;