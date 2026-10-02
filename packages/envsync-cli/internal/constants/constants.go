package constants

const (
	DefaultProjectConfig = "envsyncrc.toml"
	LoggerKey            = "logger"
	TelemetryShutdownKey = "telemetry_shutdown"
	RootSpanKey          = "root_span"
)

// Environment variable keys
const (
	EnvBackendURL   = "ENVSYNC_BACKEND_URL"
	EnvOTELURL      = "ENVSYNC_TELEMETRY_URL"
	EnvOTELService  = "ENVSYNC_OTEL_SERVICE"
	EnvOTELDisabled = "ENVSYNC_OTEL_DISABLED"
)

const (
	BackendURL = "https://api.envsync.cloud"

	OTELEndpoint = "https://t.envsync.cloud/obs/v1/traces"
	OTELService  = "envsync-cli"
	OTELDisabled = false
)
