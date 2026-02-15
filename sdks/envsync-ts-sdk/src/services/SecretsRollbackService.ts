/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { RollbackSecretsResponse } from '../models/RollbackSecretsResponse';
import type { RollbackSecretsToPitRequest } from '../models/RollbackSecretsToPitRequest';
import type { RollbackSecretsToTimestampRequest } from '../models/RollbackSecretsToTimestampRequest';
import type { SecretVariableRollbackResponse } from '../models/SecretVariableRollbackResponse';
import type { SecretVariableRollbackToPitRequest } from '../models/SecretVariableRollbackToPitRequest';
import type { SecretVariableRollbackToTimestampRequest } from '../models/SecretVariableRollbackToTimestampRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class SecretsRollbackService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Rollback Secrets to Point in Time
     * Rollback all secrets to a specific point in time
     * @param requestBody
     * @returns RollbackSecretsResponse Secrets rolled back successfully
     * @throws ApiError
     */
    public rollbackSecretsToPitId(
        requestBody?: RollbackSecretsToPitRequest,
    ): CancelablePromise<RollbackSecretsResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/secret/rollback/pit',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Rollback Secrets to Timestamp
     * Rollback all secrets to a specific timestamp
     * @param requestBody
     * @returns RollbackSecretsResponse Secrets rolled back successfully
     * @throws ApiError
     */
    public rollbackSecretsToTimestamp(
        requestBody?: RollbackSecretsToTimestampRequest,
    ): CancelablePromise<RollbackSecretsResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/secret/rollback/timestamp',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Rollback Single Secret Variable to Point in Time
     * Rollback a specific secret variable to a point in time
     * @param key
     * @param requestBody
     * @returns SecretVariableRollbackResponse Secret variable rolled back successfully
     * @throws ApiError
     */
    public rollbackSecretVariableToPitId(
        key: string,
        requestBody?: SecretVariableRollbackToPitRequest,
    ): CancelablePromise<SecretVariableRollbackResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/secret/rollback/variable/{key}/pit',
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
     * Rollback Single Secret Variable to Timestamp
     * Rollback a specific secret variable to a timestamp
     * @param key
     * @param requestBody
     * @returns SecretVariableRollbackResponse Secret variable rolled back successfully
     * @throws ApiError
     */
    public rollbackSecretVariableToTimestamp(
        key: string,
        requestBody?: SecretVariableRollbackToTimestampRequest,
    ): CancelablePromise<SecretVariableRollbackResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/secret/rollback/variable/{key}/timestamp',
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
