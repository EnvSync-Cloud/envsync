package services

import (
	"strings"
	"testing"
)

func TestNewRedactorService(t *testing.T) {
	tests := []struct {
		name        string
		redactText  []string
		expectCount int
	}{
		{
			name:        "empty redact list",
			redactText:  []string{},
			expectCount: 0,
		},
		{
			name:        "single value",
			redactText:  []string{"secret123"},
			expectCount: 1,
		},
		{
			name:        "multiple values",
			redactText:  []string{"secret123", "token456", "password789"},
			expectCount: 3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := NewRedactorService(tt.redactText)
			if service == nil {
				t.Error("NewRedactorService returned nil")
			}

			redactor, ok := service.(*redactor)
			if !ok {
				t.Error("NewRedactorService did not return *redactor type")
			}

			if len(redactor.redactText) != tt.expectCount {
				t.Errorf("Expected %d redact values, got %d", tt.expectCount, len(redactor.redactText))
			}
		})
	}
}

func TestProcessAndRedactText(t *testing.T) {
	redactor := &redactor{
		redactText: []string{"mySecretPassword123", "sk-1234567890abcdef", "secret", "dbPassword456"},
	}

	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "empty string",
			input:    "",
			expected: "",
		},
		{
			name:     "no sensitive data",
			input:    "This is a normal string with no secrets",
			expected: "This is a normal string with no secrets",
		},
		{
			name:     "simple exact match",
			input:    "The password is mySecretPassword123",
			expected: "The password is [REDACTED]",
		},
		{
			name:     "multiple sensitive values",
			input:    "Use mySecretPassword123 and sk-1234567890abcdef for auth",
			expected: "Use [REDACTED] and [REDACTED] for auth",
		},
		{
			name:     "sensitive value in URL",
			input:    "postgres://user:mySecretPassword123@localhost:5432/db",
			expected: "postgres://user:[REDACTED]@localhost:5432/db",
		},
		{
			name:     "sensitive value in JSON",
			input:    `{"password": "mySecretPassword123", "token": "sk-1234567890abcdef"}`,
			expected: `{"password": "[REDACTED]", "token": "[REDACTED]"}`,
		},
		{
			name:     "sensitive value in XML",
			input:    `<config><secret>mySecretPassword123</secret></config>`,
			expected: `<config><secret>[REDACTED]</secret></config>`,
		},
		{
			name:     "command line with sensitive data",
			input:    "curl -H 'Authorization: Bearer sk-1234567890abcdef' https://api.com",
			expected: "curl -H 'Authorization: Bearer [REDACTED]' https://api.com",
		},
		{
			name:     "configuration string",
			input:    "database_password=mySecretPassword123;api_key=sk-1234567890abcdef",
			expected: "database_password=[REDACTED];api_key=[REDACTED]",
		},
		{
			name:     "word containing sensitive substring",
			input:    "The secret value is important",
			expected: "The [REDACTED] value is important",
		},
		{
			name:     "environment variable export",
			input:    "export SECRET_KEY=mySecretPassword123",
			expected: "export SECRET_KEY=[REDACTED]",
		},
		{
			name:     "file path with sensitive data",
			input:    "/home/user/.config/mySecretPassword123.key",
			expected: "/home/user/.config/[REDACTED].key",
		},
		{
			name:     "log entry with timestamp",
			input:    "[2024-01-15 10:30:45] ERROR: Authentication failed with token mySecretPassword123",
			expected: "[2024-01-15 10:30:45] ERROR: Authentication failed with token [REDACTED]",
		},
		{
			name:     "multiple formats in one line",
			input:    "Config: api_key=sk-1234567890abcdef, db_pass=dbPassword456, secret=mySecretPassword123",
			expected: "Config: api_key=[REDACTED], db_pass=[REDACTED], secret=[REDACTED]",
		},
		{
			name:     "quoted values",
			input:    `secret="mySecretPassword123" token='sk-1234567890abcdef'`,
			expected: `secret="[REDACTED]" token='[REDACTED]'`,
		},
		{
			name:     "base64-like values",
			input:    "Authorization: Bearer mySecretPassword123==",
			expected: "Authorization: Bearer [REDACTED]==",
		},
		{
			name:     "connection string",
			input:    "Server=localhost;Database=mydb;User=admin;Password=dbPassword456;",
			expected: "Server=localhost;Database=mydb;User=admin;Password=[REDACTED];",
		},
		{
			name:     "docker command",
			input:    "docker run -e DATABASE_URL=postgres://user:mySecretPassword123@db:5432/app myapp",
			expected: "docker run -e DATABASE_URL=postgres://user:[REDACTED]@db:5432/app myapp",
		},
		{
			name:     "FTP URL",
			input:    "ftp://mySecretPassword123:dbPassword456@ftp.example.com/files",
			expected: "ftp://[REDACTED]:[REDACTED]@ftp.example.com/files",
		},
		{
			name:     "JWT-like token",
			input:    "jwt_token: eyJhbGciOiJIUzI1NiJ9.mySecretPassword123.signature",
			expected: "jwt_token: eyJhbGciOiJIUzI1NiJ9.[REDACTED].signature",
		},
		{
			name:     "INI config format",
			input:    "[database]\npassword = dbPassword456\n[api]\nkey = mySecretPassword123",
			expected: "[database]\npassword = [REDACTED]\n[api]\nkey = [REDACTED]",
		},
		{
			name:     "long line with multiple secrets",
			input:    "This is a very long configuration line that contains database_password=dbPassword456 and api_key=mySecretPassword123 and auth_token=sk-1234567890abcdef along with other settings.",
			expected: "This is a very long configuration line that contains database_password=[REDACTED] and api_key=[REDACTED] and auth_token=[REDACTED] along with other settings.",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := redactor.processAndRedactText(tt.input)
			if result != tt.expected {
				t.Errorf("Test %s failed.\nInput:    %s\nExpected: %s\nGot:      %s", tt.name, tt.input, tt.expected, result)
			}
		})
	}
}

