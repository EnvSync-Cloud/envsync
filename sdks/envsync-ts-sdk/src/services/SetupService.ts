/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateSetupOrgRequest } from '../models/CreateSetupOrgRequest';
import type { SetupStatusResponse } from '../models/SetupStatusResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class SetupService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Operator setup status (self-host)
     * @returns SetupStatusResponse Setup status
     * @throws ApiError
     */
    public getSetupStatus(): CancelablePromise<SetupStatusResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/setup/status',
            errors: {
                401: `Invalid setup token`,
            },
        });
    }
    /**
     * Create organization via operator setup token (self-host only)
     * @param requestBody
     * @returns any Organization created
     * @throws ApiError
     */
    public createSetupOrganization(
        requestBody?: CreateSetupOrgRequest,
    ): CancelablePromise<{
        message: string;
        org_id: string;
        admin_user_id: string;
        source: string;
        first_org: boolean;
    }> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/setup/org',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid request`,
                401: `Invalid setup token`,
                403: `Channel forbidden`,
            },
        });
    }
}
