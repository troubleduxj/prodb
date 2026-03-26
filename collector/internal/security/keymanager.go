package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"

	"prodb/collector/internal/logger"
)

// KeyManager manages secure storage and handling of cryptographic keys
type KeyManager struct {
	logger       *logger.Logger
	keyStorePath string
	masterKey    []byte
	mutex        sync.RWMutex
	
	// Key metadata
	keyMetadata map[string]*KeyMetadata
}

// KeyMetadata contains metadata about stored keys
type KeyMetadata struct {
	KeyID       string    `json:"key_id"`
	Algorithm   string    `json:"algorithm"`
	CreatedAt   time.Time `json:"created_at"`
	LastUsed    time.Time `json:"last_used"`
	IsRevoked   bool      `json:"is_revoked"`
	RevokedAt   time.Time `json:"revoked_at,omitempty"`
	Version     int       `json:"version"`
}

// EncryptedKey represents an encrypted key with its metadata
type EncryptedKey struct {
	KeyID      string `json:"key_id"`
	Ciphertext string `json:"ciphertext"`
	Nonce      string `json:"nonce"`
	Algorithm  string `json:"algorithm"`
	Version    int    `json:"version"`
}

// KeyManagerConfig contains configuration for the key manager
type KeyManagerConfig struct {
	KeyStorePath   string `json:"key_store_path"`
	MasterKeyPath  string `json:"master_key_path"`
	AutoGenerate   bool   `json:"auto_generate"`
	KeyRotationDays int   `json:"key_rotation_days"`
}

// NewKeyManager creates a new key manager instance
func NewKeyManager(config KeyManagerConfig, logger *logger.Logger) (*KeyManager, error) {
	km := &KeyManager{
		logger:       logger.WithGroup("key_manager"),
		keyStorePath: config.KeyStorePath,
		keyMetadata:  make(map[string]*KeyMetadata),
	}
	
	// Initialize master key
	if err := km.initializeMasterKey(config.MasterKeyPath, config.AutoGenerate); err != nil {
		return nil, fmt.Errorf("failed to initialize master key: %w", err)
	}
	
	// Create key store directory if it doesn't exist
	if err := os.MkdirAll(filepath.Dir(config.KeyStorePath), 0700); err != nil {
		return nil, fmt.Errorf("failed to create key store directory: %w", err)
	}
	
	// Load existing keys
	if err := km.loadKeys(); err != nil {
		km.logger.Warn("Failed to load existing keys", "error", err)
	}
	
	km.logger.Info("Key manager initialized", "key_store_path", config.KeyStorePath)
	
	return km, nil
}

// initializeMasterKey initializes or loads the master key
func (km *KeyManager) initializeMasterKey(masterKeyPath string, autoGenerate bool) error {
	// Try to load existing master key
	if masterKeyPath != "" {
		if data, err := os.ReadFile(masterKeyPath); err == nil {
			// Decode hex-encoded master key
			masterKey, err := hex.DecodeString(string(data))
			if err != nil {
				return fmt.Errorf("failed to decode master key: %w", err)
			}
			
			if len(masterKey) != 32 {
				return fmt.Errorf("invalid master key length: expected 32 bytes, got %d", len(masterKey))
			}
			
			km.masterKey = masterKey
			km.logger.Info("Master key loaded from file", "path", masterKeyPath)
			return nil
		} else if !os.IsNotExist(err) {
			return fmt.Errorf("failed to read master key file: %w", err)
		}
	}
	
	// Generate new master key if auto-generate is enabled
	if autoGenerate {
		masterKey := make([]byte, 32) // 256-bit key
		if _, err := rand.Read(masterKey); err != nil {
			return fmt.Errorf("failed to generate master key: %w", err)
		}
		
		km.masterKey = masterKey
		
		// Save master key if path is provided
		if masterKeyPath != "" {
			// Create directory if it doesn't exist
			if err := os.MkdirAll(filepath.Dir(masterKeyPath), 0700); err != nil {
				return fmt.Errorf("failed to create master key directory: %w", err)
			}
			
			// Write hex-encoded master key
			hexKey := hex.EncodeToString(masterKey)
			if err := os.WriteFile(masterKeyPath, []byte(hexKey), 0600); err != nil {
				return fmt.Errorf("failed to save master key: %w", err)
			}
			
			km.logger.Info("New master key generated and saved", "path", masterKeyPath)
		} else {
			km.logger.Info("New master key generated (not saved)")
		}
		
		return nil
	}
	
	return fmt.Errorf("no master key available and auto-generate is disabled")
}

