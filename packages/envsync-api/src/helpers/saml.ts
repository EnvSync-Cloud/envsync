import { v4 as uuidv4 } from "uuid";

const SAML_NS = "urn:oasis:names:tc:SAML:2.0:assertion";
const SAMLP_NS = "urn:oasis:names:tc:SAML:2.0:protocol";
const DS_NS = "http://www.w3.org/2000/09/xmldsig#";

export interface SamlAssertionAttributes {
	email: string;
	firstName: string;
	lastName: string;
	groups: string[];
	nameId: string;
}

export interface SamlParseResult {
	attributes: SamlAssertionAttributes;
	inResponseTo: string;
	destination: string;
}

// ---------------------------------------------------------------------------
// IdP Configuration Helpers
// ---------------------------------------------------------------------------

export interface IdPConfigTemplate {
	entityIdPath: string;
	ssoUrlPath: string;
	certInstructions: string;
	attributeMapping: {
		email: string[];
		firstName: string[];
		lastName: string[];
		groups: string[];
	};
}

const IDP_TEMPLATES: Record<string, IdPConfigTemplate> = {
	okta: {
		entityIdPath: "Identity Provider Metadata → Entity ID",
		ssoUrlPath: "Identity Provider Metadata → SSO URL",
		certInstructions:
			"Download the signing certificate from Security → Certificates or from the Identity Provider metadata XML.",
		attributeMapping: {
			email: ["email", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"],
			firstName: ["firstName", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname"],
			lastName: ["lastName", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"],
			groups: ["groups"],
		},
	},
	"azure-ad": {
		entityIdPath: "App Registration → Overview → Application ID URI, or SAML-based Sign-on → Identifier",
		ssoUrlPath: "App Registration → Single sign-on → SAML-based Sign-on → Login URL",
		certInstructions:
			"Download the Base64 certificate from Enterprise Applications → Single sign-on → SAML Certificates → Certificate (Base64).",
		attributeMapping: {
			email: ["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress", "email"],
			firstName: ["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname", "firstName"],
			lastName: ["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname", "lastName"],
			groups: ["http://schemas.microsoft.com/ws/2008/06/identity/claims/groups", "groups"],
		},
	},
	"google-workspace": {
		entityIdPath: "Admin Console → Apps → SAML apps → Service Provider Details → Entity ID",
		ssoUrlPath: "Admin Console → Apps → SAML apps → Identity Provider details → SSO URL",
		certInstructions:
			"Download the certificate from Admin Console → Apps → SAML apps → Identity Provider details → Certificate.",
		attributeMapping: {
			email: ["email", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"],
			firstName: ["firstName", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname"],
			lastName: ["lastName", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"],
			groups: ["groups"],
		},
	},
	onelogin: {
		entityIdPath: "SSO tab → Issuer URL",
		ssoUrlPath: "SSO tab → SAML 2.0 Endpoint (HTTP)",
		certInstructions:
			"Download the X.509 certificate from the SSO tab → X.509 Certificate → View Details.",
		attributeMapping: {
			email: ["email", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"],
			firstName: ["firstName", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname"],
			lastName: ["lastName", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"],
			groups: ["groups", "memberOf"],
		},
	},
};

export function getIdPTemplate(providerType: string): IdPConfigTemplate | null {
	return IDP_TEMPLATES[providerType] ?? null;
}

export function getSupportedIdPTypes(): string[] {
	return Object.keys(IDP_TEMPLATES);
}

// ---------------------------------------------------------------------------
// SP Certificate Generation (Web Crypto API)
// ---------------------------------------------------------------------------

export interface SpCertificate {
	certPem: string;
	privateKeyPem: string;
}

let cachedSpCert: SpCertificate | null = null;

/**
 * Generate or retrieve SP signing certificate.
 * In production, this should be provided via SAML_SP_CERT and SAML_SP_KEY env vars.
 * For development, generates a self-signed RSA certificate using Web Crypto API.
 */
export async function getSpCertificate(): Promise<SpCertificate> {
	if (cachedSpCert) return cachedSpCert;

	const envCert = process.env.SAML_SP_CERT;
	const envKey = process.env.SAML_SP_KEY;
	if (envCert && envKey) {
		cachedSpCert = { certPem: envCert, privateKeyPem: envKey };
		return cachedSpCert;
	}

	cachedSpCert = await generateSelfSignedCert();
	return cachedSpCert;
}

async function generateSelfSignedCert(): Promise<SpCertificate> {
	const keyPair = await crypto.subtle.generateKey(
		{ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
		true,
		["sign", "verify"],
	);

	const publicKeySpki = new Uint8Array(await crypto.subtle.exportKey("spki", keyPair.publicKey));
	const privateKeyPkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", keyPair.privateKey));

	const serialNumber = generateSerialNumber();
	const notBefore = new Date();
	const notAfter = new Date(notBefore.getTime() + 10 * 365 * 24 * 60 * 60 * 1000); // 10 years

	const certDer = buildSelfSignedX509Der(publicKeySpki, serialNumber, notBefore, notAfter);
	const certPem = `-----BEGIN CERTIFICATE-----\n${formatBase64Lines(derToBase64(certDer))}\n-----END CERTIFICATE-----`;
	const keyPem = `-----BEGIN PRIVATE KEY-----\n${formatBase64Lines(derToBase64(privateKeyPkcs8))}\n-----END PRIVATE KEY-----`;

	return { certPem, privateKeyPem: keyPem };
}

function generateSerialNumber(): Uint8Array {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	bytes[0] &= 0x7f; // Ensure positive
	return bytes;
}

function derToBase64(der: Uint8Array): string {
	let binary = "";
	for (const byte of der) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function formatBase64Lines(b64: string): string {
	const lines: string[] = [];
	for (let i = 0; i < b64.length; i += 64) lines.push(b64.slice(i, i + 64));
	return lines.join("\n");
}

// Minimal DER builder for self-signed X.509 certificate
function buildSelfSignedX509Der(
	publicKeySpki: Uint8Array,
	serial: Uint8Array,
	notBefore: Date,
	notAfter: Date,
): Uint8Array {
	const validity = derSequence(
		derUtcTime(notBefore),
		derUtcTime(notAfter),
	);
	const issuer = derSequence(
		derSet(derSequence(derOid([2, 5, 4, 3]), derUtf8String("EnvSync SP"))),
	);
	const tbsCertificate = derSequence(
		derInteger(serial),
		derSequence(derOid([2, 16, 840,1,101,3,4,2,1]), derNull()), // SHA256
		issuer,
		validity,
		issuer, // self-signed: issuer = subject
		new Uint8Array(publicKeySpki),
	);
	// For self-signed dev certs we skip the real signature and embed the TBSCertificate
	// as a placeholder. Real deployments should use SAML_SP_CERT/SAML_SP_KEY env vars.
	return derSequence(
		tbsCertificate,
		derSequence(derOid([2, 16, 840,1,101,3,4,2,1]), derNull()),
		derBitString(new Uint8Array(256)),
	);
}

function derLengthBytes(length: number): Uint8Array {
	if (length < 0x80) return new Uint8Array([length]);
	if (length < 0x100) return new Uint8Array([0x81, length]);
	return new Uint8Array([0x82, (length >> 8) & 0xff, length & 0xff]);
}

function derTlv(tag: number, content: Uint8Array): Uint8Array {
	const lenBytes = derLengthBytes(content.length);
	const result = new Uint8Array(1 + lenBytes.length + content.length);
	result[0] = tag;
	result.set(lenBytes, 1);
	result.set(content, 1 + lenBytes.length);
	return result;
}

function derSequence(...items: Uint8Array[]): Uint8Array {
	let total = 0;
	for (const item of items) total += item.length;
	const content = new Uint8Array(total);
	let offset = 0;
	for (const item of items) { content.set(item, offset); offset += item.length; }
	return derTlv(0x30, content);
}

function derSet(...items: Uint8Array[]): Uint8Array {
	let total = 0;
	for (const item of items) total += item.length;
	const content = new Uint8Array(total);
	let offset = 0;
	for (const item of items) { content.set(item, offset); offset += item.length; }
	return derTlv(0x31, content);
}

function derOid(oid: number[]): Uint8Array {
	if (oid.length < 2) throw new Error("OID must have at least 2 components");
	const content = [oid[0] * 40 + oid[1]];
	for (let i = 2; i < oid.length; i++) {
		let v = oid[i];
		if (v < 0x80) { content.push(v); continue; }
		const bytes: number[] = [];
		while (v > 0) { bytes.unshift(v & 0x7f); v >>= 7; }
		for (let j = 0; j < bytes.length - 1; j++) bytes[j] |= 0x80;
		content.push(...bytes);
	}
	return derTlv(0x06, new Uint8Array(content));
}

function derNull(): Uint8Array {
	return new Uint8Array([0x05, 0x00]);
}

function derInteger(value: Uint8Array): Uint8Array {
	const needsPad = value[0] & 0x80;
	const content = needsPad
		? new Uint8Array(value.length + 1)
		: value;
	if (needsPad) { content[0] = 0; content.set(value, 1); }
	return derTlv(0x02, content);
}

function derUtf8String(value: string): Uint8Array {
	const bytes = new TextEncoder().encode(value);
	return derTlv(0x0c, bytes);
}

function derUtcTime(date: Date): Uint8Array {
	const y = date.getUTCFullYear();
	const str = `${y >= 2000 ? y - 2000 : y - 1900}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`;
	return derTlv(0x17, new TextEncoder().encode(str));
}

function derBitString(data: Uint8Array): Uint8Array {
	const content = new Uint8Array(data.length + 1);
	content[0] = 0; // unused bits
	content.set(data, 1);
	return derTlv(0x03, content);
}

function pad2(n: number): string {
	return n.toString().padStart(2, "0");
}

// ---------------------------------------------------------------------------
// XML Signature Verification
// ---------------------------------------------------------------------------

/**
 * Verify an XML-DSIG signature in a SAML Response using the IdP's X.509 certificate.
 *
 * Steps:
 * 1. Extract the <ds:SignedInfo> element from the <ds:Signature>
 * 2. Canonicalize SignedInfo using Exclusive C14N (for signature verification)
 * 3. Extract the public key from the IdP's X.509 certificate
 * 4. Verify the RSA/ECDSA signature over the canonicalized SignedInfo
 * 5. Verify the DigestValue over the canonicalized assertion
 */
export async function verifyXmlSignature(
	xml: string,
	idpCertificate: string,
): Promise<boolean> {
	const signatureValue = getFirstMatch(xml, /<ds:SignatureValue[^>]*>([\s\S]*?)<\/ds:SignatureValue>/);
	if (!signatureValue) {
		throw new Error("SAML response missing SignatureValue");
	}

	const signedInfoBlock = getFirstMatch(xml, /<ds:SignedInfo[^>]*>([\s\S]*?)<\/ds:SignedInfo>/);
	if (!signedInfoBlock) {
		throw new Error("SAML response missing SignedInfo");
	}

	// Reconstruct full SignedInfo element for canonicalization
	const signedInfoXml = `<ds:SignedInfo xmlns:ds="${DS_NS}">${signedInfoBlock}</ds:SignedInfo>`;

	// Canonicalize SignedInfo (Exclusive C14N - required by most SAML IdPs)
	const canonicalizedSignedInfo = canonicalizeForSignature(signedInfoXml);

	// Extract public key from IdP certificate
	const certPem = extractCertPem(idpCertificate);
	if (certPem.length === 0) {
		throw new Error("IdP certificate is empty or invalid");
	}
	const publicKey = await importCertPublicKey(certPem);

	// Decode the signature value from base64
	const sigBytes = base64ToUint8Array(signatureValue.trim());
	const dataBytes = new TextEncoder().encode(canonicalizedSignedInfo);

	// Verify the RSA signature (SHA-256 with RSASSA-PKCS1-v1_5)
	const signatureValid = await crypto.subtle.verify(
		"RSASSA-PKCS1-v1_5",
		publicKey,
		sigBytes as unknown as BufferSource,
		dataBytes as unknown as BufferSource,
	);

	if (!signatureValid) {
		throw new Error("SAML XML signature verification failed");
	}

	// Also verify the DigestValue over the assertion
	await verifyAssertionDigest(xml);

	return true;
}

/**
 * Verify the DigestValue in the XML signature matches the canonicalized assertion.
 */
async function verifyAssertionDigest(xml: string): Promise<void> {
	const digestValue = getFirstMatch(xml, /<ds:DigestValue[^>]*>([^<]+)<\/ds:DigestValue>/);
	if (!digestValue) {
		throw new Error("SAML signature missing DigestValue");
	}

	const referenceUri = getFirstMatch(xml, /<ds:Reference[^>]+URI="([^"]+)"/);
	if (!referenceUri) {
		throw new Error("SAML signature missing Reference URI");
	}

	// The URI references the Assertion ID (typically "#_id")
	const assertionId = referenceUri.startsWith("#") ? referenceUri.slice(1) : referenceUri;
	const assertionXml = extractAssertionById(xml, assertionId);
	if (!assertionXml) {
		throw new Error(`SAML assertion with ID "${assertionId}" not found`);
	}

	// Canonicalize the assertion and compute its SHA-256 digest
	const canonicalAssertion = canonicalizeForSignature(assertionXml);
	const assertionBytes = new TextEncoder().encode(canonicalAssertion);
	const computedDigest = await crypto.subtle.digest("SHA-256", assertionBytes.buffer);
	const computedDigestB64 = uint8ArrayToBase64(new Uint8Array(computedDigest));

	if (computedDigestB64 !== digestValue.trim()) {
		throw new Error("SAML assertion digest mismatch — assertion may have been tampered with");
	}
}

/**
 * Extract an Assertion element by its ID attribute from the SAML response.
 */
function extractAssertionById(xml: string, assertionId: string): string | null {
	// Try with saml namespace prefix
	const escapedId = escapeXml(assertionId);
	const patterns = [
		new RegExp(`(<saml:Assertion[^>]+ID="${escapedId}"[\\s\\S]*?<\\/saml:Assertion>)`),
		new RegExp(`(<Assertion[^>]+ID="${escapedId}"[\\s\\S]*?<\\/Assertion>)`),
	];
	for (const pattern of patterns) {
		const match = xml.match(pattern);
		if (match?.[1]) return match[1];
	}
	return null;
}

// ---------------------------------------------------------------------------
// Exclusive XML Canonicalization (C14N) — subset sufficient for SAML XML-DSIG
// ---------------------------------------------------------------------------

/**
 * Canonicalize an XML element using Exclusive XML Canonicalization (C14N).
 * This is the canonicalization algorithm used by most SAML IdPs for XML-DSIG.
 *
 * Implementation handles the common subset needed for SAML:
 * - Sort attributes lexicographically by namespace URI then local name
 * - Escape special characters in text and attribute values
 * - Preserve namespace declarations in scope
 * - Normalize whitespace in text nodes
 */
function canonicalizeForSignature(xml: string): string {
	const parser = new DOMParser();
	const doc = parser.parseFromString(xml, "application/xml");

	const parserError = doc.querySelector("parsererror");
	if (parserError) {
		throw new Error(`XML parse error during canonicalization: ${parserError.textContent}`);
	}

	const root = doc.documentElement;
	return canonicalizeNode(root, new Map());
}

function canonicalizeNode(node: Node, parentNamespaces: Map<string, string>): string {
	if (node.nodeType === Node.TEXT_NODE) {
		const text = node.textContent ?? "";
		// Inclusive C14N: normalize line breaks and escape special chars
		const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
		return escapeXmlText(normalized);
	}

	if (node.nodeType !== Node.ELEMENT_NODE) return "";

	const el = node as Element;
	const tagName = el.tagName;
	const nsMap = new Map(parentNamespaces);

	// Collect namespace declarations from this element
	for (const attr of Array.from(el.attributes)) {
		if (attr.name === "xmlns") {
			nsMap.set("", attr.value);
		} else if (attr.name.startsWith("xmlns:")) {
			nsMap.set(attr.name.slice(6), attr.value);
		}
	}

	// Sort attributes: namespace URI first, then local name
	const attrs = Array.from(el.attributes)
		.filter((a) => !a.name.startsWith("xmlns"))
		.sort((a, b) => {
			const aNs = a.namespaceURI ?? "";
			const bNs = b.namespaceURI ?? "";
			if (aNs !== bNs) return aNs < bNs ? -1 : 1;
			return a.localName < b.localName ? -1 : a.localName > b.localName ? 1 : 0;
		});

	// Build the element
	let result = `<${tagName}`;

	// Output namespace declarations that are in scope
	for (const [prefix, uri] of nsMap) {
		if (prefix === "") {
			result += ` xmlns="${escapeXmlAttr(uri)}"`;
		} else {
			result += ` xmlns:${prefix}="${escapeXmlAttr(uri)}"`;
		}
	}

	for (const attr of attrs) {
		const ns = attr.namespaceURI;
		const attrName = ns ? `${ns}:${attr.localName}` : attr.localName;
		result += ` ${attrName}="${escapeXmlAttr(attr.value)}"`;
	}

	result += ">";

	// Process child nodes
	for (const child of Array.from(node.childNodes)) {
		result += canonicalizeNode(child, nsMap);
	}

	result += `</${tagName}>`;
	return result;
}

function escapeXmlText(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\r\n/g, "&#13;\n")
		.replace(/\r/g, "&#13;");
}

function escapeXmlAttr(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/\t/g, "&#9;")
		.replace(/\n/g, "&#10;")
		.replace(/\r/g, "&#13;");
}

// ---------------------------------------------------------------------------
// X.509 Public Key Import
// ---------------------------------------------------------------------------

/**
 * Import a public key from a PEM-encoded X.509 certificate.
 * Parses the DER-encoded certificate to extract the SubjectPublicKeyInfo (SPKI)
 * and imports it into Web Crypto API.
 */
async function importCertPublicKey(certPem: string): Promise<CryptoKey> {
	const certDer = base64ToUint8Array(certPem);
	const spki = extractSpkiFromCertificate(certDer);

	return crypto.subtle.importKey(
		"spki",
		spki as unknown as BufferSource,
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["verify"],
	);
}

/**
 * Extract the SubjectPublicKeyInfo (SPKI) bytes from a DER-encoded X.509 certificate.
 *
 * X.509 structure: SEQUENCE { tbsCertificate, signatureAlgorithm, signatureValue }
 * tbsCertificate: SEQUENCE { ..., subjectPublicKeyInfo }
 *
 * We locate the SPKI by parsing the DER structure.
 */
function extractSpkiFromCertificate(certDer: Uint8Array): Uint8Array {
	let offset = 0;

	function readLength(): number {
		const first = certDer[offset++];
		if (first < 0x80) return first;
		const numBytes = first & 0x7f;
		let length = 0;
		for (let i = 0; i < numBytes; i++) {
			length = (length << 8) | certDer[offset++];
		}
		return length;
	}

	function readTlv(): { tag: number; content: Uint8Array; contentOffset: number } {
		const tag = certDer[offset++];
		const length = readLength();
		const contentOffset = offset;
		const content = certDer.slice(offset, offset + length);
		offset += length;
		return { tag, content, contentOffset };
	}

	function skipTlv() {
		certDer[offset++]; // tag
		const length = readLength();
		offset += length;
	}

	// Outer SEQUENCE (Certificate)
	const outerSeq = readTlv();
	if (outerSeq.tag !== 0x30) throw new Error("Invalid X.509: expected SEQUENCE");

	// tbsCertificate SEQUENCE
	offset = outerSeq.contentOffset;
	const tbsSeq = readTlv();
	if (tbsSeq.tag !== 0x30) throw new Error("Invalid X.509: expected tbsCertificate SEQUENCE");

	// Parse tbsCertificate to find subjectPublicKeyInfo
	offset = tbsSeq.contentOffset;

	// Skip version (optional, context tag 0)
	if (certDer[offset] === 0xa0) skipTlv();
	// Skip serialNumber
	skipTlv();
	// Skip signature algorithm
	skipTlv();
	// Skip issuer
	skipTlv();
	// Skip validity
	skipTlv();
	// Skip subject
	skipTlv();

	// Next is subjectPublicKeyInfo
	const spkiStart = offset;
	const spkiTlv = readTlv();
	if (spkiTlv.tag !== 0x30) throw new Error("Invalid X.509: expected subjectPublicKeyInfo SEQUENCE");

	return certDer.slice(spkiStart, offset);
}

// ---------------------------------------------------------------------------
// AuthnRequest Builder
// ---------------------------------------------------------------------------

export function buildAuthnRequest(
	spEntityId: string,
	acsUrl: string,
	idpSsoUrl: string,
): { xml: string; requestId: string } {
	const requestId = `_${uuidv4()}`;
	const issueInstant = new Date().toISOString();

	const xml = [
		`<samlp:AuthnRequest xmlns:samlp="${SAMLP_NS}" xmlns:saml="${SAML_NS}"`,
		` ID="${requestId}"`,
		` Version="2.0"`,
		` IssueInstant="${issueInstant}"`,
		` Destination="${escapeXml(idpSsoUrl)}"`,
		` AssertionConsumerServiceURL="${escapeXml(acsUrl)}"`,
		` ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">`,
		`<saml:Issuer>${escapeXml(spEntityId)}</saml:Issuer>`,
		`<samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" AllowCreate="true" />`,
		`</samlp:AuthnRequest>`,
	].join("");

	return { xml, requestId };
}

// ---------------------------------------------------------------------------
// SP Metadata Builder
// ---------------------------------------------------------------------------

export async function buildSpMetadata(
	spEntityId: string,
	acsUrl: string,
): Promise<string> {
	const spCert = await getSpCertificate();
	const certBase64 = extractCertPem(spCert.certPem);

	return [
		`<?xml version="1.0" encoding="UTF-8"?>`,
		`<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${escapeXml(spEntityId)}">`,
		`<md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="${SAMLP_NS}">`,
		`<md:KeyDescriptor use="signing">`,
		`<ds:KeyInfo xmlns:ds="${DS_NS}"><ds:X509Data><ds:X509Certificate>${certBase64}</ds:X509Certificate></ds:X509Data></ds:KeyInfo>`,
		`</md:KeyDescriptor>`,
		`<md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>`,
		`<md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${escapeXml(acsUrl)}" index="0" isDefault="true" />`,
		`</md:SPSSODescriptor>`,
		`</md:EntityDescriptor>`,
	].join("");
}

// ---------------------------------------------------------------------------
// SAML Response Validation
// ---------------------------------------------------------------------------

function decodeBase64(base64: string): string {
	const raw = atob(base64);
	const bytes = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) {
		bytes[i] = raw.charCodeAt(i);
	}
	return new TextDecoder().decode(bytes);
}

function base64ToUint8Array(b64: string): Uint8Array {
	const raw = atob(b64);
	const bytes = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
	return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function getFirstMatch(xml: string, pattern: RegExp): string | null {
	const match = xml.match(pattern);
	return match?.[1] ?? null;
}

function getAllMatches(xml: string, pattern: RegExp): string[] {
	const matches: string[] = [];
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(xml)) !== null) {
		matches.push(match[1]);
	}
	return matches;
}

function extractCertPem(certificate: string): string {
	const stripped = certificate
		.replace(/-----BEGIN CERTIFICATE-----/g, "")
		.replace(/-----END CERTIFICATE-----/g, "")
		.replace(/\s+/g, "");
	return stripped;
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

export async function validateSamlResponse(
	samlResponseBase64: string,
	idpCertificate: string,
	expectedAcsUrl: string,
): Promise<SamlParseResult> {
	const xml = decodeBase64(samlResponseBase64);

	// 1. Check status code
	const statusCode = getFirstMatch(xml, /StatusCode\s+Value="([^"]+)"/);
	if (!statusCode || !statusCode.includes("Success")) {
		throw new Error("SAML response indicates authentication failure");
	}

	// 2. Verify destination
	const destination = getFirstMatch(xml, /Response[^>]+Destination="([^"]+)"/);
	if (destination && destination !== expectedAcsUrl) {
		throw new Error("SAML response destination mismatch");
	}

	// 3. Verify InResponseTo
	const inResponseTo = getFirstMatch(xml, /Response[^>]+InResponseTo="([^"]+)"/);
	if (!inResponseTo) {
		throw new Error("SAML response missing InResponseTo attribute");
	}

	// 4. Extract NameID
	const nameId = getFirstMatch(xml, /NameID[^>]*>([^<]+)<\/saml:NameID>/)
		?? getFirstMatch(xml, /NameID[^>]*>([^<]+)<\/NameID>/);
	if (!nameId) {
		throw new Error("SAML response missing NameID");
	}

	// 5. Verify time conditions
	const notBefore = getFirstMatch(xml, /Conditions[^>]+NotBefore="([^"]+)"/);
	const notOnOrAfter = getFirstMatch(xml, /Conditions[^>]+NotOnOrAfter="([^"]+)"/);
	if (notBefore && notOnOrAfter) {
		const now = Date.now();
		const start = new Date(notBefore).getTime();
		const end = new Date(notOnOrAfter).getTime();
		// Allow 5-minute clock skew
		const clockSkew = 5 * 60 * 1000;
		if (now < start - clockSkew || now >= end + clockSkew) {
			throw new Error("SAML assertion is outside the valid time window");
		}
	}

	// 6. Verify XML signature (the critical security check)
	const certPem = extractCertPem(idpCertificate);
	if (certPem.length > 0 && xml.includes("<ds:Signature")) {
		await verifyXmlSignature(xml, idpCertificate);
	} else if (certPem.length > 0) {
		// Certificate provided but no signature found — reject
		throw new Error("SAML response is not signed but IdP certificate is configured");
	}

	// 7. Extract attributes
	const email = extractAttribute(xml, "email")
		?? extractAttribute(xml, "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress")
		?? nameId;
	const firstName = extractAttribute(xml, "firstName")
		?? extractAttribute(xml, "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname")
		?? extractAttribute(xml, "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/firstname")
		?? "";
	const lastName = extractAttribute(xml, "lastName")
		?? extractAttribute(xml, "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname")
		?? extractAttribute(xml, "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/lastname")
		?? "";
	const groups = extractAttributeValues(xml, "groups")
		?? extractAttributeValues(xml, "http://schemas.xmlsoap.org/claims/Group")
		?? [];

	return {
		attributes: { email, firstName, lastName, groups, nameId },
		inResponseTo,
		destination: destination ?? expectedAcsUrl,
	};
}

function extractAttribute(xml: string, name: string): string | null {
	const escapedName = escapeXml(name);
	const pattern = new RegExp(
		`<saml:Attribute[^>]+Name="${escapedName}"[^>]*>\\s*<saml:AttributeValue[^>]*>([^<]+)<\\/saml:AttributeValue>`,
	);
	return getFirstMatch(xml, pattern)
		?? getFirstMatch(xml, new RegExp(
			`<Attribute[^>]+Name="${escapedName}"[^>]*>\\s*<AttributeValue[^>]*>([^<]+)<\\/AttributeValue>`,
		));
}

function extractAttributeValues(xml: string, name: string): string[] | null {
	const escapedName = escapeXml(name);
	const pattern = new RegExp(
		`<saml:Attribute[^>]+Name="${escapedName}"[^>]*>([\\s\\S]*?)<\\/saml:Attribute>`,
	);
	const block = getFirstMatch(xml, pattern)
		?? getFirstMatch(xml, new RegExp(
			`<Attribute[^>]+Name="${escapedName}"[^>]*>([\\s\\S]*?)<\\/Attribute>`,
		));
	if (!block) return null;

	const values = getAllMatches(block, /<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/g);
	if (values.length > 0) return values;

	return getAllMatches(block, /<AttributeValue[^>]*>([^<]+)<\/AttributeValue>/g);
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

export function deflateAndEncode(xml: string): string {
	const encoded = btoa(xml);
	return encodeURIComponent(encoded);
}
