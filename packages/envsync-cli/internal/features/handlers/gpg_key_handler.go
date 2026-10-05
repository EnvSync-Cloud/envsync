package handlers

import (
	"context"
	"os"

	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	gpg_key "github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/features/usecases/gpg_key"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/formatters"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/spinner"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/presentation/tui/factory"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
)

type GpgKeyHandler struct {
	listUseCase     gpg_key.ListKeysUseCase
	generateUseCase gpg_key.GenerateKeyUseCase
	signUseCase     gpg_key.SignUseCase
	verifyUseCase   gpg_key.VerifyUseCase
	exportUseCase   gpg_key.ExportUseCase
	revokeUseCase   gpg_key.RevokeUseCase
	deleteUseCase   gpg_key.DeleteKeyUseCase
	service         services.GpgKeyService
	formatter       *formatters.GpgKeyFormatter
	tui             *factory.GpgKeyFactory
}

func NewGpgKeyHandler(
	listUseCase gpg_key.ListKeysUseCase,
	generateUseCase gpg_key.GenerateKeyUseCase,
	signUseCase gpg_key.SignUseCase,
	verifyUseCase gpg_key.VerifyUseCase,
	exportUseCase gpg_key.ExportUseCase,
	revokeUseCase gpg_key.RevokeUseCase,
	deleteUseCase gpg_key.DeleteKeyUseCase,
	service services.GpgKeyService,
	formatter *formatters.GpgKeyFormatter,
	tui *factory.GpgKeyFactory,
) *GpgKeyHandler {
	return &GpgKeyHandler{
		listUseCase:     listUseCase,
		generateUseCase: generateUseCase,
		signUseCase:     signUseCase,
		verifyUseCase:   verifyUseCase,
		exportUseCase:   exportUseCase,
		revokeUseCase:   revokeUseCase,
		deleteUseCase:   deleteUseCase,
		service:         service,
		formatter:       formatter,
		tui:             tui,
	}
}

func (h *GpgKeyHandler) List(ctx context.Context, cmd *cli.Command) error {
	// Show progress while the keys load, then hand the screen over to the view.
	sp := spinner.New("Fetching GPG keys…", spinner.IsTerminal(os.Stderr), os.Stderr)
	if !cmd.Bool("json") {
		sp.Start()
	}
	keys, err := h.listUseCase.Execute(ctx)
	if !cmd.Bool("json") {
		sp.Stop()
	}
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, keys)
	}

	// A terminal gets the interactive table. Pipes and scripts keep the plain
	// table so existing pipelines are unaffected.
	if len(keys) > 0 && spinner.IsTerminal(cmd.Writer) {
		return h.tui.ListKeysInteractive(keys)
	}

	return h.formatter.FormatListTable(cmd.Writer, keys)
}

