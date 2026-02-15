package domain

import "time"

type Role struct {
	ID         string
	Name       string
	Privileges string
	Color      string
	Admin      bool
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

func NewRole(name string) *Role {
	return &Role{
		Name: name,
	}
}
