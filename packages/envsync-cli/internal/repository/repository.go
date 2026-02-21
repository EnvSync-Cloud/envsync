package repository

import (
	"net/http"
	"os"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/config"
	sdkclient "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/client"
	"github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/option"
	"resty.dev/v3"
)

// createSDKClient initializes and returns a new SDK client with proper authentication
// and configuration for API requests.
func createSDKClient() *sdkclient.Client {
	cfg := config.New()
	apiKey, hasAPIKey := os.LookupEnv("API_KEY")

	var cliCmd string
	if len(os.Args) > 1 {
		cliCmd = os.Args[1]
	}

	headers := http.Header{}
	headers.Set("Content-Type", "application/json")
	headers.Set("X-CLI-CMD", cliCmd)

	opts := []option.RequestOption{
		option.WithBaseURL(cfg.BackendURL),
		option.WithHTTPHeader(headers),
	}

	if hasAPIKey && apiKey != "" {
		opts = append(opts, option.WithApiKey(apiKey))
	} else if cfg.AccessToken != "" {
		opts = append(opts, option.WithToken(cfg.AccessToken))
	}

	return sdkclient.NewClient(opts...)
}

// createHTTPClient initializes and returns a new HTTP client with proper authentication
// and configuration for API requests. Used only for auth login flows.
func createHTTPClient() *resty.Client {
	var cfg config.AppConfig
	var cliCmd string

	apiKey, hasAPIKey := os.LookupEnv("API_KEY")

	cfg = config.New()

	if len(os.Args) > 1 {
		cliCmd = os.Args[1]
	}

	client := resty.New().
		SetDisableWarn(true).
		SetBaseURL(cfg.BackendURL).
		SetHeader("Content-Type", "application/json").
		SetHeader("X-CLI-CMD", cliCmd)

	if hasAPIKey && apiKey != "" {
		client.SetHeader("X-API-Key", apiKey)
	} else if cfg.AccessToken != "" {
		client.SetHeader("Authorization", "Bearer "+cfg.AccessToken)
	}

	return client
}
