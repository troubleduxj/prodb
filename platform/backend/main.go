package main

import (
	"context"
	"log"
	"net/http"
	"prodb/platform/backend/config"
	"prodb/platform/backend/database"
	"prodb/platform/backend/handlers"
	"prodb/platform/backend/models"
	"prodb/platform/backend/repository"
	"prodb/platform/backend/services"
	"prodb/platform/backend/tdengine"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// Initialize PostgreSQL database connection
	database.Connect()
	// Run migrations
	database.Migrate()
	// Seed the database with initial data (e.g., admin user)
	database.Seed()

	// Initialize TDengine connection
	// First try to load from database connection settings
	tdengineConfig := loadTDengineConfigFromDB()
	if tdengineConfig == nil {
		// Fall back to config file
		var err error
		tdengineConfig, err = config.LoadTDengineConfig("config/tdengine.json")
		if err != nil {
			log.Printf("Warning: Failed to load TDengine config: %v", err)
			log.Println("Using default configuration...")
			tdengineConfig = tdengine.DefaultTDengineConfig()
		}
	}

	var tdengineService *tdengine.TDengineService
	tdengineManager, err := tdengine.NewTDengineManager(tdengineConfig)
	if err != nil {
		log.Printf("Warning: Failed to initialize TDengine manager: %v", err)
		log.Println("Continuing without TDengine support...")
	} else {
		if err := tdengineManager.Start(); err != nil {
			log.Printf("Warning: Failed to start TDengine manager: %v", err)
			log.Println("Continuing without TDengine support...")
			tdengineManager = nil
		} else {
			log.Println("TDengine manager started successfully")
			tdengineService = tdengine.NewTDengineService(tdengineManager)
			defer tdengineManager.Stop()
		}
	}

	// Initialize services
	alertService := services.NewAlertService(database.DB)
	heartbeatService := services.NewHeartbeatService(database.DB, alertService)
	alertRulesEngine := services.NewAlertRulesEngine(database.DB, alertService)
	performanceMonitor := services.NewPerformanceMonitor(database.DB, alertService, heartbeatService)
	
	// Initialize performance optimization system
	performanceConfig := services.DefaultPerformanceConfig()
	performanceOptimizer := services.NewPerformanceOptimizer(performanceConfig)
	
	// Initialize scalability system
	scalabilityConfig := services.DefaultScalabilityConfig()
	scalabilityManager := services.NewScalabilityManager(scalabilityConfig)
	
	// TODO: Initialize audit system when needed
	// auditService := services.NewAuditService(database.DB)
	
	// TODO: Initialize security system when needed
	// securityService := services.NewSecurityThreatDetectionService(database.DB, auditService)
	
	// Start heartbeat monitoring
	if err := heartbeatService.StartMonitoring(); err != nil {
		log.Printf("Warning: Failed to start heartbeat monitoring: %v", err)
	} else {
		log.Println("Heartbeat monitoring service started")
		defer heartbeatService.StopMonitoring()
	}
	
	// Start alert rules engine
	if err := alertRulesEngine.Start(); err != nil {
		log.Printf("Warning: Failed to start alert rules engine: %v", err)
	} else {
		log.Println("Alert rules engine started")
		defer alertRulesEngine.Stop()
	}
	
	// Start performance monitoring
	if err := performanceMonitor.Start(); err != nil {
		log.Printf("Warning: Failed to start performance monitoring: %v", err)
	} else {
		log.Println("Performance monitoring service started")
		defer performanceMonitor.Stop()
	}
	
	// Start performance optimization system
	ctx := context.Background()
	if err := performanceOptimizer.Start(ctx); err != nil {
		log.Printf("Warning: Failed to start performance optimizer: %v", err)
	} else {
		log.Println("Performance optimizer started")
		defer performanceOptimizer.Stop()
	}
	
	// Start scalability system
	if err := scalabilityManager.Start(ctx); err != nil {
		log.Printf("Warning: Failed to start scalability manager: %v", err)
	} else {
		log.Println("Scalability manager started")
		defer scalabilityManager.Stop()
	}
	
	// TODO: Initialize audit service when needed
	// log.Println("Audit service initialized")
	
	// TODO: Initialize security service when needed
	// log.Println("Security threat detection service initialized")

	r := gin.Default()

	// Configure CORS
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"http://localhost:9081", "http://localhost:9083", "http://localhost:9181"}
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With", "X-Collector-ID", "X-Collector-Secret", "X-Request-Time"}
	config.AllowCredentials = true
	r.Use(cors.New(config))

	// API v1 routes
	apiV1 := r.Group("/api/v1")
	{


		// User routes
		userRoutes := apiV1.Group("/users")
		{
			userRoutes.GET("", handlers.GetUsers)
			userRoutes.POST("", handlers.CreateUser)
			userRoutes.PUT("/:id", handlers.UpdateUser)
			userRoutes.DELETE("/:id", handlers.DeleteUser)
		}

		// Role routes
		roleRoutes := apiV1.Group("/roles")
		{
			roleRoutes.GET("", handlers.GetRoles)
		}

		// Initialize Config Delivery Service and Handler
		interfaceRepo := repository.NewCollectorInterfaceRepository(database.DB)
		historyRepo := repository.NewCollectorInterfaceHistoryRepository(database.DB)
		deliveryRepo := repository.NewInterfaceConfigDeliveryRepository(database.DB)
		configAssembler := services.NewConfigAssembler(database.DB, interfaceRepo)
		configDeliveryService := services.NewConfigDeliveryService(database.DB, interfaceRepo, historyRepo, deliveryRepo, configAssembler)
		deliveryHandler := handlers.NewConfigDeliveryHandler()
		deliveryHandler.SetService(configDeliveryService)
		
		// Heartbeat Handler
		heartbeatHandler := handlers.NewHeartbeatHandler(heartbeatService, alertService)
		
		// Alert Rules Handler
		alertRulesHandler := handlers.NewAlertRulesHandler(alertRulesEngine)
		
		// Performance Handler
		performanceHandler := handlers.NewPerformanceHandler(performanceMonitor)
		
		// Performance Optimization Handler
		performanceOptimizationHandler := handlers.NewPerformanceOptimizationHandler(performanceOptimizer)
		
		// Scalability Handler
		scalabilityHandler := handlers.NewScalabilityHandler(scalabilityManager)
		
		// TODO: Initialize audit and security handlers when needed
		// auditHandler := handlers.NewAuditHandler(auditService)
		// securityHandler := handlers.NewSecurityHandler(securityService, auditService)

		// Collector Registration Handler
		collectorRegHandler := handlers.NewCollectorRegistrationHandler()
		mockAuthHandler := handlers.NewMockAuthHandler(collectorRegHandler)
		dataIngestionHandler := handlers.NewDataIngestionHandler(collectorRegHandler)

		// Authentication routes (mock for demo)
		authRoutes := apiV1.Group("/auth")
		{
			authRoutes.POST("/login", handlers.Login)
			authRoutes.GET("/keys/:key_id", mockAuthHandler.GetSecretKey)
			authRoutes.POST("/authenticate", mockAuthHandler.AuthenticateCollector)
			// Collector authentication endpoint
			authRoutes.POST("/collector/login", mockAuthHandler.AuthenticateCollector)
		}

		// Collector routes
		collectorRoutes := apiV1.Group("/collectors")
		{
			// Registration and authentication
			collectorRoutes.POST("/register", collectorRegHandler.RegisterCollector)
			collectorRoutes.GET("/list", collectorRegHandler.ListCollectors)
			collectorRoutes.GET("/by-protocol", collectorRegHandler.GetCollectorsByProtocol)
			collectorRoutes.GET("/:id/secret", collectorRegHandler.GetCollectorSecret)
			collectorRoutes.GET("/:id/info", collectorRegHandler.GetCollectorInfo)
			collectorRoutes.PUT("/:id/status", collectorRegHandler.UpdateCollectorStatus)
			collectorRoutes.POST("/heartbeat", dataIngestionHandler.HandleHeartbeat)
			
			// Existing collector management
			collectorRoutes.GET("", handlers.GetCollectors)
			collectorRoutes.POST("", handlers.CreateCollector)
			collectorRoutes.GET("/:id", handlers.GetCollector)
			collectorRoutes.PUT("/:id", handlers.UpdateCollector)
			collectorRoutes.DELETE("/:id", handlers.DeleteCollector)

			collectorRoutes.GET("/:id/interfaces", handlers.GetInterfaces)
			collectorRoutes.POST("/:id/interfaces", handlers.CreateInterface)
			collectorRoutes.PUT("/:id/interfaces/:ifaceId", handlers.UpdateInterface)
			collectorRoutes.DELETE("/:id/interfaces/:ifaceId", handlers.DeleteInterface)

			// Configuration management routes for collectors
			collectorRoutes.GET("/:id/config/pending", deliveryHandler.GetPendingConfigurations)
			collectorRoutes.GET("/:id/config/active", deliveryHandler.GetActiveConfiguration)
			collectorRoutes.GET("/:id/config/history", deliveryHandler.GetConfigurationHistory)
			collectorRoutes.POST("/:id/config/rollback", deliveryHandler.RollbackConfiguration)
			collectorRoutes.POST("/:id/config/sync", deliveryHandler.SyncOfflineConfigurations)
			collectorRoutes.POST("/:id/config/resolve-conflicts", deliveryHandler.ResolveConfigurationConflicts)
			
			// Heartbeat and monitoring routes
			collectorRoutes.POST("/:id/heartbeat", heartbeatHandler.ProcessHeartbeat)
			collectorRoutes.GET("/:id/status", heartbeatHandler.GetCollectorStatus)
			collectorRoutes.GET("/:id/heartbeat/statistics", heartbeatHandler.GetHeartbeatStatistics)
			collectorRoutes.GET("/:id/metrics/history", heartbeatHandler.GetMetricsHistory)
			collectorRoutes.GET("/:id/heartbeat/recent", heartbeatHandler.GetRecentHeartbeats)
			collectorRoutes.GET("/:id/alerts", heartbeatHandler.GetCollectorAlerts)
			
			// Performance monitoring routes
			collectorRoutes.GET("/:id/performance/metrics", performanceHandler.GetPerformanceMetrics)
			collectorRoutes.GET("/:id/performance/trend", performanceHandler.GetPerformanceTrend)
			collectorRoutes.GET("/:id/performance/capacity-plan", performanceHandler.GetCapacityPlan)
		}
		
		// Health and monitoring routes
		healthRoutes := apiV1.Group("/health")
		{
			healthRoutes.GET("", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{
					"status":    "healthy",
					"service":   "ProDB Platform",
					"timestamp": time.Now().Unix(),
				})
			})
			healthRoutes.GET("/summary", heartbeatHandler.GetCollectorHealthSummary)
		}
		
		// Alert management routes
		alertRoutes := apiV1.Group("/alerts")
		{
			alertRoutes.GET("/active", heartbeatHandler.GetActiveAlerts)
			alertRoutes.POST("/:id/acknowledge", heartbeatHandler.AcknowledgeAlert)
			alertRoutes.POST("/:id/resolve", heartbeatHandler.ResolveAlert)
			alertRoutes.GET("/statistics", heartbeatHandler.GetAlertStatistics)
		}
		
		// Alert rules management routes
		alertRulesRoutes := apiV1.Group("/alert-rules")
		{
			alertRulesRoutes.GET("", alertRulesHandler.GetRules)
			alertRulesRoutes.POST("", alertRulesHandler.CreateRule)
			alertRulesRoutes.GET("/templates", alertRulesHandler.GetRuleTemplates)
			alertRulesRoutes.POST("/test", alertRulesHandler.TestRule)
			alertRulesRoutes.POST("/from-template", alertRulesHandler.CreateRuleFromTemplate)
			alertRulesRoutes.GET("/statistics", alertRulesHandler.GetRuleStatistics)
			alertRulesRoutes.GET("/evaluation-history", alertRulesHandler.GetRuleEvaluationHistory)
			
			alertRulesRoutes.GET("/:id", alertRulesHandler.GetRule)
			alertRulesRoutes.PUT("/:id", alertRulesHandler.UpdateRule)
			alertRulesRoutes.DELETE("/:id", alertRulesHandler.DeleteRule)
			alertRulesRoutes.POST("/:id/enable", alertRulesHandler.EnableRule)
			alertRulesRoutes.POST("/:id/disable", alertRulesHandler.DisableRule)
		}
		
		// Performance monitoring routes
		performanceRoutes := apiV1.Group("/performance")
		{
			performanceRoutes.GET("/monitoring/stats", performanceHandler.GetMonitoringStats)
			performanceRoutes.GET("/thresholds", performanceHandler.GetThresholds)
			performanceRoutes.PUT("/thresholds", performanceHandler.UpdateThresholds)
			performanceRoutes.GET("/summary", performanceHandler.GetPerformanceSummary)
			performanceRoutes.GET("/alerts", performanceHandler.GetPerformanceAlerts)
			performanceRoutes.GET("/resource-utilization", performanceHandler.GetResourceUtilization)
			performanceRoutes.GET("/recommendations", performanceHandler.GetPerformanceRecommendations)
		}
		
		// Register performance optimization routes
		performanceOptimizationHandler.RegisterRoutes(apiV1)
		
		// Register scalability routes
		scalabilityHandler.RegisterRoutes(apiV1)
		
		// TODO: Register audit routes when implemented
		// auditHandler.RegisterRoutes(apiV1)
		
		// TODO: Register security routes when implemented  
		// securityHandler.RegisterRoutes(apiV1)

		// Configuration Template routes
		templateHandler := handlers.NewConfigTemplateHandler()
		templateRoutes := apiV1.Group("/templates")
		{
			templateRoutes.GET("", templateHandler.ListTemplates)
			templateRoutes.POST("", templateHandler.CreateTemplate)
			templateRoutes.GET("/:id", templateHandler.GetTemplate)
			templateRoutes.PUT("/:id", templateHandler.UpdateTemplate)
			templateRoutes.DELETE("/:id", templateHandler.DeleteTemplate)
			templateRoutes.GET("/:id/versions", templateHandler.GetTemplateVersions)
			templateRoutes.GET("/:id/export", templateHandler.ExportTemplate)
			templateRoutes.POST("/import", templateHandler.ImportTemplate)
			templateRoutes.POST("/apply", templateHandler.ApplyTemplate)
			templateRoutes.POST("/batch-apply", templateHandler.BatchApplyTemplate)
			templateRoutes.POST("/validate", templateHandler.ValidateTemplate)
		}

		// Configuration Delivery routes
		configRoutes := apiV1.Group("/config")
		{
			configRoutes.POST("/deliver", deliveryHandler.DeliverConfiguration)
			configRoutes.POST("/validate", deliveryHandler.ValidateConfiguration)
			configRoutes.GET("/deliveries", deliveryHandler.ListDeliveries)
			configRoutes.GET("/deliveries/:delivery_id", deliveryHandler.GetDeliveryStatus)
			configRoutes.POST("/deliveries/:delivery_id/confirm", deliveryHandler.ConfirmConfigurationApplication)
		}

		// Data ingestion routes
		dataRoutes := apiV1.Group("/data")
		{
			dataRoutes.POST("/receive", dataIngestionHandler.ReceiveData)
			dataRoutes.POST("/batch", dataIngestionHandler.ReceiveBatch)
			dataRoutes.POST("/ingest", dataIngestionHandler.IngestData)
			dataRoutes.GET("/received", dataIngestionHandler.GetReceivedData)
			dataRoutes.GET("/statistics", dataIngestionHandler.GetDataStatistics)
			dataRoutes.GET("/realtime/:collector_id", dataIngestionHandler.GetRealtimeData)
		}



		// Database connection management routes
		databaseRoutes := apiV1.Group("/database")
		{
			// Connection management
			connectionRoutes := databaseRoutes.Group("/connections")
			{
				connectionRoutes.GET("", handlers.GetTDengineConnections)
				connectionRoutes.POST("", handlers.CreateTDengineConnection)
				connectionRoutes.GET("/:id", handlers.GetTDengineConnection)
				connectionRoutes.PUT("/:id", handlers.UpdateTDengineConnection)
				connectionRoutes.DELETE("/:id", handlers.DeleteTDengineConnection)
				connectionRoutes.POST("/test", handlers.TestTDengineConnection)
				connectionRoutes.POST("/:id/test", handlers.TestTDengineConnectionById)
				connectionRoutes.GET("/:id/status", handlers.GetTDengineConnectionStatus)
				connectionRoutes.GET("/status", handlers.GetAllTDengineConnectionStatuses)
				connectionRoutes.POST("/batch-test", handlers.BatchTestTDengineConnections)
				connectionRoutes.DELETE("/batch", handlers.BatchDeleteTDengineConnections)
			}
			
			// Database management
			databaseRoutes.GET("/databases", handlers.GetTDengineDatabases)
			databaseRoutes.POST("/databases", handlers.CreateTDengineDatabase)
			databaseRoutes.GET("/databases/:name", handlers.GetTDengineDatabase)
			databaseRoutes.DELETE("/databases/:name", handlers.DeleteTDengineDatabase)
			
			// Super table management
			databaseRoutes.GET("/supertables", handlers.GetTDengineSuperTables)
			databaseRoutes.POST("/supertables", handlers.CreateTDengineSuperTable)
			databaseRoutes.GET("/supertables/:name", handlers.GetTDengineSuperTable)
			databaseRoutes.DELETE("/supertables/:name", handlers.DeleteTDengineSuperTable)
			
			// Table management
			databaseRoutes.GET("/tables", handlers.GetTDengineTables)
			
			// Utility endpoints
			databaseRoutes.GET("/ping", handlers.PingTDengine)
			databaseRoutes.GET("/server-info", handlers.GetTDengineServerInfo)
		}

		// Data query and export routes
		queryRoutes := apiV1.Group("/query")
		{
			// Query execution
			queryRoutes.POST("/structured", handlers.ExecuteStructuredQuery)
			queryRoutes.POST("/sql", handlers.ExecuteSQLQuery)
			queryRoutes.POST("/paginated", handlers.ExecuteQueryWithPagination)
			
			// Query templates
			queryRoutes.GET("/templates", handlers.GetQueryTemplates)
			queryRoutes.POST("/templates", handlers.SaveQueryTemplate)
			queryRoutes.GET("/templates/:id", handlers.GetQueryTemplate)
			queryRoutes.DELETE("/templates/:id", handlers.DeleteQueryTemplate)
			
			// Query history
			queryRoutes.GET("/history", handlers.GetQueryHistory)
			
			// Data export
			queryRoutes.POST("/export", handlers.ExportData)
		}

		// Trends analysis routes
		trendsRoutes := apiV1.Group("/trends")
		{
			// Initialize trends handler
			trendsHandler := handlers.NewTrendsHandler()
			
			// Trend analysis
			trendsRoutes.GET("/parameters", trendsHandler.GetParameters)
			trendsRoutes.GET("/templates", trendsHandler.GetTemplates)
			trendsRoutes.POST("/templates", trendsHandler.SaveTemplate)
			trendsRoutes.POST("/analyze", trendsHandler.ExecuteTrendAnalysis)
		}

		// Collector authentication routes
		collectorAuthRoutes := apiV1.Group("/collector-auth")
		{
			// Authentication status management
			collectorAuthRoutes.GET("/pending", handlers.GetPendingCollectors)
			collectorAuthRoutes.GET("/status", handlers.GetCollectorAuthStatus)
			collectorAuthRoutes.POST("/register", handlers.RegisterCollectorAuth)
			
			// Authentication actions
			collectorAuthRoutes.POST("/approve", handlers.ApproveCollectors)
			collectorAuthRoutes.POST("/reject", handlers.RejectCollectors)
			collectorAuthRoutes.POST("/suspend", handlers.SuspendCollectors)
			
			// Authentication rules
			collectorAuthRoutes.GET("/rules", handlers.GetAuthenticationRules)
			collectorAuthRoutes.POST("/rules", handlers.CreateAuthenticationRule)
			collectorAuthRoutes.PUT("/rules/:id", handlers.UpdateAuthenticationRule)
			collectorAuthRoutes.DELETE("/rules/:id", handlers.DeleteAuthenticationRule)
			
			// Authentication logs and statistics
			collectorAuthRoutes.GET("/logs", handlers.GetAuthenticationLogs)
			collectorAuthRoutes.GET("/statistics", handlers.GetAuthenticationStatistics)
			
			// Maintenance
			collectorAuthRoutes.POST("/cleanup-expired", handlers.CleanupExpiredTokens)
		}

		// Batch node management routes
		batchNodeRoutes := apiV1.Group("/batch-nodes")
		{
			// Node point management
			batchNodeRoutes.GET("", handlers.GetNodePoints)
			batchNodeRoutes.POST("", handlers.CreateNodePoint)
			
			// Batch operations
			batchNodeRoutes.POST("/batch-update", handlers.BatchUpdateNodePoints)
			batchNodeRoutes.POST("/batch-delete", handlers.BatchDeleteNodePoints)
			batchNodeRoutes.POST("/batch-enable-disable", handlers.BatchEnableDisableNodePoints)
			
			// Import/Export
			batchNodeRoutes.POST("/import", handlers.ImportNodePoints)
			batchNodeRoutes.POST("/export", handlers.ExportNodePoints)
			batchNodeRoutes.GET("/template", handlers.GetNodePointTemplate)
			
			// Batch operation status
			batchNodeRoutes.GET("/operations", handlers.GetBatchOperations)
			batchNodeRoutes.GET("/operations/:id", handlers.GetBatchOperationStatus)
		}

		// TDengine routes - always available with proper error handling
		var tdengineHandler *handlers.TDengineHandler
		if tdengineService != nil {
			tdengineHandler = handlers.NewTDengineHandler(tdengineService)
		}
		
		tdengineRoutes := apiV1.Group("/tdengine")
		{
			// Health and monitoring
			if tdengineHandler != nil {
				tdengineRoutes.GET("/health", tdengineHandler.GetHealthStatus)
				tdengineRoutes.GET("/metrics", tdengineHandler.GetMetrics)
			} else {
				tdengineRoutes.GET("/health", handlers.TDengineUnavailableHandler)
				tdengineRoutes.GET("/metrics", handlers.TDengineUnavailableHandler)
			}
			
			// Database management - comprehensive CRUD operations
			databaseRoutes := tdengineRoutes.Group("/databases")
			{
				if tdengineHandler != nil {
					databaseRoutes.GET("", tdengineHandler.GetDatabases)                    // List all databases
					databaseRoutes.POST("", tdengineHandler.CreateDatabase)                 // Create database
					databaseRoutes.GET("/:database", tdengineHandler.GetDatabaseInfo)          // Get database info
					databaseRoutes.DELETE("/:database", tdengineHandler.DropDatabase)          // Drop database
					databaseRoutes.GET("/:database/exists", tdengineHandler.CheckDatabaseExists) // Check existence
					databaseRoutes.GET("/:database/statistics", tdengineHandler.GetDatabaseStatistics) // Get statistics
				} else {
					databaseRoutes.GET("", handlers.TDengineUnavailableHandler)
					databaseRoutes.POST("", handlers.TDengineUnavailableHandler)
					databaseRoutes.GET("/:database", handlers.TDengineUnavailableHandler)
					databaseRoutes.DELETE("/:database", handlers.TDengineUnavailableHandler)
					databaseRoutes.GET("/:database/exists", handlers.TDengineUnavailableHandler)
					databaseRoutes.GET("/:database/statistics", handlers.TDengineUnavailableHandler)
				}
			}
			
			// Database name validation
			if tdengineHandler != nil {
				tdengineRoutes.POST("/validate-name", tdengineHandler.ValidateDatabaseName)
			} else {
				tdengineRoutes.POST("/validate-name", handlers.TDengineUnavailableHandler)
			}
			
			// Super table management - comprehensive CRUD operations
			superTableRoutes := tdengineRoutes.Group("/db/:database/supertables")
			{
				if tdengineHandler != nil {
					superTableRoutes.GET("", tdengineHandler.ListSuperTablesDetailed)                    // List all super tables
					superTableRoutes.POST("", tdengineHandler.CreateSuperTable)                         // Create super table
					superTableRoutes.GET("/:supertable", tdengineHandler.GetSuperTableInfo)            // Get super table info
					superTableRoutes.DELETE("/:supertable", tdengineHandler.DropSuperTable)            // Drop super table
					superTableRoutes.PUT("/:supertable", tdengineHandler.AlterSuperTable)              // Alter super table
					superTableRoutes.GET("/:supertable/exists", tdengineHandler.CheckSuperTableExists) // Check existence
					superTableRoutes.GET("/:supertable/schema", tdengineHandler.GetSuperTableSchema)   // Get schema
					superTableRoutes.GET("/:supertable/statistics", tdengineHandler.GetSuperTableStatistics) // Get statistics
				} else {
					superTableRoutes.GET("", handlers.TDengineUnavailableHandler)
					superTableRoutes.POST("", handlers.TDengineUnavailableHandler)
					superTableRoutes.GET("/:supertable", handlers.TDengineUnavailableHandler)
					superTableRoutes.DELETE("/:supertable", handlers.TDengineUnavailableHandler)
					superTableRoutes.PUT("/:supertable", handlers.TDengineUnavailableHandler)
					superTableRoutes.GET("/:supertable/exists", handlers.TDengineUnavailableHandler)
					superTableRoutes.GET("/:supertable/schema", handlers.TDengineUnavailableHandler)
					superTableRoutes.GET("/:supertable/statistics", handlers.TDengineUnavailableHandler)
				}
			}
			
			// Super table validation
			if tdengineHandler != nil {
				tdengineRoutes.POST("/validate-supertable-schema", tdengineHandler.ValidateSuperTableSchema)
				tdengineRoutes.POST("/db/:database/supertables/:supertable/validate-compatibility", tdengineHandler.ValidateSuperTableCompatibility)
			} else {
				tdengineRoutes.POST("/validate-supertable-schema", handlers.TDengineUnavailableHandler)
				tdengineRoutes.POST("/db/:database/supertables/:supertable/validate-compatibility", handlers.TDengineUnavailableHandler)
			}
			
			// Sub-table management - comprehensive CRUD operations
			// Use a different base path to avoid conflict with /databases/:database
			subTableRoutes := tdengineRoutes.Group("/db/:database")
			{
				if tdengineHandler != nil {
					// Sub-table operations under super table
					subTableRoutes.POST("/supertables/:supertable/subtables", tdengineHandler.CreateSubTable)                    // Create sub-table
					subTableRoutes.GET("/supertables/:supertable/subtables", tdengineHandler.ListSubTables)                     // List sub-tables
					subTableRoutes.POST("/supertables/:supertable/subtables/by-tags", tdengineHandler.GetSubTablesByTags)      // Query by tags
					subTableRoutes.POST("/supertables/:supertable/auto-create", tdengineHandler.AutoCreateSubTableFromData)    // Auto-create from data
					subTableRoutes.POST("/supertables/:supertable/lifecycle", tdengineHandler.ApplySubTableLifecyclePolicy)    // Apply lifecycle policy
					
					// Direct sub-table operations
					subTableRoutes.GET("/subtables/:subtable", tdengineHandler.GetSubTableInfo)                                // Get sub-table info
					subTableRoutes.DELETE("/subtables/:subtable", tdengineHandler.DropSubTable)                                // Drop sub-table
					subTableRoutes.GET("/subtables/:subtable/exists", tdengineHandler.CheckSubTableExists)                     // Check existence
					subTableRoutes.PUT("/subtables/:subtable/tags/:tag", tdengineHandler.UpdateSubTableTag)                   // Update tag value
				} else {
					subTableRoutes.POST("/supertables/:supertable/subtables", handlers.TDengineUnavailableHandler)
					subTableRoutes.GET("/supertables/:supertable/subtables", handlers.TDengineUnavailableHandler)
					subTableRoutes.POST("/supertables/:supertable/subtables/by-tags", handlers.TDengineUnavailableHandler)
					subTableRoutes.POST("/supertables/:supertable/auto-create", handlers.TDengineUnavailableHandler)
					subTableRoutes.POST("/supertables/:supertable/lifecycle", handlers.TDengineUnavailableHandler)
					subTableRoutes.GET("/subtables/:subtable", handlers.TDengineUnavailableHandler)
					subTableRoutes.DELETE("/subtables/:subtable", handlers.TDengineUnavailableHandler)
					subTableRoutes.GET("/subtables/:subtable/exists", handlers.TDengineUnavailableHandler)
					subTableRoutes.PUT("/subtables/:subtable/tags/:tag", handlers.TDengineUnavailableHandler)
				}
			}
			
			// Data operations
			if tdengineHandler != nil {
				tdengineRoutes.POST("/query", tdengineHandler.ExecuteQuery)
				tdengineRoutes.GET("/data/latest", tdengineHandler.GetLatestData)
				tdengineRoutes.POST("/data/insert", tdengineHandler.InsertData)
			} else {
				tdengineRoutes.POST("/query", handlers.TDengineUnavailableHandler)
				tdengineRoutes.GET("/data/latest", handlers.TDengineUnavailableHandler)
				tdengineRoutes.POST("/data/insert", handlers.TDengineUnavailableHandler)
			}
		}
	}

	r.GET("/ping", func(c *gin.Context) {
		response := gin.H{
			"message":   "pong",
			"db_status": "connected",
		}
		
		// Add TDengine status if available
		if tdengineService != nil {
			status := tdengineService.GetHealthStatus()
			response["tdengine_status"] = map[string]interface{}{
				"healthy":     status.IsHealthy,
				"last_check":  status.LastCheck,
				"uptime":      status.Uptime,
			}
		} else {
			response["tdengine_status"] = "not_available"
		}
		
		c.JSON(http.StatusOK, response)
	})

	r.Run(":9080") // listen and serve on 0.0.0.0:9080
}