func TestTokenizeText(t *testing.T) {
	redactor := &redactor{redactText: []string{"test"}}

	tests := []struct {
		name     string
		input    string
		expected []string
	}{
		{
			name:     "empty string",
			input:    "",
			expected: []string{},
		},
		{
			name:     "simple words",
			input:    "hello world test",
			expected: []string{"hello", "hello", "world", "world", "test", "test"},
		},
		{
			name:     "with delimiters",
			input:    "key=value,another=test",
			expected: []string{"key=value", "another=test", "key=value,another=test"},
		},
		{
			name:     "URL format",
			input:    "https://user:pass@host:5432/db",
			expected: []string{"https://user:pass@host:5432/db", "https://user:pass@host:5432/db"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := redactor.tokenizeText(tt.input)
			if len(result) != len(tt.expected) {
				t.Errorf("Expected %d tokens, got %d. Result: %v", len(tt.expected), len(result), result)
			}
		})
	}
}

func TestSplitByDelimiters(t *testing.T) {
	redactor := &redactor{redactText: []string{"test"}}

	tests := []struct {
		name     string
		input    string
		contains []string // Check if result contains these tokens
	}{
		{
			name:     "empty string",
			input:    "",
			contains: []string{},
		},
		{
			name:     "simple word",
			input:    "hello",
			contains: []string{"hello"},
		},
		{
			name:     "comma separated",
			input:    "key1,key2,key3",
			contains: []string{"key1", "key2", "key3", "key1,key2,key3"},
		},
		{
			name:     "semicolon separated",
			input:    "key1;key2;key3",
			contains: []string{"key1", "key2", "key3", "key1;key2;key3"},
		},
		{
			name:     "mixed delimiters",
			input:    "key1,key2;key3|key4",
			contains: []string{"key1", "key2", "key3", "key4", "key1,key2;key3|key4"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := redactor.splitByDelimiters(tt.input)

			for _, expected := range tt.contains {
				found := false
				for _, token := range result {
					if token == expected {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("Expected token '%s' not found in result: %v", expected, result)
				}
			}
		})
	}
}

func TestTokenContainsSensitiveData(t *testing.T) {
	redactor := &redactor{
		redactText: []string{"secret123", "password456", "token789"},
	}

	tests := []struct {
		name     string
		token    string
		expected bool
	}{
		{
			name:     "exact match",
			token:    "secret123",
			expected: true,
		},
		{
			name:     "token contains sensitive data",
			token:    "api_key=secret123",
			expected: true,
		},
		{
			name:     "token with quotes",
			token:    "\"password456\"",
			expected: true,
		},
		{
			name:     "no sensitive data",
			token:    "normal_text",
			expected: false,
		},
		{
			name:     "empty token",
			token:    "",
			expected: false,
		},
		{
			name:     "token with special characters",
			token:    "key:token789@host",
			expected: true,
		},
		{
			name:     "partial match in larger token",
			token:    "Bearer-token789-suffix",
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := redactor.tokenContainsSensitiveData(tt.token)
			if result != tt.expected {
				t.Errorf("Expected %v for token '%s', got %v", tt.expected, tt.token, result)
			}
		})
	}
}

