package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/bytakumis/Snippets/cognito"
	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		slog.Error("Error loading .env file", "error", err)
		panic("something went wrong.")
	}

	clientID := os.Getenv("COGNITO_CLIENT_ID")
	clientSecret := os.Getenv("COGNITO_CLIENT_SECRET")
	client, err := cognito.NewCognitoClient(clientID, clientSecret)
	if err != nil {
		slog.Error("Error creating Cognito client", "error", err)
		panic("something went wrong.")
	}

	user, err := client.SignIn(context.TODO(), "test@example.com", "Password123!")
	if err != nil {
		slog.Error("Error getting user by email", "error", err)
		return
	}

	slog.Info("User signed in", "user", user)

}
