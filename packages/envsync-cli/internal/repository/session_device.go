package repository

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

// RegisterDeviceSession records the CLI device for an access token before later API calls use it.
func RegisterDeviceSession(ctx context.Context, backendURL, accessToken string) error {
	if strings.TrimSpace(accessToken) == "" {
		return errors.New("device session requires an access token")
	}
	if strings.TrimSpace(backendURL) == "" {
		return errors.New("device session requires the API URL")
	}

	endpoint, err := url.JoinPath(strings.TrimRight(backendURL, "/"), "api/access/cli/session")
	if err != nil {
		return fmt.Errorf("failed to build device session URL: %w", err)
	}

	proof, err := sessionProof("POST", endpoint, accessToken)
	if err != nil {
		return fmt.Errorf("failed to sign device session: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, nil)
	if err != nil {
		return fmt.Errorf("failed to build device session request: %w", err)
	}
	req.Header.Set("Authorization", "DPoP "+accessToken)
	req.Header.Set("DPoP", proof)

	client := &http.Client{
		Timeout:   10 * time.Second,
		Transport: telemetry.NewInstrumentedTransport(http.DefaultTransport),
	}
	res, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to register device session: %w", err)
	}
	defer res.Body.Close()
	_, _ = io.Copy(io.Discard, res.Body)

	if res.StatusCode != http.StatusOK && res.StatusCode != http.StatusNoContent {
		return fmt.Errorf("device session registration failed: %d", res.StatusCode)
	}
	return nil
}
