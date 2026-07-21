/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateLogForwardingRequest } from '../models/CreateLogForwardingRequest';
import type { ErrorResponse } from '../models/ErrorResponse';
import type { LogForwardingResponse } from '../models/LogForwardingResponse';
import type { LogForwardingsResponse } from '../models/LogForwardingsResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class LogForwardingService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Create Log Forwarding Config
     * Create a new log forwarding configuration for the organization
     * @param requestBody
     * @returns LogForwardingResponse Log forwarding config created successfully
     * @throws ApiError
     */
    public createLogForwardingConfig(
        requestBody?: CreateLogForwardingRequest,
    ): CancelablePromise<LogForwardingResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/log_forwarding',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get All Log Forwarding Configs
     * Retrieve all log forwarding configurations for the organization
     * @returns LogForwardingsResponse Log forwarding configs retrieved successfully
     * @throws ApiError
     */
    public getLogForwardingConfigs(): CancelablePromise<LogForwardingsResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/log_forwarding',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Log Forwarding Config
     * Retrieve a specific log forwarding configuration
     * @param id
     * @returns LogForwardingResponse Log forwarding config retrieved successfully
     * @throws ApiError
     */
    public getLogForwardingConfig(
        id: string,
    ): CancelablePromise<LogForwardingResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/log_forwarding/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Config not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Delete Log Forwarding Config
     * Delete a log forwarding configuration
     * @param id
     * @returns ErrorResponse Log forwarding config deleted successfully
     * @throws ApiError
     */
    public deleteLogForwardingConfig(
        id: string,
    ): CancelablePromise<ErrorResponse> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/log_forwarding/{id}',
            path: {
                'id': id,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
}
