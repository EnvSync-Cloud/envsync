/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateRoleRequest } from '../models/CreateRoleRequest';
import type { RoleResponse } from '../models/RoleResponse';
import type { RolesResponse } from '../models/RolesResponse';
import type { RoleStatsResponse } from '../models/RoleStatsResponse';
import type { UpdateRoleRequest } from '../models/UpdateRoleRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class RolesService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get All Roles
     * Retrieve all roles in the organization
     * @returns RolesResponse Roles retrieved successfully
     * @throws ApiError
     */
    public getAllRoles(): CancelablePromise<RolesResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/role',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Create Role
     * Create a new role in the organization
     * @param requestBody
     * @returns RoleResponse Role created successfully
     * @throws ApiError
     */
    public createRole(
        requestBody?: CreateRoleRequest,
    ): CancelablePromise<RoleResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/role',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Role Statistics
     * Retrieve statistics about roles in the organization
     * @returns RoleStatsResponse Role statistics retrieved successfully
     * @throws ApiError
     */
    public getRoleStats(): CancelablePromise<RoleStatsResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/role/stats',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Role
     * Retrieve a specific role by ID
     * @param id
     * @returns RoleResponse Role retrieved successfully
     * @throws ApiError
     */
    public getRole(
        id: string,
    ): CancelablePromise<RoleResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/role/{id}',
            path: {
                'id': id,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Update Role
     * Update an existing role
     * @param id
     * @param requestBody
     * @returns RoleResponse Role updated successfully
     * @throws ApiError
     */
    public updateRole(
        id: string,
        requestBody?: UpdateRoleRequest,
    ): CancelablePromise<RoleResponse> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/api/role/{id}',
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
     * Delete Role
     * Delete an existing role (non-master roles only)
     * @param id
     * @returns RoleResponse Role deleted successfully
     * @throws ApiError
     */
    public deleteRole(
        id: string,
    ): CancelablePromise<RoleResponse> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/role/{id}',
            path: {
                'id': id,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
}
