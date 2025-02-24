package external

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
)

type AzureAISearchClient struct {
	serviceName string
	apiKey      string
	httpClient  *http.Client
}

func NewAzureAISearchClient(serviceName, apiKey string) *AzureAISearchClient {
	return &AzureAISearchClient{
		serviceName: serviceName,
		apiKey:      apiKey,
		httpClient:  &http.Client{},
	}
}

type vectorQuery struct {
	Kind   string `json:"kind"`
	Text   string `json:"text"`
	Fields string `json:"fields"`
}

type searchRequestBody struct {
	Search        string        `json:"search"`
	VectorQueries []vectorQuery `json:"vectorQueries"`
	Top           int           `json:"top"`
}

// Ref: https://learn.microsoft.com/ja-jp/rest/api/searchservice/search-documents
func (c *AzureAISearchClient) Query(indexName string, search string, retrieveHeader string) error {

	reqBody := searchRequestBody{
		Search: "*",
		VectorQueries: []vectorQuery{
			{
				Kind:   "text",
				Text:   "鈴木",
				Fields: "companyNameVector",
			},
		},
		Top: 5,
	}

	reqBodyJSON, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %v", err)
	}

	url := fmt.Sprintf("https://%s.search.windows.net/indexes/%s/docs/search?api-version=2024-11-01-preview", c.serviceName, indexName)
	slog.Info("url", "url", url)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(reqBodyJSON))
	if err != nil {
		return fmt.Errorf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("api-key", c.apiKey)
	slog.Info("req", "req", req)

	res, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to execute request: %v", err)
	}
	defer res.Body.Close()

	slog.Info("res", "res", res)
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %v", err)
	}
	slog.Info("body", "body", string(body))

	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("search request failed with status %d: %s", res.StatusCode, string(body))
	}

	// if err := json.Unmarshal(body, &searchResp); err != nil {
	// 	return fmt.Errorf("failed to unmarshal response: %v", err)
	// }

	return nil
}
