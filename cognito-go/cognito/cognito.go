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

func (c *CognitoClient) GenerateSecretHash(email string) string {
	return calculateSecretHash(c.clientID, c.clientSecret, email)
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

func (c *CognitoClient) ConfirmSignUp(ctx context.Context, email, code string) (*cognitoidentityprovider.ConfirmSignUpOutput, error) {
	input := &cognitoidentityprovider.ConfirmSignUpInput{
		ClientId:         aws.String(c.clientID),
		Username:         aws.String(email),
		ConfirmationCode: aws.String(code),
		SecretHash:       aws.String(c.GenerateSecretHash(email)),
	}
	return c.client.ConfirmSignUp(ctx, input)
}

func (c *CognitoClient) SignUp(ctx context.Context, email, password string) (*cognitoidentityprovider.SignUpOutput, error) {
	input := &cognitoidentityprovider.SignUpInput{
		ClientId:   aws.String(c.clientID),
		Username:   aws.String(email),
		Password:   aws.String(password),
		SecretHash: aws.String(c.GenerateSecretHash(email)),
	}
	return c.client.SignUp(ctx, input)
}

func (c *CognitoClient) SignIn(ctx context.Context, email, password string) (*cognitoidentityprovider.InitiateAuthOutput, error) {
	input := &cognitoidentityprovider.InitiateAuthInput{
		AuthFlow: "USER_PASSWORD_AUTH",
		AuthParameters: map[string]string{
			"USERNAME":    email,
			"PASSWORD":    password,
			"SECRET_HASH": c.GenerateSecretHash(email),
		},
		ClientId: aws.String(c.clientID),
	}

	output, err := c.client.InitiateAuth(ctx, input)
	if err != nil {
		var unauthorizedException *types.NotAuthorizedException
		var userNotFoundException *types.UserNotFoundException
		switch {
		case errors.As(err, &unauthorizedException):
			slog.Info("invalid password", "error", err)
			return nil, errors.New("user not found or invalid password")
		case errors.As(err, &userNotFoundException):
			slog.Info("user not found", "error", err)
			return nil, errors.New("user not found or invalid password")
		default:
			slog.Error("failed to initiate auth", "error", err)
			return nil, errors.New("something went wrong")
		}
	}

	switch output.ChallengeName {
	case types.ChallengeNameTypeNewPasswordRequired:
		slog.Info("requires new password")
		return nil, errors.New("requires new password")
	}

	return output, nil
}

// calculateSecretHash calculates the secret hash for the given email and client ID using HMAC-SHA256.
func calculateSecretHash(clientID, clientSecret, email string) string {
	h := hmac.New(sha256.New, []byte(clientSecret))
	h.Write([]byte(email + clientID))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}
