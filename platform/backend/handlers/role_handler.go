package handlers

import (
	"net/http"
	"prodb/platform/backend/database"
	"prodb/platform/backend/models"

	"github.com/gin-gonic/gin"
)

// GetRoles godoc
// @Summary Get a list of roles
// @Description Get a list of all roles
// @Tags roles
// @Accept  json
// @Produce  json
// @Success 200 {array} models.Role
// @Router /roles [get]
func GetRoles(c *gin.Context) {
	var roles []models.Role
	result := database.DB.Find(&roles)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": roles})
}
