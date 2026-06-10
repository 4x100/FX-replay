package main

import (
	"fmt"
	"log"
	"net/http"
	"strconv" // เพิ่มเครื่องมือแปลงตัวเลข
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// =========================================================================
// 📝 SECTION 1: MODELS / STRUCTS
// =========================================================================
type User struct {
	UserID       uint   `gorm:"primaryKey;column:user_id;autoIncrement" json:"user_id"`
	Email        string `gorm:"unique;column:email;not null" json:"email"`
	PasswordHash string `gorm:"column:password_hash;not null" json:"-"`
}

func (User) TableName() string { return "User" }

type BacktestSession struct {
	SessionID       uint      `gorm:"primaryKey;column:session_id;autoIncrement" json:"session_id"`
	UserID          uint      `gorm:"column:user_id;not null" json:"user_id"`
	SessionName     string    `gorm:"column:session_name;not null" json:"session_name"`
	AssetName       string    `gorm:"column:asset_name;not null" json:"asset_name"`
	StartingBalance float64   `gorm:"column:starting_balance;not null" json:"starting_balance"`
	CreatedAt       time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	StartDate       string    `gorm:"column:start_date" json:"start_date"` // 🌟 เพิ่มบรรทัดนี้
}

func (BacktestSession) TableName() string { return "backtest_session" }

type ChartData struct {
	Time  int64   `gorm:"column:time" json:"time"`
	Open  float64 `gorm:"column:open" json:"open"`
	High  float64 `gorm:"column:high" json:"high"`
	Low   float64 `gorm:"column:low" json:"low"`
	Close float64 `gorm:"column:close" json:"close"`
}

func (ChartData) TableName() string { return "chart_data" }

// ==========================================
// Struct สำหรับประวัติการเทรด (Trade History)
// ==========================================
type TradeHistory struct {
	TradeID    uint     `gorm:"primaryKey;column:trade_id;autoIncrement" json:"trade_id"`
	SessionID  uint     `gorm:"column:session_id" json:"session_id"`
	TradeType  string   `gorm:"column:trade_type" json:"type"`
	LotSize    float64  `gorm:"column:lot_size" json:"lot_size"`
	EntryPrice float64  `gorm:"column:entry_price" json:"entry_price"`
	ClosePrice *float64 `gorm:"column:close_price" json:"close_price"`
	PnL        *float64 `gorm:"column:pnl" json:"pnl"`
	OpenTime   string   `gorm:"column:open_time" json:"open_time"` // 🌟 แก้ตรงนี้เป็น string ให้ตรงกับ Database!
	TpPrice    *float64 `gorm:"column:tp_price" json:"tp_price"`
	SlPrice    *float64 `gorm:"column:sl_price" json:"sl_price"`
}
func (TradeHistory) TableName() string { return "trade_history" }

var DB *gorm.DB


// ==========================================
// Struct สำหรับหน้า History (ดึงข้อมูล JOIN ข้ามตาราง)
// ==========================================
// ==========================================
// Struct สำหรับหน้า History (ดึงข้อมูล JOIN ข้ามตาราง)
// ==========================================
type TradeHistoryResponse struct {
	TradeID     uint    `json:"trade_id" gorm:"column:trade_id"`
	SessionName string  `json:"session_name" gorm:"column:session_name"`
	AssetName   string  `json:"asset_name" gorm:"column:asset_name"`
	Action      string  `json:"action" gorm:"column:action"`
	EntryPrice  float64 `json:"entry_price" gorm:"column:entry_price"`
	ExitPrice   float64 `json:"exit_price" gorm:"column:exit_price"`
	PnL         float64 `json:"pnl" gorm:"column:pnl"` // 🌟 ตัวการคือบรรทัดนี้ บังคับให้อ่านคอลัมน์ pnl!
	CreatedAt   string  `json:"created_at" gorm:"column:created_at"`
}
func main() {
	// =========================================================================
	// 🔌 SECTION 2: DATABASE CONNECTION
	// =========================================================================
	dsn := "host=localhost user=postgres password=25248 dbname=fx_replay_db port=5432 sslmode=disable TimeZone=Asia/Bangkok"
	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("❌ เชื่อมต่อฐานข้อมูลไม่สำเร็จ:", err)
	}
	fmt.Println("✅ เชื่อมต่อฐานข้อมูล PostgreSQL ผ่าน GORM สำเร็จแล้ว!")

	r := gin.Default()

	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization"}
	r.Use(cors.New(config))

	// =========================================================================
	// 🛣️ SECTION 3: API ENDPOINTS
	// =========================================================================

	r.GET("/", func(c *gin.Context) {
		c.String(http.StatusOK, "ยินดีต้อนรับสู่ FX Replay Backend (Golang Edition)!")
	})

	r.POST("/api/register", func(c *gin.Context) {
		var input struct {
			Email    string `json:"email"`
			Password string `json:"password"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
			return
		}

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เข้ารหัสรหัสผ่านไม่สำเร็จ"})
			return
		}

		newUser := User{Email: input.Email, PasswordHash: string(hashedPassword)}
		if err := DB.Create(&newUser).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "อีเมลนี้มีคนใช้สมัครแล้วครับ"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"message": "สมัครสมาชิกสำเร็จ!", "user": newUser})
	})

	r.POST("/api/login", func(c *gin.Context) {
		var input struct {
			Email    string `json:"email"`
			Password string `json:"password"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "ข้อมูลไม่ถูกต้อง"})
			return
		}

		var user User
		if err := DB.Where("email = ?", input.Email).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "ไม่พบอีเมลนี้ในระบบ"})
			return
		}

		err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password))
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "รหัสผ่านไม่ถูกต้อง"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "เข้าสู่ระบบสำเร็จ", "user_id": user.UserID, "email": user.Email})
	})

	r.GET("/api/sessions", func(c *gin.Context) {
		userID := c.Query("user_id")
		if userID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "User_ID is required"})
			return
		}
		var sessions []BacktestSession
		DB.Where("user_id = ?", userID).Order("created_at DESC").Find(&sessions)
		c.JSON(http.StatusOK, sessions)
	})

	// 🌟 เพิ่ม Endpoint ใหม่: ดึง Session Details (สำหรับ TradingPage)
	r.GET("/api/sessions/:id", func(c *gin.Context) {
		sessionID := c.Param("id")
		var session BacktestSession
		
		if err := DB.Where("session_id = ?", sessionID).First(&session).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"})
			return
		}
		
		c.JSON(http.StatusOK, session)
	})

	r.POST("/api/sessions", func(c *gin.Context) {
		var session BacktestSession
		if err := c.ShouldBindJSON(&session); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
			return
		}
		if err := DB.Create(&session).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถสร้างเซสชันได้"})
			return
		}
		c.JSON(http.StatusCreated, session)
	})

	r.DELETE("/api/sessions/:id", func(c *gin.Context) {
		id := c.Param("id")
		if err := DB.Where("session_id = ?", id).Delete(&BacktestSession{}).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถลบเซสชันได้"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "ลบเซสชันเรียบร้อยแล้ว"})
	})

	// 🌟 [อัปเกรดความแข็งแกร่ง] API ดึงข้อมูลกราฟแท่งเทียน
	r.GET("/api/charts", func(c *gin.Context) {
		assetName := "XAUUSD"
		timeframe := c.Query("timeframe")
		if timeframe == "" {
			timeframe = c.Query("tf")
		}
		if timeframe == "" {
			timeframe = "15M"
		}
		startDate := c.DefaultQuery("start", "2023-01-01")

		// 🔍 DEBUG: แสดง query parameters ที่รับเข้ามา
		fmt.Printf("🔍 [DEBUG API] Query - Asset: %s, TF: '%s', Start: %s\n", assetName, timeframe, startDate)

		// 1. สร้าง Struct มารับข้อมูลดิบ โดยบังคับให้ Time รับมาเป็น String เสมอ เพื่อกัน Go Error
		type RawChartData struct {
			Time  string  `gorm:"column:time"`
			Open  float64 `gorm:"column:open"`
			High  float64 `gorm:"column:high"`
			Low   float64 `gorm:"column:low"`
			Close float64 `gorm:"column:close"`
		}
		var rawData []RawChartData

		// ✅ แก้ไข: เปลี่ยน UPPER(timeframe) เป็น timeframe โดยตรง 
		// เพราะ DB อาจเก็บเป็น '5M' หรือ '5m' ต้องตรวจสอบให้ถูกต้อง
		result := DB.Table("chart_data").
			Select("CAST(time AS TEXT) as time, open, high, low, close").
			Where("asset_name = ? AND timeframe = ? AND CAST(time AS DATE) >= ?::DATE", assetName, timeframe, startDate).
			Order("time ASC").
			Limit(10000).
			Find(&rawData)

		// 🔍 DEBUG: แสดงจำนวนแถวที่ได้
		fmt.Printf("📊 [DEBUG SQL] Retrieved %d rows for TF: %s\n", result.RowsAffected, timeframe)

		// 2. ถ้าเจอ Error ทางฝั่ง Database จะส่ง อาร์เรย์เปล่า [] ให้ React เพื่อไม่ให้หน้าเว็บพัง!
		if result.Error != nil {
			fmt.Println("❌ Error GORM Chart SQL:", result.Error)
			c.JSON(http.StatusOK, []ChartData{}) 
			return
		}

		// ถ้าไม่มีข้อมูล ให้ลองค้นหาแบบ case-insensitive
		if len(rawData) == 0 {
			fmt.Printf("⚠️ [WARNING] No data found for TF '%s', trying case-insensitive search...\n", timeframe)
			
			result = DB.Table("chart_data").
				Select("CAST(time AS TEXT) as time, open, high, low, close").
				Where("asset_name = ? AND UPPER(timeframe) = UPPER(?) AND CAST(time AS DATE) >= ?::DATE", assetName, timeframe, startDate).
				Order("time ASC").
				Limit(10000).
				Find(&rawData)

			fmt.Printf("📊 [DEBUG SQL - Retry] Retrieved %d rows\n", result.RowsAffected)
			
			if result.Error != nil {
				fmt.Println("❌ Error GORM Chart SQL (Retry):", result.Error)
				c.JSON(http.StatusOK, []ChartData{})
				return
			}
		}

		// 3. กำหนดค่า uniqueData ให้เป็น [] (ไม่เป็น null เด็ดขาด)
		uniqueData := make([]ChartData, 0)
		seenTimes := make(map[int64]bool)

		for _, d := range rawData {
			var t int64
			
			// จำลองตรรกะแปลงเวลาแบบที่เคยวางไว้ใน Node.js
			if num, err := strconv.ParseInt(d.Time, 10, 64); err == nil {
				t = num // กรณีข้อมูลเป็นตัวเลข Unix Timestamp มาตรงๆ
			} else {
				// กรณีข้อมูลเป็น String รูปแบบวันที่
				parsedDate, err := time.Parse(time.RFC3339, d.Time)
				if err != nil {
					parsedDate, err = time.Parse("2006-01-02 15:04:05", d.Time)
				}
				if err != nil {
					parsedDate, _ = time.Parse("2006-01-02", d.Time)
				}
				t = parsedDate.Unix()
			}

			// ปรับให้หน่วยเป็นวินาที
			if t > 9999999999 {
				t = t / 1000
			}

			// กรองข้อมูลซ้ำและต้องมั่นใจว่าเวลาแปลงสำเร็จ (t > 0)
			if t > 0 && !seenTimes[t] {
				seenTimes[t] = true
				uniqueData = append(uniqueData, ChartData{
					Time:  t,
					Open:  d.Open,
					High:  d.High,
					Low:   d.Low,
					Close: d.Close,
				})
			}
		}

		fmt.Printf("✅ [Backend] ส่งข้อมูล %s (เริ่ม %s) จำนวน %d แท่ง\n", timeframe, startDate, len(uniqueData))
		c.JSON(http.StatusOK, uniqueData)
	})

	// 🆕 เพิ่ม API ให้เช็ค available timeframes ในฐานข้อมูล
	r.GET("/api/available-timeframes", func(c *gin.Context) {
		var timeframes []string
		DB.Table("chart_data").
			Distinct("timeframe").
			Pluck("timeframe", &timeframes)
		
		fmt.Printf("📋 Available Timeframes in DB: %v\n", timeframes)
		c.JSON(http.StatusOK, gin.H{"timeframes": timeframes})
	})

