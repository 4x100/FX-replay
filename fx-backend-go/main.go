package main

import (
	"fmt"
	"log"
	"net/http"
	"os" // 🌟 เพิ่ม os สำหรับอ่านตัวแปร Environment (Cloud)
	"strconv"
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
	StartDate       string    `gorm:"column:start_date" json:"start_date"`
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
	OpenTime   string   `gorm:"column:open_time" json:"open_time"`
	TpPrice    *float64 `gorm:"column:tp_price" json:"tp_price"`
	SlPrice    *float64 `gorm:"column:sl_price" json:"sl_price"`
}

func (TradeHistory) TableName() string { return "trade_history" }

var DB *gorm.DB

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
	PnL         float64 `json:"pnl" gorm:"column:pnl"`
	CreatedAt   string  `json:"created_at" gorm:"column:created_at"`
}

func main() {
	// =========================================================================
	// 🔌 SECTION 2: DATABASE CONNECTION (อัปเกรดให้รองรับ Cloud)
	// =========================================================================
	
	// 🌟 เช็คว่ามีตัวแปร DATABASE_URL จาก Render/Cloud ส่งมาหรือไม่
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		// ถ้าไม่มี (แปลว่ารันในเครื่องตัวเอง Local) ให้ใช้ค่านี้แทน
		fmt.Println("⚠️ ไม่พบ DATABASE_URL กำลังใช้งาน Local Database แทน...")
		dsn = "host=localhost user=postgres password=25248 dbname=fx_replay_db port=5432 sslmode=disable TimeZone=Asia/Bangkok"
	}

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
		c.String(http.StatusOK, "ยินดีต้อนรับสู่ FX Replay Backend (Golang Edition) - Live on Cloud! 🚀")
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

		fmt.Printf("🔍 [DEBUG API] Query - Asset: %s, TF: '%s', Start: %s\n", assetName, timeframe, startDate)

		type RawChartData struct {
			Time  string  `gorm:"column:time"`
			Open  float64 `gorm:"column:open"`
			High  float64 `gorm:"column:high"`
			Low   float64 `gorm:"column:low"`
			Close float64 `gorm:"column:close"`
		}
		var rawData []RawChartData

		result := DB.Table("chart_data").
			Select("CAST(time AS TEXT) as time, open, high, low, close").
			Where("asset_name = ? AND timeframe = ? AND CAST(time AS DATE) >= ?::DATE", assetName, timeframe, startDate).
			Order("time ASC").
			Limit(10000).
			Find(&rawData)

		fmt.Printf("📊 [DEBUG SQL] Retrieved %d rows for TF: %s\n", result.RowsAffected, timeframe)

		if result.Error != nil {
			fmt.Println("❌ Error GORM Chart SQL:", result.Error)
			c.JSON(http.StatusOK, []ChartData{})
			return
		}

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

		uniqueData := make([]ChartData, 0)
		seenTimes := make(map[int64]bool)

		for _, d := range rawData {
			var t int64

			if num, err := strconv.ParseInt(d.Time, 10, 64); err == nil {
				t = num
			} else {
				parsedDate, err := time.Parse(time.RFC3339, d.Time)
				if err != nil {
					parsedDate, err = time.Parse("2006-01-02 15:04:05", d.Time)
				}
				if err != nil {
					parsedDate, _ = time.Parse("2006-01-02", d.Time)
				}
				t = parsedDate.Unix()
			}

			if t > 9999999999 {
				t = t / 1000
			}

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

		if sessionID != "" {
			var trades []TradeHistory
			DB.Where("session_id = ?", sessionID).Order("trade_id DESC").Find(&trades)
			c.JSON(http.StatusOK, trades)
			return
		}

		if userID != "" {
			var history []TradeHistoryResponse

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

			c.JSON(http.StatusOK, gin.H{"trades": history})
			return
		}

		c.JSON(http.StatusBadRequest, gin.H{"message": "กรุณาระบุ session_id หรือ user_id"})
	})

	r.GET("/api/dashboard-stats", func(c *gin.Context) {
		userID := c.Query("user_id")
		if userID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "User ID is required"})
			return
		}

		var trades []struct {
			PnL *float64 `json:"pnl" gorm:"column:pnl"`
		}

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

	// =========================================================================
	// 🚀 SECTION 4: PORT BINDING (อัปเกรดให้รองรับ Cloud)
	// =========================================================================
	
	// 🌟 เช็คว่ามีตัวแปร PORT จาก Render/Cloud ส่งมาหรือไม่
	port := os.Getenv("PORT")
	if port == "" {
		// ถ้าไม่มีให้ใช้พอร์ต 3000 สำหรับการรันในเครื่อง (Local)
		port = "3000"
	}

	fmt.Println("🚀 เซิร์ฟเวอร์ Backend (Golang) พร้อมรันบนพอร์ต :" + port)
	r.Run(":" + port)
}