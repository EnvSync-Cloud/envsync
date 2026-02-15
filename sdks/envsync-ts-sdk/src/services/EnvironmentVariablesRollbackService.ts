/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { RollbackResponse } from '../models/RollbackResponse';
import type { RollbackToPitRequest } from '../models/RollbackToPitRequest';
import type { RollbackToTimestampRequest } from '../models/RollbackToTimestampRequest';
import type { VariableRollbackResponse } from '../models/VariableRollbackResponse';
import type { VariableRollbackToPitRequest } from '../models/VariableRollbackToPitRequest';
import type { VariableRollbackToTimestampRequest } from '../models/VariableRollbackToTimestampRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class EnvironmentVariablesRollbackService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Rollback Environment Variables to Point in Time
     * Rollback all environment variables to a specific point in time
     * @param requestBody
     * @returns RollbackResponse Environment variables rolled back successfully
     * @throws ApiError
     */
    public rollbackEnvsToPitId(
        requestBody?: RollbackToPitRequest,
    ): CancelablePromise<RollbackResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/env/rollback/pit',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Rollback Environment Variables to Timestamp
     * Rollback all environment variables to a specific timestamp
     * @param requestBody
     * @returns RollbackResponse Environment variables rolled back successfully
     * @throws ApiError
     */
    public rollbackEnvsToTimestamp(
        requestBody?: RollbackToTimestampRequest,
    ): CancelablePromise<RollbackResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/env/rollback/timestamp',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Rollback Single Variable to Point in Time
     * Rollback a specific environment variable to a point in time
     * @param key
     * @param requestBody
     * @returns VariableRollbackResponse Variable rolled back successfully
     * @throws ApiError
     */
    public rollbackVariableToPitId(
        key: string,
        requestBody?: VariableRollbackToPitRequest,
    ): CancelablePromise<VariableRollbackResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/env/rollback/variable/{key}/pit',
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
    /**
     * Rollback Single Variable to Timestamp
     * Rollback a specific environment variable to a timestamp
     * @param key
     * @param requestBody
     * @returns VariableRollbackResponse Variable rolled back successfully
     * @throws ApiError
     */
    public rollbackVariableToTimestamp(
        key: string,
        requestBody?: VariableRollbackToTimestampRequest,
    ): CancelablePromise<VariableRollbackResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/env/rollback/variable/{key}/timestamp',
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
