/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PublicSamlSsoRequest } from '../models/PublicSamlSsoRequest';
import type { SamlSsoResponse } from '../models/SamlSsoResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class SamlSsoService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get public SAML SP metadata
     * Unauthenticated SP metadata XML for the organization
     * @param orgId
     * @returns string SP metadata XML
     * @throws ApiError
     */
    public getPublicSamlMetadata(
        orgId: string,
    ): CancelablePromise<string> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/saml/metadata/{orgId}',
            path: {
                'orgId': orgId,
            },
            errors: {
                404: `SSO is not available`,
            },
        });
    }
    /**
     * SAML Assertion Consumer Service
     * Receive and validate a SAML Response from the identity provider
     * @param orgId
     * @returns void
     * @throws ApiError
     */
    public handlePublicSamlAcs(
        orgId: string,
    ): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/saml/acs/{orgId}',
            path: {
                'orgId': orgId,
            },
            errors: {
                302: `Authentication successful`,
                401: `Authentication failed`,
            },
        });
    }
    /**
     * Start SAML SSO
     * Unauthenticated SP-initiated start. Returns a redirect URL for the login page or CLI.
     * @param orgSlug
     * @param requestBody
     * @returns SamlSsoResponse Redirect URL generated
     * @throws ApiError
     */
    public startPublicSamlSso(
        orgSlug: string,
        requestBody?: PublicSamlSsoRequest,
    ): CancelablePromise<SamlSsoResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/saml/sso/{orgSlug}',
            path: {
                'orgSlug': orgSlug,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                404: `SSO is not available`,
            },
        });
    }
    /**
     * Bookmark SAML SSO start
     * Success redirects to the IdP. Any error redirects to the dashboard login page.
     * @param orgSlug
     * @returns void
     * @throws ApiError
     */
    public startPublicSamlSsoRedirect(
        orgSlug: string,
    ): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/saml/sso/{orgSlug}',
            path: {
                'orgSlug': orgSlug,
            },
            errors: {
                302: `Redirect to the IdP or /login?sso=failed`,
            },
        });
    }
}
