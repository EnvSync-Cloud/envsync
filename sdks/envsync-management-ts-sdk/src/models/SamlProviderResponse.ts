/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type SamlProviderResponse = {
    id: string;
    org_id: string;
    provider_type: SamlProviderResponse.provider_type;
    name: string;
    entity_id: string;
    sso_url: string;
    certificate: string;
    enabled: boolean;
    created_at: string;
    updated_at: string;
};
export namespace SamlProviderResponse {
    export enum provider_type {
        OKTA = 'okta',
        ONELOGIN = 'onelogin',
        AZURE_AD = 'azure-ad',
        GOOGLE_WORKSPACE = 'google-workspace',
        DUO = 'duo',
        RIPPLING = 'rippling',
        ORACLE = 'oracle',
        PING_IDENTITY = 'ping-identity',
    }
}

