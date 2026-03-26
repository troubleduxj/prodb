package logger

import (
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"prodb/collector/internal/config"
)

// Logger wraps slog.Logger with additional functionality
type Logger struct {
	*slog.Logger
	config config.LoggerConfig
	file   *os.File
}

// NewLogger creates a new logger instance
func NewLogger(cfg config.LoggerConfig) (*Logger, error) {
	var writer io.Writer
	var file *os.File
	var err error

	// Determine output destination
	switch cfg.Output {
	case "file":
		// Create log directory if it doesn't exist
		logDir := filepath.Dir(cfg.FilePath)
		if err := os.MkdirAll(logDir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create log directory: %w", err)
		}

		// Open log file
		file, err = os.OpenFile(cfg.FilePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
		if err != nil {
			return nil, fmt.Errorf("failed to open log file: %w", err)
		}
		writer = file
	default: // stdout
		writer = os.Stdout
	}

	// Determine log level
	level := parseLogLevel(cfg.Level)

	// Create handler options
	opts := &slog.HandlerOptions{
		Level: level,
		AddSource: level == slog.LevelDebug,
	}

	// Create handler based on format
	var handler slog.Handler
	switch cfg.Format {
	case "text":
		handler = slog.NewTextHandler(writer, opts)
	default: // json
		handler = slog.NewJSONHandler(writer, opts)
	}

	// Create logger
	logger := slog.New(handler)

	return &Logger{
		Logger: logger,
		config: cfg,
		file:   file,
	}, nil
}

// Close closes the logger and any open files
func (l *Logger) Close() error {
	if l.file != nil {
		return l.file.Close()
	}
	return nil
}

// Debug logs a debug message with key-value pairs
func (l *Logger) Debug(msg string, keysAndValues ...interface{}) {
	l.Logger.Debug(msg, keysAndValues...)
}

// Info logs an info message with key-value pairs
func (l *Logger) Info(msg string, keysAndValues ...interface{}) {
	l.Logger.Info(msg, keysAndValues...)
}

// Warn logs a warning message with key-value pairs
func (l *Logger) Warn(msg string, keysAndValues ...interface{}) {
	l.Logger.Warn(msg, keysAndValues...)
}

// Error logs an error message with key-value pairs
func (l *Logger) Error(msg string, keysAndValues ...interface{}) {
	l.Logger.Error(msg, keysAndValues...)
}

// With returns a new logger with the given key-value pairs added to the context
func (l *Logger) With(keysAndValues ...interface{}) *Logger {
	return &Logger{
		Logger: l.Logger.With(keysAndValues...),
		config: l.config,
		file:   l.file,
	}
}

// WithGroup returns a new logger with the given group name
func (l *Logger) WithGroup(name string) *Logger {
	return &Logger{
		Logger: l.Logger.WithGroup(name),
		config: l.config,
		file:   l.file,
	}
}

// parseLogLevel parses string log level to slog.Level
func parseLogLevel(level string) slog.Level {
	switch strings.ToLower(level) {
	case "debug":
		return slog.LevelDebug
	case "info":
		return slog.LevelInfo
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// LogRotator handles log file rotation (placeholder for future implementation)
type LogRotator struct {
	config config.LoggerConfig
}

// NewLogRotator creates a new log rotator
func NewLogRotator(cfg config.LoggerConfig) *LogRotator {
	return &LogRotator{
		config: cfg,
	}
}

// Rotate rotates the log file (placeholder implementation)
func (r *LogRotator) Rotate() error {
	// TODO: Implement log rotation based on size, age, and backup count
	// This would involve:
	// 1. Checking file size against MaxSize
	// 2. Renaming current log file with timestamp
	// 3. Creating new log file
	// 4. Cleaning up old backups based on MaxBackups and MaxAge
	return nil
}