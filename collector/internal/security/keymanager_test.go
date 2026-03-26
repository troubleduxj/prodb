package security

import (
	"os"
	"path/filepath"
	"testing"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
)

func TestKeyManager_EncryptAndStoreKey(t *testing.T) {
	// Create temporary directory for testing
	tempDir, err := os.MkdirTemp("", "keymanager_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)
	
	logger, err := logger.NewLogger(config.LoggerConfig{Level: "debug", Format: "text", Output: "stdout"})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}
	defer logger.Close()
	
	config := KeyManagerConfig{
		KeyStorePath:    filepath.Join(tempDir, "keys"),
		MasterKeyPath:   filepath.Join(tempDir, "master.key"),
		AutoGenerate:    true,
		KeyRotationDays: 90,
	}
	
	km, err := NewKeyManager(config, logger)
	if err != nil {
		t.Fatalf("Failed to create key manager: %v", err)
	}
	defer km.Close()
	
	// Test key encryption and storage
	testKey := []byte("test-secret-key-12345678901234567890")
	keyID := "test-key-001"
	
	err = km.EncryptAndStoreKey(keyID, testKey, "AES-256")
	if err != nil {
		t.Errorf("Failed to encrypt and store key: %v", err)
	}
	
	// Test key retrieval and decryption
	retrievedKey, err := km.RetrieveAndDecryptKey(keyID)
	if err != nil {
		t.Errorf("Failed to retrieve and decrypt key: %v", err)
	}
	
	if string(retrievedKey) != string(testKey) {
		t.Errorf("Retrieved key doesn't match original. Expected: %s, Got: %s", string(testKey), string(retrievedKey))
	}
	
	// Test key metadata
	metadata, err := km.GetKeyMetadata(keyID)
	if err != nil {
		t.Errorf("Failed to get key metadata: %v", err)
	}
	
	if metadata.KeyID != keyID {
		t.Errorf("Expected key ID %s, got %s", keyID, metadata.KeyID)
	}
	
	if metadata.Algorithm != "AES-256" {
		t.Errorf("Expected algorithm AES-256, got %s", metadata.Algorithm)
	}
	
	if metadata.IsRevoked {
		t.Errorf("Expected key to not be revoked")
	}
}

func TestKeyManager_RevokeKey(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "keymanager_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)
	
	logger, err := logger.NewLogger(config.LoggerConfig{Level: "debug", Format: "text", Output: "stdout"})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}
	defer logger.Close()
	
	config := KeyManagerConfig{
		KeyStorePath:    filepath.Join(tempDir, "keys"),
		MasterKeyPath:   filepath.Join(tempDir, "master.key"),
		AutoGenerate:    true,
		KeyRotationDays: 90,
	}
	
	km, err := NewKeyManager(config, logger)
	if err != nil {
		t.Fatalf("Failed to create key manager: %v", err)
	}
	defer km.Close()
	
	// Create a test key
	testKey := []byte("test-secret-key")
	keyID := "test-key-revoke"
	
	err = km.EncryptAndStoreKey(keyID, testKey, "AES-256")
	if err != nil {
		t.Fatalf("Failed to encrypt and store key: %v", err)
	}
	
	// Revoke the key
	err = km.RevokeKey(keyID)
	if err != nil {
		t.Errorf("Failed to revoke key: %v", err)
	}
	
	// Check metadata
	metadata, err := km.GetKeyMetadata(keyID)
	if err != nil {
		t.Errorf("Failed to get key metadata: %v", err)
	}
	
	if !metadata.IsRevoked {
		t.Errorf("Expected key to be revoked")
	}
	
	if metadata.RevokedAt.IsZero() {
		t.Errorf("Expected revoked time to be set")
	}
	
	// Try to retrieve revoked key
	_, err = km.RetrieveAndDecryptKey(keyID)
	if err == nil {
		t.Errorf("Expected error when retrieving revoked key")
	}
}

