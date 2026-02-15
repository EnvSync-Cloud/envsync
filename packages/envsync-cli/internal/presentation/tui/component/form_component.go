package component

import (
	"fmt"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/huh"
)

// FormFieldType represents the type of form field
type FormFieldType int

const (
	InputField FormFieldType = iota
	TextAreaField
	SelectField
	MultiSelectField
	ConfirmField
	PasswordField
	FilePathField
)

// FormFieldConfig holds configuration for creating form fields
type FormFieldConfig struct {
	Title       string
	Description string
	Placeholder string
	Required    bool
	Type        FormFieldType
	Options     []huh.Option[string] // For select fields
	Validate    func(interface{}) error
	// Field pointers for different types
	StringPtr   *string
	StringSlice *[]string
	BoolPtr     *bool
}

// WithDescription adds a description to the field config
func (f FormFieldConfig) WithDescription(desc string) FormFieldConfig {
	f.Description = desc
	return f
}

// WithPlaceholder adds a placeholder to the field config
func (f FormFieldConfig) WithPlaceholder(placeholder string) FormFieldConfig {
	f.Placeholder = placeholder
	return f
}

// WithRequired marks the field as required
func (f FormFieldConfig) WithRequired(required bool) FormFieldConfig {
	f.Required = required
	return f
}

// WithValidation adds validation to the field config
func (f FormFieldConfig) WithValidation(validate func(interface{}) error) FormFieldConfig {
	f.Validate = validate
	return f
}

// FormComponent is a generic form component that works with direct field pointers
type FormComponent struct {
	form        *huh.Form
	title       string
	description string
	completed   bool
	cancelled   bool
}

// FormComponentConfig holds configuration for creating a form component
type FormComponentConfig struct {
	Title       string
	Description string
	Fields      []FormFieldConfig
	Theme       *huh.Theme
	Width       int
	Height      int
}

// NewFormComponent creates a new form component with direct field pointers
func NewFormComponent(config FormComponentConfig) (*FormComponent, error) {
	component := &FormComponent{
		title:       config.Title,
		description: config.Description,
	}

	// Create huh fields from config
	var huhFields []huh.Field
	for i, fieldConfig := range config.Fields {
		huhField, err := component.createFormField(fieldConfig, fmt.Sprintf("field_%d", i))
		if err != nil {
			return nil, fmt.Errorf("failed to create field %d: %w", i, err)
		}
		huhFields = append(huhFields, huhField)
	}

	// Create the huh form
	formBuilder := huh.NewForm(huh.NewGroup(huhFields...))

	if config.Theme != nil {
		formBuilder = formBuilder.WithTheme(config.Theme)
	}

	if config.Width > 0 {
		formBuilder = formBuilder.WithWidth(config.Width)
	}

	if config.Height > 0 {
		formBuilder = formBuilder.WithHeight(config.Height)
	}

	component.form = formBuilder

	return component, nil
}

// createFormField creates a specific form field based on the field type
func (fc *FormComponent) createFormField(config FormFieldConfig, key string) (huh.Field, error) {
	var huhField huh.Field

	switch config.Type {
	case InputField:
		if config.StringPtr == nil {
			return nil, fmt.Errorf("input field requires StringPtr to be set")
		}

		inputField := huh.NewInput().
			Key(key).
			Title(config.Title).
			Value(config.StringPtr)

		if config.Description != "" {
			inputField = inputField.Description(config.Description)
		}
		if config.Placeholder != "" {
			inputField = inputField.Placeholder(config.Placeholder)
		}
		if config.Validate != nil {
			inputField = inputField.Validate(func(s string) error {
				return config.Validate(s)
			})
		}
		huhField = inputField

	case PasswordField:
		if config.StringPtr == nil {
			return nil, fmt.Errorf("password field requires StringPtr to be set")
		}

		passwordField := huh.NewInput().
			Key(key).
			Title(config.Title).
			Value(config.StringPtr).
			Password(true)

		if config.Description != "" {
			passwordField = passwordField.Description(config.Description)
		}
		if config.Placeholder != "" {
			passwordField = passwordField.Placeholder(config.Placeholder)
		}
		if config.Validate != nil {
			passwordField = passwordField.Validate(func(s string) error {
				return config.Validate(s)
			})
		}
		huhField = passwordField

	case TextAreaField:
		if config.StringPtr == nil {
			return nil, fmt.Errorf("textarea field requires StringPtr to be set")
		}

		textAreaField := huh.NewText().
			Key(key).
			Title(config.Title).
			Value(config.StringPtr)

		if config.Description != "" {
			textAreaField = textAreaField.Description(config.Description)
		}
		if config.Placeholder != "" {
			textAreaField = textAreaField.Placeholder(config.Placeholder)
		}
		if config.Validate != nil {
			textAreaField = textAreaField.Validate(func(s string) error {
				return config.Validate(s)
			})
		}
		huhField = textAreaField

	case SelectField:
		if config.StringPtr == nil {
			return nil, fmt.Errorf("select field requires StringPtr to be set")
		}

		selectField := huh.NewSelect[string]().
			Key(key).
			Title(config.Title).
			Value(config.StringPtr).
			Options(config.Options...)

		if config.Description != "" {
			selectField = selectField.Description(config.Description)
		}
		huhField = selectField

	case MultiSelectField:
		if config.StringSlice == nil {
			return nil, fmt.Errorf("multiselect field requires StringSlice to be set")
		}

		multiSelectField := huh.NewMultiSelect[string]().
			Key(key).
			Title(config.Title).
			Value(config.StringSlice).
			Options(config.Options...)

		if config.Description != "" {
			multiSelectField = multiSelectField.Description(config.Description)
		}
		huhField = multiSelectField

	case ConfirmField:
		if config.BoolPtr == nil {
			return nil, fmt.Errorf("confirm field requires BoolPtr to be set")
		}

		confirmField := huh.NewConfirm().
			Key(key).
			Title(config.Title).
			Value(config.BoolPtr)

		if config.Description != "" {
			confirmField = confirmField.Description(config.Description)
		}
		huhField = confirmField

	case FilePathField:
		if config.StringPtr == nil {
			return nil, fmt.Errorf("filepath field requires StringPtr to be set")
		}

		filePathField := huh.NewFilePicker().
			Key(key).
			Title(config.Title).
			Value(config.StringPtr)

		if config.Description != "" {
			filePathField = filePathField.Description(config.Description)
		}
		huhField = filePathField

	default:
		return nil, fmt.Errorf("unsupported field type: %d", config.Type)
	}

	return huhField, nil
}

