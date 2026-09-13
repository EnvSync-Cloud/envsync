import { describe, expect, test } from "bun:test";

import { validateSamlResponse } from "@/helpers/saml";

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
    <saml:Subject><saml:NameID>ada@example.com</saml:NameID></saml:Subject>
    <saml:Conditions NotBefore="2020-01-01T00:00:00Z" NotOnOrAfter="2099-01-01T00:00:00Z"/>
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

		const result = await validateSamlResponse(
			b64(xml),
			"",
			"https://api.example/api/saml/acs/org_1",
		);
		expect(result.inResponseTo).toBe("_req1");
		expect(result.destination).toBe("https://api.example/api/saml/acs/org_1");
		expect(result.attributes.email).toBe("ada@example.com");
		expect(result.attributes.firstName).toBe("Ada");
		expect(result.attributes.groups).toEqual(["eng", "admins"]);
	});

	test("validateSamlResponse rejects oversized XML", async () => {
		const huge = `<samlp:Response>${"a".repeat(300_000)}</samlp:Response>`;
		await expect(validateSamlResponse(b64(huge), "", "https://acs.example")).rejects.toThrow(
			"SAML XML exceeds size limit",
		);
	});
});
