package cognito

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"log/slog"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"

	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider/types"
)

type CognitoClient struct {
	client       *cognitoidentityprovider.Client
	clientID     string
	clientSecret string
}

func NewCognitoClient(clientID, clientSecret string) (*CognitoClient, error) {
	region := "ap-northeast-1"
	cfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithRegion(region),
	)
	if err != nil {
		slog.Error("failed to load configuration", "error", err)
		panic("something went wrong.")
	}

	client := cognitoidentityprovider.NewFromConfig(cfg)
	return &CognitoClient{client, clientID, clientSecret}, nil
}

func (c *CognitoClient) SignIn(ctx context.Context, email, password string) (*cognitoidentityprovider.InitiateAuthOutput, error) {
	secretHash := calculateSecretHash(c.clientID, c.clientSecret, email)
	input := &cognitoidentityprovider.InitiateAuthInput{
		AuthFlow: "USER_PASSWORD_AUTH",
		AuthParameters: map[string]string{
			"USERNAME":    email,
			"PASSWORD":    password,
			"SECRET_HASH": secretHash,
		},
		ClientId: aws.String(c.clientID),
	}

	output, err := c.client.InitiateAuth(ctx, input)
	if err != nil {
		var unauthorizedException *types.NotAuthorizedException
		var userNotFoundException *types.UserNotFoundException
		switch {
		case errors.As(err, &unauthorizedException):
			slog.Warn("invalid password", "error", err)
			return nil, errors.New("user not found or invalid password")
		case errors.As(err, &userNotFoundException):
			slog.Warn("user not found", "error", err)
			return nil, errors.New("user not found or invalid password")
		default:
			slog.Error("failed to initiate auth", "error", err)
			return nil, errors.New("something went wrong")
		}
	}

	return output, nil
}

// calculateSecretHash calculates the secret hash for the given email and client ID using HMAC-SHA256.
func calculateSecretHash(clientID, clientSecret, email string) string {
	h := hmac.New(sha256.New, []byte(clientSecret))
	h.Write([]byte(email + clientID))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}
