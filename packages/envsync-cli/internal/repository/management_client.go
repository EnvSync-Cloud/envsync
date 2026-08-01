package repository

import (
	mgmtclient "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/client"
)

// GetManagementClient returns the unified API SDK client (core + manage paths).
func GetManagementClient() *mgmtclient.Client {
	return createManagementSDKClient()
}
