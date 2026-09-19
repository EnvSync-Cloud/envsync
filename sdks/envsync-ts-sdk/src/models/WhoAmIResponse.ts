/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { RoleResponse } from './RoleResponse';
export type WhoAmIResponse = {
    user: {
        id: string;
        email: string;
        full_name: string;
        org_id: string;
        role_id: string;
        profile_picture_url: string | null;
        is_active: boolean;
        created_at: string;
        updated_at: string;
    };
    org: {
        id: string;
        name: string;
        logo_url: string | null;
        slug: string;
        size: string | null;
        website: string | null;
        metadata: Record<string, any>;
        created_at: string;
        updated_at: string;
    };
    role: RoleResponse;
    memberships: Array<{
        user_id: string;
        org_id: string;
        org_name: string;
        org_slug: string;
        role_id: string;
        role_name: string;
        is_admin: boolean;
        is_master: boolean;
        is_active: boolean;
        is_current: boolean;
    }>;
    active_membership_user_id: string;
    features: Array<string>;
    install_features: Array<string>;
    plan?: string;
    plan_limits?: Record<string, any>;
    plan_usage?: any | null;
    feature_overrides?: Array<string>;
    auth_type: WhoAmIResponse.auth_type;
};
export namespace WhoAmIResponse {
    export enum auth_type {
        JWT = 'jwt',
        SAML = 'saml',
        OIDC = 'oidc',
        API_KEY = 'api_key',
        SERVICE_TOKEN = 'service_token',
    }
}

