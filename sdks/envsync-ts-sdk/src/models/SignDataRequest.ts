/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type SignDataRequest = {
    gpg_key_id: string;
    data: string;
    mode?: SignDataRequest.mode;
    detached?: boolean;
};
export namespace SignDataRequest {
    export enum mode {
        BINARY = 'binary',
        TEXT = 'text',
        CLEARSIGN = 'clearsign',
    }
}

