package formatters

// RenderedError reports a failure whose message a formatter has already
// displayed to the user. Handlers return it instead of nil so the command
// exits non-zero and the failure reaches the CLI observability layer (root
// span status, failure logs). main treats it as already displayed and must
// not print the message again.
type RenderedError struct {
	msg string
}

// NewRenderedError wraps an already-displayed failure message.
func NewRenderedError(message string) RenderedError {
	return RenderedError{msg: message}
}

func (e RenderedError) Error() string { return e.msg }
