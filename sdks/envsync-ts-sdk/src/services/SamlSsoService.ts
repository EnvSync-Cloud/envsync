/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SamlSsoRequest } from '../models/SamlSsoRequest';
import type { SamlSsoResponse } from '../models/SamlSsoResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class SamlSsoService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Initiate SAML SSO
     * Start SP-initiated SAML SSO flow by generating an AuthnRequest redirect URL
     * @param requestBody
     * @returns SamlSsoResponse Redirect URL generated
     * @throws ApiError
     */
    public initiateSamlSso(
        requestBody?: SamlSsoRequest,
    ): CancelablePromise<SamlSsoResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/manage/saml/sso',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * SAML Assertion Consumer Service
     * Receive and validate SAML Response from the identity provider (ACS endpoint)
     * @param orgId
     * @returns any Authentication successful
     * @throws ApiError
     */
    public handleSamlAcs(
        orgId: string,
    ): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/manage/saml/acs/{orgId}',
            path: {
                'orgId': orgId,
            },
            errors: {
                401: `Authentication failed`,
            },
        });
    }
}
