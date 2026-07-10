/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateServiceTokenRequest } from '../models/CreateServiceTokenRequest';
import type { CreateServiceTokenResponse } from '../models/CreateServiceTokenResponse';
import type { ErrorResponse } from '../models/ErrorResponse';
import type { ServiceTokenResponse } from '../models/ServiceTokenResponse';
import type { ServiceTokensResponse } from '../models/ServiceTokensResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class ServiceTokensService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Create Service Token
     * Create a new scoped service token for the organization
     * @param requestBody
     * @returns CreateServiceTokenResponse Service token created successfully
     * @throws ApiError
     */
    public createServiceToken(
        requestBody?: CreateServiceTokenRequest,
    ): CancelablePromise<CreateServiceTokenResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/service_token',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get All Service Tokens
     * Retrieve all service tokens for the organization
     * @returns ServiceTokensResponse Service tokens retrieved successfully
     * @throws ApiError
     */
    public getAllServiceTokens(): CancelablePromise<ServiceTokensResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/service_token',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Service Token
     * Retrieve a specific service token (does not return the raw token)
     * @param id
     * @returns ServiceTokenResponse Service token retrieved successfully
     * @throws ApiError
     */
    public getServiceToken(
        id: string,
    ): CancelablePromise<ServiceTokenResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/service_token/{id}',
            path: {
                'id': id,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Delete Service Token
     * Delete an existing service token
     * @param id
     * @returns ErrorResponse Service token deleted successfully
     * @throws ApiError
     */
    public deleteServiceToken(
        id: string,
    ): CancelablePromise<ErrorResponse> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/service_token/{id}',
            path: {
                'id': id,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
}
