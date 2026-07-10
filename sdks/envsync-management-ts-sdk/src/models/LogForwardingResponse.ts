/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type LogForwardingResponse = {
    id: string;
    org_id: string;
    name: string;
    provider_type: LogForwardingResponse.provider_type;
    config: Record<string, any>;
    enabled: boolean;
    created_at: string;
    updated_at: string;
};
export namespace LogForwardingResponse {
    export enum provider_type {
        DATADOG = 'datadog',
        SPLUNK = 'splunk',
        SUMO_LOGIC = 'sumo-logic',
    }
}

