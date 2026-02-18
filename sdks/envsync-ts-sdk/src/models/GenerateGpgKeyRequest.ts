/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type GenerateGpgKeyRequest = {
    name: string;
    email: string;
    algorithm: GenerateGpgKeyRequest.algorithm;
    key_size?: number;
    usage_flags: Array<'sign' | 'encrypt' | 'certify'>;
    expires_in_days?: number;
    is_default?: boolean;
};
export namespace GenerateGpgKeyRequest {
    export enum algorithm {
        RSA = 'rsa',
        ECC_CURVE25519 = 'ecc-curve25519',
        ECC_P256 = 'ecc-p256',
        ECC_P384 = 'ecc-p384',
    }
}

