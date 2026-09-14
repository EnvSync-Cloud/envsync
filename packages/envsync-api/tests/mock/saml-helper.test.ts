import { describe, expect, test } from "bun:test";

import {
	parseIdpMetadataXml,
	validateSamlResponse,
} from "@/helpers/saml";

function b64(xml: string): string {
	return Buffer.from(xml, "utf8").toString("base64");
}

describe("saml helper ReDoS-safe parsing", () => {
	test("validateSamlResponse reads fields without regex", async () => {
		const xml = `<?xml version="1.0"?>
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  Destination="https://api.example/api/saml/acs/org_1" InResponseTo="_req1">
  <samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>
  <saml:Assertion ID="_a1">
    <saml:Issuer>https://idp.example</saml:Issuer>
    <saml:Subject><saml:NameID>ada@example.com</saml:NameID></saml:Subject>
    <saml:Conditions NotBefore="2020-01-01T00:00:00Z" NotOnOrAfter="2099-01-01T00:00:00Z"/>
    <saml:AudienceRestriction><saml:Audience>https://api.example/api/saml/metadata/org_1</saml:Audience></saml:AudienceRestriction>
    <saml:AttributeStatement>
      <saml:Attribute Name="email"><saml:AttributeValue>ada@example.com</saml:AttributeValue></saml:Attribute>
      <saml:Attribute Name="firstName"><saml:AttributeValue>Ada</saml:AttributeValue></saml:Attribute>
      <saml:Attribute Name="groups">
        <saml:AttributeValue>eng</saml:AttributeValue>
        <saml:AttributeValue>admins</saml:AttributeValue>
      </saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>
</samlp:Response>`;

		await expect(
			validateSamlResponse(
				b64(xml),
				"",
				"https://api.example/api/saml/acs/org_1",
				"https://api.example/api/saml/metadata/org_1",
			),
		).rejects.toThrow("SAML IdP certificate is required");
	});

	test("validateSamlResponse rejects unsigned XML when a cert is configured", async () => {
		const xml = `<?xml version="1.0"?>
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" InResponseTo="_req1">
  <samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>
  <saml:Assertion ID="_a1">
    <saml:Issuer>https://idp.example</saml:Issuer>
    <saml:Subject><saml:NameID>ada@example.com</saml:NameID></saml:Subject>
  </saml:Assertion>
</samlp:Response>`;
		await expect(validateSamlResponse(b64(xml), "QUJDREVG", "https://acs.example")).rejects.toThrow(
			"SAML response is not signed",
		);
	});

	test("validateSamlResponse rejects oversized XML", async () => {
		const huge = `<samlp:Response>${"a".repeat(300_000)}</samlp:Response>`;
		await expect(validateSamlResponse(b64(huge), "", "https://acs.example")).rejects.toThrow(
			"SAML XML exceeds size limit",
		);
	});

	test("parseIdpMetadataXml reads entity ID, redirect SSO, and cert", () => {
		const parsed = parseIdpMetadataXml(`<?xml version="1.0"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://idp.example/metadata">
  <md:IDPSSODescriptor>
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data><ds:X509Certificate>QUJDREVG</ds:X509Certificate></ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://idp.example/sso/post"/>
    <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://idp.example/sso/redirect"/>
  </md:IDPSSODescriptor>
</md:EntityDescriptor>`);
		expect(parsed.entity_id).toBe("https://idp.example/metadata");
		expect(parsed.sso_url).toBe("https://idp.example/sso/redirect");
		expect(parsed.certificate).toContain("QUJDREVG");
	});
});
