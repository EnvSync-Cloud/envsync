/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { OrgFeatureGrantResponse } from '../models/OrgFeatureGrantResponse';
import type { PutOrgFeatureGrantRequest } from '../models/PutOrgFeatureGrantRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class OrgFeaturesService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get Organization Feature Grant
     * Hosted platform API. No row means unrestricted (full catalog).
     * @param xEnvSyncPlatformToken
     * @param orgId
     * @returns OrgFeatureGrantResponse Organization feature grant
     * @throws ApiError
     */
    public getOrgFeatureGrant(
        xEnvSyncPlatformToken: string,
        orgId: string,
    ): CancelablePromise<OrgFeatureGrantResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/manage/org-features/{orgId}',
            path: {
                'orgId': orgId,
            },
            headers: {
                'X-EnvSync-Platform-Token': xEnvSyncPlatformToken,
            },
            errors: {
                401: `Invalid platform token`,
                403: `Not hosted`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Replace Organization Feature Grant
     * Patch plan and/or overlay_features. Omitted fields stay. Overlay is additive on the plan defaults and does not change numeric caps. Unknown catalog keys are dropped.
     * @param xEnvSyncPlatformToken
     * @param orgId
     * @param requestBody
     * @returns OrgFeatureGrantResponse Organization feature grant replaced
     * @throws ApiError
     */
    public putOrgFeatureGrant(
        xEnvSyncPlatformToken: string,
        orgId: string,
        requestBody?: PutOrgFeatureGrantRequest,
    ): CancelablePromise<OrgFeatureGrantResponse> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/api/v1/manage/org-features/{orgId}',
            path: {
                'orgId': orgId,
            },
            headers: {
                'X-EnvSync-Platform-Token': xEnvSyncPlatformToken,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Invalid platform token`,
                403: `Not hosted`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Delete Organization Feature Grant
     * Resets the organization to the Developer plan with an empty overlay.
     * @param xEnvSyncPlatformToken
     * @param orgId
     * @returns OrgFeatureGrantResponse Grant deleted; organization unrestricted
     * @throws ApiError
     */
    public deleteOrgFeatureGrant(
        xEnvSyncPlatformToken: string,
        orgId: string,
    ): CancelablePromise<OrgFeatureGrantResponse> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/v1/manage/org-features/{orgId}',
            path: {
                'orgId': orgId,
            },
            headers: {
                'X-EnvSync-Platform-Token': xEnvSyncPlatformToken,
            },
            errors: {
                401: `Invalid platform token`,
                403: `Not hosted`,
                500: `Internal server error`,
            },
        });
    }
}
