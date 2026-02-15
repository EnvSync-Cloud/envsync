package formatters

type InitFormatter struct {
	*BaseFormatter
}

func NewInitFormatter() *InitFormatter {
	base := NewBaseFormatter()
	return &InitFormatter{
		BaseFormatter: base,
	}
}
