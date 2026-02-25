import z from "zod";
import "zod-openapi/extend";

export const loginUrlResponseSchema = z
	.object({
		message: z.string().openapi({ example: "Login created successfully." }),
		loginUrl: z
			.string()
			.url()
			.openapi({ example: "https://keycloak.example.com/realms/envsync/protocol/openid-connect/auth?response_type=code" }),
	})
	.openapi({ ref: "LoginUrlResponse" });

export const cliLoginResponseSchema = z
	.object({
		message: z.string().openapi({ example: "CLI login created successfully." }),
		verification_uri_complete: z
			.string()
			.url()
			.openapi({ example: "https://keycloak.example.com/realms/envsync/protocol/openid-connect/auth/device" }),
		user_code: z.string().openapi({ example: "abc123" }),
		device_code: z.string().openapi({ example: "def456" }),
		expires_in: z.number().openapi({ example: 300 }),
		client_id: z.string().openapi({ example: "envsync-web" }),
		token_url: z.string().url().openapi({ example: "https://keycloak.example.com/realms/envsync/protocol/openid-connect/token" }),
		interval: z.number().openapi({ example: 5 }),
	})
	.openapi({ ref: "CliLoginResponse" });

export const callbackResponseSchema = z
	.object({
		message: z.string().openapi({ example: "Login callback successful." }),
		tokenData: z
			.object({
				access_token: z.string().openapi({ example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }),
				id_token: z.string().openapi({ example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }),
				scope: z.string().openapi({ example: "openid profile email" }),
				expires_in: z.number().openapi({ example: 86400 }),
				token_type: z.string().openapi({ example: "Bearer" }),
			})
			.optional(),
	})
	.openapi({ ref: "CallbackResponse" });
