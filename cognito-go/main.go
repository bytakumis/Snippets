package main

import (
	"context"
	"errors"
	"log/slog"
	"os"

	"github.com/aws/aws-sdk-go/service/cognitoidentityprovider"
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

	// user, err := client.SignIn(context.TODO(), "test2@example.com", "Password123!")
	user, err := client.SignUp(context.TODO(), "test2@example.com", "Password123!")
	if err != nil {
		var usernameExistsException *cognitoidentityprovider.UsernameExistsException
		var userNotFoundException *cognitoidentityprovider.UserNotFoundException
		var notAuthorizedException *cognitoidentityprovider.NotAuthorizedException
		switch {
		case errors.As(err, &usernameExistsException):
			slog.Error("User already exists", "error", err)
		case errors.As(err, &userNotFoundException):
			slog.Error("User not found", "error", err)
		case errors.As(err, &notAuthorizedException):
			slog.Error("Invalid password", "error", err)
		default:
			slog.Error("Error signing up", "error", err)
		}
		return
	}
	slog.Info("user", "user", user)
