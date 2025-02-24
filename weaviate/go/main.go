package main

import (
	"log"
	"log/slog"
	"os"

	"github.com/bytakumis/Snippets/weaviate/go/services"
	"github.com/joho/godotenv"
	"github.com/weaviate/weaviate-go-client/v4/weaviate"
	"github.com/weaviate/weaviate-go-client/v4/weaviate/auth"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		slog.Error("Error loading .env file", "error", err)
		panic("something went wrong.")
	}

	cfg := weaviate.Config{
		Host:       os.Getenv("WEAVIATE_REST_URL"),
		Scheme:     "https",
		AuthConfig: auth.ApiKey{Value: os.Getenv("WEAVIATE_ADMIN_API_KEY")},
		Headers: map[string]string{
			"X-Cohere-Api-Key": os.Getenv("COHERE_API_KEY"),
		},
	}
	client, err := weaviate.NewClient(cfg)
	if err != nil {
		log.Fatalf("Failed to create client: %v", err)
	}

	// services.CreateCollectionWithNamedVector(client, "product", []string{"name", "code", "price", "supplier"})

	// testData := services.GetTestData()
	// services.AddItems(client, "Product", testData)

	// services.QueryWithNamedVector(client, "Product", map[string]string{"name": "スマートフォン", "supplier": "鈴木農家"}, []string{"name", "code", "price", "supplier"})

	// services.UpdateItem(client, "Product", "6bfd6362-d6c5-47eb-a3ee-cb9bd9251465", map[string]interface{}{"name": "かぼちゃ"})

	// services.ExactSearch(client, "Product", "name", "スマートフォン", []string{"name", "code", "price", "supplier"})
	services.PartialSearch(client, "Product", "name", "マートフ", []string{"name", "code", "price", "supplier"})
}
