package models

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
	Email     string         `gorm:"uniqueIndex;not null" json:"email"`
	Password  string         `json:"-"`
	Name      string         `json:"name"`
	Role      string         `gorm:"default:user" json:"role"`
}

type PublicUser struct {
	ID    uint   `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
	Role  string `json:"role"`
}

func (u *User) Public() PublicUser {
	return PublicUser{
		ID:    u.ID,
		Email: u.Email,
		Name:  u.Name,
		Role:  u.Role,
	}
}

func Migrate(db *gorm.DB) {
	db.AutoMigrate(&User{})
}
