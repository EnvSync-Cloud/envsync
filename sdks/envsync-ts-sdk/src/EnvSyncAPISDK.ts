/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BaseHttpRequest } from './core/BaseHttpRequest';
import type { OpenAPIConfig } from './core/OpenAPI';
import { FetchHttpRequest } from './core/FetchHttpRequest';
import { AccessService } from './services/AccessService';
import { ApiKeysService } from './services/ApiKeysService';
import { ApplicationsService } from './services/ApplicationsService';
import { AuditLogsService } from './services/AuditLogsService';
import { AuthenticationService } from './services/AuthenticationService';
import { EnvironmentTypesService } from './services/EnvironmentTypesService';
import { EnvironmentVariablesService } from './services/EnvironmentVariablesService';
import { EnvironmentVariablesPointInTimeService } from './services/EnvironmentVariablesPointInTimeService';
import { EnvironmentVariablesRollbackService } from './services/EnvironmentVariablesRollbackService';
import { FileUploadService } from './services/FileUploadService';
import { OnboardingService } from './services/OnboardingService';
import { OrganizationsService } from './services/OrganizationsService';
import { RolesService } from './services/RolesService';
import { SecretsService } from './services/SecretsService';
import { SecretsPointInTimeService } from './services/SecretsPointInTimeService';
import { SecretsRollbackService } from './services/SecretsRollbackService';
import { UsersService } from './services/UsersService';
import { WebhooksService } from './services/WebhooksService';
type HttpRequestConstructor = new (config: OpenAPIConfig) => BaseHttpRequest;
export class EnvSyncAPISDK {
    public readonly access: AccessService;
    public readonly apiKeys: ApiKeysService;
    public readonly applications: ApplicationsService;
    public readonly auditLogs: AuditLogsService;
    public readonly authentication: AuthenticationService;
    public readonly environmentTypes: EnvironmentTypesService;
    public readonly environmentVariables: EnvironmentVariablesService;
    public readonly environmentVariablesPointInTime: EnvironmentVariablesPointInTimeService;
    public readonly environmentVariablesRollback: EnvironmentVariablesRollbackService;
    public readonly fileUpload: FileUploadService;
    public readonly onboarding: OnboardingService;
    public readonly organizations: OrganizationsService;
    public readonly roles: RolesService;
    public readonly secrets: SecretsService;
    public readonly secretsPointInTime: SecretsPointInTimeService;
    public readonly secretsRollback: SecretsRollbackService;
    public readonly users: UsersService;
    public readonly webhooks: WebhooksService;
    public readonly request: BaseHttpRequest;
    constructor(config?: Partial<OpenAPIConfig>, HttpRequest: HttpRequestConstructor = FetchHttpRequest) {
        this.request = new HttpRequest({
            BASE: config?.BASE ?? 'http://localhost:8600',
            VERSION: config?.VERSION ?? '0.3.7',
            WITH_CREDENTIALS: config?.WITH_CREDENTIALS ?? false,
            CREDENTIALS: config?.CREDENTIALS ?? 'include',
            TOKEN: config?.TOKEN,
            USERNAME: config?.USERNAME,
            PASSWORD: config?.PASSWORD,
            HEADERS: config?.HEADERS,
            ENCODE_PATH: config?.ENCODE_PATH,
        });
        this.access = new AccessService(this.request);
        this.apiKeys = new ApiKeysService(this.request);
        this.applications = new ApplicationsService(this.request);
        this.auditLogs = new AuditLogsService(this.request);
        this.authentication = new AuthenticationService(this.request);
        this.environmentTypes = new EnvironmentTypesService(this.request);
        this.environmentVariables = new EnvironmentVariablesService(this.request);
        this.environmentVariablesPointInTime = new EnvironmentVariablesPointInTimeService(this.request);
        this.environmentVariablesRollback = new EnvironmentVariablesRollbackService(this.request);
        this.fileUpload = new FileUploadService(this.request);
        this.onboarding = new OnboardingService(this.request);
        this.organizations = new OrganizationsService(this.request);
        this.roles = new RolesService(this.request);
        this.secrets = new SecretsService(this.request);
        this.secretsPointInTime = new SecretsPointInTimeService(this.request);
        this.secretsRollback = new SecretsRollbackService(this.request);
        this.users = new UsersService(this.request);
        this.webhooks = new WebhooksService(this.request);
    }
}

