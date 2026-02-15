package actions

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync-cli/internal/services"
)

func ListRoles() cli.ActionFunc {
	return func(ctx context.Context, cmd *cli.Command) error {
		// Step1: Initialize role service
		rs := services.NewRoleService()

		// Step2: Get all roles
		roles, err := rs.GetAllRoles()
		if err != nil {
			return err
		}

		// Step3: Check if roles exist
		if len(roles) == 0 {
			return cli.Exit("No roles found", 0)
		}

		// Step4: Handle JSON output
		if cmd.Bool("json") {
			jsonOutput, err := json.MarshalIndent(roles, "", "  ")
			if err != nil {
				return err
			}
			cmd.Writer.Write([]byte(jsonOutput))
			return nil
		}

		// Step5: Print roles in formatted way
		cmd.Writer.Write([]byte("👥 Available Roles:\n"))
		for _, role := range roles {
			cmd.Writer.Write([]byte("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"))
			cmd.Writer.Write([]byte(fmt.Sprintf("🆔 ID: %s\n", role.ID)))
			cmd.Writer.Write([]byte(fmt.Sprintf("👤 Role: %s\n", role.Name)))
			cmd.Writer.Write([]byte(fmt.Sprintf("🔑 Privileges: %s\n", role.Privileges)))
			cmd.Writer.Write([]byte(fmt.Sprintf("⚡ Admin: %t\n", role.Admin)))
			cmd.Writer.Write([]byte("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"))
		}

		return nil
	}
}
