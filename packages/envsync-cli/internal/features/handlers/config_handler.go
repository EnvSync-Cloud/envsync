package handlers

import (
	"context"
	"errors"
	"strings"

	"github.com/urfave/cli/v3"

	configUseCase "github.com/EnvSync-Cloud/envsync-cli/internal/features/usecases/config"
	"github.com/EnvSync-Cloud/envsync-cli/internal/presentation/formatters"
)

type ConfigHandler struct {
	setUseCase   configUseCase.SetConfigUseCase
	getUseCase   configUseCase.GetConfigUseCase
	resetUseCase configUseCase.ResetConfigUseCase
	formatter    *formatters.ConfigFormatter
}

func NewConfigHandler(
	setUseCase configUseCase.SetConfigUseCase,
	getUseCase configUseCase.GetConfigUseCase,
	resetUseCase configUseCase.ResetConfigUseCase,
	formatter *formatters.ConfigFormatter,
) *ConfigHandler {
	return &ConfigHandler{
		setUseCase:   setUseCase,
		getUseCase:   getUseCase,
		resetUseCase: resetUseCase,
		formatter:    formatter,
	}
}

func (h *ConfigHandler) Set(ctx context.Context, cmd *cli.Command) error {
	args := cmd.Args()

	if args.Len() < 1 {
		return h.formatUseCaseError(cmd, errors.New("No arguments provided. Usage: envsync config set key=value"))
	}

	// Parse key=value pairs from arguments
	keyValuePairs, err := h.extractKeyValuePairs(args)
	if err != nil {
		return h.formatUseCaseError(cmd, err)
	}

	// Build request
	req := configUseCase.SetConfigRequest{
		KeyValuePairs: keyValuePairs,
	}

	// Execute use case
	if err := h.setUseCase.Execute(ctx, req); err != nil {
		return h.formatUseCaseError(cmd, err)
	}

	if cmd.Bool("json") {
		// If JSON output is requested, format the entire config
		jsonOutput := map[string]any{
			"message": "Configuration updated successfully!",
			"config":  req.KeyValuePairs,
		}
		return h.formatter.FormatJSON(cmd.Writer, jsonOutput)
	}

	// Format success message
	return h.formatter.FormatSuccess(cmd.Writer, "Configuration updated successfully!")
}

func (h *ConfigHandler) Get(ctx context.Context, cmd *cli.Command) error {
	args := cmd.Args()
	keys := make([]string, args.Len())
	for i := 0; i < args.Len(); i++ {
		keys[i] = strings.TrimSpace(args.Get(i))
	}

	// Build request
	req := configUseCase.GetConfigRequest{
		Keys: keys,
	}

	// Execute use case
	response, err := h.getUseCase.Execute(ctx, req)
	if err != nil {
		return h.formatUseCaseError(cmd, err)
	}

	// Format output based on requested format
	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, response.Config)
	}

	// If specific keys were requested, show only those
	if len(keys) > 0 {
		for _, key := range keys {
			if value, exists := response.Values[key]; exists {
				if cmd.Bool("json") {
					jsonOutput := map[string]any{
						"key":   key,
						"value": value,
					}
					if err := h.formatter.FormatJSON(cmd.Writer, jsonOutput); err != nil {
						return err
					}
				}

				if err := h.formatter.FormatSingleValue(cmd.Writer, key, value); err != nil {
					return err
				}
			} else {
				if !cmd.Bool("json") {
					if err := h.formatter.FormatWarning(cmd.Writer, "Key '"+key+"' not found"); err != nil {
						return err
					}
				}
			}
		}
		return nil
	}

	return nil
}

func (h *ConfigHandler) Reset(ctx context.Context, cmd *cli.Command) error {
	args := cmd.Args()
	keys := make([]string, args.Len())
	for i := 0; i < args.Len(); i++ {
		keys[i] = strings.TrimSpace(args.Get(i))
	}

	// Build request
	req := configUseCase.ResetConfigRequest{
		Keys: keys,
	}

	// Execute use case
	if err := h.resetUseCase.Execute(ctx, req); err != nil {
		return h.formatUseCaseError(cmd, err)
	}

	// Format success message
	if len(keys) == 0 {
		if cmd.Bool("json") {
			jsonOutput := map[string]any{
				"message": "All configuration values reset successfully!",
			}
			return h.formatter.FormatJSON(cmd.Writer, jsonOutput)
		}

		return h.formatter.FormatSuccess(cmd.Writer, "All configuration values reset successfully!")
	} else {
		if cmd.Bool("json") {
			jsonOutput := map[string]any{
				"message": "Configuration values reset successfully!",
			}
			return h.formatter.FormatJSON(cmd.Writer, jsonOutput)
		}

		return h.formatter.FormatSuccess(cmd.Writer, "Configuration values reset successfully!")
	}
}

// Helper methods

func (h *ConfigHandler) formatUseCaseError(cmd *cli.Command, err error) error {
	if cmd.Bool("json") {
		// If JSON output is requested, format the error as JSON
		jsonOutput := map[string]any{
			"error": err.Error(),
		}
		return h.formatter.FormatJSON(cmd.Writer, jsonOutput)
	}

	// Handle different types of use case errors
	switch e := err.(type) {
	case *configUseCase.ConfigError:
		switch e.Code {
		case configUseCase.ConfigErrorCodeValidation:
			return h.formatter.FormatError(cmd.Writer, "Validation error: "+e.Message)
		case configUseCase.ConfigErrorCodeFileSystem:
			return h.formatter.FormatError(cmd.Writer, "File system error: "+e.Message)
		case configUseCase.ConfigErrorCodePermission:
			return h.formatter.FormatError(cmd.Writer, "Permission error: "+e.Message)
		case configUseCase.ConfigErrorCodeNotFound:
			return h.formatter.FormatError(cmd.Writer, "Configuration not found: "+e.Message)
		case configUseCase.ConfigErrorCodeCorrupted:
			return h.formatter.FormatError(cmd.Writer, "Configuration corrupted: "+e.Message)
		default:
			return h.formatter.FormatError(cmd.Writer, "Service error: "+e.Message)
		}
	default:
		return h.formatter.FormatError(cmd.Writer, "Unexpected error: "+err.Error())
	}
}

func (h *ConfigHandler) extractKeyValuePairs(args cli.Args) (map[string]string, error) {
	keyValuePairs := make(map[string]string)
	for i := 0; i < args.Len(); i++ {
		arg := args.Get(i)
		parts := strings.SplitN(arg, "=", 2)
		if len(parts) != 2 {
			errors.New("Invalid format: '" + arg + "'. Expected format: key=value")
		}
		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])
		if key == "" {
			return nil, errors.New("Empty key provided in: '" + arg + "'")
		}
		keyValuePairs[key] = value
	}

	return keyValuePairs, nil
}
