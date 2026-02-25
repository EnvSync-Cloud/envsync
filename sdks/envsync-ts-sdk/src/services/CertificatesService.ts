/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CertificateListResponse } from '../models/CertificateListResponse';
import type { CRLResponse } from '../models/CRLResponse';
import type { InitOrgCARequest } from '../models/InitOrgCARequest';
import type { IssueMemberCertRequest } from '../models/IssueMemberCertRequest';
import type { MemberCertResponse } from '../models/MemberCertResponse';
import type { OCSPResponse } from '../models/OCSPResponse';
import type { OrgCAResponse } from '../models/OrgCAResponse';
import type { RevokeCertRequest } from '../models/RevokeCertRequest';
import type { RevokeCertResponse } from '../models/RevokeCertResponse';
import type { RootCAResponse } from '../models/RootCAResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class CertificatesService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Initialize Organization CA
     * Create an intermediate CA for the organization via SpacetimeDB
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