func (h *GpgKeyHandler) Generate(ctx context.Context, cmd *cli.Command) error {
	jsonOutput := cmd.Bool("json")

	if cmd.IsSet("algorithm") {
		if _, ok := domain.ResolveGpgAlgorithm(cmd.String("algorithm")); !ok {
			return h.formatError(cmd, gpg_key.NewValidationError("algorithm must be one of ECC Curve25519, ECC P-256, ECC P-384, RSA 4096", gpg_key.ErrInvalidAlgorithm))
		}
	}

	name := cmd.String("name")
	email := cmd.String("email")
	algorithm := cmd.String("algorithm")

	var expiresInDays *int
	if cmd.IsSet("expires-in-days") {
		days := int(cmd.Int("expires-in-days"))
		expiresInDays = &days
	}

	// Flags alone can carry a run when they cover the required fields. The
	// form picks up whatever is missing. JSON output is for scripts: it takes
	// flag values only and never opens the form.
	switch {
	case jsonOutput:
		if name == "" {
			return h.formatError(cmd, gpg_key.NewValidationError("name must be provided with json flag", gpg_key.ErrNameRequired))
		}
		if email == "" {
			return h.formatError(cmd, gpg_key.NewValidationError("email must be provided with json flag", gpg_key.ErrEmailRequired))
		}
	case !cmd.IsSet("name") || !cmd.IsSet("email") || !cmd.IsSet("algorithm"):
		if !spinner.IsTerminal(os.Stdin) {
			return h.formatError(cmd, gpg_key.NewValidationError("name, email and algorithm are required; provide --name, --email and --algorithm flags", gpg_key.ErrNameRequired))
		}

		values, err := h.tui.GenerateKeyTUI(factory.GenerateKeyValues{
			Name:          name,
			Email:         email,
			Algorithm:     algorithm,
			ExpiresInDays: expiresInDays,
		})
		if err != nil {
			return h.formatError(cmd, err)
		}
		name, email, algorithm, expiresInDays = values.Name, values.Email, values.Algorithm, values.ExpiresInDays
	case name == "" || email == "":
		return h.formatError(cmd, gpg_key.NewValidationError("name and email are required; provide --name and --email flags", gpg_key.ErrNameRequired))
	}

	// Show progress while the key generates, then hand the screen over to the
	// success message.
	sp := spinner.New("Generating GPG key…", spinner.IsTerminal(os.Stderr), os.Stderr)
	if !jsonOutput {
		sp.Start()
	}
	key, err := h.generateUseCase.Execute(ctx, name, email, algorithm, expiresInDays, []string{"sign"}, cmd.Bool("default"))
	if !jsonOutput {
		sp.Stop()
	}
	if err != nil {
		return h.formatError(cmd, err)
	}

	if jsonOutput {
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
			return h.formatter.FormatError(cmd.ErrWriter, "Failed to write output: "+err.Error())
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
			return h.formatter.FormatError(cmd.ErrWriter, "Failed to write output: "+err.Error())
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

func (h *GpgKeyHandler) Rotate(ctx context.Context, cmd *cli.Command) error {
	keyID := cmd.String("key-id")
	payload := map[string]any{
		"set_new_default": cmd.Bool("set-new-default"),
		"revoke_previous": cmd.Bool("revoke-previous"),
	}
	if cmd.IsSet("expires-in-days") {
		payload["expires_in_days"] = int(cmd.Int("expires-in-days"))
	}
	if cmd.IsSet("name") {
		payload["name"] = cmd.String("name")
	}
	if cmd.IsSet("email") {
		payload["email"] = cmd.String("email")
	}
	if cmd.IsSet("algorithm") {
		payload["algorithm"] = cmd.String("algorithm")
	}
	if cmd.IsSet("key-size") {
		payload["key_size"] = int(cmd.Int("key-size"))
	}

	key, err := h.service.RotateKey(ctx, keyID, payload)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, key)
	}
	return h.formatter.FormatSuccess(cmd.Writer, "GPG key rotated: "+key.ID)
}

func (h *GpgKeyHandler) ExtendExpiry(ctx context.Context, cmd *cli.Command) error {
	keyID := cmd.String("key-id")
	expiresInDays := int(cmd.Int("expires-in-days"))

	key, err := h.service.ExtendExpiry(ctx, keyID, expiresInDays)
	if err != nil {
		return h.formatError(cmd, err)
	}

	if cmd.Bool("json") {
		return h.formatter.FormatJSON(cmd.Writer, key)
	}
	return h.formatter.FormatSuccess(cmd.Writer, "GPG key expiry extended: "+key.ID)
}

func (h *GpgKeyHandler) formatError(cmd *cli.Command, err error) error {
	if cmd.Bool("json") {
		return h.formatter.FormatJSONError(cmd.Writer, err)
	}

	switch e := err.(type) {
	case *gpg_key.GpgKeyError:
		switch e.Code {
		case gpg_key.GpgKeyErrorCodeNotFound:
			return h.formatter.FormatError(cmd.ErrWriter, "GPG key not found: "+e.Message)
		case gpg_key.GpgKeyErrorCodeValidation:
			return h.formatter.FormatError(cmd.ErrWriter, "Validation error: "+e.Message)
		default:
			return h.formatter.FormatError(cmd.ErrWriter, "Error: "+e.Message)
		}
	default:
		return h.formatter.FormatError(cmd.ErrWriter, "Unexpected error: "+err.Error())
	}
}
