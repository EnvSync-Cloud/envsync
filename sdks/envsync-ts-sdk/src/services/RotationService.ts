/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateRotationPolicyRequest } from '../models/CreateRotationPolicyRequest';
import type { ErrorResponse } from '../models/ErrorResponse';
import type { RevokeOldCredentialResponse } from '../models/RevokeOldCredentialResponse';
import type { RotationPoliciesResponse } from '../models/RotationPoliciesResponse';
import type { RotationPolicyResponse } from '../models/RotationPolicyResponse';
import type { RotationStatesResponse } from '../models/RotationStatesResponse';
import type { TriggerRotationResponse } from '../models/TriggerRotationResponse';
import type { UpdateRotationPolicyRequest } from '../models/UpdateRotationPolicyRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class RotationService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Create Rotation Policy
     * Create a new secret rotation policy for a variable
     * @param requestBody
     * @returns RotationPolicyResponse Rotation policy created successfully
     * @throws ApiError
     */
    public createRotationPolicy(
        requestBody?: CreateRotationPolicyRequest,
    ): CancelablePromise<RotationPolicyResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/manage/rotation',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Bad request`,
                403: `Forbidden`,
                409: `Conflict - policy already exists`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Rotation Policies
     * List all rotation policies for the organization
     * @param appId
     * @param envTypeId
     * @param enabled
     * @returns RotationPoliciesResponse Rotation policies retrieved successfully
     * @throws ApiError
     */
    public getRotationPolicies(
        appId?: string,
        envTypeId?: string,
        enabled?: 'true' | 'false',
    ): CancelablePromise<RotationPoliciesResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/manage/rotation',
            query: {
                'app_id': appId,
                'env_type_id': envTypeId,
                'enabled': enabled,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Rotation Policy
     * Get a specific rotation policy by ID
     * @param id
     * @returns RotationPolicyResponse Rotation policy retrieved successfully
     * @throws ApiError
     */
    public getRotationPolicy(
        id: string,
    ): CancelablePromise<RotationPolicyResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/manage/rotation/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Update Rotation Policy
     * Update an existing rotation policy
     * @param id
     * @param requestBody
     * @returns RotationPolicyResponse Rotation policy updated successfully
     * @throws ApiError
     */
    public updateRotationPolicy(
        id: string,
        requestBody?: UpdateRotationPolicyRequest,
    ): CancelablePromise<RotationPolicyResponse> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/api/v1/manage/rotation/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                403: `Forbidden`,
                404: `Not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Delete Rotation Policy
     * Delete a rotation policy
     * @param id
     * @returns ErrorResponse Rotation policy deleted successfully
     * @throws ApiError
     */
    public deleteRotationPolicy(
        id: string,
    ): CancelablePromise<ErrorResponse> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/v1/manage/rotation/{id}',
            path: {
                'id': id,
            },
            errors: {
                403: `Forbidden`,
                404: `Not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Trigger Rotation
     * Manually trigger a secret rotation for a policy
     * @param id
     * @returns TriggerRotationResponse Rotation executed successfully
     * @throws ApiError
     */
    public triggerRotation(
        id: string,
    ): CancelablePromise<TriggerRotationResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/manage/rotation/{id}/rotate',
            path: {
                'id': id,
            },
            errors: {
                403: `Forbidden`,
                404: `Not found`,
                409: `Conflict - policy disabled`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Rotation States
     * Get the rotation state history for a policy
     * @param id
     * @returns RotationStatesResponse Rotation states retrieved successfully
     * @throws ApiError
     */
    public getRotationStates(
        id: string,
    ): CancelablePromise<RotationStatesResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/manage/rotation/{id}/states',
            path: {
                'id': id,
            },
            errors: {
                404: `Not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Revoke Expired Credentials
     * Revoke old credentials that have passed their dual-credential window
     * @returns RevokeOldCredentialResponse Expired credentials revoked successfully
     * @throws ApiError
     */
    public revokeExpiredCredentials(): CancelablePromise<RevokeOldCredentialResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/manage/rotation/revoke-expired',
            errors: {
                500: `Internal server error`,
            },
        });
    }
}
