/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BatchCreateSecretsRequest } from '../models/BatchCreateSecretsRequest';
import type { BatchDeleteSecretsRequest } from '../models/BatchDeleteSecretsRequest';
import type { BatchSecretsResponse } from '../models/BatchSecretsResponse';
import type { CreateSecretRequest } from '../models/CreateSecretRequest';
import type { DeleteSecretRequest } from '../models/DeleteSecretRequest';
import type { GetSecretRequest } from '../models/GetSecretRequest';
import type { RevealSecretsRequest } from '../models/RevealSecretsRequest';
import type { RevealSecretsResponse } from '../models/RevealSecretsResponse';
import type { SecretResponse } from '../models/SecretResponse';
import type { SecretsResponse } from '../models/SecretsResponse';
import type { UpdateSecretRequest } from '../models/UpdateSecretRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class SecretsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get Secrets
     * Retrieve all secrets for an application and environment type
     * @param requestBody
     * @returns SecretsResponse Secrets retrieved successfully
     * @throws ApiError
     */
    public getSecrets(
        requestBody?: GetSecretRequest,
    ): CancelablePromise<SecretsResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/secret',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Delete Secret
     * Delete an existing secret
     * @param requestBody
     * @returns BatchSecretsResponse Secret deleted successfully
     * @throws ApiError
     */
    public deleteSecret(
        requestBody?: DeleteSecretRequest,
    ): CancelablePromise<BatchSecretsResponse> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/secret',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Single Secret
     * Retrieve a specific secret
     * @param key
     * @param requestBody
     * @returns SecretResponse Secret retrieved successfully
     * @throws ApiError
     */
    public getSecret(
        key: string,
        requestBody?: GetSecretRequest,
    ): CancelablePromise<SecretResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/secret/i/{key}',
            path: {
                'key': key,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Update Secret
     * Update an existing secret
     * @param key
     * @param requestBody
     * @returns BatchSecretsResponse Secret updated successfully
     * @throws ApiError
     */
    public updateSecret(
        key: string,
        requestBody?: UpdateSecretRequest,
    ): CancelablePromise<BatchSecretsResponse> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/api/secret/i/{key}',
            path: {
                'key': key,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Create Secret
     * Create a new secret
     * @param requestBody
     * @returns SecretResponse Secret created successfully
     * @throws ApiError
     */
    public createSecret(
        requestBody?: CreateSecretRequest,
    ): CancelablePromise<SecretResponse> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/api/secret/single',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Batch Create Secrets
     * Create multiple secrets in a single request
     * @param requestBody
     * @returns BatchSecretsResponse Secrets created successfully
     * @throws ApiError
     */
    public batchCreateSecrets(
        requestBody?: BatchCreateSecretsRequest,
    ): CancelablePromise<BatchSecretsResponse> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/api/secret/batch',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Batch Update Secrets
     * Update multiple secrets in a single request
     * @param requestBody
     * @returns BatchSecretsResponse Secrets updated successfully
     * @throws ApiError
     */
    public batchUpdateSecrets(
        requestBody?: BatchCreateSecretsRequest,
    ): CancelablePromise<BatchSecretsResponse> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/api/secret/batch',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Batch Delete Secrets
     * Delete multiple secrets in a single request
     * @param requestBody
     * @returns BatchSecretsResponse Secrets deleted successfully
     * @throws ApiError
     */
    public deleteBatchSecrets(
        requestBody?: BatchDeleteSecretsRequest,
    ): CancelablePromise<BatchSecretsResponse> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/secret/batch',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Reveal Secrets
     * Decrypt and reveal secret values for managed apps
     * @param requestBody
     * @returns RevealSecretsResponse Secrets revealed successfully
     * @throws ApiError
     */
    public revealSecrets(
        requestBody?: RevealSecretsRequest,
    ): CancelablePromise<RevealSecretsResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/secret/reveal',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
}
