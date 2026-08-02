/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateLogForwardingRequest = {
    name: string;
    provider_type: CreateLogForwardingRequest.provider_type;
    config: Record<string, any>;
    enabled?: boolean;
};
export namespace CreateLogForwardingRequest {
    export enum provider_type {
        DATADOG = 'datadog',
        SPLUNK = 'splunk',
        SUMO_LOGIC = 'sumo-logic',
    }
}