// EncryptAndStoreKey encrypts and stores a key with the given ID
func (km *KeyManager) EncryptAndStoreKey(keyID string, plainKey []byte, algorithm string) error {
	km.mutex.Lock()
	defer km.mutex.Unlock()
	
	// Check if key already exists
	if _, exists := km.keyMetadata[keyID]; exists {
		return fmt.Errorf("key with ID %s already exists", keyID)
	}
	
	// Encrypt the key
	encryptedKey, err := km.encryptKey(plainKey, algorithm)
	if err != nil {
		return fmt.Errorf("failed to encrypt key: %w", err)
	}
	encryptedKey.KeyID = keyID
	
	// Store encrypted key
	if err := km.storeEncryptedKey(encryptedKey); err != nil {
		return fmt.Errorf("failed to store encrypted key: %w", err)
	}
	
	// Update metadata
	km.keyMetadata[keyID] = &KeyMetadata{
		KeyID:     keyID,
		Algorithm: algorithm,
		CreatedAt: time.Now(),
		LastUsed:  time.Now(),
		IsRevoked: false,
		Version:   1,
	}
	
	km.logger.Info("Key encrypted and stored", "key_id", keyID, "algorithm", algorithm)
	
	return nil
}

// RetrieveAndDecryptKey retrieves and decrypts a key by ID
func (km *KeyManager) RetrieveAndDecryptKey(keyID string) ([]byte, error) {
	km.mutex.Lock()
	defer km.mutex.Unlock()
	
	// Check metadata
	metadata, exists := km.keyMetadata[keyID]
	if !exists {
		return nil, fmt.Errorf("key with ID %s not found", keyID)
	}
	
	if metadata.IsRevoked {
		return nil, fmt.Errorf("key with ID %s has been revoked", keyID)
	}
	
	// Load encrypted key
	encryptedKey, err := km.loadEncryptedKey(keyID)
	if err != nil {
		return nil, fmt.Errorf("failed to load encrypted key: %w", err)
	}
	
	// Decrypt key
	plainKey, err := km.decryptKey(encryptedKey)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt key: %w", err)
	}
	
	// Update last used time
	metadata.LastUsed = time.Now()
	
	km.logger.Debug("Key retrieved and decrypted", "key_id", keyID)
	
	return plainKey, nil
}

// RevokeKey revokes a key, making it unusable
func (km *KeyManager) RevokeKey(keyID string) error {
	km.mutex.Lock()
	defer km.mutex.Unlock()
	
	metadata, exists := km.keyMetadata[keyID]
	if !exists {
		return fmt.Errorf("key with ID %s not found", keyID)
	}
	
	if metadata.IsRevoked {
		return fmt.Errorf("key with ID %s is already revoked", keyID)
	}
	
	metadata.IsRevoked = true
	metadata.RevokedAt = time.Now()
	
	// Save updated metadata
	if err := km.saveMetadata(); err != nil {
		return fmt.Errorf("failed to save metadata: %w", err)
	}
	
	km.logger.Info("Key revoked", "key_id", keyID, "revoked_at", metadata.RevokedAt)
	
	return nil
}

