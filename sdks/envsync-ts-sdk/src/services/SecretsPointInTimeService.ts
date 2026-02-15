/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SecretDiffRequest } from '../models/SecretDiffRequest';
import type { SecretDiffResponse } from '../models/SecretDiffResponse';
import type { SecretHistoryRequest } from '../models/SecretHistoryRequest';
import type { SecretHistoryResponse } from '../models/SecretHistoryResponse';
import type { SecretPitRequest } from '../models/SecretPitRequest';
import type { SecretPitStateResponse } from '../models/SecretPitStateResponse';
import type { SecretTimestampRequest } from '../models/SecretTimestampRequest';
import type { SecretVariableTimelineRequest } from '../models/SecretVariableTimelineRequest';
import type { SecretVariableTimelineResponse } from '../models/SecretVariableTimelineResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class SecretsPointInTimeService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get Secrets History
     * Retrieve paginated history of secret changes
     * @param requestBody
     * @returns SecretHistoryResponse Secrets history retrieved successfully
     * @throws ApiError
     */
    public getSecretHistory(
        requestBody?: SecretHistoryRequest,
    ): CancelablePromise<SecretHistoryResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/secret/history',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Secrets at Point in Time
     * Retrieve secrets state at a specific point in time
     * @param requestBody
     * @returns SecretPitStateResponse Secrets at point in time retrieved successfully
     * @throws ApiError
     */
    public getSecretsAtPointInTime(
        requestBody?: SecretPitRequest,
    ): CancelablePromise<SecretPitStateResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/secret/pit',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Secrets at Timestamp
     * Retrieve secrets state at a specific timestamp
     * @param requestBody
     * @returns SecretPitStateResponse Secrets at timestamp retrieved successfully
     * @throws ApiError
     */
    public getSecretsAtTimestamp(
        requestBody?: SecretTimestampRequest,
    ): CancelablePromise<SecretPitStateResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/secret/timestamp',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Secrets Diff
     * Compare secrets between two points in time
     * @param requestBody
     * @returns SecretDiffResponse Secrets diff retrieved successfully
     * @throws ApiError
     */
    public getSecretDiff(
        requestBody?: SecretDiffRequest,
    ): CancelablePromise<SecretDiffResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/secret/diff',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Secret Variable Timeline
     * Get timeline of changes for a specific secret variable
     * @param key
     * @param requestBody
     * @returns SecretVariableTimelineResponse Secret variable timeline retrieved successfully
     * @throws ApiError
     */
    public getSecretVariableTimeline(
        key: string,
        requestBody?: SecretVariableTimelineRequest,
    ): CancelablePromise<SecretVariableTimelineResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/secret/timeline/{key}',
            path: {
                'key': key,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
}
