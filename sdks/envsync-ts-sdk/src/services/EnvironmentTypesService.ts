/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateEnvTypeRequest } from '../models/CreateEnvTypeRequest';
import type { DeleteEnvTypeRequest } from '../models/DeleteEnvTypeRequest';
import type { EnvTypeResponse } from '../models/EnvTypeResponse';
import type { EnvTypesResponse } from '../models/EnvTypesResponse';
import type { UpdateEnvTypeRequest } from '../models/UpdateEnvTypeRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class EnvironmentTypesService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get Environment Types
     * Retrieve all environment types for the organization
     * @returns EnvTypesResponse Environment types retrieved successfully
     * @throws ApiError
     */
    public getEnvTypes(): CancelablePromise<EnvTypesResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/env_type',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Create Environment Type
     * Create a new environment type
     * @param requestBody
     * @returns EnvTypeResponse Environment type created successfully
     * @throws ApiError
     */
    public createEnvType(
        requestBody?: CreateEnvTypeRequest,
    ): CancelablePromise<EnvTypeResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/env_type',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Environment Type
     * Retrieve a specific environment type
     * @param id
     * @returns EnvTypeResponse Environment type retrieved successfully
     * @throws ApiError
     */
    public getEnvType(
        id: string,
    ): CancelablePromise<EnvTypeResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/env_type/{id}',
            path: {
                'id': id,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Update Environment Type
     * Update an existing environment type
     * @param id
     * @param requestBody
     * @returns EnvTypeResponse Environment type updated successfully
     * @throws ApiError
     */
    public updateEnvType(
        id: string,
        requestBody?: UpdateEnvTypeRequest,
    ): CancelablePromise<EnvTypeResponse> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/api/env_type/{id}',
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
     * Delete Environment Type
     * Delete an existing environment type
     * @param id
     * @returns DeleteEnvTypeRequest Environment type deleted successfully
     * @throws ApiError
     */
    public deleteEnvType(
        id: string,
    ): CancelablePromise<DeleteEnvTypeRequest> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/env_type/{id}',
            path: {
                'id': id,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
}
