/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateEnvTypeMappingRequest } from '../models/CreateEnvTypeMappingRequest';
import type { CreateIntegrationBindingRequest } from '../models/CreateIntegrationBindingRequest';
import type { CreateManualSyncRunRequest } from '../models/CreateManualSyncRunRequest';
import type { CreateOrgSecretRequest } from '../models/CreateOrgSecretRequest';
import type { CreateProviderConnectionRequest } from '../models/CreateProviderConnectionRequest';
import type { EnterpriseProvidersResponse } from '../models/EnterpriseProvidersResponse';
import type { EnvTypeMapping } from '../models/EnvTypeMapping';
import type { EnvTypeMappingsResponse } from '../models/EnvTypeMappingsResponse';
import type { IntegrationBinding } from '../models/IntegrationBinding';
import type { IntegrationBindingsResponse } from '../models/IntegrationBindingsResponse';
import type { OrgSecret } from '../models/OrgSecret';
import type { OrgSecretModelResponse } from '../models/OrgSecretModelResponse';
import type { OrgSecretsResponse } from '../models/OrgSecretsResponse';
import type { ProviderConnection } from '../models/ProviderConnection';
import type { ProviderConnectionsResponse } from '../models/ProviderConnectionsResponse';
import type { SyncAuditEventsResponse } from '../models/SyncAuditEventsResponse';
import type { SyncRun } from '../models/SyncRun';
import type { SyncRunsResponse } from '../models/SyncRunsResponse';
import type { UpdateEnvTypeMappingRequest } from '../models/UpdateEnvTypeMappingRequest';
import type { UpdateIntegrationBindingRequest } from '../models/UpdateIntegrationBindingRequest';
import type { UpdateOrgSecretRequest } from '../models/UpdateOrgSecretRequest';
import type { UpdateProviderConnectionRequest } from '../models/UpdateProviderConnectionRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class EnterpriseService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * List Enterprise Providers
     * @returns EnterpriseProvidersResponse Enterprise provider catalog
     * @throws ApiError
     */
    public listEnterpriseProviders(): CancelablePromise<EnterpriseProvidersResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/manage/enterprise/providers',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get Enterprise Org Secret Model
     * @returns OrgSecretModelResponse Org secret model
     * @throws ApiError
     */
    public getEnterpriseOrgSecretModel(): CancelablePromise<OrgSecretModelResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/manage/enterprise/org-secrets/model',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * List Enterprise Provider Connections
     * @returns ProviderConnectionsResponse Provider connections
     * @throws ApiError
     */
    public listEnterpriseProviderConnections(): CancelablePromise<ProviderConnectionsResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/manage/enterprise/provider-connections',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Create Enterprise Provider Connection
     * @param requestBody
     * @returns ProviderConnection Provider connection created
     * @throws ApiError
     */
    public createEnterpriseProviderConnection(
        requestBody?: CreateProviderConnectionRequest,
    ): CancelablePromise<ProviderConnection> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/manage/enterprise/provider-connections',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Update Enterprise Provider Connection
     * @param id
     * @param requestBody
     * @returns ProviderConnection Provider connection updated
     * @throws ApiError
     */
    public updateEnterpriseProviderConnection(
        id: string,
        requestBody?: UpdateProviderConnectionRequest,
    ): CancelablePromise<ProviderConnection> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/api/v1/manage/enterprise/provider-connections/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * List Enterprise Org Secrets
     * @returns OrgSecretsResponse Org secrets
     * @throws ApiError
     */
    public listEnterpriseOrgSecrets(): CancelablePromise<OrgSecretsResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/manage/enterprise/org-secrets',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Create Enterprise Org Secret
     * @param requestBody
     * @returns OrgSecret Org secret created
     * @throws ApiError
     */
    public createEnterpriseOrgSecret(
        requestBody?: CreateOrgSecretRequest,
    ): CancelablePromise<OrgSecret> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/manage/enterprise/org-secrets',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Update Enterprise Org Secret
     * @param id
     * @param requestBody
     * @returns OrgSecret Org secret updated
     * @throws ApiError
     */
    public updateEnterpriseOrgSecret(
        id: string,
        requestBody?: UpdateOrgSecretRequest,
    ): CancelablePromise<OrgSecret> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/api/v1/manage/enterprise/org-secrets/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * List Enterprise Integration Bindings
     * @param appId
     * @returns IntegrationBindingsResponse Integration bindings
     * @throws ApiError
     */
    public listEnterpriseIntegrationBindings(
        appId: string,
    ): CancelablePromise<IntegrationBindingsResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/manage/enterprise/apps/{app_id}/bindings',
            path: {
                'app_id': appId,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Create Enterprise Integration Binding
     * @param appId
     * @param requestBody
     * @returns IntegrationBinding Integration binding created
     * @throws ApiError
     */
    public createEnterpriseIntegrationBinding(
        appId: string,
        requestBody?: CreateIntegrationBindingRequest,
    ): CancelablePromise<IntegrationBinding> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/manage/enterprise/apps/{app_id}/bindings',
            path: {
                'app_id': appId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Update Enterprise Integration Binding
     * @param appId
     * @param id
     * @param requestBody
     * @returns IntegrationBinding Integration binding updated
     * @throws ApiError
     */
    public updateEnterpriseIntegrationBinding(
        appId: string,
        id: string,
        requestBody?: UpdateIntegrationBindingRequest,
    ): CancelablePromise<IntegrationBinding> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/api/v1/manage/enterprise/apps/{app_id}/bindings/{id}',
            path: {
                'app_id': appId,
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * List Enterprise Env-Type Mappings
     * @param appId
     * @returns EnvTypeMappingsResponse Env-type mappings
     * @throws ApiError
     */
    public listEnterpriseEnvTypeMappings(
        appId: string,
    ): CancelablePromise<EnvTypeMappingsResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/manage/enterprise/apps/{app_id}/env-type-mappings',
            path: {
                'app_id': appId,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Create Enterprise Env-Type Mapping
     * @param appId
     * @param requestBody
     * @returns EnvTypeMapping Env-type mapping created
     * @throws ApiError
     */
    public createEnterpriseEnvTypeMapping(
        appId: string,
        requestBody?: CreateEnvTypeMappingRequest,
    ): CancelablePromise<EnvTypeMapping> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/manage/enterprise/apps/{app_id}/env-type-mappings',
            path: {
                'app_id': appId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Update Enterprise Env-Type Mapping
     * @param appId
     * @param id
     * @param requestBody
     * @returns EnvTypeMapping Env-type mapping updated
     * @throws ApiError
     */
    public updateEnterpriseEnvTypeMapping(
        appId: string,
        id: string,
        requestBody?: UpdateEnvTypeMappingRequest,
    ): CancelablePromise<EnvTypeMapping> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/api/v1/manage/enterprise/apps/{app_id}/env-type-mappings/{id}',
            path: {
                'app_id': appId,
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * List Enterprise Sync Runs
     * @returns SyncRunsResponse Sync runs
     * @throws ApiError
     */
    public listEnterpriseSyncRuns(): CancelablePromise<SyncRunsResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/manage/enterprise/sync-runs',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Create Enterprise Manual Sync Run
     * @param requestBody
     * @returns SyncRun Sync run created
     * @throws ApiError
     */
    public createEnterpriseManualSyncRun(
        requestBody?: CreateManualSyncRunRequest,
    ): CancelablePromise<SyncRun> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/manage/enterprise/sync-runs/manual',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * List Enterprise Sync Audit Events
     * @param syncRunId
     * @returns SyncAuditEventsResponse Sync audit events
     * @throws ApiError
     */
    public listEnterpriseSyncAuditEvents(
        syncRunId: string,
    ): CancelablePromise<SyncAuditEventsResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/manage/enterprise/sync-runs/{sync_run_id}/events',
            path: {
                'sync_run_id': syncRunId,
            },
            errors: {
                500: `Internal server error`,
            },
        });
    }
}
