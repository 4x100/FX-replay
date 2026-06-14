import { useState, useEffect, useMemo, useRef } from "react";

import type { RefObject } from "react";
import { createChart, ColorType, LineStyle } from "lightweight-charts";
import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  LogicalRange
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

    const obs = new ResizeObserver(() =>
      chart.applyOptions({
        width: container.clientWidth,
        height: container.clientHeight,
      }),
    );
    obs.observe(container);
    return () => {
      obs.disconnect();
      chart.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicatorResults, indicators, currentIndex]);

  // ── MACD Sub-chart ────────────────────────────────────────────────────────
  // ── MACD Sub-chart ────────────────────────────────────────────────────────
  useEffect(() => {
    const container = macdContainerRef.current;
    const macdInd = indicators.find((i) => i.type === "MACD" && i.enabled);
    if (!container) return;

    container.innerHTML = "";
    if (!macdInd || allData.length === 0) return;

    const macdData = indicatorResults.macd.get(macdInd.id) || [];
    if (macdData.length === 0) return;

    const currentTime = allData[Math.min(currentIndex, allData.length - 1)]
      .time as number;
    const filtered = macdData.filter((d) => d.time <= currentTime);
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

    const macdBars = chart.addHistogramSeries({
      color: "#2962FF",
      priceLineVisible: false,
      lastValueVisible: true,
      title: "MACD",
    });

    macdBars.setData(
      filtered.map((d) => ({
        time: d.time as Time,
        value: d.macd,
      })),
    );

    // ── 🌟 [เพิ่มจุดนี้] เชื่อมกราฟหลักกับกราฟ MACD ให้เลื่อนไปพร้อมกัน ──
    const mainTimeScale = chartRef.current?.timeScale();
    const subTimeScale = chart.timeScale();

    let isSyncing = false;
    const handleMainChange = (range: LogicalRange | null) => {
      if (isSyncing) return;
      isSyncing = true;
      if (range) subTimeScale.setVisibleLogicalRange(range);
      isSyncing = false;
    };
    const handleSubChange = (range: LogicalRange | null) => {
      if (isSyncing) return;
      isSyncing = true;
      if (range) mainTimeScale?.setVisibleLogicalRange(range);
      isSyncing = false;
    };

    mainTimeScale?.subscribeVisibleLogicalRangeChange(handleMainChange);
    subTimeScale.subscribeVisibleLogicalRangeChange(handleSubChange);
    // ──────────────────────────────────────────────────────────────

    const obs = new ResizeObserver(() =>
      chart.applyOptions({
        width: container.clientWidth,
        height: container.clientHeight,
      }),
    );
    obs.observe(container);

    return () => {
      obs.disconnect();
      // ล้างการเชื่อมต่อฝั่งกราฟหลักเพื่อป้องกัน Memory Leak
      mainTimeScale?.unsubscribeVisibleLogicalRangeChange(handleMainChange);
      chart.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicatorResults, indicators, currentIndex]);

  return {
    indicators,
    setIndicators,
    showIndicatorMenu,
    setShowIndicatorMenu,
    rsiContainerRef,
    macdContainerRef,
  };
}
