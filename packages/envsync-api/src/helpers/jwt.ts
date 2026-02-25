import { createRemoteJWKSet, jwtVerify } from "jose";

import { getKeycloakIssuer } from "@/helpers/keycloak";

const getJwksUrl = () =>
	getKeycloakIssuer() + "/protocol/openid-connect/certs";

const jwks = createRemoteJWKSet(new URL(getJwksUrl()));

export async function verifyJWTToken(token: string) {
	const issuer = getKeycloakIssuer();
	const { payload } = await jwtVerify(token, jwks, {
		issuer,
		algorithms: ["RS256"],
	});
	return payload;
}
