/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type VariableRollbackResponse = {
    message: string;
    key: string;
    operation: VariableRollbackResponse.operation;
    previous_value: string | null;
    target_value: string | null;
    pit_id?: string;
    target_timestamp?: string;
};
export namespace VariableRollbackResponse {
    export enum operation {
        CREATE = 'CREATE',
        UPDATE = 'UPDATE',
        DELETE = 'DELETE',
    }
}

