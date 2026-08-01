/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateOidcProviderRequest } from '../models/CreateOidcProviderRequest';
import type { ErrorResponse } from '../models/ErrorResponse';
import type { OidcProviderResponse } from '../models/OidcProviderResponse';
import type { OidcProvidersResponse } from '../models/OidcProvidersResponse';
import type { UpdateOidcProviderRequest } from '../models/UpdateOidcProviderRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class OidcProvidersService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Register OIDC Provider
     * Register a new OIDC provider for CI/CD machine authentication
     * @param requestBody
     * @returns OidcProviderResponse OIDC provider created successfully
     * @throws ApiError
     */
    public createOidcProvider(
        requestBody?: CreateOidcProviderRequest,
    ): CancelablePromise<OidcProviderResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/manage/oidc',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get All OIDC Providers
     * Retrieve all OIDC providers for the organization
     * @returns OidcProvidersResponse OIDC providers retrieved successfully
     * @throws ApiError
     */
    public getAllOidcProviders(): CancelablePromise<OidcProvidersResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/manage/oidc',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get OIDC Provider
     * Retrieve a specific OIDC provider
     * @param id
     * @returns OidcProviderResponse OIDC provider retrieved successfully
     * @throws ApiError
     */
    public getOidcProvider(
        id: string,
    ): CancelablePromise<OidcProviderResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/manage/oidc/{id}',
            path: {
                'id': id,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Update OIDC Provider
     * Update an existing OIDC provider
     * @param id
     * @param requestBody
     * @returns ErrorResponse OIDC provider updated successfully
     * @throws ApiError
     */
    public updateOidcProvider(
        id: string,
        requestBody?: UpdateOidcProviderRequest,
    ): CancelablePromise<ErrorResponse> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/api/v1/manage/oidc/{id}',
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
     * Delete OIDC Provider
     * Delete an existing OIDC provider
     * @param id
     * @returns ErrorResponse OIDC provider deleted successfully
     * @throws ApiError
     */
    public deleteOidcProvider(
        id: string,
    ): CancelablePromise<ErrorResponse> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/v1/manage/oidc/{id}',
            path: {
                'id': id,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
}
