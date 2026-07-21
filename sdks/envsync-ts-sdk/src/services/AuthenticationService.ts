/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { WhoAmIResponse } from '../models/WhoAmIResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class AuthenticationService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get Current User
     * Retrieve the current authenticated user's information and their organization details
     * @returns WhoAmIResponse User information retrieved successfully
     * @throws ApiError
     */
    public whoami(): CancelablePromise<WhoAmIResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/auth/me',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Create Workspace
     * Create a new workspace for the current enterprise web session and switch into it
     * @param requestBody
     * @returns WhoAmIResponse Workspace created successfully
     * @throws ApiError
     */
    public createWorkspace(
        requestBody?: {
            name: string;
        },
    ): CancelablePromise<WhoAmIResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/auth/create-workspace',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid request`,
                401: `Cookie session required`,
                403: `Enterprise edition required`,
                409: `Workspace slug conflict`,
            },
        });
    }
    /**
     * Switch Active Organization
     * Switch the active organization membership for the current web session
     * @param requestBody
     * @returns WhoAmIResponse Active organization switched successfully
     * @throws ApiError
     */
    public switchOrg(
        requestBody?: {
            org_id: string;
        },
    ): CancelablePromise<WhoAmIResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/auth/switch-org',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid request`,
                401: `Cookie session required`,
                403: `User does not belong to the requested organization`,
            },
        });
    }
}
