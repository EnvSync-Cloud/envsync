/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type RollbackSecretsResponse = {
    message: string;
    operations_performed: number;
    operations: Array<{
        key: string;
        value: string;
        operation: 'CREATE' | 'UPDATE' | 'DELETE';
    }>;
};

