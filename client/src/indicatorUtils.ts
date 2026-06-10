// ============================================
// 📊 INDICATOR CALCULATIONS UTILITY
// ============================================

export interface IndicatorData {
    time: number;
    value: number;
}

export interface CandleData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
}

// ============================================
// 1️⃣ SIMPLE MOVING AVERAGE (SMA)
// ============================================
export const calculateSMA = (candles: CandleData[], period: number): IndicatorData[] => {
    const result: IndicatorData[] = [];
    
    for (let i = period - 1; i < candles.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += candles[i - j].close;
        }
        result.push({
            time: candles[i].time,
            value: sum / period
        });
    }
    
    return result;
};

// ============================================
// 2️⃣ EXPONENTIAL MOVING AVERAGE (EMA)
// ============================================
export const calculateEMA = (candles: CandleData[], period: number): IndicatorData[] => {
    const result: IndicatorData[] = [];
    const multiplier = 2 / (period + 1);
    
    // คำนวณ SMA ตัวแรก
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += candles[i].close;
    }
    let ema = sum / period;
    result.push({
        time: candles[period - 1].time,
        value: ema
    });
    
    // คำนวณ EMA ถัดไป
    for (let i = period; i < candles.length; i++) {
        ema = (candles[i].close - ema) * multiplier + ema;
        result.push({
            time: candles[i].time,
            value: ema
        });
    }
    
    return result;
};

// ============================================
// 3️⃣ RELATIVE STRENGTH INDEX (RSI)
// ============================================
export const calculateRSI = (candles: CandleData[], period: number): IndicatorData[] => {
    const result: IndicatorData[] = [];
    
    if (candles.length < period + 1) return result;
    
    // คำนวณการเปลี่ยนแปลง
    const changes: number[] = [];
    for (let i = 1; i < candles.length; i++) {
        changes.push(candles[i].close - candles[i - 1].close);
    }
    
    // คำนวณ gains และ losses
    let avgGain = 0, avgLoss = 0;
    
    for (let i = 0; i < period; i++) {
        if (changes[i] > 0) avgGain += changes[i];
        else avgLoss += -changes[i];
    }
    
    avgGain /= period;
    avgLoss /= period;
    
    let rsi = 100 - (100 / (1 + (avgGain / avgLoss)));
    result.push({
        time: candles[period].time,
        value: rsi
    });
    
    // ใช้ EMA smoothing สำหรับ RSI ถัดไป
    for (let i = period + 1; i < candles.length; i++) {
        const change = changes[i - 1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;
        
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        
        rsi = avgLoss === 0 ? 100 : (100 - (100 / (1 + (avgGain / avgLoss))));
        
        result.push({
            time: candles[i].time,
            value: rsi
        });
    }
    
    return result;
};

// ============================================
// 4️⃣ MACD (Moving Average Convergence Divergence)
// ============================================
export interface MACDData {
    time: number;
    macd: number;
    signal: number;
    histogram: number;
}

export const calculateMACD = (
    candles: CandleData[], 
    fastPeriod: number = 12, 
    slowPeriod: number = 26, 
    signalPeriod: number = 9
): MACDData[] => {
    const result: MACDData[] = [];
    
    if (candles.length < slowPeriod) return result;
    
    // คำนวณ 12 EMA และ 26 EMA
    const ema12 = calculateEMA(candles, fastPeriod);
    const ema26 = calculateEMA(candles, slowPeriod);
    
    // หา starting index ของ ema26 (longest)
    const startIndex = candles.length - ema26.length;
    
    // คำนวณ MACD Line
    const macdLine: number[] = [];
    for (let i = 0; i < ema26.length; i++) {
        const idx12 = i - (ema12.length - ema26.length);
        const val12 = idx12 >= 0 ? ema12[idx12].value : 0;
        const val26 = ema26[i].value;
        macdLine.push(val12 - val26);
    }
    
    // คำนวณ Signal Line (EMA ของ MACD)
    const signalLine: number[] = [];
    if (macdLine.length >= signalPeriod) {
        // SMA สำหรับ 9 แท่งแรก
        let sum = 0;
        for (let i = 0; i < signalPeriod; i++) {
            sum += macdLine[i];
        }
        let signal = sum / signalPeriod;
        signalLine.push(signal);
        
        // EMA สำหรับส่วนที่เหลือ
        const multiplier = 2 / (signalPeriod + 1);
        for (let i = signalPeriod; i < macdLine.length; i++) {
            signal = (macdLine[i] - signal) * multiplier + signal;
            signalLine.push(signal);
        }
    }
    
    // สร้าง result
    for (let i = signalPeriod - 1; i < macdLine.length; i++) {
        const signalIdx = i - (signalPeriod - 1);
        if (signalIdx >= 0 && signalIdx < signalLine.length) {
            result.push({
                time: candles[startIndex + i].time,
                macd: macdLine[i],
                signal: signalLine[signalIdx],
                histogram: macdLine[i] - signalLine[signalIdx]
            });
        }
    }
    
    return result;
};

// ============================================
// 5️⃣ BOLLINGER BANDS
// ============================================
export interface BollingerBandsData {
    time: number;
    upper: number;
    middle: number;
    lower: number;
}

export const calculateBollingerBands = (
    candles: CandleData[], 
    period: number = 20, 
    stdDev: number = 2
): BollingerBandsData[] => {
    const result: BollingerBandsData[] = [];
    
    for (let i = period - 1; i < candles.length; i++) {
        // คำนวณ SMA (middle band)
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += candles[i - j].close;
        }
        const middle = sum / period;
        
        // คำนวณ Standard Deviation
        let variance = 0;
        for (let j = 0; j < period; j++) {
            const diff = candles[i - j].close - middle;
            variance += diff * diff;
        }
        const std = Math.sqrt(variance / period);
        
        result.push({
            time: candles[i].time,
            upper: middle + (std * stdDev),
            middle: middle,
            lower: middle - (std * stdDev)
        });
    }
    
    return result;
};

// ============================================
// 🎯 UTILITY: ตัดเฉพาะแท่งปัจจุบันของ indicator
// ============================================
export const getLatestIndicatorValue = (
    indicatorData: IndicatorData[] | MACDData[] | BollingerBandsData[],
    currentTime: number
): IndicatorData | MACDData | BollingerBandsData | null => {
    if (indicatorData.length === 0) return null;
    
    // หา indicator ที่เวลา <= currentTime
    let latest = null;
    for (let i = indicatorData.length - 1; i >= 0; i--) {
        if (indicatorData[i].time <= currentTime) {
            latest = indicatorData[i];
            break;
        }
    }
    
    return latest;
};

// ============================================
// 🎯 UTILITY: Filter indicator data ตามช่วง
// ============================================
export const filterIndicatorByRange = (
    data: IndicatorData[] | MACDData[] | BollingerBandsData[],
    startTime: number,
    endTime: number
) => {
    return data.filter(item => item.time >= startTime && item.time <= endTime);
};