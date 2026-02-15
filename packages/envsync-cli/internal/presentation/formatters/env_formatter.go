package formatters

type EnvFormatter struct {
	*BaseFormatter
}

func NewEnvFormatter() *EnvFormatter {
	base := NewBaseFormatter()
	return &EnvFormatter{
		BaseFormatter: base,
	}
}
