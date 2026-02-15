/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AcceptOrgInviteRequest } from '../models/AcceptOrgInviteRequest';
import type { AcceptOrgInviteResponse } from '../models/AcceptOrgInviteResponse';
import type { AcceptUserInviteRequest } from '../models/AcceptUserInviteRequest';
import type { AcceptUserInviteResponse } from '../models/AcceptUserInviteResponse';
import type { CreateOrgInviteRequest } from '../models/CreateOrgInviteRequest';
import type { CreateOrgInviteResponse } from '../models/CreateOrgInviteResponse';
import type { CreateUserInviteRequest } from '../models/CreateUserInviteRequest';
import type { CreateUserInviteResponse } from '../models/CreateUserInviteResponse';
import type { DeleteUserInviteResponse } from '../models/DeleteUserInviteResponse';
import type { GetOrgInviteByCodeResponse } from '../models/GetOrgInviteByCodeResponse';
import type { GetUserInviteByTokenResponse } from '../models/GetUserInviteByTokenResponse';
import type { UpdateUserInviteRequest } from '../models/UpdateUserInviteRequest';
import type { UpdateUserInviteResponse } from '../models/UpdateUserInviteResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class OnboardingService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Create Organization Invite
     * Create an organization invite
     * @param requestBody
     * @returns CreateOrgInviteResponse Successful greeting response
     * @throws ApiError
     */
    public createOrgInvite(
        requestBody?: CreateOrgInviteRequest,
    ): CancelablePromise<CreateOrgInviteResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/onboarding/org',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Organization Invite by Code
     * Get organization invite by code
     * @param inviteCode
     * @returns GetOrgInviteByCodeResponse Organization invite retrieved successfully
     * @throws ApiError
     */
    public getOrgInviteByCode(
        inviteCode: string,
    ): CancelablePromise<GetOrgInviteByCodeResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/onboarding/org/{invite_code}',
            path: {
                'invite_code': inviteCode,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Accept Organization Invite
     * Accept organization invite
     * @param inviteCode
     * @param requestBody
     * @returns AcceptOrgInviteResponse Organization invite accepted successfully
     * @throws ApiError
     */
    public acceptOrgInvite(
        inviteCode: string,
        requestBody?: AcceptOrgInviteRequest,
    ): CancelablePromise<AcceptOrgInviteResponse> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/api/onboarding/org/{invite_code}/accept',
            path: {
                'invite_code': inviteCode,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get User Invite by Code
     * Get user invite by code
     * @param inviteCode
     * @returns GetUserInviteByTokenResponse User invite retrieved successfully
     * @throws ApiError
     */
    public getUserInviteByCode(
        inviteCode: string,
    ): CancelablePromise<GetUserInviteByTokenResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/onboarding/user/{invite_code}',
            path: {
                'invite_code': inviteCode,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Update User Invite
     * Update user invite
     * @param inviteCode
     * @param requestBody
     * @returns UpdateUserInviteResponse User invite updated successfully
     * @throws ApiError
     */
    public updateUserInvite(
        inviteCode: string,
        requestBody?: UpdateUserInviteRequest,
    ): CancelablePromise<UpdateUserInviteResponse> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/api/onboarding/user/{invite_code}',
            path: {
                'invite_code': inviteCode,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Accept User Invite
     * Accept user invite
     * @param inviteCode
     * @param requestBody
     * @returns AcceptUserInviteResponse User invite accepted successfully
     * @throws ApiError
     */
    public acceptUserInvite(
        inviteCode: string,
        requestBody?: AcceptUserInviteRequest,
    ): CancelablePromise<AcceptUserInviteResponse> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/api/onboarding/user/{invite_code}/accept',
            path: {
                'invite_code': inviteCode,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Create User Invite
     * Create a user invite
     * @param requestBody
     * @returns CreateUserInviteResponse User invite created successfully
     * @throws ApiError
     */
    public createUserInvite(
        requestBody?: CreateUserInviteRequest,
    ): CancelablePromise<CreateUserInviteResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/onboarding/user',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get All User Invites
     * Get all user invites
     * @returns GetUserInviteByTokenResponse User invites retrieved successfully
     * @throws ApiError
     */
    public getAllUserInvites(): CancelablePromise<GetUserInviteByTokenResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/onboarding/user',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Delete User Invite
     * Delete user invite
     * @param inviteId
     * @param requestBody
     * @returns DeleteUserInviteResponse User invite deleted successfully
     * @throws ApiError
     */
    public deleteUserInvite(
        inviteId: string,
        requestBody?: DeleteUserInviteResponse,
    ): CancelablePromise<DeleteUserInviteResponse> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/onboarding/user/{invite_id}',
            path: {
                'invite_id': inviteId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
}
