package repository

import mgmtclient "github.com/envsync-cloud/envsync-management-go-sdk/sdk/client"

// CreateManagementSDKClient is the exported wrapper for createManagementSDKClient.
// It initializes and returns a new Management API SDK client.
func CreateManagementSDKClient() *mgmtclient.Client {
	return createManagementSDKClient()
}
