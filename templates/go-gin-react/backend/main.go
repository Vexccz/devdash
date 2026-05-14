package main

import (
	"fmt"
	"log"
	"os"

	"{{PROJECT_SLUG}}/config"
	"{{PROJECT_SLUG}}/handlers"
	"{{PROJECT_SLUG}}/middleware"
	"{{PROJECT_SLUG}}/models"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	db := config.ConnectDB()
	models.Migrate(db)

	r := gin.Default()

	r.Use(middleware.CORSMiddleware())

	api := r.Group("/api")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/register", handlers.Register(db))
			auth.POST("/login", handlers.Login(db))
		}

		protected := api.Group("/")
		protected.Use(middleware.AuthMiddleware())
		{
			protected.GET("/me", handlers.GetMe(db))
			protected.PUT("/me", handlers.UpdateMe(db))
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Server running on port %s", port)
	if err := r.Run(fmt.Sprintf(":%s", port)); err != nil {
		log.Fatal(err)
	}
}
