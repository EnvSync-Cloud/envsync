package formatters

import (
	"fmt"
	"io"
	"strings"
)

type ConfigFormatter struct {
	*BaseFormatter
}

// NewConfigFormatter creates a new ConfigFormatter instance
func NewConfigFormatter() *ConfigFormatter {
	base := NewBaseFormatter()
	return &ConfigFormatter{
		BaseFormatter: base,
	}
}

// FormatSingleValue formats a single config value
func (f *ConfigFormatter) FormatSingleValue(writer io.Writer, key, value string) error {
	var output string

	switch strings.ToLower(key) {
	case "backend_url":
		if value == "" {
			value = "<not set>"
		}
		output = fmt.Sprintf("🌐 backend_url: %s\n", value)
	case "otel_config.endpoint":
		if value == "" {
			value = "<not set>"
		}
		output = fmt.Sprintf("📡 otel_config.endpoint: %s\n", value)
	case "otel_config.service_name":
		if value == "" {
			value = "<not set>"
		}
		output = fmt.Sprintf("📝 otel_config.service_name: %s\n", value)
	case "otel_config.disabled":
		if value == "" {
			value = "<not set>"
		}
		output = fmt.Sprintf("🔌 otel_config.disabled: %s\n", value)
	default:
		output = fmt.Sprintf("❓ %s: %s\n", key, value)
	}

	_, err := writer.Write([]byte(output))
	return err
}

// FormatKeyValueList formats a list of key-value pairs
func (f *ConfigFormatter) FormatKeyValueList(writer io.Writer, title string, items map[string]string) error {
	if len(items) == 0 {
		return nil
	}

	header := fmt.Sprintf("📋 %s:\n", title)
	if _, err := writer.Write([]byte(header)); err != nil {
		return err
	}

	for key, value := range items {
		line := fmt.Sprintf("   • %s: %s\n", key, value)
		if _, err := writer.Write([]byte(line)); err != nil {
			return err
		}
	}

	return nil
}
