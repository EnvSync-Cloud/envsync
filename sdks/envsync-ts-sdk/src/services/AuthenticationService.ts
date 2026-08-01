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
     * Create Organization
     * Create a new organization for the current hosted web session and switch into it. Hosted only; self-host always 403.
     * @param requestBody
     * @returns WhoAmIResponse Organization created successfully
     * @throws ApiError
     */
    public createOrganization(
        requestBody?: {
            name: string;
        },
    ): CancelablePromise<WhoAmIResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/auth/create-organization',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid request`,
                401: `Cookie session required`,
                403: `Not allowed on this deployment (e.g. self-host)`,
                409: `Organization slug conflict or org limit reached`,
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