func TestCleanWordForMatching(t *testing.T) {
	redactor := &redactor{redactText: []string{"test"}}

	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "no special characters",
			input:    "hello",
			expected: "hello",
		},
		{
			name:     "with quotes",
			input:    "\"hello\"",
			expected: "hello",
		},
		{
			name:     "with brackets",
			input:    "[hello]",
			expected: "hello",
		},
		{
			name:     "with punctuation",
			input:    "hello,world.",
			expected: "hello,world",
		},
		{
			name:     "with URL characters",
			input:    "user:pass@host",
			expected: "user:pass@host",
		},
		{
			name:     "multiple special chars",
			input:    "({[hello]})",
			expected: "hello",
		},
		{
			name:     "empty after cleaning",
			input:    "()[]{}",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := redactor.cleanWordForMatching(tt.input)
			if result != tt.expected {
				t.Errorf("Expected '%s', got '%s'", tt.expected, result)
			}
		})
	}
}

func TestGenerateRedaction(t *testing.T) {
	redactor := &redactor{redactText: []string{"test"}}

	tests := []struct {
		name     string
		length   int
		expected string
	}{
		{
			name:     "zero length",
			length:   0,
			expected: "[REDACTED]",
		},
		{
			name:     "negative length",
			length:   -5,
			expected: "[REDACTED]",
		},
		{
			name:     "short length",
			length:   5,
			expected: "[REDACTED]",
		},
		{
			name:     "normal length",
			length:   10,
			expected: "[REDACTED]",
		},
		{
			name:     "long length",
			length:   20,
			expected: "[REDACTED]",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := redactor.generateRedaction()
			if result != tt.expected {
				t.Errorf("Expected '%s', got '%s'", tt.expected, result)
			}

			// Verify it's [REDACTED]
			if result != "[REDACTED]" {
				t.Errorf("Result should be [REDACTED], got '%s'", result)
			}
		})
	}
}

func TestRedactorEdgeCases(t *testing.T) {
	redactor := &redactor{
		redactText: []string{"sensitive", "SECRET123", "token_value"},
	}

	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "case sensitivity",
			input:    "This contains SENSITIVE data",
			expected: "This contains SENSITIVE data",
		},
		{
			name:     "numbers and special chars in sensitive data",
			input:    "The secret is SECRET123 here",
			expected: "The secret is [REDACTED] here",
		},
		{
			name:     "underscores in sensitive data",
			input:    "Token: token_value",
			expected: "Token: [REDACTED]",
		},
		{
			name:     "very long line",
			input:    strings.Repeat("normal ", 100) + "sensitive" + strings.Repeat(" text", 100),
			expected: strings.Repeat("normal ", 100) + "[REDACTED]" + strings.Repeat(" text", 100),
		},
		{
			name:     "multiple occurrences",
			input:    "sensitive data and more sensitive information",
			expected: "[REDACTED] data and more [REDACTED] information",
		},
		{
			name:     "unicode characters",
			input:    "héllo wørld sensitive data 测试",
			expected: "héllo wørld [REDACTED] data 测试",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := redactor.processAndRedactText(tt.input)
			if result != tt.expected {
				t.Errorf("Test %s failed.\nInput:    %s\nExpected: %s\nGot:      %s", tt.name, tt.input, tt.expected, result)
			}
		})
	}
}

func TestRedactorPerformance(t *testing.T) {
	// Test with large input to ensure reasonable performance
	redactor := &redactor{
		redactText: []string{"secret123", "password456"},
	}

	// Create a large input string
	largeInput := strings.Repeat("This is normal text without secrets. ", 1000) +
		"secret123" +
		strings.Repeat(" More normal text here.", 1000)

	result := redactor.processAndRedactText(largeInput)

	// Verify the secret was redacted
	if strings.Contains(result, "secret123") {
		t.Error("Secret was not redacted in large input")
	}

	// Verify it contains the redaction
	if !strings.Contains(result, "[REDACTED]") {
		t.Error("Redaction not found in result")
	}
}

