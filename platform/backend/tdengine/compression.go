package tdengine

import (
	"bytes"
	"compress/gzip"
	"compress/zlib"
	"encoding/json"
	"fmt"
	"io"
)

// CompressionType defines the type of compression to use
type CompressionType int

const (
	CompressionNone CompressionType = iota
	CompressionGzip
	CompressionZlib
)

// CompressionConfig configures data compression settings
type CompressionConfig struct {
	Type             CompressionType `json:"type"`
	Level            int             `json:"level"`
	MinSize          int             `json:"min_size"`          // Minimum data size to compress
	EnableBatching   bool            `json:"enable_batching"`   // Enable batch compression
	BatchSize        int             `json:"batch_size"`        // Size of compression batches
}

// DefaultCompressionConfig returns default compression configuration
func DefaultCompressionConfig() *CompressionConfig {
	return &CompressionConfig{
		Type:           CompressionGzip,
		Level:          gzip.DefaultCompression,
		MinSize:        1024, // 1KB minimum
		EnableBatching: true,
		BatchSize:      10000, // 10K data points per batch
	}
}

// DataCompressor handles data compression for efficient storage and transmission
type DataCompressor struct {
	config *CompressionConfig
}

// NewDataCompressor creates a new data compressor
func NewDataCompressor(config *CompressionConfig) *DataCompressor {
	if config == nil {
		config = DefaultCompressionConfig()
	}
	
	return &DataCompressor{
		config: config,
	}
}

// CompressedData represents compressed data with metadata
type CompressedData struct {
	Data             []byte          `json:"data"`
	OriginalSize     int             `json:"original_size"`
	CompressedSize   int             `json:"compressed_size"`
	CompressionRatio float64         `json:"compression_ratio"`
	CompressionType  CompressionType `json:"compression_type"`
}

// CompressDataPoints compresses a slice of data points
func (c *DataCompressor) CompressDataPoints(dataPoints []DataPoint) (*CompressedData, error) {
	if len(dataPoints) == 0 {
		return &CompressedData{
			Data:            []byte{},
			CompressionType: CompressionNone,
		}, nil
	}

	// Serialize data points to JSON
	jsonData, err := json.Marshal(dataPoints)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal data points: %w", err)
	}

	originalSize := len(jsonData)

	// Skip compression if data is too small
	if originalSize < c.config.MinSize {
		return &CompressedData{
			Data:             jsonData,
			OriginalSize:     originalSize,
			CompressedSize:   originalSize,
			CompressionRatio: 1.0,
			CompressionType:  CompressionNone,
		}, nil
	}

	// Compress the data
	compressedData, err := c.compressBytes(jsonData)
	if err != nil {
		return nil, fmt.Errorf("failed to compress data: %w", err)
	}

	compressedSize := len(compressedData)
	compressionRatio := float64(compressedSize) / float64(originalSize)

	return &CompressedData{
		Data:             compressedData,
		OriginalSize:     originalSize,
		CompressedSize:   compressedSize,
		CompressionRatio: compressionRatio,
		CompressionType:  c.config.Type,
	}, nil
}

// DecompressDataPoints decompresses data back to data points
func (c *DataCompressor) DecompressDataPoints(compressed *CompressedData) ([]DataPoint, error) {
	if compressed == nil {
		return nil, fmt.Errorf("compressed data is nil")
	}

	// Handle empty data
	if len(compressed.Data) == 0 {
		return []DataPoint{}, nil
	}

	var jsonData []byte
	var err error

	// Decompress if needed
	if compressed.CompressionType == CompressionNone {
		jsonData = compressed.Data
	} else {
		jsonData, err = c.decompressBytes(compressed.Data, compressed.CompressionType)
		if err != nil {
			return nil, fmt.Errorf("failed to decompress data: %w", err)
		}
	}

	// Deserialize JSON back to data points
	var dataPoints []DataPoint
	err = json.Unmarshal(jsonData, &dataPoints)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal data points: %w", err)
	}

	return dataPoints, nil
}

// CompressBatchData compresses batch data for efficient transmission
func (c *DataCompressor) CompressBatchData(batches []BatchData) (*CompressedData, error) {
	if len(batches) == 0 {
		return &CompressedData{
			Data:            []byte{},
			CompressionType: CompressionNone,
		}, nil
	}

	// Serialize batch data to JSON
	jsonData, err := json.Marshal(batches)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal batch data: %w", err)
	}

	originalSize := len(jsonData)

	// Skip compression if data is too small
	if originalSize < c.config.MinSize {
		return &CompressedData{
			Data:             jsonData,
			OriginalSize:     originalSize,
			CompressedSize:   originalSize,
			CompressionRatio: 1.0,
			CompressionType:  CompressionNone,
		}, nil
	}

	// Compress the data
	compressedData, err := c.compressBytes(jsonData)
	if err != nil {
		return nil, fmt.Errorf("failed to compress batch data: %w", err)
	}

	compressedSize := len(compressedData)
	compressionRatio := float64(compressedSize) / float64(originalSize)

	return &CompressedData{
		Data:             compressedData,
		OriginalSize:     originalSize,
		CompressedSize:   compressedSize,
		CompressionRatio: compressionRatio,
		CompressionType:  c.config.Type,
	}, nil
}

