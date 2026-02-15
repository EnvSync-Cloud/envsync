package formatters

type SyncFormatter struct {
	*BaseFormatter
}

func NewSyncFormatter() *SyncFormatter {
	base := NewBaseFormatter()
	return &SyncFormatter{
		BaseFormatter: base,
	}
}