// RotateKey creates a new version of an existing key
func (km *KeyManager) RotateKey(keyID string, newPlainKey []byte) error {
	km.mutex.Lock()
	defer km.mutex.Unlock()
	
	metadata, exists := km.keyMetadata[keyID]
	if !exists {
		return fmt.Errorf("key with ID %s not found", keyID)
	}
	
	// Create new version
	newVersion := metadata.Version + 1
	newKeyID := fmt.Sprintf("%s_v%d", keyID, newVersion)
	
	// Encrypt new key
	encryptedKey, err := km.encryptKey(newPlainKey, metadata.Algorithm)
	if err != nil {
		return fmt.Errorf("failed to encrypt new key: %w", err)
	}
	encryptedKey.KeyID = newKeyID
	encryptedKey.Version = newVersion
	
	// Store new encrypted key
	if err := km.storeEncryptedKey(encryptedKey); err != nil {
		return fmt.Errorf("failed to store new encrypted key: %w", err)
	}
	
	// Revoke old key
	metadata.IsRevoked = true
	metadata.RevokedAt = time.Now()
	
	// Create metadata for new key
	km.keyMetadata[newKeyID] = &KeyMetadata{
		KeyID:     newKeyID,
		Algorithm: metadata.Algorithm,
		CreatedAt: time.Now(),
		LastUsed:  time.Now(),
		IsRevoked: false,
		Version:   newVersion,
	}
	
	// Save metadata
	if err := km.saveMetadata(); err != nil {
		return fmt.Errorf("failed to save metadata: %w", err)
	}
	
	km.logger.Info("Key rotated", "old_key_id", keyID, "new_key_id", newKeyID, "version", newVersion)
	
	return nil
}

// ListKeys returns metadata for all keys
func (km *KeyManager) ListKeys() map[string]*KeyMetadata {
	km.mutex.RLock()
	defer km.mutex.RUnlock()
	
	// Return a copy to prevent external modification
	result := make(map[string]*KeyMetadata)
	for keyID, metadata := range km.keyMetadata {
		metadataCopy := *metadata
		result[keyID] = &metadataCopy
	}
	
	return result
}

// GetKeyMetadata returns metadata for a specific key
func (km *KeyManager) GetKeyMetadata(keyID string) (*KeyMetadata, error) {
	km.mutex.RLock()
	defer km.mutex.RUnlock()
	
	metadata, exists := km.keyMetadata[keyID]
	if !exists {
		return nil, fmt.Errorf("key with ID %s not found", keyID)
	}
	
	// Return a copy
	metadataCopy := *metadata
	return &metadataCopy, nil
}

// encryptKey encrypts a key using AES-GCM
func (km *KeyManager) encryptKey(plainKey []byte, algorithm string) (*EncryptedKey, error) {
	// Create AES cipher
	block, err := aes.NewCipher(km.masterKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create AES cipher: %w", err)
	}
	
	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}
	
	// Generate random nonce
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}
	
	// Encrypt
	ciphertext := gcm.Seal(nil, nonce, plainKey, nil)
	
	return &EncryptedKey{
		Ciphertext: base64.StdEncoding.EncodeToString(ciphertext),
		Nonce:      base64.StdEncoding.EncodeToString(nonce),
		Algorithm:  algorithm,
		Version:    1,
	}, nil
}

// decryptKey decrypts a key using AES-GCM
func (km *KeyManager) decryptKey(encryptedKey *EncryptedKey) ([]byte, error) {
	// Decode ciphertext and nonce
	ciphertext, err := base64.StdEncoding.DecodeString(encryptedKey.Ciphertext)
	if err != nil {
		return nil, fmt.Errorf("failed to decode ciphertext: %w", err)
	}
	
	nonce, err := base64.StdEncoding.DecodeString(encryptedKey.Nonce)
	if err != nil {
		return nil, fmt.Errorf("failed to decode nonce: %w", err)
	}
	
	// Create AES cipher
	block, err := aes.NewCipher(km.masterKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create AES cipher: %w", err)
	}
	
	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}
	
	// Decrypt
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt key: %w", err)
	}
	
	return plaintext, nil
}

// storeEncryptedKey stores an encrypted key to disk
func (km *KeyManager) storeEncryptedKey(encryptedKey *EncryptedKey) error {
	keyPath := filepath.Join(km.keyStorePath, encryptedKey.KeyID+".key")
	
	// Create directory if it doesn't exist
	if err := os.MkdirAll(filepath.Dir(keyPath), 0700); err != nil {
		return fmt.Errorf("failed to create key directory: %w", err)
	}
	
	// Marshal to JSON
	data, err := json.Marshal(encryptedKey)
	if err != nil {
		return fmt.Errorf("failed to marshal encrypted key: %w", err)
	}
	
	// Write to file
	if err := os.WriteFile(keyPath, data, 0600); err != nil {
		return fmt.Errorf("failed to write key file: %w", err)
	}
	
	return nil
}

