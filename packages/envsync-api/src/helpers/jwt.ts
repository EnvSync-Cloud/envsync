import { createRemoteJWKSet, jwtVerify } from "jose";

import { getZitadelIssuer } from "@/helpers/zitadel";

const getJwksUrl = () => getZitadelIssuer() + "/oauth/v2/keys";

const jwks = createRemoteJWKSet(new URL(getJwksUrl()));

export async function verifyJWTToken(token: string) {
	const issuer = getZitadelIssuer();
	const { payload } = await jwtVerify(token, jwks, {
		issuer,
		algorithms: ["RS256"],
	});
	return payload;
}
