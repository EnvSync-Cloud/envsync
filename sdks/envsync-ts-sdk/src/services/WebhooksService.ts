/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateWebhookRequest } from '../models/CreateWebhookRequest';
import type { UpdateWebhookRequest } from '../models/UpdateWebhookRequest';
import type { WebhookResponse } from '../models/WebhookResponse';
import type { WebhooksResponse } from '../models/WebhooksResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class WebhooksService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Create Webhook
     * Create a new webhook for the organization
     * @param requestBody
     * @returns WebhookResponse Webhook created successfully
     * @throws ApiError
     */
    public createWebhook(
        requestBody?: CreateWebhookRequest,
    ): CancelablePromise<WebhookResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/webhook',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get All Webhooks
     * Retrieve all webhooks for the organization
     * @returns WebhooksResponse Webhooks retrieved successfully
     * @throws ApiError
     */
    public getWebhooks(): CancelablePromise<WebhooksResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/webhook',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Webhook
     * Retrieve a specific webhook
     * @param id
     * @returns WebhookResponse Webhook retrieved successfully
     * @throws ApiError
     */
    public getWebhook(
        id: string,
    ): CancelablePromise<WebhookResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/webhook/{id}',
            path: {
                'id': id,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Update Webhook
     * Update an existing webhook
     * @param id
     * @param requestBody
     * @returns WebhookResponse Webhook updated successfully
     * @throws ApiError
     */
    public updateWebhook(
        id: string,
        requestBody?: UpdateWebhookRequest,
    ): CancelablePromise<WebhookResponse> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/api/webhook/{id}',
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
     * Delete Webhook
     * Delete an existing webhook
     * @param id
     * @returns WebhookResponse Webhook deleted successfully
     * @throws ApiError
     */
    public deleteWebhook(
        id: string,
    ): CancelablePromise<WebhookResponse> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/webhook/{id}',
            path: {
                'id': id,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
}
