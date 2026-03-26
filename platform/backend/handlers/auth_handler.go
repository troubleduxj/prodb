package handlers

import (
	"log"
	"net/http"
	"prodb/platform/backend/database"
	"prodb/platform/backend/models"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type LoginInput struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// A secret key for signing the JWT. In a real application, this should be loaded from a secure config.
var jwtKey = []byte("my_secret_key")

// Claims struct to be encoded to a JWT
type Claims struct {
	Username string   `json:"username"`
	FullName string   `json:"fullName"`
	Roles    []string `json:"roles"`
	jwt.StandardClaims
}

func Login(c *gin.Context) {
	var input LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	// Preload Roles to include them in the JWT
	if err := database.DB.Preload("Roles").Where("username = ?", input.Username).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		log.Printf("Password comparison failed for user %s.", input.Username)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password (debug: comparison failed)"})
		return
	}

	// Create the JWT claims, which includes the username and expiry time
	expirationTime := time.Now().Add(24 * time.Hour)
	
	var roles []string
	for _, role := range user.Roles {
		roles = append(roles, role.Name)
	}

	claims := &Claims{
		Username: user.Username,
		FullName: user.FullName,
		Roles:    roles,
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: expirationTime.Unix(),
		},
	}

	// Create the JWT token with the claims
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// Sign the token with our secret key
	tokenString, err := token.SignedString(jwtKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": tokenString,
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"fullName": user.FullName,
			"email":    user.Email,
			"roles":    roles,
		},
	})
}
