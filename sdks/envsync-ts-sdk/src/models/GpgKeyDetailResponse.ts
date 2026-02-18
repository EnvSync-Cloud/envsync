/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GpgKeyResponse } from './GpgKeyResponse';
export type GpgKeyDetailResponse = (GpgKeyResponse & {
    public_key: string;
    revocation_reason: string | null;
});

