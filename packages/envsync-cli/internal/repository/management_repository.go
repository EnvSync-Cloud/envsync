package repository

import (
	sdkclient "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/client"
)

// createManagementSDKClient returns the unified API client.
// Manage routes share BackendURL under /api/v1/manage/... (no second process).
func createManagementSDKClient() *sdkclient.Client {
	return createSDKClient()
}
