/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type EnterpriseProviderProfile = {
    id: EnterpriseProviderProfile.id;
    name: string;
    scope: string;
    description: string;
    connection_requirements: Array<string>;
    binding_metadata_fields: Array<string>;
    mapping_requirements: Array<string>;
};
export namespace EnterpriseProviderProfile {
    export enum id {
        GITHUB = 'github',
        GITLAB = 'gitlab',
        AWS_SSM = 'aws-ssm',
        VERCEL = 'vercel',
        GOOGLE_SECRET_MANAGER = 'google-secret-manager',
    }
}

