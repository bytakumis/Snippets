package main

import (
	"log/slog"

	"github.com/bytakumis/Snippets/azure/ai_search_go/external"
)

func main() {
	slog.Info("Hello, World!")
	client := external.NewAzureAISearchClient("", "")
	client.Query("", "", "")
}
