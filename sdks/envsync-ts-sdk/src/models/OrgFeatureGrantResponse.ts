/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type OrgFeatureGrantResponse = {
    org_id: string;
    unrestricted: boolean;
    plan?: string;
    features: Array<string>;
    overlay_features: Array<string>;
    source: string | null;
    updated_by: string | null;
    created_at: string | null;
    updated_at: string | null;
};

