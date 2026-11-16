import { createRemoteJWKSet, jwtVerify } from "jose";

import { getIdentityIssuer } from "@/helpers/identity";

const getJwksUrl = () => `${getIdentityIssuer()}/oidc/jwks`;

const jwks = createRemoteJWKSet(new URL(getJwksUrl()));

export async function verifyJWTToken(token: string) {
	const issuer = getIdentityIssuer();
	const { payload } = await jwtVerify(token, jwks, {
		issuer,
		algorithms: ["RS256"],
	});
	return payload;
}
