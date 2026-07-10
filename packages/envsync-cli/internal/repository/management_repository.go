package repository

import (
	"net/http"
	"os"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/config"
	mgmtclient "github.com/envsync-cloud/envsync-management-go-sdk/sdk/client"
	mgmtoption "github.com/envsync-cloud/envsync-management-go-sdk/sdk/option"
)

// createManagementSDKClient initializes and returns a new Management API SDK client.
// The management API runs on a different port (4001) than the core API (4000).
func createManagementSDKClient() *mgmtclient.Client {
	cfg := config.New()
	apiKey, hasAPIKey := os.LookupEnv("API_KEY")

	var cliCmd string
	if len(os.Args) > 1 {
		cliCmd = os.Args[1]
	}

	headers := http.Header{}
	headers.Set("Content-Type", "application/json")
	headers.Set("X-CLI-CMD", cliCmd)

	// Derive management URL from backend URL
	// Default: http://localhost:4000 -> http://localhost:4001
	managementURL := deriveManagementURL(cfg.BackendURL)

	opts := []mgmtoption.RequestOption{
		mgmtoption.WithBaseURL(managementURL),
		mgmtoption.WithHTTPHeader(headers),
		mgmtoption.WithHTTPClient(&http.Client{
			Transport: otelhttp.NewTransport(http.DefaultTransport),
		}),
	}

	if hasAPIKey && apiKey != "" {
		opts = append(opts, mgmtoption.WithApiKey(apiKey))
	} else if cfg.AccessToken != "" {
		opts = append(opts, mgmtoption.WithToken(cfg.AccessToken))
	}

	return mgmtclient.NewClient(opts...)
}

// deriveManagementURL converts a core API URL to the management API URL.
// Convention: port 4000 -> port 4001, or uses ENVSYNC_MANAGEMENT_API_URL env var.
func deriveManagementURL(backendURL string) string {
	if mgmtURL := os.Getenv("ENVSYNC_MANAGEMENT_API_URL"); mgmtURL != "" {
		return mgmtURL
	}

	// Default: replace :4000 with :4001 in the backend URL
	// If no port found, append :4001
	if backendURL == "" {
		return "http://localhost:4001"
	}

	// Simple port replacement
	url := backendURL
	// Replace common port patterns
	for _, replacement := range []struct{ old, new string }{
		{":4000", ":4001"},
		{":8600", ":4001"},
	} {
		if len(url) >= len(replacement.old) {
			for i := 0; i <= len(url)-len(replacement.old); i++ {
				if url[i:i+len(replacement.old)] == replacement.old {
					return url[:i] + replacement.new + url[i+len(replacement.old):]
				}
			}
		}
	}

	// If no known port found, assume localhost:4001
	return "http://localhost:4001"
}
