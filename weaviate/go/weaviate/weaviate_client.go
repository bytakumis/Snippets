package weaviate

import (
	"context"
	"fmt"

	"github.com/bytakumis/Snippets/weaviate/go/weaviate/backup"
	"github.com/bytakumis/Snippets/weaviate/go/weaviate/collection"
	"github.com/bytakumis/Snippets/weaviate/go/weaviate/record"

	weaviateOriginal "github.com/weaviate/weaviate-go-client/v4/weaviate"
	"github.com/weaviate/weaviate-go-client/v4/weaviate/auth"
)

type Weaviate struct {
	Backup     backup.BackupService
	Collection collection.CollectionService
	Record     record.RecordService
}

func New(ctx context.Context, args WeaviateClientNewArgs) (*Weaviate, error) {
	client, err := createClient(args.WeaviateHostURL, args.WeaviateAdminAPIKey, args.OpenAIKey)
	if err != nil {
		return nil, fmt.Errorf("failed to weaviate client: %w", err)
	}

	return &Weaviate{
		Backup:     backup.New(ctx, client),
		Collection: collection.New(ctx, client),
		Record:     record.New(ctx, client),
	}, nil
}

func createClient(hostURL, adminAPIKey, openAIKey string) (*weaviateOriginal.Client, error) {
	cfg := weaviateOriginal.Config{
		Host:       hostURL,
		Scheme:     "https",
		AuthConfig: auth.ApiKey{Value: adminAPIKey},
		Headers: map[string]string{
			"X-OpenAI-Api-key": openAIKey,
		},
	}

	client, err := weaviateOriginal.NewClient(cfg)
	if err != nil {
		return nil, fmt.Errorf("faild to create weaviate client: %w", err)
	}
	return client, err

}
