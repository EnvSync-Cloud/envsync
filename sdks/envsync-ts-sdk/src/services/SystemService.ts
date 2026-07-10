/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SystemStatusResponse } from '../models/SystemStatusResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class SystemService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get Management System Status
     * @returns SystemStatusResponse Management system status
     * @throws ApiError
     */
    public getManagementSystemStatus(): CancelablePromise<SystemStatusResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/system/status',
            errors: {
                500: `Internal server error`,
            },
        });
    }
}
