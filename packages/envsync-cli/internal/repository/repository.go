package repository

import (
	"os"

	"github.com/EnvSync-Cloud/envsync-cli/internal/config"
	"resty.dev/v3"
)

// createHTTPClient initializes and returns a new HTTP client with proper authentication
// and configuration for API requests.
func createHTTPClient() *resty.Client {
	// Initialize variables for authentication token and application configuration
	var cfg config.AppConfig
	var cliCmd string

	// Check if API key is provided as an environment variable
	apiKey, hasAPIKey := os.LookupEnv("API_KEY")

	// Always load config to get BackendURL and potentially AccessToken
	cfg = config.New()

	// get the args passed to the CLI
	if len(os.Args) > 1 {
		cliCmd = os.Args[1]
	}

	// Create and configure a new REST client
	client := resty.New().
		SetDisableWarn(true).
		SetBaseURL(cfg.BackendURL).
		SetHeader("Content-Type", "application/json").
		SetHeader("X-CLI-CMD", cliCmd)

	// Set authentication headers based on available credentials
	if hasAPIKey && apiKey != "" {
		// Priority 1: Use API key from environment variable
		client.SetHeader("X-API-Key", apiKey)
	} else if cfg.AccessToken != "" {
		// Priority 2: Use JWT token from config as Bearer token
		client.SetHeader("Authorization", "Bearer "+cfg.AccessToken)
	}

	return client
}
