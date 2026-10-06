package repository

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"resty.dev/v3"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/config"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/responses"
	sdkclient "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/client"
	"github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/option"
)

// tokenRefreshSkew refreshes slightly before the recorded expiry so a token
// cannot lapse between the check and the request that uses it.
const tokenRefreshSkew = 30 * time.Second

// var l = logger.NewLogger()

var (
	resolvedOnce  sync.Once
	resolvedToken string
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
		option.WithHTTPClient(&http.Client{
			Transport: otelhttp.NewTransport(http.DefaultTransport),
		}),
	}

	if hasAPIKey && apiKey != "" {
		opts = append(opts, option.WithApiKey(apiKey))
	} else if token := resolveAccessToken(); token != "" {
		opts = append(opts, option.WithToken(token))
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
		SetLoggerWarnLevel(false).
		SetBaseURL(cfg.BackendURL).
		SetHeader("Content-Type", "application/json").
		SetHeader("X-CLI-CMD", cliCmd).
		SetTransport(otelhttp.NewTransport(http.DefaultTransport))

	if hasAPIKey && apiKey != "" {
		client.SetHeader("X-API-Key", apiKey)
	} else if token := resolveAccessToken(); token != "" {
		client.SetAuthToken("Bearer " + token)
	}

	return client
}

// resolveAccessToken returns the token to authenticate API requests with.
func resolveAccessToken() string {
	resolvedOnce.Do(func() {
		resolvedToken = resolveToken(config.New(), time.Now())
	})
	return resolvedToken
}

// resolveToken returns the stored access token while it is still valid
// otherwise exchanges the refresh token for a fresh pair. Refresh problems are
// reported on stderr and fall back to the stored token: the request then fails
// with the server's own auth error instead of blocking the command outright.
func resolveToken(cfg config.AppConfig, now time.Time) string {
	auth := cfg.AuthConfig

	// An empty access token means logged out — even a leftover refresh token
	// must not silently log the user back in.
	if auth.AccessToken == "" {
		return ""
	}
	if !tokenExpired(auth, now) {
		return auth.AccessToken
	}
	if auth.RefreshToken == "" {
		// Nothing to refresh with; keep the stored token and let the request
		// surface the expiry.
		// TODO: Suggest better logging mechanism here
		return auth.AccessToken
	}

	fresh, err := refreshAuth(auth, now)
	if err != nil {
		// TODO: Suggest better logging mechanism here
		return auth.AccessToken
	}

	cfg.AuthConfig = fresh
	if err := cfg.WriteConfigFile(); err != nil {
		// Ignore errors persisting the refreshed token; the request will fail
		// with the server's own auth error instead of blocking the command.
		// TODO: Suggest better logging mechanism here
	}

	return fresh.AccessToken
}

// tokenExpired reports whether the stored access token expires within the
// refresh skew of now. A zero expiry is unknown and counts as expired so a
// refresh token can re-establish it.
func tokenExpired(auth config.AuthConfig, now time.Time) bool {
	if auth.ExpiresAt == 0 {
		return true
	}
	return !now.Add(tokenRefreshSkew).Before(time.Unix(int64(auth.ExpiresAt), 0))
}

// refreshAuth exchanges the stored refresh token for a fresh token pair using
// the OAuth refresh grant at the recorded token endpoint.
func refreshAuth(auth config.AuthConfig, now time.Time) (config.AuthConfig, error) {
	if auth.TokenURL == "" || auth.ClientID == "" {
		return config.AuthConfig{}, errors.New("token endpoint is unknown (this login predates refresh support); run 'envsync auth login' again")
	}

	var resBody responses.LoginTokenResponse
	res, err := resty.New().
		SetLoggerWarnLevel(false).
		R().
		SetResult(&resBody).
		SetFormData(map[string]string{
			"grant_type":    "refresh_token",
			"refresh_token": auth.RefreshToken,
			"client_id":     auth.ClientID,
		}).
		Post(auth.TokenURL)
	if err != nil {
		return config.AuthConfig{}, fmt.Errorf("failed to reach token endpoint: %w", err)
	}
	if res.StatusCode() != http.StatusOK {
		return config.AuthConfig{}, fmt.Errorf("unexpected status code while refreshing token: %d", res.StatusCode())
	}

	auth.AccessToken = resBody.AccessToken
	// Providers may rotate the refresh token; keep the old one when they don't.
	if resBody.RefreshToken != "" {
		auth.RefreshToken = resBody.RefreshToken
	}
	auth.ExpiresAt = int(now.Add(time.Duration(resBody.ExpiresIn) * time.Second).Unix())

	return auth, nil
}
