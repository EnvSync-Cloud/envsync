/**
 * OSS-safe loader. Forwarding lives in envsync-enterprise.
 * Audit logging must not statically import the proprietary package.
 */
import infoLogs, { LogTypes } from "@/libs/logger";
type AuditLogPayload = {
	action: string;
	org_id: string;
	user_id: string;
	details: Record<string, unknown>;
	message: string;
};

type EnterpriseLogForwarding = {
	LogForwardingService: {
		forwardAuditLog: (payload: AuditLogPayload) => Promise<void>;
	};
};

export class LogForwardingService {
	public static forwardAuditLog = async (payload: AuditLogPayload): Promise<void> => {
		try {
			const { LogForwardingService: EnterpriseForwarding } = (await import(
				"../../../envsync-enterprise/src/services/log-forwarding.service.ts"
			)) as EnterpriseLogForwarding;
			return EnterpriseForwarding.forwardAuditLog(payload);
		} catch (error) {
			infoLogs(
				`Log forwarding skipped: ${error instanceof Error ? error.message : String(error)}`,
				LogTypes.ERROR,
				"LogForwardingService",
			);
		}
	};
}
