/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AddTeamMemberRequest } from '../models/AddTeamMemberRequest';
import type { CreateTeamRequest } from '../models/CreateTeamRequest';
import type { CreateTeamResponse } from '../models/CreateTeamResponse';
import type { GetTeamResponse } from '../models/GetTeamResponse';
import type { GetTeamsResponse } from '../models/GetTeamsResponse';
import type { TeamMessageResponse } from '../models/TeamMessageResponse';
import type { UpdateTeamRequest } from '../models/UpdateTeamRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class TeamsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get All Teams
     * Retrieve all teams for the organization
     * @returns GetTeamsResponse Teams retrieved successfully
     * @throws ApiError
     */
    public getTeams(): CancelablePromise<GetTeamsResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/team',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Create Team
     * Create a new team in the organization
     * @param requestBody
     * @returns CreateTeamResponse Team created successfully
     * @throws ApiError
     */
    public createTeam(
        requestBody?: CreateTeamRequest,
    ): CancelablePromise<CreateTeamResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/team',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Team
     * Retrieve a specific team with its members
     * @param id
     * @returns GetTeamResponse Team retrieved successfully
     * @throws ApiError
     */
    public getTeam(
        id: string,
    ): CancelablePromise<GetTeamResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/team/{id}',
            path: {
                'id': id,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Update Team
     * Update an existing team
     * @param id
     * @param requestBody
     * @returns TeamMessageResponse Team updated successfully
     * @throws ApiError
     */
    public updateTeam(
        id: string,
        requestBody?: UpdateTeamRequest,
    ): CancelablePromise<TeamMessageResponse> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/api/team/{id}',
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
     * Delete Team
     * Delete an existing team
     * @param id
     * @returns TeamMessageResponse Team deleted successfully
     * @throws ApiError
     */
    public deleteTeam(
        id: string,
    ): CancelablePromise<TeamMessageResponse> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/team/{id}',
            path: {
                'id': id,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Add Team Member
     * Add a user to a team
     * @param id
     * @param requestBody
     * @returns TeamMessageResponse Team member added successfully
     * @throws ApiError
     */
    public addTeamMember(
        id: string,
        requestBody?: AddTeamMemberRequest,
    ): CancelablePromise<TeamMessageResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/team/{id}/members',
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
     * Remove Team Member
     * Remove a user from a team
     * @param id
     * @param userId
     * @returns TeamMessageResponse Team member removed successfully
     * @throws ApiError
     */
    public removeTeamMember(
        id: string,
        userId: string,
    ): CancelablePromise<TeamMessageResponse> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/team/{id}/members/{user_id}',
            path: {
                'id': id,
                'user_id': userId,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
}
