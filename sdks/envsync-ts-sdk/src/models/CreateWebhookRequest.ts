/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateWebhookRequest = {
    name: string;
    url: string;
    event_types: Array<string>;
    webhook_type: CreateWebhookRequest.webhook_type;
    linked_to?: CreateWebhookRequest.linked_to;
    app_id?: string | null;
};
export namespace CreateWebhookRequest {
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

