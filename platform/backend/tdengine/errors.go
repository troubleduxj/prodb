package tdengine

import (
	"fmt"
)

// TDengineError represents a TDengine-specific error
type TDengineError struct {
	Code    int
	Message string
	Cause   error
}

func (e *TDengineError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("TDengine error [%d]: %s (caused by: %v)", e.Code, e.Message, e.Cause)
	}
	return fmt.Sprintf("TDengine error [%d]: %s", e.Code, e.Message)
}

func (e *TDengineError) Unwrap() error {
	return e.Cause
}

// Error codes
const (
	ErrCodeConnectionFailed = 1001
	ErrCodeInvalidConfig    = 1002
	ErrCodeHealthCheckFailed = 1003
	ErrCodeReconnectFailed  = 1004
	ErrCodeQueryFailed      = 1005
	ErrCodePoolExhausted    = 1006
)

// Predefined errors
func ErrConnectionFailed(cause error) *TDengineError {
	return &TDengineError{
		Code:    ErrCodeConnectionFailed,
		Message: "failed to connect to TDengine",
		Cause:   cause,
	}
}

func ErrInvalidConfig(message string) *TDengineError {
	return &TDengineError{
		Code:    ErrCodeInvalidConfig,
		Message: message,
	}
}

func ErrHealthCheckFailed(cause error) *TDengineError {
	return &TDengineError{
		Code:    ErrCodeHealthCheckFailed,
		Message: "health check failed",
		Cause:   cause,
	}
}

func ErrReconnectFailed(cause error) *TDengineError {
	return &TDengineError{
		Code:    ErrCodeReconnectFailed,
		Message: "reconnection failed",
		Cause:   cause,
	}
}

func ErrQueryFailed(cause error) *TDengineError {
	return &TDengineError{
		Code:    ErrCodeQueryFailed,
		Message: "query execution failed",
		Cause:   cause,
	}
}

func ErrPoolExhausted() *TDengineError {
	return &TDengineError{
		Code:    ErrCodePoolExhausted,
		Message: "connection pool exhausted",
	}
}