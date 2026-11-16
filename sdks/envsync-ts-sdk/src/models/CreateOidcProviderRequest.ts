/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateOidcProviderRequest = {
    /**
     * CI/CD platform type
     */
    provider_type: CreateOidcProviderRequest.provider_type;
    /**
     * OIDC issuer URL
     */
    issuer_url: string;
    /**
     * Expected audience claim value
     */
    audience: string;
    /**
     * Subject patterns to allow (glob matching). Empty = allow all subjects from this issuer.
     */
    allowed_subjects?: Array<string>;
};
export namespace CreateOidcProviderRequest {
    /**
     * CI/CD platform type
     */
    export enum provider_type {
        GITHUB_ACTIONS = 'github_actions',
        GITLAB_CI = 'gitlab_ci',
        KUBERNETES = 'kubernetes',
        VERCEL = 'vercel',
        CIRCLECI = 'circleci',
        BUILDKITE = 'buildkite',
        BITBUCKET_PIPELINES = 'bitbucket_pipelines',
        AZURE_PIPELINES = 'azure_pipelines',
        TERRAFORM_CLOUD = 'terraform_cloud',
        SPACELIFT = 'spacelift',
        PULUMI = 'pulumi',
        GENERIC = 'generic',
    }
}

