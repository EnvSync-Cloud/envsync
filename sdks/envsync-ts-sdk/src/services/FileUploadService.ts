/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UploadFileResponse } from '../models/UploadFileResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class FileUploadService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Upload File
     * Upload a file to the server. The file should be less than 5MB in size.
     * @param formData
     * @returns UploadFileResponse File uploaded successfully
     * @throws ApiError
     */
    public uploadFile(
        formData?: {
            file: any;
        },
    ): CancelablePromise<UploadFileResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/upload/file',
            formData: formData,
            mediaType: 'multipart/form-data',
            errors: {
                500: `Internal server error`,
            },
        });
    }
}
