/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CleanupResponse } from '../models/CleanupResponse';
import type { CreateDynamicSecretEngineRequest } from '../models/CreateDynamicSecretEngineRequest';
import type { CreateDynamicSecretLeaseRequest } from '../models/CreateDynamicSecretLeaseRequest';
import type { DynamicSecretEngineResponse } from '../models/DynamicSecretEngineResponse';
import type { DynamicSecretEnginesResponse } from '../models/DynamicSecretEnginesResponse';
import type { DynamicSecretLeaseResponse } from '../models/DynamicSecretLeaseResponse';
import type { DynamicSecretLeasesResponse } from '../models/DynamicSecretLeasesResponse';
import type { ErrorResponse } from '../models/ErrorResponse';
import type { RevokeLeaseResponse } from '../models/RevokeLeaseResponse';
import type { UpdateDynamicSecretEngineRequest } from '../models/UpdateDynamicSecretEngineRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class DynamicSecretsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Create Dynamic Secret Engine
     * Create a new dynamic secret engine for short-lived credential generation
     * @param requestBody
     * @returns DynamicSecretEngineResponse Engine created successfully
     * @throws ApiError
     */
    public createDynamicSecretEngine(
        requestBody?: CreateDynamicSecretEngineRequest,
    ): CancelablePromise<DynamicSecretEngineResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/dynamic_secret/engines',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error`,
                409: `Engine name conflict`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get All Dynamic Secret Engines
     * Retrieve all dynamic secret engines for the organization
     * @returns DynamicSecretEnginesResponse Engines retrieved successfully
     * @throws ApiError
     */
    public getAllDynamicSecretEngines(): CancelablePromise<DynamicSecretEnginesResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/dynamic_secret/engines',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Dynamic Secret Engine
     * Retrieve a specific dynamic secret engine by ID
     * @param id
     * @returns DynamicSecretEngineResponse Engine retrieved successfully
     * @throws ApiError
     */
    public getDynamicSecretEngine(
        id: string,
    ): CancelablePromise<DynamicSecretEngineResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/dynamic_secret/engines/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Engine not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Update Dynamic Secret Engine
     * Update an existing dynamic secret engine
     * @param id
     * @param requestBody
     * @returns DynamicSecretEngineResponse Engine updated successfully
     * @throws ApiError
     */
    public updateDynamicSecretEngine(
        id: string,
        requestBody?: UpdateDynamicSecretEngineRequest,
    ): CancelablePromise<DynamicSecretEngineResponse> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/api/dynamic_secret/engines/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                404: `Engine not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Delete Dynamic Secret Engine
     * Delete a dynamic secret engine (must have no active leases)
     * @param id
     * @returns ErrorResponse Engine deleted successfully
     * @throws ApiError
     */
    public deleteDynamicSecretEngine(
        id: string,
    ): CancelablePromise<ErrorResponse> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/dynamic_secret/engines/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Engine not found`,
                409: `Engine has active leases`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Create Dynamic Secret Lease
     * Generate short-lived credentials by creating a lease on an engine
     * @param id
     * @param requestBody
     * @returns DynamicSecretLeaseResponse Lease created successfully
     * @throws ApiError
     */
    public createDynamicSecretLease(
        id: string,
        requestBody?: CreateDynamicSecretLeaseRequest,
    ): CancelablePromise<DynamicSecretLeaseResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/dynamic_secret/engines/{id}/leases',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Validation error`,
                404: `Engine not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Leases for Engine
     * Retrieve all leases for a specific dynamic secret engine
     * @param id
     * @returns DynamicSecretLeasesResponse Leases retrieved successfully
     * @throws ApiError
     */
    public getDynamicSecretLeases(
        id: string,
    ): CancelablePromise<DynamicSecretLeasesResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/dynamic_secret/engines/{id}/leases',
            path: {
                'id': id,
            },
            errors: {
                404: `Engine not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Dynamic Secret Lease
     * Retrieve a specific lease by ID
     * @param leaseId
     * @returns DynamicSecretLeaseResponse Lease retrieved successfully
     * @throws ApiError
     */
    public getDynamicSecretLease(
        leaseId: string,
    ): CancelablePromise<DynamicSecretLeaseResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/dynamic_secret/leases/{leaseId}',
            path: {
                'leaseId': leaseId,
            },
            errors: {
                404: `Lease not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Revoke Dynamic Secret Lease
     * Revoke a lease and its associated credentials
     * @param leaseId
     * @returns RevokeLeaseResponse Lease revoked successfully
     * @throws ApiError
     */
    public revokeDynamicSecretLease(
        leaseId: string,
    ): CancelablePromise<RevokeLeaseResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/dynamic_secret/leases/{leaseId}/revoke',
            path: {
                'leaseId': leaseId,
            },
            errors: {
                404: `Lease not found`,
                409: `Lease already revoked`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Cleanup Expired Leases
     * Mark all expired leases as revoked (admin operation)
     * @returns CleanupResponse Cleanup completed
     * @throws ApiError
     */
    public cleanupExpiredLeases(): CancelablePromise<CleanupResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/dynamic_secret/leases/cleanup',
            errors: {
                500: `Internal server error`,
            },
        });
    }
}
