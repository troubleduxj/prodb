// ProDB API 集成测试
// 测试登录、Token 机制和核心 API

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

const (
	baseURL = "http://localhost:9080/api/v1"
)

var (
	token        string
	refreshToken string
	testResults  []TestResult
)

type TestResult struct {
	Name    string
	Status  string // PASS / FAIL
	Message string
	Duration time.Duration
}

func main() {
	fmt.Println("========================================")
	fmt.Println("ProDB API 集成测试")
	fmt.Println("========================================")
	fmt.Println()

	// 测试 1: 健康检查
	testHealthCheck()

	// 测试 2: 用户登录
	testLogin()

	// 测试 3: 获取当前用户
	testGetCurrentUser()

	// 测试 4: 采集器列表
	testListCollectors()

	// 测试 5: TDengine 数据库列表
	testListDatabases()

	// 测试 6: 告警规则列表
	testListAlertRules()

	// 打印测试报告
	printTestReport()
}

// ============================================
// 测试 1: 健康检查
// ============================================
func testHealthCheck() {
	start := time.Now()
	
	resp, err := http.Get(baseURL + "/ping")
	if err != nil {
		recordResult("Health Check", "FAIL", fmt.Sprintf("请求失败: %v", err))
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	
	if resp.StatusCode == 200 {
		recordResult("Health Check", "PASS", string(body), time.Since(start))
	} else {
		recordResult("Health Check", "FAIL", fmt.Sprintf("状态码: %d", resp.StatusCode), time.Since(start))
	}
}

// ============================================
// 测试 2: 用户登录
// ============================================
func testLogin() {
	start := time.Now()

	loginData := map[string]string{
		"username": "admin",
		"password": "admin",
	}

	jsonData, _ := json.Marshal(loginData)
	resp, err := http.Post(
		baseURL+"/auth/login",
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		recordResult("User Login", "FAIL", fmt.Sprintf("请求失败: %v", err), time.Since(start))
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		recordResult("User Login", "FAIL", fmt.Sprintf("状态码: %d, 响应: %s", resp.StatusCode, string(body)), time.Since(start))
		return
	}

	// 解析响应
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		recordResult("User Login", "FAIL", fmt.Sprintf("解析响应失败: %v", err), time.Since(start))
		return
	}

	// 检查 token
	if tokenValue, ok := result["token"].(string); ok && tokenValue != "" {
		token = tokenValue
		recordResult("User Login", "PASS", "登录成功，获取到 Token", time.Since(start))
	} else {
		recordResult("User Login", "FAIL", "响应中未找到 token", time.Since(start))
	}

	// 检查 refresh token
	if refreshValue, ok := result["refreshToken"].(string); ok && refreshValue != "" {
		refreshToken = refreshValue
	}
}

// ============================================
// 测试 3: 获取当前用户
// ============================================
func testGetCurrentUser() {
	if token == "" {
		recordResult("Get Current User", "SKIP", "没有 Token，跳过测试", 0)
		return
	}

	start := time.Now()

	req, _ := http.NewRequest("GET", baseURL+"/users/me", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		recordResult("Get Current User", "FAIL", fmt.Sprintf("请求失败: %v", err), time.Since(start))
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == 200 {
		recordResult("Get Current User", "PASS", string(body), time.Since(start))
	} else {
		recordResult("Get Current User", "FAIL", fmt.Sprintf("状态码: %d, 响应: %s", resp.StatusCode, string(body)), time.Since(start))
	}
}

// ============================================
// 测试 4: 采集器列表
// ============================================
func testListCollectors() {
	if token == "" {
		recordResult("List Collectors", "SKIP", "没有 Token，跳过测试", 0)
		return
	}

	start := time.Now()

	req, _ := http.NewRequest("GET", baseURL+"/collectors/list", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		recordResult("List Collectors", "FAIL", fmt.Sprintf("请求失败: %v", err), time.Since(start))
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == 200 {
		recordResult("List Collectors", "PASS", fmt.Sprintf("获取到 %d 字节数据", len(body)), time.Since(start))
	} else {
		recordResult("List Collectors", "FAIL", fmt.Sprintf("状态码: %d", resp.StatusCode), time.Since(start))
	}
}

// ============================================
// 测试 5: TDengine 数据库列表
// ============================================
func testListDatabases() {
	if token == "" {
		recordResult("List Databases", "SKIP", "没有 Token，跳过测试", 0)
		return
	}

	start := time.Now()

	req, _ := http.NewRequest("GET", baseURL+"/tdengine/databases", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		recordResult("List Databases", "FAIL", fmt.Sprintf("请求失败: %v", err), time.Since(start))
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == 200 {
		recordResult("List Databases", "PASS", fmt.Sprintf("获取到 %d 字节数据", len(body)), time.Since(start))
	} else {
		recordResult("List Databases", "FAIL", fmt.Sprintf("状态码: %d, 响应: %s", resp.StatusCode, string(body)), time.Since(start))
	}
}

// ============================================
// 测试 6: 告警规则列表
// ============================================
func testListAlertRules() {
	if token == "" {
		recordResult("List Alert Rules", "SKIP", "没有 Token，跳过测试", 0)
		return
	}

	start := time.Now()

	req, _ := http.NewRequest("GET", baseURL+"/alert-rules", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		recordResult("List Alert Rules", "FAIL", fmt.Sprintf("请求失败: %v", err), time.Since(start))
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == 200 {
		recordResult("List Alert Rules", "PASS", fmt.Sprintf("获取到 %d 字节数据", len(body)), time.Since(start))
	} else {
		recordResult("List Alert Rules", "FAIL", fmt.Sprintf("状态码: %d", resp.StatusCode), time.Since(start))
	}
}

// ============================================
// 工具函数
// ============================================
func recordResult(name, status, message string, duration ...time.Duration) {
	var d time.Duration
	if len(duration) > 0 {
		d = duration[0]
	}
	
	result := TestResult{
		Name:     name,
		Status:   status,
		Message:  message,
		Duration: d,
	}
	testResults = append(testResults, result)
}

func printTestReport() {
	fmt.Println()
	fmt.Println("========================================")
	fmt.Println("测试报告")
	fmt.Println("========================================")
	fmt.Println()

	var pass, fail, skip int

	for _, result := range testResults {
		statusIcon := "⚪"
		if result.Status == "PASS" {
			statusIcon = "✅"
			pass++
		} else if result.Status == "FAIL" {
			statusIcon = "❌"
			fail++
		} else if result.Status == "SKIP" {
			statusIcon = "⏭️"
			skip++
		}

		fmt.Printf("%s %s\n", statusIcon, result.Name)
		fmt.Printf("   状态: %s\n", result.Status)
		if result.Duration > 0 {
			fmt.Printf("   耗时: %v\n", result.Duration)
		}
		fmt.Printf("   详情: %s\n", result.Message)
		fmt.Println()
	}

	fmt.Println("========================================")
	fmt.Printf("总计: %d | 通过: %d | 失败: %d | 跳过: %d\n", 
		len(testResults), pass, fail, skip)
	fmt.Println("========================================")

	// 退出码
	if fail > 0 {
		os.Exit(1)
	}
}