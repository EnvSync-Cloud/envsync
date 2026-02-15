/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CallbackResponse } from '../models/CallbackResponse';
import type { LoginUrlResponse } from '../models/LoginUrlResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class AccessService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Initiate CLI Login
     * Generate authentication URL for CLI login
     * @returns LoginUrlResponse CLI login initiated successfully.
     * @throws ApiError
     */
    public createCliLogin(): CancelablePromise<LoginUrlResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/access/cli',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Create Web Login URL
     * Generate authentication URL for web login
     * @returns LoginUrlResponse Web login URL created successfully
     * @throws ApiError
     */
    public createWebLogin(): CancelablePromise<LoginUrlResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/access/web',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Web Login Callback
     * Handle web login callback from Auth0
     * @param code
     * @returns void
     * @throws ApiError
     */
    public callbackWebLogin(
        code: string,
    ): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/access/web/callback',
            query: {
                'code': code,
            },
            errors: {
                302: `Redirect with authentication token`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Create API Login URL
     * Generate authentication URL for API login
     * @returns LoginUrlResponse API login URL created successfully
     * @throws ApiError
     */
    public createApiLogin(): CancelablePromise<LoginUrlResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/access/api',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * API Login Callback
     * Handle API login callback from Auth0
     * @param code
     * @returns CallbackResponse API login callback successful
     * @throws ApiError
     */
    public callbackApiLogin(
        code: string,
    ): CancelablePromise<CallbackResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/access/api/callback',
            query: {
                'code': code,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
}
