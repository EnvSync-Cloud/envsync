/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type GrantAccessRequest = {
    subject_id: string;
    subject_type: GrantAccessRequest.subject_type;
    relation: GrantAccessRequest.relation;
};
export namespace GrantAccessRequest {
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

