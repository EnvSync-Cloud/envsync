/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type OidcProviderResponse = {
    id: string;
    org_id: string;
    provider_type: OidcProviderResponse.provider_type;
    issuer_url: string;
    audience: string;
    enabled: boolean;
    allowed_subjects: Array<string>;
    machine_user_id: string | null;
    created_at: string;
    updated_at: string;
};
export namespace OidcProviderResponse {
    export enum provider_type {
        GITHUB_ACTIONS = 'github_actions',
        GITLAB_CI = 'gitlab_ci',
        KUBERNETES = 'kubernetes',
        GENERIC = 'generic',
    }
}

