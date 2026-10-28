package helper

import "time"

// ParseStrToTime parses time with layout-RFC3339
func ParseStrToTime(str string) time.Time {
	t, _ := time.Parse(time.RFC3339, str)
	return t
}

// ParseStringPtrToTime parses an optional time string with layout-RFC3339.
// Returns nil when str is nil.
func ParseStringPtrToTime(str *string) *time.Time {
	if str == nil {
		return nil
	}
	t := ParseStrToTime(*str)
	return &t
}
