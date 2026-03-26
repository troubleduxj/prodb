package migrations

import (
	"fmt"
	"log"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// MigrateCollectorAgentID fixes the agent_id column migration issue
// It adds the agent_id column, populates it for existing records, and adds constraints
func MigrateCollectorAgentID(db *gorm.DB) error {
	fmt.Println("Running migration: Fix collector agent_id...")

	// Step 1: Check if agent_id column exists
	var columnExists bool
	err := db.Raw(`
		SELECT EXISTS (
			SELECT 1 
			FROM information_schema.columns 
			WHERE table_name = 'collectors' AND column_name = 'agent_id'
		)
	`).Scan(&columnExists).Error
	if err != nil {
		return fmt.Errorf("failed to check if agent_id column exists: %w", err)
	}

	if columnExists {
		fmt.Println("  - agent_id column already exists, checking for null values...")
		
		// Step 2: Check for null values
		var nullCount int64
		err = db.Raw(`SELECT COUNT(*) FROM collectors WHERE agent_id IS NULL`).Scan(&nullCount).Error
		if err != nil {
			return fmt.Errorf("failed to count null agent_id values: %w", err)
		}

		if nullCount > 0 {
			fmt.Printf("  - Found %d records with null agent_id, generating values...\n", nullCount)
			
			// Step 3: Update null values with generated agent_id
			err = db.Exec(`
				UPDATE collectors 
				SET agent_id = 'collector-' || id::text 
				WHERE agent_id IS NULL
			`).Error
			if err != nil {
				return fmt.Errorf("failed to update null agent_id values: %w", err)
			}
			fmt.Printf("  - Updated %d records with generated agent_id\n", nullCount)
		} else {
			fmt.Println("  - No null agent_id values found")
		}

		// Step 4: Check if unique constraint exists
		var constraintExists bool
		err = db.Raw(`
			SELECT EXISTS (
				SELECT 1 
				FROM pg_indexes 
				WHERE indexname = 'idx_collectors_agent_id'
			)
		`).Scan(&constraintExists).Error
		if err != nil {
			return fmt.Errorf("failed to check if unique constraint exists: %w", err)
		}

		if !constraintExists {
			fmt.Println("  - Adding unique index on agent_id...")
			err = db.Exec(`CREATE UNIQUE INDEX idx_collectors_agent_id ON collectors(agent_id)`).Error
			if err != nil {
				// Try to drop duplicates if any exist
				log.Printf("Warning: Could not create unique index, attempting to handle duplicates: %v", err)
				
				// Find and fix duplicates
				err = db.Exec(`
					WITH duplicates AS (
						SELECT id, agent_id,
							   ROW_NUMBER() OVER (PARTITION BY agent_id ORDER BY created_at) as rn
						FROM collectors
						WHERE agent_id IN (
							SELECT agent_id 
							FROM collectors 
							GROUP BY agent_id 
							HAVING COUNT(*) > 1
						)
					)
					UPDATE collectors 
					SET agent_id = 'collector-' || id::text || '-' || floor(random() * 1000)::text
					WHERE id IN (SELECT id FROM duplicates WHERE rn > 1)
				`).Error
				if err != nil {
					return fmt.Errorf("failed to fix duplicate agent_id values: %w", err)
				}
				
				// Try creating the index again
				err = db.Exec(`CREATE UNIQUE INDEX idx_collectors_agent_id ON collectors(agent_id)`).Error
				if err != nil {
					return fmt.Errorf("failed to create unique index after fixing duplicates: %w", err)
				}
			}
			fmt.Println("  - Unique index added successfully")
		} else {
			fmt.Println("  - Unique index already exists")
		}

	} else {
		fmt.Println("  - Adding agent_id column...")
		
		// Add column as nullable first
		err = db.Exec(`ALTER TABLE collectors ADD COLUMN agent_id varchar(100)`).Error
		if err != nil {
			return fmt.Errorf("failed to add agent_id column: %w", err)
		}
		fmt.Println("  - Column added successfully")
		
		// Generate agent_id for existing records
		err = db.Exec(`
			UPDATE collectors 
			SET agent_id = 'collector-' || id::text 
			WHERE agent_id IS NULL
		`).Error
		if err != nil {
			return fmt.Errorf("failed to populate agent_id values: %w", err)
		}
		fmt.Println("  - Populated agent_id for existing records")
		
		// Add unique index
		err = db.Exec(`CREATE UNIQUE INDEX idx_collectors_agent_id ON collectors(agent_id)`).Error
		if err != nil {
			return fmt.Errorf("failed to create unique index: %w", err)
		}
		fmt.Println("  - Unique index added successfully")
	}

	fmt.Println("Migration completed: collector agent_id fixed")
	return nil
}

// GenerateAgentID generates a unique agent ID
func GenerateAgentID() string {
	return "collector-" + uuid.New().String()[:8]
}
