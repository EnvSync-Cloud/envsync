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
import { CertificatesService } from './services/CertificatesService';
import { ChangeRequestsService } from './services/ChangeRequestsService';
import { DynamicSecretsService } from './services/DynamicSecretsService';
import { EnterpriseService } from './services/EnterpriseService';
import { EnvironmentTypesService } from './services/EnvironmentTypesService';
import { EnvironmentVariablesService } from './services/EnvironmentVariablesService';
import { EnvironmentVariablesPointInTimeService } from './services/EnvironmentVariablesPointInTimeService';
import { EnvironmentVariablesRollbackService } from './services/EnvironmentVariablesRollbackService';
import { FileUploadService } from './services/FileUploadService';
import { GpgKeysService } from './services/GpgKeysService';
import { LicenseService } from './services/LicenseService';
import { LogForwardingService } from './services/LogForwardingService';
import { OidcProvidersService } from './services/OidcProvidersService';
import { OnboardingService } from './services/OnboardingService';
import { OrganizationsService } from './services/OrganizationsService';
import { PermissionsService } from './services/PermissionsService';
import { RolesService } from './services/RolesService';
import { RotationService } from './services/RotationService';
import { SamlProvidersService } from './services/SamlProvidersService';
import { SamlSsoService } from './services/SamlSsoService';
import { SecretsService } from './services/SecretsService';
import { SecretsPointInTimeService } from './services/SecretsPointInTimeService';
import { SecretsRollbackService } from './services/SecretsRollbackService';
import { ServiceTokensService } from './services/ServiceTokensService';
import { SetupService } from './services/SetupService';
import { SystemService } from './services/SystemService';
import { TeamsService } from './services/TeamsService';
import { UsersService } from './services/UsersService';
import { WebhooksService } from './services/WebhooksService';
type HttpRequestConstructor = new (config: OpenAPIConfig) => BaseHttpRequest;
export class EnvSyncAPISDK {
    public readonly access: AccessService;
    public readonly apiKeys: ApiKeysService;
    public readonly applications: ApplicationsService;
    public readonly auditLogs: AuditLogsService;
    public readonly authentication: AuthenticationService;
    public readonly certificates: CertificatesService;
    public readonly changeRequests: ChangeRequestsService;
    public readonly dynamicSecrets: DynamicSecretsService;
    public readonly enterprise: EnterpriseService;
    public readonly environmentTypes: EnvironmentTypesService;
    public readonly environmentVariables: EnvironmentVariablesService;
    public readonly environmentVariablesPointInTime: EnvironmentVariablesPointInTimeService;
    public readonly environmentVariablesRollback: EnvironmentVariablesRollbackService;
    public readonly fileUpload: FileUploadService;
    public readonly gpgKeys: GpgKeysService;
    public readonly license: LicenseService;
    public readonly logForwarding: LogForwardingService;
    public readonly oidcProviders: OidcProvidersService;
    public readonly onboarding: OnboardingService;
    public readonly organizations: OrganizationsService;
    public readonly permissions: PermissionsService;
    public readonly roles: RolesService;
    public readonly rotation: RotationService;
    public readonly samlProviders: SamlProvidersService;
    public readonly samlSso: SamlSsoService;
    public readonly secrets: SecretsService;
    public readonly secretsPointInTime: SecretsPointInTimeService;
    public readonly secretsRollback: SecretsRollbackService;
    public readonly serviceTokens: ServiceTokensService;
    public readonly setup: SetupService;
    public readonly system: SystemService;
    public readonly teams: TeamsService;
    public readonly users: UsersService;
    public readonly webhooks: WebhooksService;
    public readonly request: BaseHttpRequest;
    constructor(config?: Partial<OpenAPIConfig>, HttpRequest: HttpRequestConstructor = FetchHttpRequest) {
        this.request = new HttpRequest({
            BASE: config?.BASE ?? 'http://localhost:4000',
            VERSION: config?.VERSION ?? '0.20.0',
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
        this.certificates = new CertificatesService(this.request);
        this.changeRequests = new ChangeRequestsService(this.request);
        this.dynamicSecrets = new DynamicSecretsService(this.request);
        this.enterprise = new EnterpriseService(this.request);
        this.environmentTypes = new EnvironmentTypesService(this.request);
        this.environmentVariables = new EnvironmentVariablesService(this.request);
        this.environmentVariablesPointInTime = new EnvironmentVariablesPointInTimeService(this.request);
        this.environmentVariablesRollback = new EnvironmentVariablesRollbackService(this.request);
        this.fileUpload = new FileUploadService(this.request);
        this.gpgKeys = new GpgKeysService(this.request);
        this.license = new LicenseService(this.request);
        this.logForwarding = new LogForwardingService(this.request);
        this.oidcProviders = new OidcProvidersService(this.request);
        this.onboarding = new OnboardingService(this.request);
        this.organizations = new OrganizationsService(this.request);
        this.permissions = new PermissionsService(this.request);
        this.roles = new RolesService(this.request);
        this.rotation = new RotationService(this.request);
        this.samlProviders = new SamlProvidersService(this.request);
        this.samlSso = new SamlSsoService(this.request);
        this.secrets = new SecretsService(this.request);
        this.secretsPointInTime = new SecretsPointInTimeService(this.request);
        this.secretsRollback = new SecretsRollbackService(this.request);
        this.serviceTokens = new ServiceTokensService(this.request);
        this.setup = new SetupService(this.request);
        this.system = new SystemService(this.request);
        this.teams = new TeamsService(this.request);
        this.users = new UsersService(this.request);
        this.webhooks = new WebhooksService(this.request);
    }
}

