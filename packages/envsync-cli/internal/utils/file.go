package utils

import "os"

func ReadFile(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func WriteFile(data, path string) error {
	return os.WriteFile(path, []byte(data), 0644)
}
