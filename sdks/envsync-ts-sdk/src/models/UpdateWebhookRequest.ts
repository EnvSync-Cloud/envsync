/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UpdateWebhookRequest = {
    name?: string;
    url?: string;
    event_types?: Array<string>;
    is_active?: boolean;
    webhook_type?: UpdateWebhookRequest.webhook_type;
    app_id?: string;
    linked_to?: UpdateWebhookRequest.linked_to;
};
export namespace UpdateWebhookRequest {
    export enum webhook_type {
        DISCORD = 'DISCORD',
        SLACK = 'SLACK',
        CUSTOM = 'CUSTOM',
    }
    export enum linked_to {
        ORG = 'org',
        APP = 'app',
    }
}

