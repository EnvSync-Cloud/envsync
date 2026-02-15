package requests

type RevelRequest struct {
	AppID     string   `json:"app_id"`
	EnvTypeID string   `json:"env_type_id"`
	Keys      []string `json:"keys"`
}

type GetAllRequest struct {
	AppID     string `json:"app_id"`
	EnvTypeID string `json:"env_type_id"`
}
