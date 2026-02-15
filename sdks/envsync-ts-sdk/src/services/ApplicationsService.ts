/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateAppRequest } from '../models/CreateAppRequest';
import type { CreateAppResponse } from '../models/CreateAppResponse';
import type { DeleteAppResponse } from '../models/DeleteAppResponse';
import type { GetAppResponse } from '../models/GetAppResponse';
import type { GetAppsResponse } from '../models/GetAppsResponse';
import type { UpdateAppRequest } from '../models/UpdateAppRequest';
import type { UpdateAppResponse } from '../models/UpdateAppResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class ApplicationsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get All Applications
     * Retrieve all applications for the organization
     * @returns GetAppsResponse Applications retrieved successfully
     * @throws ApiError
     */
    public getApps(): CancelablePromise<GetAppsResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/app',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Create Application
     * Create a new application
     * @param requestBody
     * @returns CreateAppResponse Application created successfully
     * @throws ApiError
     */
    public createApp(
        requestBody?: CreateAppRequest,
    ): CancelablePromise<CreateAppResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/app',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Application
     * Retrieve a specific application by ID
     * @param id
     * @returns GetAppResponse Application retrieved successfully
     * @throws ApiError
     */
    public getApp(
        id: string,
    ): CancelablePromise<GetAppResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/app/{id}',
            path: {
                'id': id,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Update Application
     * Update an existing application
     * @param id
     * @param requestBody
     * @returns UpdateAppResponse Application updated successfully
     * @throws ApiError
     */
    public updateApp(
        id: string,
        requestBody?: UpdateAppRequest,
    ): CancelablePromise<UpdateAppResponse> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/api/app/{id}',
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
     * Delete Application
     * Delete an existing application
     * @param id
     * @returns DeleteAppResponse Application deleted successfully
     * @throws ApiError
     */
    public deleteApp(
        id: string,
    ): CancelablePromise<DeleteAppResponse> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/app/{id}',
            path: {
                'id': id,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
}