// loadTDengineConfigFromDB loads TDengine configuration from database connection settings
func loadTDengineConfigFromDB() *tdengine.TDengineConfig {
	var connection models.TDengineConnection
	
	// Try to find the default connection first
	err := database.DB.Where("is_default = ?", true).First(&connection).Error
	if err != nil {
		// If no default connection, try to find any active connection
		err = database.DB.Where("status = ?", "connected").First(&connection).Error
		if err != nil {
			// Try any connection
			err = database.DB.First(&connection).Error
			if err != nil {
				log.Println("No TDengine connection found in database")
				return nil
			}
		}
	}
	
	log.Printf("Loading TDengine config from database connection: %s (%s:%d)",
		connection.Name, connection.Host, connection.Port)
	
	// Get default config for values not in database
	defaultConfig := tdengine.DefaultTDengineConfig()
	
	config := &tdengine.TDengineConfig{
		Host:         connection.Host,
		Port:         connection.Port,
		Username:     connection.Username,
		Password:     connection.Password,
		Database:     connection.Database,
		MaxOpenConns: connection.MaxOpenConns,
		MaxIdleConns: connection.MaxIdleConns,
		ConnTimeout:  time.Duration(connection.ConnTimeout) * time.Second,
		// Use defaults for these values
		IdleTimeout:         defaultConfig.IdleTimeout,
		MaxLifetime:         defaultConfig.MaxLifetime,
		HealthCheckInterval: defaultConfig.HealthCheckInterval,
		MaxRetries:          defaultConfig.MaxRetries,
		RetryInterval:       defaultConfig.RetryInterval,
		EnableAutoReconnect: defaultConfig.EnableAutoReconnect,
		ReconnectInterval:   defaultConfig.ReconnectInterval,
		MaxReconnectAttempts: defaultConfig.MaxReconnectAttempts,
	}
	
	// Ensure HealthCheckInterval is not zero
	if config.HealthCheckInterval <= 0 {
		config.HealthCheckInterval = 30 * time.Second
	}
	
	return config
}
