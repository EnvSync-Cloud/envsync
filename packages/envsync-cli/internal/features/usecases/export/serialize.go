package export

import (
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
)

func SerializeResult(result ExportResult) (string, error) {
	switch result.Format {
	case "dotenv":
		return serializeDotenv(result.Environment), nil
	case "json":
		return serializeExportJSON(result)
	default:
		return "", fmt.Errorf("unsupported format %q", result.Format)
	}
}

func serializeDotenv(values map[string]string) string {
	keys := sortedKeys(values)
	var builder strings.Builder

	for _, key := range keys {
		builder.WriteString(key)
		builder.WriteByte('=')
		builder.WriteString(formatDotenvValue(values[key]))
		builder.WriteByte('\n')
	}

	return builder.String()
}

func serializeExportJSON(result ExportResult) (string, error) {
	var builder strings.Builder
	builder.WriteString("{")

	writeJSONField := func(name string, rawValue string, first *bool) {
		if !*first {
			builder.WriteByte(',')
		}
		*first = false
		builder.WriteString(strconv.Quote(name))
		builder.WriteByte(':')
		builder.WriteString(rawValue)
	}

	first := true
	writeJSONField("resolved_app_id", strconv.Quote(result.ResolvedAppID), &first)
	writeJSONField("resolved_env_type_id", strconv.Quote(result.ResolvedEnvTypeID), &first)
	writeJSONField("resolved_env_type_name", strconv.Quote(result.ResolvedEnvTypeName), &first)

	secretsEnabledJSON, err := json.Marshal(result.SecretsEnabled)
	if err != nil {
		return "", err
	}
	writeJSONField("secrets_enabled", string(secretsEnabledJSON), &first)

	managedSecretsJSON, err := json.Marshal(result.ManagedSecrets)
	if err != nil {
		return "", err
	}
	writeJSONField("managed_secrets", string(managedSecretsJSON), &first)

	writeJSONField("environment", serializeJSONMap(result.Environment), &first)
	builder.WriteString("}\n")

	return builder.String(), nil
}

func serializeJSONMap(values map[string]string) string {
	keys := sortedKeys(values)
	var builder strings.Builder
	builder.WriteByte('{')

	for idx, key := range keys {
		if idx > 0 {
			builder.WriteByte(',')
		}
		builder.WriteString(strconv.Quote(key))
		builder.WriteByte(':')
		builder.WriteString(strconv.Quote(values[key]))
	}

	builder.WriteByte('}')
	return builder.String()
}

func sortedKeys(values map[string]string) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func formatDotenvValue(value string) string {
	if strings.ContainsAny(value, "\n\r") {
		return strconv.Quote(value)
	}

	if strings.ContainsAny(value, " \t#\"'`") || strings.HasPrefix(value, " ") || strings.HasSuffix(value, " ") {
		return strconv.Quote(value)
	}

	return value
}
