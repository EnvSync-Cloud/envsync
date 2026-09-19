/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateServiceTokenRequest } from '../models/CreateServiceTokenRequest';
import type { CreateServiceTokenResponse } from '../models/CreateServiceTokenResponse';
import type { ErrorResponse } from '../models/ErrorResponse';
import type { ListServiceTokensQuery } from '../models/ListServiceTokensQuery';
import type { RotateServiceTokenRequest } from '../models/RotateServiceTokenRequest';
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
     * Retrieve service tokens for the organization. Pass app_id to limit the list to one project.
     * @param componentsSchemasListServiceTokensQuery
     * @returns ServiceTokensResponse Service tokens retrieved successfully
     * @throws ApiError
     */
    public getAllServiceTokens(
        componentsSchemasListServiceTokensQuery?: ListServiceTokensQuery,
    ): CancelablePromise<ServiceTokensResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/service_token',
            query: {
                '#/components/schemas/ListServiceTokensQuery': componentsSchemasListServiceTokensQuery,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Rotate Service Token
     * Issue a new esv_ token for an existing service token. The previous hash stays valid until the grace window ends (default 24h, 0–7 days).
     * @param id
     * @param requestBody
     * @returns CreateServiceTokenResponse Service token rotated successfully
     * @throws ApiError
     */
    public rotateServiceToken(
        id: string,
        requestBody?: RotateServiceTokenRequest,
    ): CancelablePromise<CreateServiceTokenResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/service_token/{id}/rotate',
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
