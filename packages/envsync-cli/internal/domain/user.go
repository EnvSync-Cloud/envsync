package domain

import "time"

type User struct {
	ID        string
	Name      string
	OrgID     string
	Email     string
	Role      string
	CreatedAt time.Time
	UpdatedAt time.Time
}

func NewUser(name, email, role string) *User {
	return &User{
		Name:  name,
		Email: email,
		Role:  role,
	}
}
