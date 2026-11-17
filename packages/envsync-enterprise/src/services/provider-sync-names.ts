function isAsciiAlphaNum(char: string) {
	const code = char.charCodeAt(0);
	return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function mapChars(value: string, mapChar: (char: string) => string) {
	let out = "";
	for (const char of value) out += mapChar(char);
	return out;
}

function collapseChar(value: string, char: string) {
	let out = "";
	let pending = false;
	for (const unit of value) {
		if (unit === char) {
			if (!pending) out += char;
			pending = true;
			continue;
		}
		pending = false;
		out += unit;
	}
	return out;
}

function trimChar(value: string, char: string) {
	let start = 0;
	let end = value.length;
	while (start < end && value[start] === char) start += 1;
	while (end > start && value[end - 1] === char) end -= 1;
	return value.slice(start, end);
}

export function sanitizeSecretKey(key: string) {
	const replaced = mapChars(key, char => (isAsciiAlphaNum(char) || char === "_" ? char : "_"));
	return trimChar(collapseChar(replaced, "_"), "_").toUpperCase();
}

export function sanitizeGoogleSecretId(key: string) {
	const replaced = mapChars(key, char => (isAsciiAlphaNum(char) || char === "_" || char === "-" ? char : "-"));
	const normalized = trimChar(collapseChar(replaced, "-"), "-");
	return normalized || "ENVSYNC_SECRET";
}

export function collapseSlashes(value: string) {
	return collapseChar(value, "/");
}

export function trimSlashes(value: string) {
	return trimChar(value, "/");
}
