package repository

import (
	mgmtclient "github.com/envsync-cloud/envsync-management-go-sdk/sdk/client"
)

// GetManagementClient returns a configured management API SDK client.
func GetManagementClient() *mgmtclient.Client {
	return createManagementSDKClient()
}
