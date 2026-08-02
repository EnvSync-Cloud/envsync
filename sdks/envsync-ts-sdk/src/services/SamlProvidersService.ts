/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateSamlProviderRequest } from '../models/CreateSamlProviderRequest';
import type { ErrorResponse } from '../models/ErrorResponse';
import type { SamlProviderResponse } from '../models/SamlProviderResponse';
import type { SamlProvidersResponse } from '../models/SamlProvidersResponse';
import type { UpdateSamlProviderRequest } from '../models/UpdateSamlProviderRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class SamlProvidersService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Register SAML Provider
     * Register a new SAML identity provider for SSO authentication
     * @param requestBody
     * @returns SamlProviderResponse SAML provider created successfully
     * @throws ApiError
     */
    public createSamlProvider(
        requestBody?: CreateSamlProviderRequest,
    ): CancelablePromise<SamlProviderResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/manage/saml',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get All SAML Providers
     * Retrieve all SAML providers for the organization
     * @returns SamlProvidersResponse SAML providers retrieved successfully
     * @throws ApiError
     */
    public getAllSamlProviders(): CancelablePromise<SamlProvidersResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/manage/saml',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get SAML Provider
     * Retrieve a specific SAML provider
     * @param id
     * @returns SamlProviderResponse SAML provider retrieved successfully
     * @throws ApiError
     */
    public getSamlProvider(
        id: string,
    ): CancelablePromise<SamlProviderResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/manage/saml/{id}',
            path: {
                'id': id,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Update SAML Provider
     * Update an existing SAML provider
     * @param id
     * @param requestBody
     * @returns ErrorResponse SAML provider updated successfully
     * @throws ApiError
     */
    public updateSamlProvider(
        id: string,
        requestBody?: UpdateSamlProviderRequest,
    ): CancelablePromise<ErrorResponse> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/api/v1/manage/saml/{id}',
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
     * Delete SAML Provider
     * Delete an existing SAML provider
     * @param id
     * @returns ErrorResponse SAML provider deleted successfully
     * @throws ApiError
     */
    public deleteSamlProvider(
        id: string,
    ): CancelablePromise<ErrorResponse> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/v1/manage/saml/{id}',
            path: {
                'id': id,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get SAML SP Metadata
     * Retrieve SAML Service Provider metadata XML for the organization
     * @param id
     * @returns string SP metadata XML
     * @throws ApiError
     */
    public getSamlMetadata(
        id: string,
    ): CancelablePromise<string> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/manage/saml/{id}/metadata',
            path: {
                'id': id,
            },
        });
    }
}