r.GET("/api/trades", func(c *gin.Context) {
		sessionID := c.Query("session_id")
		userID := c.Query("user_id")

		// 🌟 กรณีที่ 1: ดึงเฉพาะของ 1 Session (ใช้ในหน้ากราฟ TradingPage)
		if sessionID != "" {
			var trades []TradeHistory
			DB.Where("session_id = ?", sessionID).Order("trade_id DESC").Find(&trades)
			c.JSON(http.StatusOK, trades)
			return
		}

		// 🌟 กรณีที่ 2: ดึงประวัติรวมทั้งหมดของ User (ใช้ในหน้า HistoryPage)
		if userID != "" {
			var history []TradeHistoryResponse
			
			// ใช้ GORM JOIN ตาราง trade_history เข้ากับ backtest_session
			// สังเกตว่าเราใช้คำสั่ง 'as' เพื่อแปลงชื่อคอลัมน์ให้ตรงกับที่ React ต้องการเป๊ะๆ
			err := DB.Table("trade_history").
				Select(`
					trade_history.trade_id, 
					backtest_session.session_name, 
					backtest_session.asset_name, 
					trade_history.trade_type as action, 
					trade_history.entry_price, 
					trade_history.close_price as exit_price, 
					trade_history.pnl, 
					trade_history.open_time as created_at
				`).
				Joins("JOIN backtest_session ON trade_history.session_id = backtest_session.session_id").
				Where("backtest_session.user_id = ?", userID).
				Order("trade_history.trade_id DESC").
				Scan(&history).Error

			if err != nil {
				fmt.Println("❌ [Backend] Error joining trade history:", err)
				c.JSON(http.StatusInternalServerError, gin.H{"message": "ดึงข้อมูลประวัติไม่สำเร็จ"})
				return
			}
			
			// ส่งข้อมูลกลับไปในรูปแบบ { "trades": [...] }
			c.JSON(http.StatusOK, gin.H{"trades": history})
			return
		}

		// ถ้าไม่ส่งพารามิเตอร์อะไรมาเลย
		c.JSON(http.StatusBadRequest, gin.H{"message": "กรุณาระบุ session_id หรือ user_id"})
	})

