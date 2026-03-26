package handlers

import (
	"net/http"
	"prodb/platform/backend/database"
	"prodb/platform/backend/models"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// RoleResponse defines the structure for a role in the user response.
type RoleResponse struct {
	ID   uint   `json:"id"`
	Name string `json:"name"`
}

// UserResponse defines the structure for a user in the response.
type UserResponse struct {
	ID          uint           `json:"id"`
	Username    string         `json:"username"`
	FullName    string         `json:"fullName"`
	Email       string         `json:"email"`
	PhoneNumber string         `json:"phoneNumber"`
	Status      int16          `json:"status"`
	Roles       []RoleResponse `json:"roles"`
	CreatedAt   string         `json:"createdAt"`
}

// GetUsers godoc
// @Summary Get a list of users
// @Description Get a list of all users with pagination
// @Tags users
// @Accept  json
// @Produce  json
// @Success 200 {array} UserResponse
// @Router /users [get]
func GetUsers(c *gin.Context) {
	var users []models.User
	// Preload Roles to include them in the response
	result := database.DB.Preload("Roles").Find(&users)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	// Manually construct the response to ensure field names are correct
	var userResponses []UserResponse
	for _, user := range users {
		var roles []RoleResponse
		for _, role := range user.Roles {
			roles = append(roles, RoleResponse{ID: role.ID, Name: role.Name})
		}

		userResponses = append(userResponses, UserResponse{
			ID:          user.ID,
			Username:    user.Username,
			FullName:    user.FullName,
			Email:       user.Email,
			PhoneNumber: user.PhoneNumber,
			Status:      user.Status,
			Roles:       roles,
			CreatedAt:   user.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	c.JSON(http.StatusOK, gin.H{"data": userResponses})
}

// CreateUserInput defines the input structure for creating a new user.
type CreateUserInput struct {
	Username    string `json:"username" binding:"required"`
	Password    string `json:"password" binding:"required"`
	FullName    string `json:"fullName"`
	Email       string `json:"email" binding:"required,email"`
	PhoneNumber string `json:"phoneNumber"`
	Roles       []uint `json:"roles"` // Expecting an array of role IDs
}

// CreateUser godoc
// @Summary Create a new user
// @Description Create a new user with the given details
// @Tags users
// @Accept  json
// @Produce  json
// @Param   user body CreateUserInput true "User to create"
// @Success 201 {object} models.User
// @Router /users [post]
func CreateUser(c *gin.Context) {
	var input CreateUserInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	var roles []*models.Role
	if len(input.Roles) > 0 {
		if err := database.DB.Where("id IN ?", input.Roles).Find(&roles).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role IDs"})
			return
		}
	}

	user := models.User{
		Username:     input.Username,
		PasswordHash: string(hashedPassword),
		FullName:     input.FullName,
		Email:        input.Email,
		PhoneNumber:  input.PhoneNumber,
		Status:       1, // Default to active
		Roles:        roles,
	}

	if err := database.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	// Re-query the user to get the updated data with roles
	var createdUser models.User
	database.DB.Preload("Roles").First(&createdUser, user.ID)

	c.JSON(http.StatusCreated, gin.H{"data": createdUser})
}

// UpdateUserInput defines the input structure for updating a user.
type UpdateUserInput struct {
	FullName    string `json:"fullName"`
	Email       string `json:"email" binding:"omitempty,email"`
	PhoneNumber string `json:"phoneNumber"`
	Status      *int16 `json:"status"`
	Roles       []uint `json:"roles"`
}

// UpdateUser godoc
// @Summary Update a user
// @Description Update a user's details
// @Tags users
// @Accept  json
// @Produce  json
// @Param   id   path      int  true  "User ID"
// @Param   user body      UpdateUserInput true "User details to update"
// @Success 200  {object}  models.User
// @Router /users/{id} [put]
func UpdateUser(c *gin.Context) {
	id := c.Param("id")
	var user models.User
	if err := database.DB.Preload("Roles").First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	var input UpdateUserInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update basic fields
	user.FullName = input.FullName
	user.Email = input.Email
	user.PhoneNumber = input.PhoneNumber
	if input.Status != nil {
		user.Status = *input.Status
	}

	// Update roles
	if input.Roles != nil {
		if len(input.Roles) > 0 {
			var roles []*models.Role
			if err := database.DB.Where("id IN ?", input.Roles).Find(&roles).Error; err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role IDs"})
				return
			}
			if err := database.DB.Model(&user).Association("Roles").Replace(roles); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user roles"})
				return
			}
			if err := database.DB.Save(&user).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save user roles"})
				return
			}
		} else {
			// If roles are empty, clear them
			if err := database.DB.Model(&user).Association("Roles").Clear(); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear user roles"})
				return
			}
		}
	}

	// Re-query the user to get the updated data with roles
	var updatedUser models.User
	database.DB.Preload("Roles").First(&updatedUser, id)

	var roles []RoleResponse
	for _, role := range updatedUser.Roles {
		roles = append(roles, RoleResponse{ID: role.ID, Name: role.Name})
	}

	userResponse := UserResponse{
		ID:          updatedUser.ID,
		Username:    updatedUser.Username,
		FullName:    updatedUser.FullName,
		Email:       updatedUser.Email,
		PhoneNumber: updatedUser.PhoneNumber,
		Status:      updatedUser.Status,
		Roles:       roles,
		CreatedAt:   updatedUser.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	c.JSON(http.StatusOK, gin.H{"data": userResponse})
}

// DeleteUser godoc
// @Summary Delete a user
// @Description Delete a user by ID
// @Tags users
// @Accept  json
// @Produce  json
// @Param   id   path      int  true  "User ID"
// @Success 204  {object}  nil
// @Router /users/{id} [delete]
func DeleteUser(c *gin.Context) {
	id := c.Param("id")
	var user models.User
	if err := database.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// First, clear the user's roles associations
	if err := database.DB.Model(&user).Association("Roles").Clear(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear user roles"})
		return
	}

	// Then, delete the user
	if err := database.DB.Delete(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user"})
		return
	}

	c.Status(http.StatusNoContent)
}
