/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type WebhookResponse = {
    id: string;
    name: string;
    org_id: string;
    user_id: string;
    url: string;
    event_types: Array<string>;
    is_active: boolean;
    webhook_type: WebhookResponse.webhook_type;
    app_id: string | null;
    linked_to: WebhookResponse.linked_to;
    created_at: string;
    updated_at: string;
    last_triggered_at: string | null;
};
export namespace WebhookResponse {
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

