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

	itemService := services.NewItem(client, "Product")

	// services.CreateCollectionWithNamedVector(client, "Product", []string{"name", "code", "price", "supplier"})

	// testData := services.GetTestData()
	// itemService.Add(testData)

	// itemService.QueryWithNamedVector(map[string]string{"name": "スマートフォン", "supplier": "鈴木農家"}, []string{"name", "code", "price", "supplier"})

	// itemService.Update("33d59db4-29e0-4976-a396-fc0fa9f0362e", map[string]interface{}{"name": "かぼちゃ"})

	itemService.ExactSearch("name", "スマートフォン", []string{"name", "code", "price", "supplier"})
	itemService.PartialSearch("name", "マートフ", []string{"name", "code", "price", "supplier"})
}
