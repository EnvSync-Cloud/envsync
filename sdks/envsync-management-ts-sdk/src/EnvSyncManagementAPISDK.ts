/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BaseHttpRequest } from './core/BaseHttpRequest';
import type { OpenAPIConfig } from './core/OpenAPI';
import { FetchHttpRequest } from './core/FetchHttpRequest';
import { DynamicSecretsService } from './services/DynamicSecretsService';
import { EnterpriseService } from './services/EnterpriseService';
import { LicenseService } from './services/LicenseService';
import { LogForwardingService } from './services/LogForwardingService';
import { OidcProvidersService } from './services/OidcProvidersService';
import { OnboardingService } from './services/OnboardingService';
import { RotationService } from './services/RotationService';
import { SamlProvidersService } from './services/SamlProvidersService';
import { SamlSsoService } from './services/SamlSsoService';
import { SystemService } from './services/SystemService';
type HttpRequestConstructor = new (config: OpenAPIConfig) => BaseHttpRequest;
export class EnvSyncManagementAPISDK {
    public readonly dynamicSecrets: DynamicSecretsService;
    public readonly enterprise: EnterpriseService;
    public readonly license: LicenseService;
    public readonly logForwarding: LogForwardingService;
    public readonly oidcProviders: OidcProvidersService;
    public readonly onboarding: OnboardingService;
    public readonly rotation: RotationService;
    public readonly samlProviders: SamlProvidersService;
    public readonly samlSso: SamlSsoService;
    public readonly system: SystemService;
    public readonly request: BaseHttpRequest;
    constructor(config?: Partial<OpenAPIConfig>, HttpRequest: HttpRequestConstructor = FetchHttpRequest) {
        this.request = new HttpRequest({
            BASE: config?.BASE ?? 'http://localhost:4001',
            VERSION: config?.VERSION ?? '0.10.0',
            WITH_CREDENTIALS: config?.WITH_CREDENTIALS ?? false,
            CREDENTIALS: config?.CREDENTIALS ?? 'include',
            TOKEN: config?.TOKEN,
            USERNAME: config?.USERNAME,
            PASSWORD: config?.PASSWORD,
            HEADERS: config?.HEADERS,
            ENCODE_PATH: config?.ENCODE_PATH,
        });
        this.dynamicSecrets = new DynamicSecretsService(this.request);
        this.enterprise = new EnterpriseService(this.request);
        this.license = new LicenseService(this.request);
        this.logForwarding = new LogForwardingService(this.request);
        this.oidcProviders = new OidcProvidersService(this.request);
        this.onboarding = new OnboardingService(this.request);
        this.rotation = new RotationService(this.request);
        this.samlProviders = new SamlProvidersService(this.request);
        this.samlSso = new SamlSsoService(this.request);
        this.system = new SystemService(this.request);
    }
}

