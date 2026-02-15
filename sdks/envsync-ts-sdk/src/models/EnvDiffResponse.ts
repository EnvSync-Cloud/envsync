/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type EnvDiffResponse = {
    added: Array<{
        key: string;
        value: string;
    }>;
    modified: Array<{
        key: string;
        old_value: string;
        new_value: string;
    }>;
    deleted: Array<{
        key: string;
        value: string;
    }>;
};

