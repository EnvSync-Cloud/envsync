/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PlatformProvisionRequest } from '../models/PlatformProvisionRequest';
import type { PlatformProvisionResponse } from '../models/PlatformProvisionResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class PlatformService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Provision a Hosted organization (SuperAdmin)
     * Hosted platform API. existing_identity attaches a new org to a membership. fresh_tenant creates Keycloak user + org. Source is hosted_ops; per-user org caps are skipped.
     * @param xEnvSyncPlatformToken
     * @param requestBody
     * @returns PlatformProvisionResponse Organization provisioned
     * @throws ApiError
     */
    public provisionPlatformOrganization(
        xEnvSyncPlatformToken: string,
        requestBody?: PlatformProvisionRequest,
    ): CancelablePromise<PlatformProvisionResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/platform/organizations',
            headers: {
                'X-EnvSync-Platform-Token': xEnvSyncPlatformToken,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Invalid platform token`,
                403: `Not hosted`,
                409: `User or organization already exists`,
            },
        });
    }
}
