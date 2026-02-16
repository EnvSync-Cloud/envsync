/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type GetTeamResponse = {
    id: string;
    name: string;
    org_id: string;
    description: string | null;
    color: string;
    created_at: string;
    updated_at: string;
    members: Array<{
        id: string;
        user_id: string;
        created_at: string;
        full_name: string | null;
        email: string;
        profile_picture_url: string | null;
    }>;
};

