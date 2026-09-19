/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class AcmeService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Create ACME External Account Binding credentials
     * @returns any EAB created
     * @throws ApiError
     */
    public createAcmeEab(): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/manage/acme/eab',
        });
    }
    /**
     * List ACME EAB key ids
     * @returns any EAB keys
     * @throws ApiError
     */
    public listAcmeEab(): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/manage/acme/eab',
        });
    }
}
