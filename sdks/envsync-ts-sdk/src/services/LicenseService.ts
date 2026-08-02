/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { LicenseActionResponse } from '../models/LicenseActionResponse';
import type { LicenseStatusResponse } from '../models/LicenseStatusResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class LicenseService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get Management License Status
     * @returns LicenseStatusResponse Current license status
     * @throws ApiError
     */
    public getManagementLicenseStatus(): CancelablePromise<LicenseStatusResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/manage/license/status',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Activate Management License
     * @returns LicenseActionResponse License activated
     * @throws ApiError
     */
    public activateManagementLicense(): CancelablePromise<LicenseActionResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/manage/license/activate',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Verify Management License
     * @returns LicenseActionResponse License verified
     * @throws ApiError
     */
    public verifyManagementLicense(): CancelablePromise<LicenseActionResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/manage/license/verify',
            errors: {
                500: `Internal server error`,
            },
        });
    }
}
