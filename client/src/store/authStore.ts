import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 1. กำหนดพิมพ์เขียว (Interface) ให้เหมือน Data Dictionary ที่ SA ออกแบบไว้
interface User {
  user_id: number;
  email: string;
}

// 2. กำหนดโครงสร้างของ "ตะกร้าเก็บข้อมูล" (State)
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

// 3. สร้าง Store (🌟 เปลี่ยนแปลงตรงนี้: เอา persist มาครอบ)
const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        
        try {
          // จำลองการยิง API
          const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });

          const data = await response.json();

          if (response.ok) {
            set({ 
              user: { user_id: data.user_id, email: email }, 
              isAuthenticated: true, 
              isLoading: false 
            });
          } else {
            set({ error: data.message, isLoading: false });
          }
        } catch (err) {
          console.error(err);
          set({ error: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", isLoading: false });
        }
      },

      logout: () => {
        set({ user: null, isAuthenticated: false, error: null });
      }
    }),
    {
      name: 'auth-storage', // 🌟 ชื่อที่ใช้จำใน Local Storage ของเบราว์เซอร์
    }
  )
);

export default useAuthStore;