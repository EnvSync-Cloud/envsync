package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

type AppConfig struct {
	AccessToken string `json:"access_token"`
	BackendURL  string `json:"backend_url"`
}

var cfg AppConfig
var once sync.Once
var backendURL string

func New() AppConfig {
	once.Do(func() {
		configDir, err := os.UserConfigDir()
		if err != nil {
			panic(err)
		}

		filePath := filepath.Join(configDir, "envsync", "config.json")

		// Ensure directory exists
		dirPath := filepath.Dir(filePath)
		if err := os.MkdirAll(dirPath, os.ModePerm); err != nil {
			panic(err)
		}

		// Create a file if it doesn't exist
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			file, err := os.Create(filePath)
			if err != nil {
				panic(err)
			}
			file.Close()
		}

		cfg, err = ReadConfigFile()

		if err != nil {
			panic(err)
		}

		if cfg.BackendURL == "" {
			cfg.BackendURL = backendURL
		}
	})

	return cfg
}

func (c *AppConfig) WriteConfigFile() error {
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}

	configDir, err := os.UserConfigDir()
	if err != nil {
		panic(err)
	}

	filePath := filepath.Join(configDir, "envsync", "config.json")

	return os.WriteFile(filePath, data, 0644)
}

func ReadConfigFile() (AppConfig, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		panic(err)
	}

	filePath := filepath.Join(configDir, "envsync", "config.json")

	data, err := os.ReadFile(filePath)
	if err != nil {
		return AppConfig{}, err
	}

	if len(data) == 0 {
		return AppConfig{}, nil
	}

	var config AppConfig
	err = json.Unmarshal(data, &config)
	if err != nil {
		return AppConfig{}, err
	}

	return config, nil
}
