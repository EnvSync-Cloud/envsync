/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ServiceTokenPermissions } from './ServiceTokenPermissions';
export type ServiceTokenResponse = {
    id: string;
    name: string;
    app_id: string | null;
    env_type_id: string | null;
    permissions: ServiceTokenPermissions;
    expires_at: string;
    last_used_at: string | null;
    created_at: string;
};

