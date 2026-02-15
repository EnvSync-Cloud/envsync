/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GetAuditLogsResponseWrapper } from '../models/GetAuditLogsResponseWrapper';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class AuditLogsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get Audit Logs
     * Retrieve audit logs for the organization with pagination
     * @param page
     * @param perPage
     * @param filterByUser
     * @param filterByCategory
     * @param filterByPastTime
     * @returns GetAuditLogsResponseWrapper Audit logs retrieved successfully
     * @throws ApiError
     */
    public getAuditLogs(
        page: string = '1',
        perPage: string = '20',
        filterByUser?: string,
        filterByCategory?: 'app*' | 'audit_log*' | 'env*' | 'env_store*' | 'secret_store*' | 'onboarding*' | 'org*' | 'role*' | 'user*' | 'api_key*' | 'webhook*' | 'cli*',
        filterByPastTime?: 'last_3_hours' | 'last_24_hours' | 'last_7_days' | 'last_30_days' | 'last_90_days' | 'last_180_days' | 'last_1_year' | 'all_time',
    ): CancelablePromise<GetAuditLogsResponseWrapper> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/audit_log',
            query: {
                'page': page,
                'per_page': perPage,
                'filter_by_user': filterByUser,
                'filter_by_category': filterByCategory,
                'filter_by_past_time': filterByPastTime,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
}
