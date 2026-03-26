package main

import (
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	_ "github.com/mattn/go-sqlite3"

	"prodb/collector/internal/api"
	"prodb/collector/internal/config"
	"prodb/collector/internal/core"
	"prodb/collector/internal/logger"
)

func getCurrentDir() string {
	dir, err := os.Getwd()
	if err != nil {
		return "unknown"
	}
	return dir
}

func startWebServer(collector *core.Collector, logger *logger.Logger) {
	// Log current directory for debugging
	log.Printf("Current working directory: %s", getCurrentDir())
	log.Printf("Looking for frontend files in: ./frontend/")
	
	// Check if frontend directory exists
	if _, err := os.Stat("./frontend"); os.IsNotExist(err) {
		log.Printf("WARNING: Frontend directory not found at ./frontend/")
		log.Printf("Frontend may not be accessible. Please ensure you're running from the collector directory.")
	} else {
		log.Printf("Frontend directory found successfully")
	}
	
	// Create API handler
	apiHandler := api.NewAPIHandler(collector, logger)
	
	// Create a new ServeMux for better route handling
	mux := http.NewServeMux()
	
	// Register collector API routes
	apiHandler.RegisterRoutes(mux)
	
	// Reverse proxy for platform API requests (excluding collector APIs)
	platformURL, err := url.Parse("http://localhost:9080")
	if err != nil {
		log.Fatalf("Failed to parse platform URL: %v", err)
	}
	proxy := httputil.NewSingleHostReverseProxy(platformURL)
	
	// Handle platform API requests (but not collector v1 APIs)
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		// Check if this is a collector v1 API request
		if len(r.URL.Path) > 7 && r.URL.Path[:8] == "/api/v1/" {
			// Let the collector API handler deal with it
			http.NotFound(w, r)
			return
		}
		// Forward to platform
		proxy.ServeHTTP(w, r)
	})

	// This handler will serve static files and fallback to index.html for SPA routing
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// The path to the file in the filesystem
		filePath := "./frontend" + r.URL.Path
		
		// Get file info
		info, err := os.Stat(filePath)

		// If the file exists and it's not a directory, serve it
		if err == nil && !info.IsDir() {
			http.ServeFile(w, r, filePath)
			return
		}

		// Check if index.html exists
		indexPath := "./frontend/index.html"
		if _, err := os.Stat(indexPath); err != nil {
			// If index.html doesn't exist, return 404 with helpful message
			w.WriteHeader(http.StatusNotFound)
			w.Write([]byte(fmt.Sprintf("Frontend not found. Please ensure the collector is running from the correct directory.\nLooking for: %s\nCurrent directory: %s", indexPath, getCurrentDir())))
			return
		}

		// Otherwise, serve the index.html
		http.ServeFile(w, r, indexPath)
	})

	// Handle saving the new configuration
	mux.HandleFunc("/save", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
			return
		}
		// Parse the form data from the request
		if err := r.ParseForm(); err != nil {
			http.Error(w, "Failed to parse form", http.StatusBadRequest)
			return
		}
		endpoint := r.FormValue("endpoint")
		dbPath := r.FormValue("dbpath")

		// Write the new configuration to the .env file
		content := fmt.Sprintf("PLATFORM_API_ENDPOINT=%s\nLOCAL_DB_PATH=%s\n", endpoint, dbPath)
		err := os.WriteFile(".env", []byte(content), 0644)
		if err != nil {
			http.Error(w, "Failed to save config file", http.StatusInternalServerError)
			return
		}

		fmt.Fprintln(w, "Configuration saved. Please restart the collector to apply changes.")
	})

	// Handle shutting down the collector
	mux.HandleFunc("/shutdown", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "Collector is shutting down...")
		go func() {
			time.Sleep(1 * time.Second)
			os.Exit(0)
		}()
	})

	log.Println("Starting configuration server on http://localhost:9082")
	if err := http.ListenAndServe(":9082", mux); err != nil {
		log.Fatalf("Failed to start web server: %v", err)
	}
}

func main() {
	fmt.Println("ProDB Collector starting...")

	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables or defaults")
	}

	// Get config path from command line arguments or use default
	configPath := "config.json"
	if len(os.Args) > 1 {
		configPath = os.Args[1]
	}

	// Create collector instance
	collector, err := core.NewCollector(configPath)
	if err != nil {
		log.Fatalf("Failed to create collector: %v", err)
	}

	// Initialize logger for web server
	webLogger, err := logger.NewLogger(config.LoggerConfig{
		Level:  "INFO",
		Format: "json",
		Output: "stdout",
	})
	if err != nil {
		log.Printf("Failed to create web logger, using default: %v", err)
		webLogger = nil
	}

	// Start the web server in a new goroutine
	go startWebServer(collector, webLogger)

	// Start the collector
	if err := collector.Start(); err != nil {
		log.Fatalf("Failed to start collector: %v", err)
	}

	// Set up signal handling for graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Wait for shutdown signal
	sig := <-sigChan
	fmt.Printf("\nReceived signal %v, shutting down gracefully...\n", sig)

	// Stop the collector
	if err := collector.Stop(); err != nil {
		log.Printf("Error stopping collector: %v", err)
	}

	fmt.Println("ProDB Collector stopped.")
}
