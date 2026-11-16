package requests

type BatchSyncEnvRequest struct {
	AppID       string        `json:"app_id,omitempty"`
	AppName     string        `json:"app_name,omitempty"`
	EnvTypeID   string        `json:"env_type_id,omitempty"`
	EnvTypeName string        `json:"env_type_name,omitempty"`
	Envs        []EnvVariable `json:"envs"`
}

type BatchDeleteRequest struct {
	AppID       string   `json:"app_id,omitempty"`
	AppName     string   `json:"app_name,omitempty"`
	EnvTypeID   string   `json:"env_type_id,omitempty"`
	EnvTypeName string   `json:"env_type_name,omitempty"`
	Keys        []string `json:"keys"`
}

type EnvVariable struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}
