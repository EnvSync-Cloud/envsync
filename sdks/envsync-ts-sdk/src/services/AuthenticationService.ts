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
}
