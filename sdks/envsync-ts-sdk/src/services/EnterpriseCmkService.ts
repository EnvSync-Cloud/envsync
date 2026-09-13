/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateOrgKmsCredentialRequest } from '../models/CreateOrgKmsCredentialRequest';
import type { OrgKmsAppsResponse } from '../models/OrgKmsAppsResponse';
import type { OrgKmsConfigResponse } from '../models/OrgKmsConfigResponse';
import type { OrgKmsCredentialResponse } from '../models/OrgKmsCredentialResponse';
import type { OrgKmsJobResponse } from '../models/OrgKmsJobResponse';
import type { OrgKmsVerifyResponse } from '../models/OrgKmsVerifyResponse';
import type { UpdateOrgKmsConfigRequest } from '../models/UpdateOrgKmsConfigRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class EnterpriseCmkService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Break-glass detach organization CMK
     * Hosted platform API. Enqueues detach-to-managed even if the org lost the kms grant or status is unavailable. Does not call ensureTenantKek.
     * @param xEnvSyncPlatformToken
     * @param orgId
     * @returns OrgKmsJobResponse Already on managed wrapping
     * @throws ApiError
     */
    public breakGlassDetachOrgKms(
        xEnvSyncPlatformToken: string,
        orgId: string,
    ): CancelablePromise<OrgKmsJobResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/manage/kms/{orgId}/break-glass-detach',
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
     * Get organization KMS config
     * Returns implicit managed/active when no org_kms_config row exists. Never returns key material.
     * @returns OrgKmsConfigResponse Organization KMS config
     * @throws ApiError
     */
    public getOrgKmsConfig(): CancelablePromise<OrgKmsConfigResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/manage/kms',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Update organization KMS config
     * Self-host cloud sources return 403 CMK_HOSTED_ONLY. Cloud attach is not wired until PR-8.
     * @param requestBody
     * @returns OrgKmsConfigResponse Organization KMS config updated
     * @throws ApiError
     */
    public updateOrgKmsConfig(
        requestBody?: UpdateOrgKmsConfigRequest,
    ): CancelablePromise<OrgKmsConfigResponse> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/api/v1/manage/kms',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                403: `Cloud CMK is Hosted-only`,
                409: `A rewrap job is already running`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Create a purpose=kms org secret
     * Encrypts the value under scope __kms_config__ before insert. Does not require the integrations feature.
     * @param requestBody
     * @returns OrgKmsCredentialResponse Credential created (value redacted)
     * @throws ApiError
     */
    public createOrgKmsCredential(
        requestBody?: CreateOrgKmsCredentialRequest,
    ): CancelablePromise<OrgKmsCredentialResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/manage/kms/credentials',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Verify organization KMS
     * Managed source succeeds immediately. Cloud verify is PR-8.
     * @returns OrgKmsVerifyResponse Verify result
     * @throws ApiError
     */
    public verifyOrgKms(): CancelablePromise<OrgKmsVerifyResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/manage/kms/verify',
            errors: {
                500: `Internal server error`,
                503: `CMK unavailable`,
            },
        });
    }
    /**
     * Rotate organization KEK
     * Re-wraps wrapped_kek under the same or new key_ref. Cloud-only; not wired until PR-8.
     * @returns OrgKmsConfigResponse KEK rotated
     * @throws ApiError
     */
    public rotateOrgKmsKek(): CancelablePromise<OrgKmsConfigResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/manage/kms/rotate-kek',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Attach organization CMK
     * Enqueues DEK rewrap under the tenant KEK. Cloud attach is PR-8.
     * @returns OrgKmsJobResponse Attach job enqueued
     * @throws ApiError
     */
    public attachOrgKms(): CancelablePromise<OrgKmsJobResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/manage/kms/attach',
            errors: {
                500: `Internal server error`,
                501: `Cloud attach not implemented`,
            },
        });
    }
    /**
     * Detach organization CMK to managed
     * Enqueues detach_managed. Does not call ensureTenantKek when status is unavailable.
     * @returns OrgKmsJobResponse Detach job enqueued
     * @throws ApiError
     */
    public detachOrgKms(): CancelablePromise<OrgKmsJobResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/manage/kms/detach',
            errors: {
                409: `A rewrap job is already running`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get organization KMS job
     * @param id
     * @returns OrgKmsJobResponse KMS job
     * @throws ApiError
     */
    public getOrgKmsJob(
        id: string,
    ): CancelablePromise<OrgKmsJobResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/manage/kms/jobs/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Job not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * List per-app KMS key info
     * Calls GetKeyInfo per app. Never returns key material.
     * @returns OrgKmsAppsResponse Per-app key metadata
     * @throws ApiError
     */
    public listOrgKmsApps(): CancelablePromise<OrgKmsAppsResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/manage/kms/apps',
            errors: {
                500: `Internal server error`,
                503: `CMK unavailable`,
            },
        });
    }
}
