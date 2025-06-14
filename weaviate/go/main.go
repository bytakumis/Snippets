package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/bytakumis/Snippets/weaviate/go/weaviate"
	"github.com/bytakumis/Snippets/weaviate/go/weaviate/backup"

	"github.com/joho/godotenv"
)

func main() {
	collectionName := "TEST"

	err := godotenv.Load()
	if err != nil {
		slog.Error("Error loading .env file", "error", err)
		panic("something went wrong.")
	}

	ctx := context.Background()
	weaviateCfg := weaviate.WeaviateClientNewArgs{
		WeaviateHostURL:     os.Getenv("WEAVIATE_REST_URL"),
		WeaviateAdminAPIKey: os.Getenv("WEAVIATE_ADMIN_API_KEY"),
		OpenAIKey:           os.Getenv("OPENAI_API_KEY"),
	}
	weaviate, err := weaviate.New(ctx, weaviateCfg)
	if err != nil {
		slog.Error("Error creating weaviate client", "error", err)
		return
	}

	// // Create collection
	// createArg := collection.CollectionCreateWithVectorArgs{
	// 	Name:       collectionName,
	// 	FieldNames: []string{"name", "code"},
	// }
	// err = weaviate.Collection.CreateWithVector(createArg)
	// if err != nil {
	// 	slog.Error("Error create weaviate collection", "error", err)
	// 	return
	// }

	// // Insert record
	// insertArg := record.RecordInsertArg{
	// 	CollectionName: collectionName,
	// 	Item: []record.RecordInsertItem{
	// 		{
	// 			Header: "name",
	// 			Value:  "testA",
	// 		},
	// 		{
	// 			Header: "code",
	// 			Value:  "testB",
	// 		},
	// 	},
	// }
	// err = weaviate.Record.Insert(insertArg)
	// if err != nil {
	// 	slog.Error("Error insert record to weaviate", "error", err)
	// 	return
	// }

	// Create backup
	backupArg := backup.BackupCreateArg{
		CollectionName: collectionName,
		BackupID:       "testbackup",
	}
	err = weaviate.Backup.Create(backupArg)
	if err != nil {
		slog.Error("Error create backup", "error", err)
		return
	}

	slog.Info("finished!!")
}
