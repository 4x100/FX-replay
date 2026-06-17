import { useState, useEffect } from "react";
import type { CandlestickData } from "lightweight-charts";

export function useChartData(
  sessionId: number,
  paramStartDate: string,
  setCurrentIndex: (i: number) => void,
  setCurrentPrice: (p: number) => void,
) {
  // บันทึก Timeframe ลง localStorage ให้จำข้าม session
  const [timeframe, setTimeframe] = useState<string>(
    () => localStorage.getItem("savedTimeframe") || "15M",
  );
  const [startDate, setStartDate] = useState(paramStartDate);
  const [allData, setAllData] = useState<CandlestickData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    localStorage.setItem("savedTimeframe", timeframe);
  }, [timeframe]);

  // โหลดข้อมูลกราฟ + ซิงค์ตำแหน่งจาก localStorage
  // โหลดข้อมูลกราฟ + ซิงค์ตำแหน่งจาก localStorage
  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        // ยิงไปขอข้อมูลที่เผื่อ 5 เดือนมาจาก Go
        const res = await fetch(
          `https://fx-replay-backend.onrender.com/api/charts?tf=${timeframe}&start=${startDate}`,
        );
        const data: CandlestickData[] = await res.json();

        if (data?.length > 0) {
          let startingIndex = 100;
          const savedTime = localStorage.getItem(`replay_time_${sessionId}`);

          if (savedTime) {
            // 🟢 กรณีที่ 1: เคยเล่นมาแล้ว (หรือสลับ TF) ให้กู้คืนเวลาเดิม
            const parsedTime = Number(savedTime);
            for (let i = data.length - 1; i >= 0; i--) {
              if ((data[i].time as number) <= parsedTime) {
                startingIndex = i;
                break;
              }
            }
          } else {
            // 🌟 กรณีที่ 2: เปิดกราฟครั้งแรก! ต้องซูมไปที่วัน Start Date จริงๆ
            // แปลงวันที่ "2023-01-01" เป็นตัวเลข Unix เพื่อเอาไปหาใน Array
            const targetUnix = new Date(paramStartDate).getTime() / 1000;
            const actualStartDataIndex = data.findIndex(
              (d) => (d.time as number) >= targetUnix,
            );

            if (actualStartDataIndex > -1) {
              startingIndex = actualStartDataIndex;
            } else {
              // ถ้าหาไม่เจอจริงๆ ให้เริ่มตรงกลางหน้ากระดาน
              startingIndex = Math.floor(data.length / 2);
            }
          }

          setAllData(data);
          setCurrentIndex(startingIndex);
          setCurrentPrice(data[startingIndex].close as number);
        }
      } catch (err) {
        console.error("Chart load error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [timeframe, startDate, sessionId, paramStartDate]); // อย่าลืมเติม paramStartDate ในวงเล็บนี้ด้วยครับ

  const handleTimeframeChange = (newTf: string, currentIndex: number) => {
    if (allData.length > 0 && currentIndex < allData.length) {
      localStorage.setItem(
        `replay_time_${sessionId}`,
        allData[currentIndex].time.toString(),
      );
    }
    setTimeframe(newTf);
  };

  return {
    allData,
    isLoading,
    timeframe,
    startDate,
    setStartDate,
    handleTimeframeChange,
  };
}