// DecompressBatchData decompresses batch data
func (c *DataCompressor) DecompressBatchData(compressed *CompressedData) ([]BatchData, error) {
	if compressed == nil {
		return nil, fmt.Errorf("compressed data is nil")
	}

	// Handle empty data
	if len(compressed.Data) == 0 {
		return []BatchData{}, nil
	}

	var jsonData []byte
	var err error

	// Decompress if needed
	if compressed.CompressionType == CompressionNone {
		jsonData = compressed.Data
	} else {
		jsonData, err = c.decompressBytes(compressed.Data, compressed.CompressionType)
		if err != nil {
			return nil, fmt.Errorf("failed to decompress batch data: %w", err)
		}
	}

	// Deserialize JSON back to batch data
	var batches []BatchData
	err = json.Unmarshal(jsonData, &batches)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal batch data: %w", err)
	}

	return batches, nil
}

// OptimizeDataPoints optimizes data points for storage by removing redundancy
func (c *DataCompressor) OptimizeDataPoints(dataPoints []DataPoint) []DataPoint {
	if len(dataPoints) <= 1 {
		return dataPoints
	}

	optimized := make([]DataPoint, 0, len(dataPoints))
	
	// Add first data point
	optimized = append(optimized, dataPoints[0])
	
	for i := 1; i < len(dataPoints); i++ {
		current := dataPoints[i]
		previous := dataPoints[i-1]
		
		// Skip duplicate values within a short time window (1 second)
		if c.isDuplicateValue(current, previous) {
			continue
		}
		
		optimized = append(optimized, current)
	}
	
	return optimized
}

// GetCompressionStats returns compression statistics
func (c *DataCompressor) GetCompressionStats(original, compressed int) map[string]interface{} {
	ratio := float64(compressed) / float64(original)
	savings := float64(original-compressed) / float64(original) * 100
	
	return map[string]interface{}{
		"original_size":      original,
		"compressed_size":    compressed,
		"compression_ratio":  ratio,
		"space_savings_pct":  savings,
		"compression_type":   c.config.Type,
	}
}

// Private helper methods

func (c *DataCompressor) compressBytes(data []byte) ([]byte, error) {
	var buf bytes.Buffer
	
	switch c.config.Type {
	case CompressionGzip:
		writer, err := gzip.NewWriterLevel(&buf, c.config.Level)
		if err != nil {
			return nil, err
		}
		
		_, err = writer.Write(data)
		if err != nil {
			writer.Close()
			return nil, err
		}
		
		err = writer.Close()
		if err != nil {
			return nil, err
		}
		
	case CompressionZlib:
		writer, err := zlib.NewWriterLevel(&buf, c.config.Level)
		if err != nil {
			return nil, err
		}
		
		_, err = writer.Write(data)
		if err != nil {
			writer.Close()
			return nil, err
		}
		
		err = writer.Close()
		if err != nil {
			return nil, err
		}
		
	default:
		return data, nil
	}
	
	return buf.Bytes(), nil
}

func (c *DataCompressor) decompressBytes(data []byte, compressionType CompressionType) ([]byte, error) {
	buf := bytes.NewReader(data)
	
	var reader io.ReadCloser
	var err error
	
	switch compressionType {
	case CompressionGzip:
		reader, err = gzip.NewReader(buf)
		if err != nil {
			return nil, err
		}
		
	case CompressionZlib:
		reader, err = zlib.NewReader(buf)
		if err != nil {
			return nil, err
		}
		
	default:
		return data, nil
	}
	
	defer reader.Close()
	
	var result bytes.Buffer
	_, err = io.Copy(&result, reader)
	if err != nil {
		return nil, err
	}
	
	return result.Bytes(), nil
}

func (c *DataCompressor) isDuplicateValue(current, previous DataPoint) bool {
	// Check if same device and point
	if current.DeviceID != previous.DeviceID || current.PointName != previous.PointName {
		return false
	}
	
	// Check if values are the same
	if current.Value != previous.Value {
		return false
	}
	
	// Check if within 1 second time window
	timeDiff := current.Timestamp.Sub(previous.Timestamp)
	if timeDiff < 0 {
		timeDiff = -timeDiff
	}
	
	return timeDiff <= 1*1000000000 // 1 second in nanoseconds
}