func TestRedactorWithEmptyValues(t *testing.T) {
	tests := []struct {
		name       string
		redactText []string
		input      string
		expected   string
	}{
		{
			name:       "empty redact list",
			redactText: []string{},
			input:      "This should not be changed",
			expected:   "This should not be changed",
		},
		{
			name:       "redact list with empty strings",
			redactText: []string{"", "secret", ""},
			input:      "This contains secret data",
			expected:   "This contains [REDACTED] data",
		},
		{
			name:       "only empty strings in redact list",
			redactText: []string{"", "", ""},
			input:      "This should not be changed",
			expected:   "This should not be changed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			redactor := &redactor{redactText: tt.redactText}
			result := redactor.processAndRedactText(tt.input)
			if result != tt.expected {
				t.Errorf("Expected '%s', got '%s'", tt.expected, result)
			}
		})
	}
}

func BenchmarkRedactorSmallInput(b *testing.B) {
	redactor := &redactor{
		redactText: []string{"secret123", "password456", "token789"},
	}
	input := "This is a test with secret123 and password456 values"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		redactor.processAndRedactText(input)
	}
}

func BenchmarkRedactorMediumInput(b *testing.B) {
	redactor := &redactor{
		redactText: []string{"secret123", "password456", "token789", "apikey999", "dbpass888"},
	}
	input := strings.Repeat("This is normal text ", 50) + "secret123" + strings.Repeat(" more text here", 50)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		redactor.processAndRedactText(input)
	}
}

func BenchmarkRedactorLargeInput(b *testing.B) {
	redactor := &redactor{
		redactText: []string{"secret123", "password456", "token789", "apikey999", "dbpass888"},
	}
	input := strings.Repeat("This is normal text without secrets. ", 1000) +
		"secret123 and password456" +
		strings.Repeat(" More normal text here.", 1000)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		redactor.processAndRedactText(input)
	}
}

func BenchmarkRedactorManySecrets(b *testing.B) {
	redactor := &redactor{
		redactText: []string{"secret1", "secret2", "secret3", "secret4", "secret5"},
	}
	input := "secret1 and secret2 and secret3 and secret4 and secret5 mixed with normal text"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		redactor.processAndRedactText(input)
	}
}

