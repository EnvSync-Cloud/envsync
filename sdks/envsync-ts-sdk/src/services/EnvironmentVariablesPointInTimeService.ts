/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EnvDiffRequest } from '../models/EnvDiffRequest';
import type { EnvDiffResponse } from '../models/EnvDiffResponse';
import type { EnvHistoryRequest } from '../models/EnvHistoryRequest';
import type { EnvHistoryResponse } from '../models/EnvHistoryResponse';
import type { EnvPitRequest } from '../models/EnvPitRequest';
import type { EnvPitStateResponse } from '../models/EnvPitStateResponse';
import type { EnvTimestampRequest } from '../models/EnvTimestampRequest';
import type { VariableTimelineRequest } from '../models/VariableTimelineRequest';
import type { VariableTimelineResponse } from '../models/VariableTimelineResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class EnvironmentVariablesPointInTimeService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get Environment Variables History
     * Retrieve paginated history of environment variable changes
     * @param requestBody
     * @returns EnvHistoryResponse Environment variables history retrieved successfully
     * @throws ApiError
     */
    public getEnvHistory(
        requestBody?: EnvHistoryRequest,
    ): CancelablePromise<EnvHistoryResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/env/history',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Environment Variables at Point in Time
     * Retrieve environment variables state at a specific point in time
     * @param requestBody
     * @returns EnvPitStateResponse Environment variables at point in time retrieved successfully
     * @throws ApiError
     */
    public getEnvsAtPointInTime(
        requestBody?: EnvPitRequest,
    ): CancelablePromise<EnvPitStateResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/env/pit',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Environment Variables at Timestamp
     * Retrieve environment variables state at a specific timestamp
     * @param requestBody
     * @returns EnvPitStateResponse Environment variables at timestamp retrieved successfully
     * @throws ApiError
     */
    public getEnvsAtTimestamp(
        requestBody?: EnvTimestampRequest,
    ): CancelablePromise<EnvPitStateResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/env/timestamp',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Environment Variables Diff
     * Compare environment variables between two points in time
     * @param requestBody
     * @returns EnvDiffResponse Environment variables diff retrieved successfully
     * @throws ApiError
     */
    public getEnvDiff(
        requestBody?: EnvDiffRequest,
    ): CancelablePromise<EnvDiffResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/env/diff',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Variable Timeline
     * Get timeline of changes for a specific environment variable
     * @param key
     * @param requestBody
     * @returns VariableTimelineResponse Variable timeline retrieved successfully
     * @throws ApiError
     */
    public getVariableTimeline(
        key: string,
        requestBody?: VariableTimelineRequest,
    ): CancelablePromise<VariableTimelineResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/env/timeline/{key}',
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
