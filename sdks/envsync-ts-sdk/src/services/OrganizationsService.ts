/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CheckSlugResponse } from '../models/CheckSlugResponse';
import type { OrgResponse } from '../models/OrgResponse';
import type { UpdateOrgRequest } from '../models/UpdateOrgRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class OrganizationsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get Organization
     * Retrieve the current organization's details
     * @returns OrgResponse Organization retrieved successfully
     * @throws ApiError
     */
    public getOrg(): CancelablePromise<OrgResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/org',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Update Organization
     * Update the current organization's details
     * @param requestBody
     * @returns OrgResponse Organization updated successfully
     * @throws ApiError
     */
    public updateOrg(
        requestBody?: UpdateOrgRequest,
    ): CancelablePromise<OrgResponse> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/api/org',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Check Slug Availability
     * Check if an organization slug is available
     * @param slug
     * @returns CheckSlugResponse Slug availability checked successfully
     * @throws ApiError
     */
    public checkIfSlugExists(
        slug: string,
    ): CancelablePromise<CheckSlugResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/org/check-slug',
            query: {
                'slug': slug,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
}