// Init initializes the form component (Bubble Tea Model interface)
func (fc *FormComponent) Init() tea.Cmd {
	return fc.form.Init()
}

// Update handles messages and updates the form state (Bubble Tea Model interface)
func (fc *FormComponent) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "esc":
			fc.cancelled = true
			return fc, tea.Quit
		}
	}

	form, cmd := fc.form.Update(msg)
	if f, ok := form.(*huh.Form); ok {
		fc.form = f
	}

	// Check if form is completed
	if fc.form.State == huh.StateCompleted {
		fc.completed = true
		return fc, tea.Quit
	}

	return fc, cmd
}

// View renders the form (Bubble Tea Model interface)
func (fc *FormComponent) View() string {
	if fc.completed {
		return "Form submitted successfully!\n"
	}
	if fc.cancelled {
		return "Form cancelled.\n"
	}

	var view string
	if fc.title != "" {
		view += fmt.Sprintf("# %s\n\n", fc.title)
	}
	if fc.description != "" {
		view += fmt.Sprintf("%s\n\n", fc.description)
	}

	view += fc.form.View()
	return view
}

// IsCompleted returns whether the form has been completed
func (fc *FormComponent) IsCompleted() bool {
	return fc.completed
}

// IsCancelled returns whether the form has been cancelled
func (fc *FormComponent) IsCancelled() bool {
	return fc.cancelled
}

// Helper functions for creating common field configurations

// NewInputFieldConfig creates a configuration for an input field
func NewInputFieldConfig(ptr *string, title string) FormFieldConfig {
	return FormFieldConfig{
		Title:     title,
		Type:      InputField,
		StringPtr: ptr,
	}
}

// NewPasswordFieldConfig creates a configuration for a password field
func NewPasswordFieldConfig(ptr *string, title string) FormFieldConfig {
	return FormFieldConfig{
		Title:     title,
		Type:      PasswordField,
		StringPtr: ptr,
	}
}

// NewSelectFieldConfig creates a configuration for a select field
func NewSelectFieldConfig(ptr *string, title string, options []huh.Option[string]) FormFieldConfig {
	return FormFieldConfig{
		Title:     title,
		Type:      SelectField,
		StringPtr: ptr,
		Options:   options,
	}
}

// NewConfirmFieldConfig creates a configuration for a confirm field
func NewConfirmFieldConfig(ptr *bool, title string) FormFieldConfig {
	return FormFieldConfig{
		Title:   title,
		Type:    ConfirmField,
		BoolPtr: ptr,
	}
}

// NewTextAreaFieldConfig creates a configuration for a text area field
func NewTextAreaFieldConfig(ptr *string, title string) FormFieldConfig {
	return FormFieldConfig{
		Title:     title,
		Type:      TextAreaField,
		StringPtr: ptr,
	}
}

// NewFilePathFieldConfig creates a configuration for a file path field
func NewFilePathFieldConfig(ptr *string, title string) FormFieldConfig {
	return FormFieldConfig{
		Title:     title,
		Type:      FilePathField,
		StringPtr: ptr,
	}
}

// NewMultiSelectFieldConfig creates a configuration for a multi-select field
func NewMultiSelectFieldConfig(ptr *[]string, title string, options []huh.Option[string]) FormFieldConfig {
	return FormFieldConfig{
		Title:       title,
		Type:        MultiSelectField,
		StringSlice: ptr,
		Options:     options,
	}
}
