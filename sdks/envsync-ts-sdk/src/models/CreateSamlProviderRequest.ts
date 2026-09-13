/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateSamlProviderRequest = {
    /**
     * SAML identity provider type
     */
    provider_type: CreateSamlProviderRequest.provider_type;
    /**
     * Human-readable name for this provider
     */
    name: string;
    /**
     * SAML entity ID (issuer) from the IdP metadata
     */
    entity_id?: string;
    /**
     * IdP SSO login URL
     */
    sso_url?: string;
    /**
     * IdP X.509 certificate (PEM format) for signature validation
     */
    certificate?: string;
    /**
     * Optional IdP metadata XML. When set, entity_id, sso_url, and certificate are parsed from it.
     */
    idp_metadata_xml?: string;
    /**
     * Mark this provider as the default IdP for the organization
     */
    is_default?: boolean;
};
export namespace CreateSamlProviderRequest {
    /**
     * SAML identity provider type
     */
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

