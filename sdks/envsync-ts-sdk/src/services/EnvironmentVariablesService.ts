/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BatchCreateEnvsRequest } from '../models/BatchCreateEnvsRequest';
import type { BatchDeleteEnvsRequest } from '../models/BatchDeleteEnvsRequest';
import type { BatchEnvsResponse } from '../models/BatchEnvsResponse';
import type { CreateEnvRequest } from '../models/CreateEnvRequest';
import type { DeleteEnvRequest } from '../models/DeleteEnvRequest';
import type { EnvResponse } from '../models/EnvResponse';
import type { EnvsResponse } from '../models/EnvsResponse';
import type { GetEnvRequest } from '../models/GetEnvRequest';
import type { UpdateEnvRequest } from '../models/UpdateEnvRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class EnvironmentVariablesService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get Environment Variables
     * Retrieve all environment variables for an application and environment type
     * @param requestBody
     * @returns EnvsResponse Environment variables retrieved successfully
     * @throws ApiError
     */
    public getEnvs(
        requestBody?: GetEnvRequest,
    ): CancelablePromise<EnvsResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/env',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Delete Environment Variable
     * Delete an existing environment variable
     * @param requestBody
     * @returns DeleteEnvRequest Environment variable deleted successfully
     * @throws ApiError
     */
    public deleteEnv(
        requestBody?: DeleteEnvRequest,
    ): CancelablePromise<DeleteEnvRequest> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/env',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Single Environment Variable
     * Retrieve a specific environment variable
     * @param key
     * @param requestBody
     * @returns EnvResponse Environment variable retrieved successfully
     * @throws ApiError
     */
    public getEnv(
        key: string,
        requestBody?: GetEnvRequest,
    ): CancelablePromise<EnvResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/env/i/{key}',
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
     * Update Environment Variable
     * Update an existing environment variable
     * @param key
     * @param requestBody
     * @returns EnvResponse Environment variable updated successfully
     * @throws ApiError
     */
    public updateEnv(
        key: string,
        requestBody?: UpdateEnvRequest,
    ): CancelablePromise<EnvResponse> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/api/env/i/{key}',
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
     * Create Environment Variable
     * Create a new environment variable
     * @param requestBody
     * @returns EnvResponse Environment variable created successfully
     * @throws ApiError
     */
    public createEnv(
        requestBody?: CreateEnvRequest,
    ): CancelablePromise<EnvResponse> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/api/env/single',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Batch Create Environment Variables
     * Create multiple environment variables in a single request
     * @param requestBody
     * @returns BatchEnvsResponse Environment variables created successfully
     * @throws ApiError
     */
    public batchCreateEnvs(
        requestBody?: BatchCreateEnvsRequest,
    ): CancelablePromise<BatchEnvsResponse> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/api/env/batch',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Batch Update Environment Variables
     * Update multiple environment variables in a single request
     * @param requestBody
     * @returns BatchEnvsResponse Environment variables updated successfully
     * @throws ApiError
     */
    public batchUpdateEnvs(
        requestBody?: BatchCreateEnvsRequest,
    ): CancelablePromise<BatchEnvsResponse> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/api/env/batch',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Batch Delete Environment Variables
     * Delete multiple environment variables in a single request
     * @param requestBody
     * @returns BatchEnvsResponse Environment variables deleted successfully
     * @throws ApiError
     */
    public deleteBatchEnv(
        requestBody?: BatchDeleteEnvsRequest,
    ): CancelablePromise<BatchEnvsResponse> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/env/batch',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
}
