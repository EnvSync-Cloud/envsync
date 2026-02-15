package sync

import "errors"

// Sync use case errors
var (
	// Validation errors
	ErrNoSyncTargets     = errors.New("no sync targets provided")
	ErrEmptySyncKey      = errors.New("sync key cannot be empty")
	ErrInvalidSyncKey    = errors.New("invalid sync key")
	ErrEmptySyncSource   = errors.New("sync source cannot be empty")
	ErrInvalidSyncSource = errors.New("invalid sync source")

	// File system errors
	ErrSyncFileNotFound   = errors.New("sync file not found")
	ErrSyncFileRead       = errors.New("failed to read sync file")
	ErrSyncFileWrite      = errors.New("failed to write sync file")
	ErrSyncFilePermission = errors.New("insufficient permissions to access sync file")
	ErrSyncFileCorrupted  = errors.New("sync file is corrupted or invalid")

	// Business logic errors
	ErrSyncNotInitialized = errors.New("sync is not initialized")
	ErrSyncAlreadyExists  = errors.New("sync already exists")
	ErrSyncLocked         = errors.New("sync is locked and cannot be modified")
	ErrSyncBackupFailed   = errors.New("failed to create sync backup")

	// External service errors
	ErrSyncServiceUnavailable = errors.New("sync service is currently unavailable")
	ErrSyncValidationFailed   = errors.New("sync validation failed")
	ErrSyncFailed             = errors.New("failed to sync")
)

// Error types for structured error handling
type SyncError struct {
	Code    string
	Message string
	Key     string
	Cause   error
}

func (e SyncError) Error() string {
	if e.Key != "" {
		if e.Cause != nil {
			return e.Message + " for key '" + e.Key + "': " + e.Cause.Error()
		}
		return e.Message + " for key '" + e.Key + "'"
	}

	if e.Cause != nil {
		return e.Message + ": " + e.Cause.Error()
	}
	return e.Message
}

func (e SyncError) Unwrap() error {
	return e.Cause
}

// Error codes
const (
	SyncErrorCodeValidation   = "VALIDATION_ERROR"
	SyncErrorCodeFileSystem   = "FILE_SYSTEM_ERROR"
	SyncErrorCodePermission   = "PERMISSION_ERROR"
	SyncErrorCodeNotFound     = "SYNC_NOT_FOUND"
	SyncErrorCodeCorrupted    = "SYNC_CORRUPTED"
	SyncErrorCodeServiceError = "SERVICE_ERROR"
)

// Helper functions to create structured errors
func NewValidationError(message, key string, cause error) *SyncError {
	return &SyncError{
		Code:    SyncErrorCodeValidation,
		Message: message,
		Key:     key,
		Cause:   cause,
	}
}

func NewFileSystemError(message string, cause error) *SyncError {
	return &SyncError{
		Code:    SyncErrorCodeFileSystem,
		Message: message,
		Cause:   cause,
	}
}

func NewPermissionError(message string, cause error) *SyncError {
	return &SyncError{
		Code:    SyncErrorCodePermission,
		Message: message,
		Cause:   cause,
	}
}

func NewNotFoundError(message string, cause error) *SyncError {
	return &SyncError{
		Code:    SyncErrorCodeNotFound,
		Message: message,
		Cause:   cause,
	}
}

func NewCorruptedError(message string, cause error) *SyncError {
	return &SyncError{
		Code:    SyncErrorCodeCorrupted,
		Message: message,
		Cause:   cause,
	}
}

func NewServiceError(message string, cause error) *SyncError {
	return &SyncError{
		Code:    SyncErrorCodeServiceError,
		Message: message,
		Cause:   cause,
	}
}

// Validation severity levels
const (
	ValidationSeverityError   = "error"
	ValidationSeverityWarning = "warning"
	ValidationSeverityInfo    = "info"
)

// Common validation messages
const (
	MsgSyncSourceRequired = "Sync source is required"
	MsgSyncKeyRequired    = "Sync key is required"
	MsgSyncTargetRequired = "Sync target is required"
	MsgSyncKeyInvalid     = "Sync key format is invalid"
	MsgSyncIncomplete     = "Sync configuration is incomplete"
	MsgSyncOutdated       = "Sync configuration format appears to be outdated"
)

// Suggestion messages
const (
	SuggestSetSyncSource = "Use 'envsync sync set source=<source>' to set the sync source"
	SuggestSetSyncKey    = "Use 'envsync sync set key=<key>' to set a sync key"
	SuggestValidateSync  = "Run 'envsync sync validate' to check your sync configuration"
	SuggestRunSync       = "Run 'envsync sync run' to synchronize your data"
)
