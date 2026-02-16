/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type RevokeAccessRequest = {
    subject_id: string;
    subject_type: RevokeAccessRequest.subject_type;
    relation: RevokeAccessRequest.relation;
};
export namespace RevokeAccessRequest {
    export enum subject_type {
        USER = 'user',
        TEAM = 'team',
    }
    export enum relation {
        ADMIN = 'admin',
        EDITOR = 'editor',
        VIEWER = 'viewer',
    }
}

