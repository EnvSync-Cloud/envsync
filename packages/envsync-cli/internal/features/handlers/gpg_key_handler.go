package handlers

import (
	"context"
	"os"

	"github.com/urfave/cli/v3"

	gpg_key "github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/features/usecases/gpg_key"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/formatters"
)

type GpgKeyHandler struct {
	listUseCase     gpg_key.ListKeysUseCase
	generateUseCase gpg_key.GenerateKeyUseCase
	signUseCase     gpg_key.SignUseCase
	verifyUseCase   gpg_key.VerifyUseCase
	exportUseCase   gpg_key.ExportUseCase
	revokeUseCase   gpg_key.RevokeUseCase
	deleteUseCase   gpg_key.DeleteKeyUseCase
	formatter       *formatters.GpgKeyFormatter
}

func NewGpgKeyHandler(
	listUseCase gpg_key.ListKeysUseCase,
	generateUseCase gpg_key.GenerateKeyUseCase,
	signUseCase gpg_key.SignUseCase,
	verifyUseCase gpg_key.VerifyUseCase,
	exportUseCase gpg_key.ExportUseCase,
	revokeUseCase gpg_key.RevokeUseCase,
	deleteUseCase gpg_key.DeleteKeyUseCase,
	formatter *formatters.GpgKeyFormatter,
) *GpgKeyHandler {
	return &GpgKeyHandler{
		listUseCase:     listUseCase,
		generateUseCase: generateUseCase,
		signUseCase:     signUseCase,
		verifyUseCase:   verifyUseCase,
		exportUseCase:   exportUseCase,
		revokeUseCase:   revokeUseCase,
		deleteUseCase:   deleteUseCase,
		formatter:       formatter,
	}
}

func (h *GpgKeyHandler) List(ctx context.Context, cmd *cli.Command) error {
	keys, err := h.listUseCase.Execute(ctx)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, keys)
	}

	return h.formatter.FormatKeyList(cmd.Writer, keys)
}

func (h *GpgKeyHandler) Generate(ctx context.Context, cmd *cli.Command) error {
	name := cmd.String("name")
	email := cmd.String("email")
	algorithm := cmd.String("algorithm")

	var keySize *int
	if cmd.IsSet("key-size") {
		ks := int(cmd.Int("key-size"))
		keySize = &ks
	}

	var expiresInDays *int
	if cmd.IsSet("expires-in-days") {
		eid := int(cmd.Int("expires-in-days"))
		expiresInDays = &eid
	}

	usageFlags := []string{"sign"}
	isDefault := cmd.Bool("default")

	key, err := h.generateUseCase.Execute(ctx, name, email, algorithm, keySize, expiresInDays, usageFlags, isDefault)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, key)
	}

	return h.formatter.FormatKeyGenerated(cmd.Writer, *key)
}

func (h *GpgKeyHandler) Sign(ctx context.Context, cmd *cli.Command) error {
	keyID := cmd.String("key-id")
	filePath := cmd.String("file")
	mode := cmd.String("mode")
	detached := cmd.Bool("detached")

	// Check if stdin has data
	useStdin := false
	if filePath == "" {
		stat, _ := os.Stdin.Stat()
		if stat != nil && (stat.Mode()&os.ModeCharDevice) == 0 {
			useStdin = true
		}
	}

	result, err := h.signUseCase.Execute(ctx, keyID, filePath, mode, detached, useStdin)
	if err != nil {
		return h.formatError(cmd, err)
	}

	// Write to output file if specified
	outputPath := cmd.String("output")
	if outputPath != "" {
		if err := os.WriteFile(outputPath, []byte(result.Signature+"\n"), 0644); err != nil {
			return h.formatter.FormatError(cmd.Writer, "Failed to write output: "+err.Error())
		}
		return h.formatter.FormatSuccess(cmd.Writer, "Signature written to "+outputPath)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, result)
	}

	return h.formatter.FormatSignResult(cmd.Writer, *result)
}

func (h *GpgKeyHandler) Verify(ctx context.Context, cmd *cli.Command) error {
	filePath := cmd.String("file")
	signaturePath := cmd.String("signature")
	keyID := cmd.String("key-id")

	result, err := h.verifyUseCase.Execute(ctx, filePath, signaturePath, keyID)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, result)
	}

	return h.formatter.FormatVerifyResult(cmd.Writer, *result)
}

func (h *GpgKeyHandler) Export(ctx context.Context, cmd *cli.Command) error {
	keyID := cmd.String("key-id")

	publicKey, _, err := h.exportUseCase.Execute(ctx, keyID)
	if err != nil {
		return h.formatError(cmd, err)
	}

	// Write to output file if specified
	outputPath := cmd.String("output")
	if outputPath != "" {
		if err := os.WriteFile(outputPath, []byte(publicKey+"\n"), 0644); err != nil {
			return h.formatter.FormatError(cmd.Writer, "Failed to write output: "+err.Error())
		}
		return h.formatter.FormatSuccess(cmd.Writer, "Public key written to "+outputPath)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, map[string]string{"public_key": publicKey})
	}

	return h.formatter.FormatExport(cmd.Writer, publicKey)
}

func (h *GpgKeyHandler) Revoke(ctx context.Context, cmd *cli.Command) error {
	keyID := cmd.String("key-id")
	reason := cmd.String("reason")

	key, err := h.revokeUseCase.Execute(ctx, keyID, reason)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, key)
	}

	return h.formatter.FormatSuccess(cmd.Writer, "GPG key revoked: "+key.ID)
}

func (h *GpgKeyHandler) Delete(ctx context.Context, cmd *cli.Command) error {
	keyID := cmd.String("key-id")

	if err := h.deleteUseCase.Execute(ctx, keyID); err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, map[string]string{"message": "GPG key deleted", "key_id": keyID})
	}

	return h.formatter.FormatSuccess(cmd.Writer, "GPG key deleted: "+keyID)
}

func (h *GpgKeyHandler) formatError(cmd *cli.Command, err error) error {
	if cmd.Bool("json") {
		return h.formatter.FormatJSONError(cmd.Writer, err)
	}

	switch e := err.(type) {
	case *gpg_key.GpgKeyError:
		switch e.Code {
		case gpg_key.GpgKeyErrorCodeNotFound:
			return h.formatter.FormatError(cmd.Writer, "GPG key not found: "+e.Message)
		case gpg_key.GpgKeyErrorCodeValidation:
			return h.formatter.FormatError(cmd.Writer, "Validation error: "+e.Message)
		default:
			return h.formatter.FormatError(cmd.Writer, "Error: "+e.Message)
		}
	default:
		return h.formatter.FormatError(cmd.Writer, "Unexpected error: "+err.Error())
	}
}
