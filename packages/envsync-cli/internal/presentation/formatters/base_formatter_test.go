package formatters

import (
	"bytes"
	"errors"
	"strings"
	"testing"
)

// Regression: FormatError/FormatJSONError returned only the write error, so
// handlers that returned their result swallowed the failure and every failed
// command exited 0 with a successful root span.
func TestFormatErrorReturnsRenderedError(t *testing.T) {
	f := NewBaseFormatter()
	var out bytes.Buffer

	err := f.FormatError(&out, "boom")

	var rendered RenderedError
	if !errors.As(err, &rendered) {
		t.Fatalf("FormatError returned %v, want a RenderedError", err)
	}
	if rendered.Error() != "boom" {
		t.Errorf("message = %q, want %q", rendered.Error(), "boom")
	}
	if !strings.Contains(out.String(), "boom") {
		t.Errorf("output %q does not contain the message", out.String())
	}
}

func TestFormatJSONErrorReturnsRenderedError(t *testing.T) {
	f := NewBaseFormatter()
	var out bytes.Buffer

	err := f.FormatJSONError(&out, errors.New("boom"))

	var rendered RenderedError
	if !errors.As(err, &rendered) {
		t.Fatalf("FormatJSONError returned %v, want a RenderedError", err)
	}
	if rendered.Error() != "boom" {
		t.Errorf("message = %q, want %q", rendered.Error(), "boom")
	}
	if !strings.Contains(out.String(), `"error": "boom"`) {
		t.Errorf("JSON output %q does not contain the error field", out.String())
	}
}
