/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChangeRequestListResponse } from '../models/ChangeRequestListResponse';
import type { ChangeRequestResponse } from '../models/ChangeRequestResponse';
import type { DirectChangeRequestBody } from '../models/DirectChangeRequestBody';
import type { PromotionChangeRequestBody } from '../models/PromotionChangeRequestBody';
import type { RejectChangeRequestBody } from '../models/RejectChangeRequestBody';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class ChangeRequestsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Create Direct Change Request
     * Create a protected-environment change request with explicit env and secret changes.
     * @param requestBody
     * @returns ChangeRequestResponse Direct change request created
     * @throws ApiError
     */
    public createDirectChangeRequest(
        requestBody?: DirectChangeRequestBody,
    ): CancelablePromise<ChangeRequestResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/change_request/direct',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation error`,
            },
        });
    }
    /**
     * Create Promotion Change Request
     * Create a promotion request from one app environment to another protected environment.
     * @param requestBody
     * @returns ChangeRequestResponse Promotion change request created
     * @throws ApiError
     */
    public createPromotionChangeRequest(
        requestBody?: PromotionChangeRequestBody,
    ): CancelablePromise<ChangeRequestResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/change_request/promotion',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * List Change Requests
     * List change requests for the current organization. Pass app_id to limit the list to one project.
     * @returns ChangeRequestListResponse Change requests listed
     * @throws ApiError
     */
    public listChangeRequests(): CancelablePromise<ChangeRequestListResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/change_request',
        });
    }
    /**
     * Get Change Request
     * Fetch a single change request including env and secret item diffs.
     * @param id
     * @returns ChangeRequestResponse Change request fetched
     * @throws ApiError
     */
    public getChangeRequest(
        id: string,
    ): CancelablePromise<ChangeRequestResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/change_request/{id}',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Approve Change Request
     * Approve a pending change request and apply it atomically to the target environment.
     * @param id
     * @returns ChangeRequestResponse Change request approved and applied
     * @throws ApiError
     */
    public approveChangeRequest(
        id: string,
    ): CancelablePromise<ChangeRequestResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/change_request/{id}/approve',
            path: {
                'id': id,
            },
            errors: {
                404: `Change request not found`,
            },
        });
    }
    /**
     * Reject Change Request
     * Reject a pending change request without mutating the target environment.
     * @param id
     * @param requestBody
     * @returns ChangeRequestResponse Change request rejected
     * @throws ApiError
     */
    public rejectChangeRequest(
        id: string,
        requestBody?: RejectChangeRequestBody,
    ): CancelablePromise<ChangeRequestResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/change_request/{id}/reject',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                404: `Change request not found`,
            },
        });
    }
    /**
     * Cancel Change Request
     * Cancel a pending change request created by the current user.
     * @param id
     * @returns ChangeRequestResponse Change request cancelled
     * @throws ApiError
     */
    public cancelChangeRequest(
        id: string,
    ): CancelablePromise<ChangeRequestResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/change_request/{id}/cancel',
            path: {
                'id': id,
            },
            errors: {
                404: `Change request not found`,
            },
        });
    }
}
