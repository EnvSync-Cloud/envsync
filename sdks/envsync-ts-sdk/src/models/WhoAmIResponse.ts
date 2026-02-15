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
};