// loadEncryptedKey loads an encrypted key from disk
func (km *KeyManager) loadEncryptedKey(keyID string) (*EncryptedKey, error) {
	keyPath := filepath.Join(km.keyStorePath, keyID+".key")
	
	data, err := os.ReadFile(keyPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read key file: %w", err)
	}
	
	var encryptedKey EncryptedKey
	if err := json.Unmarshal(data, &encryptedKey); err != nil {
		return nil, fmt.Errorf("failed to unmarshal encrypted key: %w", err)
	}
	
	return &encryptedKey, nil
}

// loadKeys loads all keys and metadata from disk
func (km *KeyManager) loadKeys() error {
	// Load metadata
	if err := km.loadMetadata(); err != nil {
		return fmt.Errorf("failed to load metadata: %w", err)
	}
	
	km.logger.Info("Keys loaded", "count", len(km.keyMetadata))
	
	return nil
}

// saveMetadata saves key metadata to disk
func (km *KeyManager) saveMetadata() error {
	metadataPath := filepath.Join(km.keyStorePath, "metadata.json")
	
	data, err := json.MarshalIndent(km.keyMetadata, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}
	
	if err := os.WriteFile(metadataPath, data, 0600); err != nil {
		return fmt.Errorf("failed to write metadata file: %w", err)
	}
	
	return nil
}

// loadMetadata loads key metadata from disk
func (km *KeyManager) loadMetadata() error {
	metadataPath := filepath.Join(km.keyStorePath, "metadata.json")
	
	data, err := os.ReadFile(metadataPath)
	if err != nil {
		if os.IsNotExist(err) {
			// No metadata file exists yet, start with empty metadata
			return nil
		}
		return fmt.Errorf("failed to read metadata file: %w", err)
	}
	
	if err := json.Unmarshal(data, &km.keyMetadata); err != nil {
		return fmt.Errorf("failed to unmarshal metadata: %w", err)
	}
	
	return nil
}

// GenerateSecretKey generates a new secret key for collector authentication
func (km *KeyManager) GenerateSecretKey(collectorID string) (string, error) {
	// Generate 32-byte random key
	secretKey := make([]byte, 32)
	if _, err := rand.Read(secretKey); err != nil {
		return "", fmt.Errorf("failed to generate secret key: %w", err)
	}
	
	// Create key ID
	keyID := fmt.Sprintf("collector_%s_secret", collectorID)
	
	// Store encrypted key
	if err := km.EncryptAndStoreKey(keyID, secretKey, "AES-256"); err != nil {
		return "", fmt.Errorf("failed to store secret key: %w", err)
	}
	
	// Return base64-encoded key for use
	return base64.StdEncoding.EncodeToString(secretKey), nil
}

// GetSecretKey retrieves a collector's secret key
func (km *KeyManager) GetSecretKey(collectorID string) (string, error) {
	keyID := fmt.Sprintf("collector_%s_secret", collectorID)
	
	secretKey, err := km.RetrieveAndDecryptKey(keyID)
	if err != nil {
		return "", fmt.Errorf("failed to retrieve secret key: %w", err)
	}
	
	return base64.StdEncoding.EncodeToString(secretKey), nil
}

// RotateSecretKey rotates a collector's secret key
func (km *KeyManager) RotateSecretKey(collectorID string) (string, error) {
	// Generate new secret key
	newSecretKey := make([]byte, 32)
	if _, err := rand.Read(newSecretKey); err != nil {
		return "", fmt.Errorf("failed to generate new secret key: %w", err)
	}
	
	keyID := fmt.Sprintf("collector_%s_secret", collectorID)
	
	// Rotate the key
	if err := km.RotateKey(keyID, newSecretKey); err != nil {
		return "", fmt.Errorf("failed to rotate secret key: %w", err)
	}
	
	return base64.StdEncoding.EncodeToString(newSecretKey), nil
}

// Close closes the key manager and saves any pending changes
func (km *KeyManager) Close() error {
	km.mutex.Lock()
	defer km.mutex.Unlock()
	
	// Save metadata
	if err := km.saveMetadata(); err != nil {
		return fmt.Errorf("failed to save metadata on close: %w", err)
	}
	
	km.logger.Info("Key manager closed")
	
	return nil
}