func TestRedactorIntegrationComplexScenarios(t *testing.T) {
	redactor := &redactor{
		redactText: []string{
			"mySecretPassword123",
			"sk-1234567890abcdef",
			"jwt_abc123xyz789",
			"prod_key_456",
			"db_secret_999",
		},
	}

	tests := []struct {
		name     string
		input    string
		validate func(t *testing.T, result string)
	}{
		{
			name: "kubernetes deployment with secrets",
			input: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  template:
    spec:
      containers:
      - name: app
        env:
        - name: DATABASE_PASSWORD
          value: "mySecretPassword123"
        - name: API_KEY
          value: "sk-1234567890abcdef"`,
			validate: func(t *testing.T, result string) {
				if strings.Contains(result, "mySecretPassword123") {
					t.Error("Kubernetes YAML should not contain original password")
				}
				if strings.Contains(result, "sk-1234567890abcdef") {
					t.Error("Kubernetes YAML should not contain original API key")
				}
				if !strings.Contains(result, "[REDACTED]") {
					t.Error("Kubernetes YAML should contain redacted values")
				}
			},
		},
		{
			name: "docker compose with multiple services",
			input: `version: '3.8'
services:
  web:
    image: myapp
    environment:
      - DATABASE_URL=postgres://user:mySecretPassword123@db:5432/myapp
      - JWT_SECRET=jwt_abc123xyz789
  db:
    image: postgres
    environment:
      - POSTGRES_PASSWORD=db_secret_999`,
			validate: func(t *testing.T, result string) {
				sensitiveValues := []string{"mySecretPassword123", "jwt_abc123xyz789", "db_secret_999"}
				for _, value := range sensitiveValues {
					if strings.Contains(result, value) {
						t.Errorf("Docker compose should not contain %s", value)
					}
				}
			},
		},
		{
			name: "shell script with environment exports",
			input: `#!/bin/bash
export DATABASE_PASSWORD="mySecretPassword123"
export API_KEY='sk-1234567890abcdef'
export JWT_SECRET=jwt_abc123xyz789
echo "Starting application..."
curl -H "Authorization: Bearer $API_KEY" https://api.example.com`,
			validate: func(t *testing.T, result string) {
				if strings.Contains(result, "mySecretPassword123") ||
					strings.Contains(result, "sk-1234567890abcdef") ||
					strings.Contains(result, "jwt_abc123xyz789") {
					t.Error("Shell script should not contain original secrets")
				}
			},
		},
		{
			name: "configuration file with mixed formats",
			input: `[database]
host = localhost
port = 5432
password = mySecretPassword123

[api]
base_url = https://api.example.com
key = sk-1234567890abcdef
timeout = 30

[jwt]
secret = jwt_abc123xyz789
expiry = 3600`,
			validate: func(t *testing.T, result string) {
				sensitiveValues := []string{"mySecretPassword123", "sk-1234567890abcdef", "jwt_abc123xyz789"}
				for _, value := range sensitiveValues {
					if strings.Contains(result, value) {
						t.Errorf("Config file should not contain %s", value)
					}
				}
				// Ensure structure is preserved
				if !strings.Contains(result, "[database]") ||
					!strings.Contains(result, "host = localhost") {
					t.Error("Config file structure should be preserved")
				}
			},
		},
		{
			name: "log file with timestamps and secrets",
			input: `2024-01-15 10:30:45.123 [INFO] Application starting
2024-01-15 10:30:46.456 [DEBUG] Database connection: postgres://user:mySecretPassword123@localhost:5432/app
2024-01-15 10:30:47.789 [INFO] API authentication successful with key: sk-1234567890abcdef
2024-01-15 10:30:48.012 [WARN] JWT token validation: jwt_abc123xyz789
2024-01-15 10:30:49.345 [ERROR] Failed to connect to production database with key: prod_key_456`,
			validate: func(t *testing.T, result string) {
				// Check that timestamps are preserved
				if !strings.Contains(result, "2024-01-15 10:30:45.123") {
					t.Error("Timestamps should be preserved")
				}
				// Check that log levels are preserved
				if !strings.Contains(result, "[INFO]") || !strings.Contains(result, "[DEBUG]") {
					t.Error("Log levels should be preserved")
				}
				// Check that no secrets remain
				sensitiveValues := []string{"mySecretPassword123", "sk-1234567890abcdef", "jwt_abc123xyz789", "prod_key_456"}
				for _, value := range sensitiveValues {
					if strings.Contains(result, value) {
						t.Errorf("Log should not contain %s", value)
					}
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := redactor.processAndRedactText(tt.input)
			tt.validate(t, result)
		})
	}
}

func TestRedactorConcurrency(t *testing.T) {
	redactor := &redactor{
		redactText: []string{"secret123", "password456", "token789"},
	}

	inputs := []string{
		"This contains secret123 data",
		"Password is password456 here",
		"Token token789 for auth",
		"Mixed secret123 and password456 content",
		"No sensitive data here",
	}

	// Run multiple goroutines concurrently
	done := make(chan bool, len(inputs))
	for _, input := range inputs {
		go func(text string) {
			defer func() { done <- true }()
			result := redactor.processAndRedactText(text)
			// Basic validation that redaction occurred if needed
			if strings.Contains(text, "secret123") && strings.Contains(result, "secret123") {
				t.Errorf("Concurrent redaction failed for: %s", text)
			}
		}(input)
	}

	// Wait for all goroutines to complete
	for i := 0; i < len(inputs); i++ {
		<-done
	}
}

func TestRedactorSpecialCharacterHandling(t *testing.T) {
	redactor := &redactor{
		redactText: []string{"secret@123", "pass#word", "token$456", "key%789"},
	}

	tests := []struct {
		name  string
		input string
	}{
		{
			name:  "email-like secret",
			input: "Login with secret@123 for access",
		},
		{
			name:  "hash in password",
			input: "Database password: pass#word",
		},
		{
			name:  "dollar sign in token",
			input: "Environment variable TOKEN=token$456",
		},
		{
			name:  "percent in key",
			input: "API key encoded: key%789",
		},
		{
			name:  "multiple special chars",
			input: "Config: secret@123, pass#word, token$456, key%789",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := redactor.processAndRedactText(tt.input)

			// Check that none of the original sensitive values remain
			sensitiveValues := []string{"secret@123", "pass#word", "token$456", "key%789"}
			for _, value := range sensitiveValues {
				if strings.Contains(result, value) {
					t.Errorf("Input should not contain original value %s. Result: %s", value, result)
				}
			}

			// Ensure redaction occurred (should contain [REDACTED])
			if !strings.Contains(result, "[REDACTED]") {
				t.Errorf("Result should contain redacted values. Result: %s", result)
			}
		})
	}
}
