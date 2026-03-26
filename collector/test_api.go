package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

func testAPIs() {
	// Wait for server to start
	time.Sleep(2 * time.Second)
	
	baseURL := "http://localhost:8093"
	
	// Test system status API
	fmt.Println("Testing System Status API...")
	resp, err := http.Get(baseURL + "/api/v1/status")
	if err != nil {
		fmt.Printf("Error: %v\n", err)
	} else {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		
		var status map[string]interface{}
		json.Unmarshal(body, &status)
		fmt.Printf("Status: %s\n", status["status"])
		fmt.Printf("Uptime: %v seconds\n", status["uptime"])
	}
	
	// Test interfaces API
	fmt.Println("\nTesting Interfaces API...")
	resp, err = http.Get(baseURL + "/api/v1/interfaces")
	if err != nil {
		fmt.Printf("Error: %v\n", err)
	} else {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		
		var interfaces []map[string]interface{}
		json.Unmarshal(body, &interfaces)
		fmt.Printf("Found %d interfaces\n", len(interfaces))
	}
	
	// Test data flow metrics API
	fmt.Println("\nTesting Data Flow Metrics API...")
	resp, err = http.Get(baseURL + "/api/v1/monitoring/dataflow")
	if err != nil {
		fmt.Printf("Error: %v\n", err)
	} else {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		
		var metrics map[string]interface{}
		json.Unmarshal(body, &metrics)
		fmt.Printf("Collection Rate: %v\n", metrics["collectionRate"])
		fmt.Printf("Buffer Utilization: %v%%\n", metrics["bufferUtilization"])
	}
	
	// Test drivers API
	fmt.Println("\nTesting Drivers API...")
	resp, err = http.Get(baseURL + "/api/v1/drivers")
	if err != nil {
		fmt.Printf("Error: %v\n", err)
	} else {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		
		var drivers []map[string]interface{}
		json.Unmarshal(body, &drivers)
		fmt.Printf("Found %d drivers\n", len(drivers))
		for _, driver := range drivers {
			fmt.Printf("- %s v%s (%s)\n", driver["name"], driver["version"], driver["status"])
		}
	}
	
	fmt.Println("\nAPI tests completed!")
}

// This function can be called from main for testing
// Uncomment the line in main() to run tests
func init() {
	// Automatically run tests after a delay
	go func() {
		time.Sleep(3 * time.Second)
		testAPIs()
	}()
}