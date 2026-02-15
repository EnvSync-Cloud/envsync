package domain

import "time"

// EnvironmentVariable represents a single environment variable
type EnvironmentVariable struct {
	Key   string
	Value string
}

// EnvironmentSync represents the sync state between local and remote environments
type EnvironmentSync struct {
	Local      map[string]string
	Remote     map[string]EnvironmentVariable
	ToAdd      []EnvironmentVariable
	ToUpdate   []EnvironmentVariable
	ToDelete   []string
	LastSynced time.Time
}

// SyncConfig represents the configuration needed for syncing
type SyncConfig struct {
	AppID     string `toml:"app_id"`
	EnvTypeID string `toml:"env_type_id"`
}

// NewEnvironmentSync creates a new EnvironmentSync instance
func NewEnvironmentSync(local map[string]string, remote map[string]EnvironmentVariable) *EnvironmentSync {
	return &EnvironmentSync{
		Local:      local,
		Remote:     remote,
		ToAdd:      make([]EnvironmentVariable, 0),
		ToUpdate:   make([]EnvironmentVariable, 0),
		ToDelete:   make([]string, 0),
		LastSynced: time.Now(),
	}
}

// CalculateDiff determines which variables need to be added, updated, or deleted
func (es *EnvironmentSync) CalculateDiff() {
	// Reset diff slices
	es.ToAdd = make([]EnvironmentVariable, 0)
	es.ToUpdate = make([]EnvironmentVariable, 0)
	es.ToDelete = make([]string, 0)

	// Find variables to add or update
	for key, localValue := range es.Local {
		if remoteVar, exists := es.Remote[key]; exists {
			// Variable exists in both - check if it needs updating
			if remoteVar.Value != localValue {
				es.ToUpdate = append(es.ToUpdate, EnvironmentVariable{
					Key:   key,
					Value: localValue,
				})
			}
		} else {
			// Variable only exists locally - needs to be added
			es.ToAdd = append(es.ToAdd, EnvironmentVariable{
				Key:   key,
				Value: localValue,
			})
		}
	}

	// Find variables to delete (only in remote)
	for key := range es.Remote {
		if _, exists := es.Local[key]; !exists {
			es.ToDelete = append(es.ToDelete, key)
		}
	}
}

// HasChanges returns true if there are any differences between local and remote
func (es *EnvironmentSync) HasChanges() bool {
	return len(es.ToAdd) > 0 || len(es.ToUpdate) > 0 || len(es.ToDelete) > 0
}

// ToMap converts the environment variables to a simple key-value map
func (es *EnvironmentSync) ToMap() map[string]string {
	result := make(map[string]string)
	for key, value := range es.Remote {
		result[key] = value.Value
	}
	return result
}

// GetSummary returns a summary of the changes to be made
func (es *EnvironmentSync) GetSummary() SyncSummary {
	return SyncSummary{
		AddCount:    len(es.ToAdd),
		UpdateCount: len(es.ToUpdate),
		DeleteCount: len(es.ToDelete),
		LastSynced:  es.LastSynced,
	}
}

// SyncSummary represents a summary of sync changes
type SyncSummary struct {
	AddCount    int
	UpdateCount int
	DeleteCount int
	LastSynced  time.Time
}
