import { useState, useEffect, useMemo, useRef } from "react";

import type { RefObject } from "react";
import { createChart, ColorType, LineStyle } from "lightweight-charts";
import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  LogicalRange,
} from "lightweight-charts";
import type { IndicatorConfig } from "../../IndicatorPanel";
import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
} from "../../indicatorUtils";
import type { CandleData, IndicatorData, MACDData } from "../../indicatorUtils";

interface IndicatorResults {
  sma: Map<string, IndicatorData[]>;
  ema: Map<string, IndicatorData[]>;
  rsi: Map<string, IndicatorData[]>;
  macd: Map<string, MACDData[]>;
}

export function useIndicators(
  allData: CandlestickData[],
  currentIndex: number,
  chartRef: RefObject<IChartApi | null>,
) {
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(() => {
    const saved = localStorage.getItem("fx_replay_active_indicators");
    return saved ? JSON.parse(saved) : [];
  });
  const [showIndicatorMenu, setShowIndicatorMenu] = useState(false);

  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const macdContainerRef = useRef<HTMLDivElement>(null);

  // 🌟 1. เพิ่ม 3 บรรทัดนี้เข้าไป เพื่อเก็บความจำให้กราฟ MACD ไม่โดนทำลายทิ้ง
  const macdChartRef = useRef<IChartApi | null>(null);
  const macdSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const macdLastLengthRef = useRef(0);
  const macdSyncCleanupRef = useRef<(() => void) | null>(null);

  // ── 🌟 แก้ไขจุดที่ 1: ใช้ useMemo คำนวณ Indicator แทน useEffect + useState ──
  const indicatorResults = useMemo<IndicatorResults>(() => {
    const results: IndicatorResults = {
      sma: new Map(),
      ema: new Map(),
      rsi: new Map(),
      macd: new Map(),
    };

    if (allData.length === 0 || indicators.length === 0) return results;

    const candles: CandleData[] = allData.map((c) => ({
      time: c.time as number,
      open: c.open as number,
      high: c.high as number,
      low: c.low as number,
      close: c.close as number,
    }));

    indicators.forEach((ind) => {
      if (!ind.enabled) return;
      try {
        if (ind.type === "SMA")
          results.sma.set(ind.id, calculateSMA(candles, ind.period || 20));
        else if (ind.type === "EMA")
          results.ema.set(ind.id, calculateEMA(candles, ind.period || 12));
        else if (ind.type === "RSI")
          results.rsi.set(ind.id, calculateRSI(candles, ind.period || 14));
        else if (ind.type === "MACD")
          results.macd.set(
            ind.id,
            calculateMACD(
              candles,
              ind.fastPeriod || 12,
              ind.slowPeriod || 26,
              ind.signalPeriod || 9,
            ),
          );
      } catch (e) {
        console.error(`Error calculating ${ind.type}:`, e);
      }
    });

    return results;
  }, [allData, indicators]);

  useEffect(() => {
    localStorage.setItem(
      "fx_replay_active_indicators",
      JSON.stringify(indicators),
    );
  }, [indicators]);

  // ── วาด SMA/EMA เป็น Line บนกราฟหลัก ────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current || allData.length === 0) return;

    // ── 🌟 แก้ไขจุดที่ 2: จัดการ Empty Block ──
    indicatorSeriesRef.current.forEach((s) => {
      try {
        chartRef.current?.removeSeries(s);
      } catch {
        // eslint-disable-next-line no-empty
      }
    });
    indicatorSeriesRef.current.clear();

    const currentTime = allData[Math.min(currentIndex, allData.length - 1)]
      .time as number;

    indicators
      .filter((i) => ["SMA", "EMA"].includes(i.type) && i.enabled)
      .forEach((ind) => {
        if (!chartRef.current) return;

        const lineSeries = chartRef.current.addLineSeries({
          color: ind.color || "#3b82f6",
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: false,
          title: `${ind.type}(${ind.period})`,
        });

        const raw =
          ind.type === "SMA"
            ? indicatorResults.sma.get(ind.id) || []
            : indicatorResults.ema.get(ind.id) || [];
        const data = raw
          .filter((d) => d.time <= currentTime)
          .map((d) => ({ time: d.time as Time, value: d.value }));
        if (data.length > 0) lineSeries.setData(data);
        indicatorSeriesRef.current.set(ind.id, lineSeries);
      });
  }, [indicatorResults, allData, indicators, currentIndex, chartRef]);

  // ── RSI Sub-chart ─────────────────────────────────────────────────────────
  useEffect(() => {
    const container = rsiContainerRef.current;
    const rsiInd = indicators.find((i) => i.type === "RSI" && i.enabled);
    if (!container) return;

    container.innerHTML = "";
    if (!rsiInd || allData.length === 0) return;

    const rsiData = indicatorResults.rsi.get(rsiInd.id) || [];
    if (rsiData.length === 0) return;

    const currentTime = allData[Math.min(currentIndex, allData.length - 1)]
      .time as number;
    const filtered = rsiData.filter((d) => d.time <= currentTime);
    if (filtered.length === 0) return;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "#0b0e14" },
        textColor: "#64748b",
      },
      grid: {
        vertLines: { color: "#1e222d" },
        horzLines: { color: "#1e222d" },
      },
      width: container.clientWidth,
      height: container.clientHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "#2a2e39",
      },
      rightPriceScale: {
        borderColor: "#2a2e39",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
    });

    const series = chart.addLineSeries({
      color: rsiInd.color || "#f59e0b",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: `RSI(${rsiInd.period})`,
    });
    series.createPriceLine({
      price: 70,
      color: "#ef4444",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "70",
    });
    series.createPriceLine({
      price: 30,
      color: "#10b981",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "30",
    });
    series.setData(
      filtered.map((d) => ({ time: d.time as Time, value: d.value })),
    );
    const obs = new ResizeObserver(() => {
      try {
        // 🌟 ใส่ try-catch ครอบไว้! ถ้ากราฟตายแล้วจะได้ไม่พ่น Error
        if (container && macdChartRef.current) {
          macdChartRef.current.applyOptions({
            width: container.clientWidth,
            height: container.clientHeight,
          });
        }
      } catch  {
        // ปล่อยผ่านเงียบๆ
      }
    });
    obs.observe(container);
    return () => {
      obs.disconnect();
      chart.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicatorResults, indicators, currentIndex]);

  // ── MACD Sub-chart ────────────────────────────────────────────────────────
  // ── MACD Sub-chart (จัดการสร้างกราฟและอัปเดตข้อมูล) ──────────────────────────
  // ─── 🌟 EFFECT 1: สร้างกราฟ MACD และยัดข้อมูลให้ตำแหน่งตรงกันเป๊ะ 1:1 ───
  useEffect(() => {
    const container = macdContainerRef.current;
    const macdInd = indicators.find((i) => i.type === "MACD" && i.enabled);

    if (!container || !macdInd || allData.length === 0) {
      if (macdChartRef.current) {
        macdChartRef.current.remove();
        macdChartRef.current = null;
        macdSeriesRef.current = null;
      }
      return;
    }

    const macdDataRaw = indicatorResults.macd.get(macdInd.id) || [];
    if (macdDataRaw.length === 0) return;

    // 🌟 1. ดึงกราฟราคาหลักมาเป็น "แกนตั้งต้น" (ความยาวต้องเท่ากันเป๊ะ)
    const currentMainData = allData.slice(0, currentIndex + 1);

    // 🌟 2. เอาข้อมูล MACD มาใส่ Map เพื่อให้ค้นหาตามเวลาได้เร็วขึ้น
    const macdDict = new Map();
    macdDataRaw.forEach((d) => macdDict.set(d.time, d));

    // 🌟 3. ประกอบร่างข้อมูล 1:1 ป้องกันกราฟเหลื่อม!
    const histData = currentMainData.map((candle) => {
      const mItem = macdDict.get(candle.time);
      // เช็คว่า MACD คำนวณเสร็จหรือยัง (ไม่ใช่ช่วงตั้งไข่ 26 แท่งแรก)
      const isValid = mItem && mItem.macd !== undefined && !isNaN(mItem.macd);

      return {
        time: candle.time as Time,
        value: isValid ? mItem.macd : 0, // ถ้าไม่มีค่าให้ยัด 0 ดันไว้แท่งจะได้ไม่เบี้ยว
        color: isValid ? "#2962FF" : "transparent", // ซ่อนแท่งที่ไม่มีค่าให้ล่องหน
      };
    });

    if (histData.length === 0) return;

    // 4. สร้างตัวกราฟ (ทำครั้งแรกครั้งเดียว)
    if (!macdChartRef.current) {
      container.innerHTML = "";
      const subChart = createChart(container, {
        layout: {
          background: { type: ColorType.Solid, color: "#0b0e14" },
          textColor: "#64748b",
        },
        grid: {
          vertLines: { color: "#1e222d" },
          horzLines: { color: "#1e222d" },
        },
        width: container.clientWidth,
        height: container.clientHeight,
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: "#2a2e39",
          rightOffset: 15,
          fixRightEdge: false,
        },
        rightPriceScale: {
          borderColor: "#2a2e39",
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
      });
      macdChartRef.current = subChart;

      macdSeriesRef.current = subChart.addHistogramSeries({
        priceLineVisible: false,
        lastValueVisible: true,
        title: "MACD",
      });

      const obs = new ResizeObserver(() => {
        if (container && macdChartRef.current) {
          macdChartRef.current.applyOptions({
            width: container.clientWidth,
            height: container.clientHeight,
          });
        }
      });
      obs.observe(container);
    }

    // 5. ป้อนข้อมูลใส่กราฟ
    if (macdSeriesRef.current) {
      macdSeriesRef.current.setData(histData);
    }
  }, [indicatorResults, indicators, currentIndex, allData]);

  // ─── 🌟 EFFECT 2: ระบบซิงค์ 100% สองทิศทาง (Bidirectional Sync) ───
  useEffect(() => {
    const mainChart = chartRef?.current;
    const subChart = macdChartRef?.current;

    // ถ้ามีกราฟใดกราฟหนึ่งยังไม่เกิด ให้ข้ามไปก่อน (กันบั๊กสายไฟหลุด)
    if (!mainChart || !subChart) return;

    const mainTimeScale = mainChart.timeScale();
    const subTimeScale = subChart.timeScale();

    let isSyncing = false;

    // ลากกราฟบน ล่างตาม
    const syncToMain = (range: LogicalRange | null) => {
      if (!isSyncing && range) {
        isSyncing = true;
        subTimeScale.setVisibleLogicalRange(range);
        isSyncing = false;
      }
    };

    // ลากกราฟล่าง บนตาม
    const syncToSub = (range: LogicalRange | null) => {
      if (!isSyncing && range) {
        isSyncing = true;
        mainTimeScale.setVisibleLogicalRange(range);
        isSyncing = false;
      }
    };

    // เสียบสายไฟดักจับการเลื่อนกราฟ
    mainTimeScale.subscribeVisibleLogicalRangeChange(syncToMain);
    subTimeScale.subscribeVisibleLogicalRangeChange(syncToSub);

    // จัดหน้าให้ตรงกันเป๊ะตั้งแต่วินาทีแรกที่เปิด
    const currentMainRange = mainTimeScale.getVisibleLogicalRange();
    if (currentMainRange) {
      subTimeScale.setVisibleLogicalRange(currentMainRange);
    }

    // ถอดสายไฟเมื่อปิดกราฟ
    return () => {
      mainTimeScale.unsubscribeVisibleLogicalRangeChange(syncToMain);
      subTimeScale.unsubscribeVisibleLogicalRangeChange(syncToSub);
    };
  }, [chartRef, indicators]); // ใช้แค่ chartRef ไม่มี .current เพื่อป้องกัน ESLint โวยวาย

  // ── macd ──

  // ─── 🌟 THE PERFECT MACD (แท่งเดี่ยว + ซิงค์ 100% + ป้องกันกราฟแบน) ───
  useEffect(() => {
    const container = macdContainerRef.current;
    const mainChart = chartRef.current;
    const macdInd = indicators.find((i) => i.type === "MACD" && i.enabled);

    // 1. Cleanup ล้างกระดานหากปิดการใช้งาน MACD
    if (!container || !macdInd || allData.length === 0) {
      if (macdChartRef.current) {
        if (macdSyncCleanupRef.current) macdSyncCleanupRef.current();
        macdChartRef.current.remove();
        macdChartRef.current = null;
        macdSeriesRef.current = null;
        macdLastLengthRef.current = 0;
      }
      return;
    }

    const macdDataRaw = indicatorResults.macd.get(macdInd.id) || [];
    if (macdDataRaw.length === 0) return;

    const currentTime = allData[Math.min(currentIndex, allData.length - 1)]
      .time as number;

    // 🌟 2. DATA PREPARATION: จัดการข้อมูลขั้นเทพ
    // แทนที่จะ slice ทิ้ง (ซึ่งทำให้เวลา 2 กราฟเหลื่อมกัน) เราใช้วิธีเปลี่ยนค่าเป็น 0 และซ่อนสีแทน!
    const histData = macdDataRaw
      .filter((d) => d.time <= currentTime)
      .map((d, index) => {
        // MACD ปกติต้องใช้เวลาตั้งไข่ 26 แท่ง (Slow Period) ช่วงนี้ค่าจะรวน ให้เราจับกดเป็น 0 ให้หมด
        const isWarmup = index < 26 || d.macd === undefined || isNaN(d.macd);
        return {
          time: d.time as Time,
          value: isWarmup ? 0 : d.macd, // ถ้าอยู่ช่วงตั้งไข่ให้ค่าเป็น 0 กราฟจะได้ไม่แบน
          color: isWarmup ? "transparent" : "#2962FF", // ซ่อนสีในช่วง 26 แท่งแรกไปเลย
        };
      });

    if (histData.length === 0) return;

    // 3. CHART CREATION: สร้างกราฟและผูกสายไฟ Sync ครั้งแรก
    if (!macdChartRef.current) {
      container.innerHTML = "";
      const subChart = createChart(container, {
        layout: {
          background: { type: ColorType.Solid, color: "#0b0e14" },
          textColor: "#64748b",
        },
        grid: {
          vertLines: { color: "#1e222d" },
          horzLines: { color: "#1e222d" },
        },
        width: container.clientWidth,
        height: container.clientHeight,
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: "#2a2e39",
          rightOffset: 15,
          fixRightEdge: false,
        },
        rightPriceScale: {
          borderColor: "#2a2e39",
          scaleMargins: { top: 0.05, bottom: 0.02 }, // บีบ Margin ให้แคบ กราฟจะได้แนบสนิท
          minimumWidth: 75,
        },
      });
      macdChartRef.current = subChart;

      // วาดแท่ง Histogram เพียวๆ ตามความต้องการ
      macdSeriesRef.current = subChart.addHistogramSeries({
        priceLineVisible: false,
        lastValueVisible: true,
        title: "MACD",
      });

      const obs = new ResizeObserver(() => {
        if (container && macdChartRef.current) {
          macdChartRef.current.applyOptions({
            width: container.clientWidth,
            height: container.clientHeight,
          });
        }
      });
      obs.observe(container);

      // 🌟 4. PERFECT SYNC: ระบบล็อคกราฟสองทิศทาง 100%
      let syncCleanup = () => {};
      if (mainChart) {
        const mainTimeScale = mainChart.timeScale();
        const subTimeScale = subChart.timeScale();
        let isSyncing = false;

        const handleMainChange = (range: LogicalRange | null) => {
          if (isSyncing || !range) return;
          isSyncing = true;
          subTimeScale.setVisibleLogicalRange(range);
          isSyncing = false;
        };

        const handleSubChange = (range: LogicalRange | null) => {
          if (isSyncing || !range) return;
          isSyncing = true;
          mainTimeScale.setVisibleLogicalRange(range);
          isSyncing = false;
        };

        mainTimeScale.subscribeVisibleLogicalRangeChange(handleMainChange);
        subTimeScale.subscribeVisibleLogicalRangeChange(handleSubChange);

        const currentMainRange = mainTimeScale.getVisibleLogicalRange();
        if (currentMainRange) {
          subTimeScale.setVisibleLogicalRange(currentMainRange);
        }

        syncCleanup = () => {
          mainTimeScale.unsubscribeVisibleLogicalRangeChange(handleMainChange);
          subTimeScale.unsubscribeVisibleLogicalRangeChange(handleSubChange);
        };
      }

      macdSyncCleanupRef.current = () => {
        obs.disconnect();
        syncCleanup();
      };
    }

    // 5. UPDATE DATA: ป้อนข้อมูลแท่งเทียน
    if (macdSeriesRef.current) {
      if (
        macdLastLengthRef.current > 0 &&
        histData.length === macdLastLengthRef.current + 1
      ) {
        macdSeriesRef.current.update(histData[histData.length - 1]);
      } else {
        macdSeriesRef.current.setData(histData);
      }
      macdLastLengthRef.current = histData.length;
    }

    // 🌟 ห้ามเอา .current ใส่ในวงเล็บนี้เด็ดขาด ป้องกัน ESLint Error
  }, [indicatorResults, indicators, currentIndex, allData, chartRef]);

  // 🌟 Cleanup ตอนสลับหน้าเว็บ
  useEffect(() => {
    return () => {
      // ดึงฟังก์ชันล้างขยะจาก Ref มาทำงาน (React จะเลิกบ่นเรื่อง Ref.current เปลี่ยนแปลง)
      if (macdSyncCleanupRef.current) {
        macdSyncCleanupRef.current();
      }
    };
  }, []);

  return {
    indicators,
    setIndicators,
    showIndicatorMenu,
    setShowIndicatorMenu,
    rsiContainerRef,
    macdContainerRef,
  };
}