func TestKeyManager_RotateKey(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "keymanager_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)
	
	logger, err := logger.NewLogger(config.LoggerConfig{Level: "debug", Format: "text", Output: "stdout"})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}
	defer logger.Close()
	
	config := KeyManagerConfig{
		KeyStorePath:    filepath.Join(tempDir, "keys"),
		MasterKeyPath:   filepath.Join(tempDir, "master.key"),
		AutoGenerate:    true,
		KeyRotationDays: 90,
	}
	
	km, err := NewKeyManager(config, logger)
	if err != nil {
		t.Fatalf("Failed to create key manager: %v", err)
	}
	defer km.Close()
	
	// Create original key
	originalKey := []byte("original-secret-key")
	keyID := "test-key-rotate"
	
	err = km.EncryptAndStoreKey(keyID, originalKey, "AES-256")
	if err != nil {
		t.Fatalf("Failed to encrypt and store original key: %v", err)
	}
	
	// Rotate the key
	newKey := []byte("new-secret-key")
	err = km.RotateKey(keyID, newKey)
	if err != nil {
		t.Errorf("Failed to rotate key: %v", err)
	}
	
	// Check that original key is revoked
	originalMetadata, err := km.GetKeyMetadata(keyID)
	if err != nil {
		t.Errorf("Failed to get original key metadata: %v", err)
	}
	
	if !originalMetadata.IsRevoked {
		t.Errorf("Expected original key to be revoked")
	}
	
	// Check that new key exists and is active
	newKeyID := keyID + "_v2"
	newMetadata, err := km.GetKeyMetadata(newKeyID)
	if err != nil {
		t.Errorf("Failed to get new key metadata: %v", err)
	}
	
	if newMetadata.IsRevoked {
		t.Errorf("Expected new key to not be revoked")
	}
	
	if newMetadata.Version != 2 {
		t.Errorf("Expected new key version to be 2, got %d", newMetadata.Version)
	}
	
	// Retrieve new key and verify
	retrievedKey, err := km.RetrieveAndDecryptKey(newKeyID)
	if err != nil {
		t.Errorf("Failed to retrieve new key: %v", err)
	}
	
	if string(retrievedKey) != string(newKey) {
		t.Errorf("Retrieved new key doesn't match. Expected: %s, Got: %s", string(newKey), string(retrievedKey))
	}
}

func TestKeyManager_SecretKeyOperations(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "keymanager_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)
	
	logger, err := logger.NewLogger(config.LoggerConfig{Level: "debug", Format: "text", Output: "stdout"})
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}
	defer logger.Close()
	
	config := KeyManagerConfig{
		KeyStorePath:    filepath.Join(tempDir, "keys"),
		MasterKeyPath:   filepath.Join(tempDir, "master.key"),
		AutoGenerate:    true,
		KeyRotationDays: 90,
	}
	
	km, err := NewKeyManager(config, logger)
	if err != nil {
		t.Fatalf("Failed to create key manager: %v", err)
	}
	defer km.Close()
	
	collectorID := "test-collector-001"
	
	// Generate secret key
	secretKey, err := km.GenerateSecretKey(collectorID)
	if err != nil {
		t.Errorf("Failed to generate secret key: %v", err)
	}
	
	if secretKey == "" {
		t.Errorf("Expected non-empty secret key")
	}
	
	// Retrieve secret key
	retrievedKey, err := km.GetSecretKey(collectorID)
	if err != nil {
		t.Errorf("Failed to get secret key: %v", err)
	}
	
	if retrievedKey != secretKey {
		t.Errorf("Retrieved secret key doesn't match generated key")
	}
	
	// Rotate secret key
	newSecretKey, err := km.RotateSecretKey(collectorID)
	if err != nil {
		t.Errorf("Failed to rotate secret key: %v", err)
	}
	
	if newSecretKey == secretKey {
		t.Errorf("New secret key should be different from original")
	}
	
	// Verify old key is revoked and new key is active
	keys := km.ListKeys()
	
	foundOldKey := false
	foundNewKey := false
	
	for keyID, metadata := range keys {
		if keyID == "collector_"+collectorID+"_secret" {
			foundOldKey = true
			if !metadata.IsRevoked {
				t.Errorf("Expected old secret key to be revoked")
			}
		} else if keyID == "collector_"+collectorID+"_secret_v2" {
			foundNewKey = true
			if metadata.IsRevoked {
				t.Errorf("Expected new secret key to not be revoked")
			}
		}
	}
	
	if !foundOldKey {
		t.Errorf("Expected to find old secret key in key list")
	}
	
	if !foundNewKey {
		t.Errorf("Expected to find new secret key in key list")
	}
}