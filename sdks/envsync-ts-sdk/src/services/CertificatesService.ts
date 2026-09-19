/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CertificateChainResponse } from '../models/CertificateChainResponse';
import type { CertificateListResponse } from '../models/CertificateListResponse';
import type { CRLResponse } from '../models/CRLResponse';
import type { ImportChainRequest } from '../models/ImportChainRequest';
import type { InitOrgCARequest } from '../models/InitOrgCARequest';
import type { IssueLeafCertRequest } from '../models/IssueLeafCertRequest';
import type { IssueMemberCertRequest } from '../models/IssueMemberCertRequest';
import type { LabelEnvCaRequest } from '../models/LabelEnvCaRequest';
import type { MemberCertResponse } from '../models/MemberCertResponse';
import type { MyCertificateBundleResponse } from '../models/MyCertificateBundleResponse';
import type { OCSPResponse } from '../models/OCSPResponse';
import type { OrgCAResponse } from '../models/OrgCAResponse';
import type { RenewCertRequest } from '../models/RenewCertRequest';
import type { RevokeCertRequest } from '../models/RevokeCertRequest';
import type { RevokeCertResponse } from '../models/RevokeCertResponse';
import type { RootCAResponse } from '../models/RootCAResponse';
import type { RotateCertRequest } from '../models/RotateCertRequest';
import type { SetAutoRenewRequest } from '../models/SetAutoRenewRequest';
import type { SignCsrRequest } from '../models/SignCsrRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class CertificatesService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Initialize Organization CA
     * Create an intermediate CA for the organization via miniKMS
     * @param requestBody
     * @returns OrgCAResponse Organization CA initialized successfully
     * @throws ApiError
     */
    public initOrgCa(
        requestBody?: InitOrgCARequest,
    ): CancelablePromise<OrgCAResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/certificate/ca/init',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Organization CA
     * Retrieve the organization's intermediate CA certificate
     * @returns OrgCAResponse Organization CA retrieved successfully
     * @throws ApiError
     */
    public getOrgCa(): CancelablePromise<OrgCAResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/certificate/ca',
            errors: {
                404: `Organization CA not initialized`,
            },
        });
    }
    /**
     * Get Root CA
     * Retrieve the root CA certificate
     * @returns RootCAResponse Root CA retrieved successfully
     * @throws ApiError
     */
    public getRootCa(): CancelablePromise<RootCAResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/certificate/root-ca',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get CA chain
     * PEM bundle of imported chains, organization CA, and root CA
     * @returns CertificateChainResponse CA chain
     * @throws ApiError
     */
    public getCertificateChain(): CancelablePromise<CertificateChainResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/certificate/chain',
        });
    }
    /**
     * Import an external CA chain
     * Enterprise-only. Store a PEM chain (external root/intermediates) next to the org CA.
     * @param requestBody
     * @returns OrgCAResponse Chain imported
     * @throws ApiError
     */
    public importCertificateChain(
        requestBody?: ImportChainRequest,
    ): CancelablePromise<OrgCAResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/certificate/ca/import-chain',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Label an environment CA
     * Enterprise-only. Record an environment-scoped CA label. Leaves remain signed by the org intermediate.
     * @param requestBody
     * @returns OrgCAResponse Environment CA labeled
     * @throws ApiError
     */
    public labelEnvironmentCa(
        requestBody?: LabelEnvCaRequest,
    ): CancelablePromise<OrgCAResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/certificate/ca/env',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Issue Member Certificate
     * Issue a new member certificate signed by the organization CA
     * @param requestBody
     * @returns MemberCertResponse Member certificate issued successfully
     * @throws ApiError
     */
    public issueMemberCert(
        requestBody?: IssueMemberCertRequest,
    ): CancelablePromise<MemberCertResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/certificate/issue',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Issue service leaf certificate
     * Issue a project-scoped leaf certificate with DNS/IP SANs. Private key is returned once.
     * @param requestBody
     * @returns MemberCertResponse Leaf certificate issued
     * @throws ApiError
     */
    public issueLeafCert(
        requestBody?: IssueLeafCertRequest,
    ): CancelablePromise<MemberCertResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/certificate/issue-leaf',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Sign a CSR
     * Sign a client-generated CSR with the organization CA. Private key never leaves the client.
     * @param requestBody
     * @returns OrgCAResponse Certificate signed
     * @throws ApiError
     */
    public signCertificateCsr(
        requestBody?: SignCsrRequest,
    ): CancelablePromise<OrgCAResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/certificate/sign-csr',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get CRL
     * Retrieve the Certificate Revocation List for the organization
     * @returns CRLResponse CRL retrieved successfully
     * @throws ApiError
     */
    public getCrl(): CancelablePromise<CRLResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/certificate/crl',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Current User Certificate Bundle
     * Retrieve the current user's active system-generated certificate bundle
     * @returns MyCertificateBundleResponse Certificate bundle retrieved successfully
     * @throws ApiError
     */
    public getMyCertificateBundle(): CancelablePromise<MyCertificateBundleResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/certificate/me',
            errors: {
                404: `Certificate bundle not found`,
            },
        });
    }
    /**
     * List Certificates
     * List all certificates for the organization
     * @returns CertificateListResponse Certificates retrieved successfully
     * @throws ApiError
     */
    public listCertificates(): CancelablePromise<CertificateListResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/certificate',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Certificate
     * Retrieve a specific certificate by ID
     * @param id
     * @returns CertificateListResponse Certificate retrieved successfully
     * @throws ApiError
     */
    public getCertificate(
        id: string,
    ): CancelablePromise<CertificateListResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/certificate/{id}',
            path: {
                'id': id,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Revoke Certificate
     * Revoke a certificate by its serial number
     * @param serialHex
     * @param requestBody
     * @returns RevokeCertResponse Certificate revoked successfully
     * @throws ApiError
     */
    public revokeCert(
        serialHex: string,
        requestBody?: RevokeCertRequest,
    ): CancelablePromise<RevokeCertResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/certificate/{serial_hex}/revoke',
            path: {
                'serial_hex': serialHex,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Renew Certificate
     * Issue a renewed replacement certificate linked to the existing certificate lineage.
     * @param id
     * @param requestBody
     * @returns MemberCertResponse Certificate renewed successfully
     * @throws ApiError
     */
    public renewCertificate(
        id: string,
        requestBody?: RenewCertRequest,
    ): CancelablePromise<MemberCertResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/certificate/{id}/renew',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Rotate Certificate
     * Rotate a certificate by issuing a replacement and optionally revoking the previous certificate.
     * @param id
     * @param requestBody
     * @returns MemberCertResponse Certificate rotated successfully
     * @throws ApiError
     */
    public rotateCertificate(
        id: string,
        requestBody?: RotateCertRequest,
    ): CancelablePromise<MemberCertResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/certificate/{id}/rotate',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Configure leaf auto-renew
     * Enterprise-only. Auto-renew managed service certificates and optionally write ENVSYNC_TLS_* secrets.
     * @param id
     * @param requestBody
     * @returns OrgCAResponse Auto-renew updated
     * @throws ApiError
     */
    public setCertificateAutoRenew(
        id: string,
        requestBody?: SetAutoRenewRequest,
    ): CancelablePromise<OrgCAResponse> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/api/certificate/{id}/auto-renew',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Check OCSP Status
     * Check the OCSP status of a certificate
     * @param serialHex
     * @returns OCSPResponse OCSP status retrieved successfully
     * @throws ApiError
     */
    public checkOcsp(
        serialHex: string,
    ): CancelablePromise<OCSPResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/certificate/{serial_hex}/ocsp',
            path: {
                'serial_hex': serialHex,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
}
