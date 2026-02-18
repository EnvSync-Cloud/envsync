/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UpdateTrustLevelRequest = {
    trust_level: UpdateTrustLevelRequest.trust_level;
};
export namespace UpdateTrustLevelRequest {
    export enum trust_level {
        UNKNOWN = 'unknown',
        NEVER = 'never',
        MARGINAL = 'marginal',
        FULL = 'full',
        ULTIMATE = 'ultimate',
    }
}

