import { runtimeConfig } from "@/utils/runtime-config";

export type NavLink = {
  label: string;
  href: string;
  external?: boolean;
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavLink[];
};

export const productNav: NavGroup = {
  id: "product",
  label: "Product",
  items: [
    { label: "Environments & secrets", href: "/product/secrets" },
    { label: "Certificates", href: "/product/certificates" },
    { label: "Access & SSO", href: "/product/access" },
    { label: "Security & operations", href: "/product/security" },
    { label: "Integrations", href: "/integrations" },
  ],
};

export const companiesNav: NavGroup = {
  id: "companies",
  label: "Companies",
  items: [
    { label: "For startups", href: "/companies/startups" },
    { label: "For MSME", href: "/companies/msme" },
    { label: "For Enterprise", href: "/companies/enterprise" },
  ],
};

export const ossNav: NavGroup = {
  id: "oss",
  label: "OSS",
  items: [
    { label: "Open source", href: "/oss" },
    { label: "miniKMS", href: "/oss/minikms" },
    { label: "Encryption", href: "/oss/encryption" },
  ],
};

export const navGroups: NavGroup[] = [productNav, companiesNav, ossNav];

export const standaloneNav: NavLink[] = [
  { label: "Pricing", href: "/pricing" },
  { label: "API Reference", href: runtimeConfig.apiDocsUrl, external: true },
  { label: "GitHub", href: "https://github.com/EnvSync-Cloud/envsync", external: true },
];

export function pathInGroup(pathname: string, group: NavGroup) {
  return group.items.some((item) => !item.external && (pathname === item.href || pathname.startsWith(`${item.href}/`)));
}
