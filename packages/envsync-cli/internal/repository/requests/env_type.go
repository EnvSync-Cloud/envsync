package requests

type EnvTypeRequest struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	AppID       string `json:"app_id"`
	IsDefault   bool   `json:"is_default"`
	IsProtected bool   `json:"is_protected"`
	Color       string `json:"color"`
}
