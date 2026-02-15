/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiKeyResponse } from '../models/ApiKeyResponse';
import type { ApiKeysResponse } from '../models/ApiKeysResponse';
import type { CreateApiKeyRequest } from '../models/CreateApiKeyRequest';
import type { RegenerateApiKeyResponse } from '../models/RegenerateApiKeyResponse';
import type { UpdateApiKeyRequest } from '../models/UpdateApiKeyRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class ApiKeysService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Create API Key
     * Create a new API key for the organization
     * @param requestBody
     * @returns ApiKeyResponse API key created successfully
     * @throws ApiError
     */
    public createApiKey(
        requestBody?: CreateApiKeyRequest,
    ): CancelablePromise<ApiKeyResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/api_key',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get All API Keys
     * Retrieve all API keys for the organization
     * @returns ApiKeysResponse API keys retrieved successfully
     * @throws ApiError
     */
    public getAllApiKeys(): CancelablePromise<ApiKeysResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/api_key',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get API Key
     * Retrieve a specific API key
     * @param id
     * @returns ApiKeyResponse API key retrieved successfully
     * @throws ApiError
     */
    public getApiKey(
        id: string,
    ): CancelablePromise<ApiKeyResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/api_key/{id}',
            path: {
                'id': id,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Update API Key
     * Update an existing API key
     * @param id
     * @param requestBody
     * @returns ApiKeyResponse API key updated successfully
     * @throws ApiError
     */
    public updateApiKey(
        id: string,
        requestBody?: UpdateApiKeyRequest,
    ): CancelablePromise<ApiKeyResponse> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/api/api_key/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Delete API Key
     * Delete an existing API key
     * @param id
     * @returns ApiKeyResponse API key deleted successfully
     * @throws ApiError
     */
    public deleteApiKey(
        id: string,
    ): CancelablePromise<ApiKeyResponse> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/api_key/{id}',
            path: {
                'id': id,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Regenerate API Key
     * Generate a new value for an existing API key
     * @param id
     * @returns RegenerateApiKeyResponse API key regenerated successfully
     * @throws ApiError
     */
    public regenerateApiKey(
        id: string,
    ): CancelablePromise<RegenerateApiKeyResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/api_key/{id}/regenerate',
            path: {
                'id': id,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
}
