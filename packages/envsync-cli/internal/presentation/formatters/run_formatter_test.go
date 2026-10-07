package formatters

import (
	"bytes"
	"testing"
)

// Regression: RunFormatter used to pass the newline into lipgloss Render, which
// pads the trailing empty line to the block width. The invisible padding
// shifted every subsequent line right (e.g. "→ Application running..." printed
// mid-line), so the written bytes must be exactly the message plus "\n".
func TestRunFormatterOutputHasNoTrailingPadding(t *testing.T) {
	f := NewRunFormatter()

	tests := []struct {
		name string
		run  func(*bytes.Buffer) error
		want string
	}{
		{
			name: "log line",
			run:  func(b *bytes.Buffer) error { return f.FormatLog(b, "Fetched project configuration.") },
			want: "✓ Fetched project configuration.\n",
		},
		{
			name: "running status",
			run:  func(b *bytes.Buffer) error { return f.FormatRunningStatus(b) },
			want: "→ Application running...\n",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			if err := tt.run(&buf); err != nil {
				t.Fatalf("write error = %v", err)
			}
			if got := buf.String(); got != tt.want {
				t.Errorf("output = %q, want %q", got, tt.want)
			}
		})
	}
}