r.GET("/api/dashboard-stats", func(c *gin.Context) {
		userID := c.Query("user_id")
		if userID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "User ID is required"})
			return
		}

		// 🌟 จุดที่แก้ 1: เปลี่ยน PnL เป็น *float64 (ใส่ดอกจัน) เพื่อให้รองรับค่าว่าง (NULL) ได้ระบบจะได้ไม่พัง
		var trades []struct {
			PnL *float64 `json:"pnl" gorm:"column:pnl"`
		}

		// 🌟 จุดที่แก้ 2: เพิ่ม AND trade_history.pnl IS NOT NULL เพื่อบวกเลขเฉพาะไม้ที่ปิดออเดอร์แล้วเท่านั้น
		DB.Table("trade_history").
			Select("trade_history.pnl").
			Joins("JOIN backtest_session ON trade_history.session_id = backtest_session.session_id").
			Where("backtest_session.user_id = ? AND trade_history.pnl IS NOT NULL", userID).
			Scan(&trades)

		var sessions []BacktestSession
		DB.Where("user_id = ?", userID).Order("session_id DESC").Find(&sessions)

		c.JSON(http.StatusOK, gin.H{"trades": trades, "sessions": sessions})
	})
	r.POST("/api/trades", func(c *gin.Context) {
		var newTrade TradeHistory
		
		// ถ้าข้อมูลที่ React ส่งมาไม่ตรงกับโครงสร้าง จะพ่น Error บอกใน Terminal
		if err := c.ShouldBindJSON(&newTrade); err != nil {
			fmt.Println("❌ [Backend] Bind JSON Error:", err)
			c.JSON(http.StatusBadRequest, gin.H{"message": "ข้อมูลไม่ถูกต้อง", "error": err.Error()})
			return
		}

		if err := DB.Create(&newTrade).Error; err != nil {
			fmt.Println("❌ [Backend] Error GORM SQL:", err)
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Server Error"})
			return
		}

		c.JSON(http.StatusCreated, newTrade)
	})

	fmt.Println("🚀 เซิร์ฟเวอร์ Backend (Golang) รันอยู่บนพอร์ต http://localhost:3000")
	r.Run(":3000")


	
}

