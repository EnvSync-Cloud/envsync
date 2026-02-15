/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UpdateRoleRequest } from '../models/UpdateRoleRequest';
import type { UpdateUserRequest } from '../models/UpdateUserRequest';
import type { UserResponse } from '../models/UserResponse';
import type { UsersResponse } from '../models/UsersResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class UsersService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get All Users
     * Retrieve all users in the organization
     * @returns UsersResponse Users retrieved successfully
     * @throws ApiError
     */
    public getUsers(): CancelablePromise<UsersResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/user',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get User by ID
     * Retrieve a specific user by their ID
     * @param id
     * @returns UserResponse User retrieved successfully
     * @throws ApiError
     */
    public getUserById(
        id: string,
    ): CancelablePromise<UserResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/user/{id}',
            path: {
                'id': id,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Update User
     * Update a user's profile information
     * @param id
     * @param requestBody
     * @returns UserResponse User updated successfully
     * @throws ApiError
     */
    public updateUser(
        id: string,
        requestBody?: UpdateUserRequest,
    ): CancelablePromise<UserResponse> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/api/user/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Delete User
     * Delete a user from the organization (Admin only)
     * @param id
     * @returns UserResponse User deleted successfully
     * @throws ApiError
     */
    public deleteUser(
        id: string,
    ): CancelablePromise<UserResponse> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/user/{id}',
            path: {
                'id': id,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Update User Role
     * Update a user's role (Admin only)
     * @param id
     * @param requestBody
     * @returns UserResponse User role updated successfully
     * @throws ApiError
     */
    public updateRole(
        id: string,
        requestBody?: UpdateRoleRequest,
    ): CancelablePromise<UserResponse> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/api/user/role/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Update User Password
     * Update a user's password (Admin only)
     * @param id
     * @returns UserResponse Password update request sent successfully
     * @throws ApiError
     */
    public updatePassword(
        id: string,
    ): CancelablePromise<UserResponse> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/api/user/password/{id}',
            path: {
                'id': id,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
}
