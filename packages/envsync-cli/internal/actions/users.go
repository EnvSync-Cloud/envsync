package actions

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/urfave/cli/v3"

	"github.com/EnvSync-Cloud/envsync-cli/internal/services"
)

func ListUsers() cli.ActionFunc {
	return func(ctx context.Context, cmd *cli.Command) error {
		// Step1: Initialize user service
		us := services.NewUserService()

		// Step2: Get all users
		users, err := us.GetAllUsers()
		if err != nil {
			return err
		}

		// Step3: Check if users exist
		if len(users) == 0 {
			return cli.Exit("No users found", 0)
		}

		// Step4: Handle JSON output
		if cmd.Bool("json") {
			jsonOutput, err := json.MarshalIndent(users, "", "  ")
			if err != nil {
				return err
			}
			cmd.Writer.Write([]byte(jsonOutput))
			return nil
		}

		// Step5: Print users in formatted way
		cmd.Writer.Write([]byte("👥 Available Users:\n"))
		for _, user := range users {
			cmd.Writer.Write([]byte("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"))
			cmd.Writer.Write([]byte(fmt.Sprintf("🆔 ID: %s\n", user.ID)))
			cmd.Writer.Write([]byte(fmt.Sprintf("📧 Email: %s\n", user.Email)))
			cmd.Writer.Write([]byte(fmt.Sprintf("👤 Role: %s\n", user.Role)))
			cmd.Writer.Write([]byte("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"))
		}

		return nil
	}
}
