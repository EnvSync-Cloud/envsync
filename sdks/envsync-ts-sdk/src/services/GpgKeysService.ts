/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ExportKeyResponse } from '../models/ExportKeyResponse';
import type { GenerateGpgKeyRequest } from '../models/GenerateGpgKeyRequest';
import type { GpgKeyDetailResponse } from '../models/GpgKeyDetailResponse';
import type { GpgKeyResponse } from '../models/GpgKeyResponse';
import type { GpgKeysResponse } from '../models/GpgKeysResponse';
import type { ImportGpgKeyRequest } from '../models/ImportGpgKeyRequest';
import type { RevokeGpgKeyRequest } from '../models/RevokeGpgKeyRequest';
import type { SignatureResponse } from '../models/SignatureResponse';
import type { SignDataRequest } from '../models/SignDataRequest';
import type { UpdateTrustLevelRequest } from '../models/UpdateTrustLevelRequest';
import type { VerifyResponse } from '../models/VerifyResponse';
import type { VerifySignatureRequest } from '../models/VerifySignatureRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class GpgKeysService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Generate GPG Key
     * Generate a new GPG key pair for the organization
     * @param requestBody
     * @returns GpgKeyResponse GPG key generated successfully
     * @throws ApiError
     */
    public generateGpgKey(
        requestBody?: GenerateGpgKeyRequest,
    ): CancelablePromise<GpgKeyResponse> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/api/gpg_key/generate',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Import GPG Key
     * Import an existing GPG key into the organization
     * @param requestBody
     * @returns GpgKeyResponse GPG key imported successfully
     * @throws ApiError
     */
    public importGpgKey(
        requestBody?: ImportGpgKeyRequest,
    ): CancelablePromise<GpgKeyResponse> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/api/gpg_key/import',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Sign Data
     * Sign data using a GPG key
     * @param requestBody
     * @returns SignatureResponse Data signed successfully
     * @throws ApiError
     */
    public signDataWithGpgKey(
        requestBody?: SignDataRequest,
    ): CancelablePromise<SignatureResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/gpg_key/sign',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Verify Signature
     * Verify a GPG signature
     * @param requestBody
     * @returns VerifyResponse Verification result
     * @throws ApiError
     */
    public verifyGpgSignature(
        requestBody?: VerifySignatureRequest,
    ): CancelablePromise<VerifyResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/gpg_key/verify',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * List GPG Keys
     * List all GPG keys for the organization
     * @returns GpgKeysResponse GPG keys retrieved successfully
     * @throws ApiError
     */
    public listGpgKeys(): CancelablePromise<GpgKeysResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/gpg_key',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get GPG Key
     * Retrieve a specific GPG key
     * @param id
     * @returns GpgKeyDetailResponse GPG key retrieved successfully
     * @throws ApiError
     */
    public getGpgKey(
        id: string,
    ): CancelablePromise<GpgKeyDetailResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/gpg_key/{id}',
            path: {
                'id': id,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Delete GPG Key
     * Delete a GPG key from the organization
     * @param id
     * @returns GpgKeyResponse GPG key deleted successfully
     * @throws ApiError
     */
    public deleteGpgKey(
        id: string,
    ): CancelablePromise<GpgKeyResponse> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/gpg_key/{id}',
            path: {
                'id': id,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Export GPG Public Key
     * Export the ASCII-armored public key
     * @param id
     * @returns ExportKeyResponse Public key exported successfully
     * @throws ApiError
     */
    public exportGpgPublicKey(
        id: string,
    ): CancelablePromise<ExportKeyResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/gpg_key/{id}/export',
            path: {
                'id': id,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Revoke GPG Key
     * Revoke a GPG key (keeps data but marks as revoked)
     * @param id
     * @param requestBody
     * @returns GpgKeyDetailResponse GPG key revoked successfully
     * @throws ApiError
     */
    public revokeGpgKey(
        id: string,
        requestBody?: RevokeGpgKeyRequest,
    ): CancelablePromise<GpgKeyDetailResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/gpg_key/{id}/revoke',
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
     * Update Trust Level
     * Update the trust level of a GPG key
     * @param id
     * @param requestBody
     * @returns GpgKeyDetailResponse Trust level updated successfully
     * @throws ApiError
     */
    public updateGpgKeyTrustLevel(
        id: string,
        requestBody?: UpdateTrustLevelRequest,
    ): CancelablePromise<GpgKeyDetailResponse> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/api/gpg_key/{id}/trust',
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
}
