{{- define "envsync.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "envsync.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := include "envsync.name" . -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "envsync.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" -}}
{{- end -}}

{{- define "envsync.labels" -}}
helm.sh/chart: {{ include "envsync.chart" . }}
app.kubernetes.io/name: {{ include "envsync.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- with .Values.global.commonLabels }}
{{ toYaml . }}
{{- end }}
{{- end -}}

{{- define "envsync.selectorLabels" -}}
app.kubernetes.io/name: {{ include "envsync.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "envsync.publicScheme" -}}
{{- default "https" .Values.global.publicScheme -}}
{{- end -}}

{{- define "envsync.domain" -}}
{{- default "envsync.local" .Values.global.domain -}}
{{- end -}}

{{- define "envsync.apiHost" -}}
{{- default (printf "api.%s" (include "envsync.domain" .)) .Values.ingress.hosts.api -}}
{{- end -}}

{{- define "envsync.authHost" -}}
{{- default (printf "auth.%s" (include "envsync.domain" .)) .Values.ingress.hosts.auth -}}
{{- end -}}

{{- define "envsync.dashboardHost" -}}
{{- printf "app.%s" (include "envsync.domain" .) -}}
{{- end -}}

{{- define "envsync.landingUrl" -}}
{{- default (printf "%s://%s" (include "envsync.publicScheme" .) (include "envsync.domain" .)) .Values.urls.landing -}}
{{- end -}}

{{- define "envsync.dashboardUrl" -}}
{{- default (printf "%s://%s" (include "envsync.publicScheme" .) (include "envsync.dashboardHost" .)) .Values.urls.dashboard -}}
{{- end -}}

{{- define "envsync.zitadelPublicUrl" -}}
{{- printf "%s://%s" (include "envsync.publicScheme" .) (default (include "envsync.authHost" .) .Values.zitadel.externalDomain) -}}
{{- end -}}

{{- define "envsync.zitadelInternalUrl" -}}
{{- printf "http://%s-zitadel:%v" (include "envsync.fullname" .) .Values.zitadel.service.port -}}
{{- end -}}

{{- define "envsync.openfgaInternalUrl" -}}
{{- printf "http://%s-openfga:%v" (include "envsync.fullname" .) .Values.openfga.service.httpPort -}}
{{- end -}}

{{- define "envsync.minikmsAddress" -}}
{{- printf "%s-minikms:%v" (include "envsync.fullname" .) .Values.minikms.service.port -}}
{{- end -}}

{{- define "envsync.redisUrl" -}}
{{- if .Values.external.redis.enabled -}}
{{- required "external.redis.url is required when external.redis.enabled=true" .Values.external.redis.url -}}
{{- else -}}
{{- printf "redis://%s-redis-master:6379" .Release.Name -}}
{{- end -}}
{{- end -}}

{{- define "envsync.rustfsEndpoint" -}}
{{- if .Values.external.s3.enabled -}}
{{- required "external.s3.endpoint is required when external.s3.enabled=true" .Values.external.s3.endpoint -}}
{{- else -}}
{{- printf "http://%s-rustfs:%v" (include "envsync.fullname" .) .Values.rustfs.service.port -}}
{{- end -}}
{{- end -}}

{{- define "envsync.rustfsBucketUrl" -}}
{{- if .Values.external.s3.enabled -}}
{{- required "external.s3.bucketUrl is required when external.s3.enabled=true" .Values.external.s3.bucketUrl -}}
{{- else -}}
{{- include "envsync.rustfsEndpoint" . -}}
{{- end -}}
{{- end -}}

{{- define "envsync.s3Bucket" -}}
{{- if .Values.external.s3.enabled -}}
{{- required "external.s3.bucket is required when external.s3.enabled=true" .Values.external.s3.bucket -}}
{{- else -}}
{{- default "envsync-bucket" .Values.rustfs.bucket -}}
{{- end -}}
{{- end -}}

{{- define "envsync.s3Region" -}}
{{- if .Values.external.s3.enabled -}}
{{- default "us-east-1" .Values.external.s3.region -}}
{{- else -}}
{{- default "us-east-1" .Values.rustfs.region -}}
{{- end -}}
{{- end -}}

{{- define "envsync.s3AccessKey" -}}
{{- if .Values.external.s3.enabled -}}
{{- required "external.s3.accessKey is required when external.s3.enabled=true" .Values.external.s3.accessKey -}}
{{- else -}}
{{- required "rustfs.accessKey is required when rustfs is enabled" .Values.rustfs.accessKey -}}
{{- end -}}
{{- end -}}

{{- define "envsync.s3SecretKey" -}}
{{- if .Values.external.s3.enabled -}}
{{- required "external.s3.secretKey is required when external.s3.enabled=true" .Values.external.s3.secretKey -}}
{{- else -}}
{{- required "rustfs.secretKey is required when rustfs is enabled" .Values.rustfs.secretKey -}}
{{- end -}}
{{- end -}}

{{- define "envsync.postgresqlHost" -}}
{{- if .Values.external.postgresql.enabled -}}
{{- required "external.postgresql.host is required when external.postgresql.enabled=true" .Values.external.postgresql.host -}}
{{- else -}}
{{- printf "%s-postgresql" .Release.Name -}}
{{- end -}}
{{- end -}}

{{- define "envsync.postgresqlPort" -}}
{{- if .Values.external.postgresql.enabled -}}
{{- .Values.external.postgresql.port | default 5432 -}}
{{- else -}}
5432
{{- end -}}
{{- end -}}

{{- define "envsync.databaseSslMode" -}}
{{- if .Values.external.postgresql.enabled -}}
{{- default "require" .Values.external.postgresql.sslMode -}}
{{- else -}}
{{- default "disable" .Values.database.sslMode -}}
{{- end -}}
{{- end -}}

{{- define "envsync.databaseSslEnabled" -}}
{{- if eq (include "envsync.databaseSslMode" .) "disable" -}}false{{- else -}}true{{- end -}}
{{- end -}}

{{- define "envsync.postgresqlAdminUser" -}}
{{- if .Values.external.postgresql.enabled -}}
{{- required "external.postgresql.adminUsername is required when external.postgresql.enabled=true" .Values.external.postgresql.adminUsername -}}
{{- else -}}
postgres
{{- end -}}
{{- end -}}

{{- define "envsync.postgresqlAdminPassword" -}}
{{- if .Values.external.postgresql.enabled -}}
{{- required "external.postgresql.adminPassword is required when external.postgresql.enabled=true" .Values.external.postgresql.adminPassword -}}
{{- else -}}
{{- required "postgresql.auth.postgresPassword is required" .Values.postgresql.auth.postgresPassword -}}
{{- end -}}
{{- end -}}

{{- define "envsync.appDatabaseName" -}}
{{- if .Values.external.postgresql.enabled -}}
{{- required "external.postgresql.app.database is required when external.postgresql.enabled=true" .Values.external.postgresql.app.database -}}
{{- else -}}
{{- .Values.postgresql.auth.database -}}
{{- end -}}
{{- end -}}

{{- define "envsync.appDatabaseUser" -}}
{{- if .Values.external.postgresql.enabled -}}
{{- required "external.postgresql.app.username is required when external.postgresql.enabled=true" .Values.external.postgresql.app.username -}}
{{- else -}}
{{- .Values.postgresql.auth.username -}}
{{- end -}}
{{- end -}}

{{- define "envsync.appDatabasePassword" -}}
{{- if .Values.external.postgresql.enabled -}}
{{- required "external.postgresql.app.password is required when external.postgresql.enabled=true" .Values.external.postgresql.app.password -}}
{{- else -}}
{{- required "postgresql.auth.password is required" .Values.postgresql.auth.password -}}
{{- end -}}
{{- end -}}

{{- define "envsync.zitadelDbName" -}}
{{- if .Values.external.postgresql.enabled -}}
{{- required "external.postgresql.zitadel.database is required when external.postgresql.enabled=true" .Values.external.postgresql.zitadel.database -}}
{{- else -}}
{{- .Values.database.roles.zitadel.database -}}
{{- end -}}
{{- end -}}

{{- define "envsync.zitadelDbUser" -}}
{{- if .Values.external.postgresql.enabled -}}
{{- required "external.postgresql.zitadel.username is required when external.postgresql.enabled=true" .Values.external.postgresql.zitadel.username -}}
{{- else -}}
{{- .Values.database.roles.zitadel.username -}}
{{- end -}}
{{- end -}}

{{- define "envsync.zitadelDbPassword" -}}
{{- if .Values.external.postgresql.enabled -}}
{{- required "external.postgresql.zitadel.password is required when external.postgresql.enabled=true" .Values.external.postgresql.zitadel.password -}}
{{- else -}}
{{- required "database.roles.zitadel.password is required" .Values.database.roles.zitadel.password -}}
{{- end -}}
{{- end -}}

{{- define "envsync.openfgaDbName" -}}
{{- if .Values.external.postgresql.enabled -}}
{{- required "external.postgresql.openfga.database is required when external.postgresql.enabled=true" .Values.external.postgresql.openfga.database -}}
{{- else -}}
{{- .Values.database.roles.openfga.database -}}
{{- end -}}
{{- end -}}

{{- define "envsync.openfgaDbUser" -}}
{{- if .Values.external.postgresql.enabled -}}
{{- required "external.postgresql.openfga.username is required when external.postgresql.enabled=true" .Values.external.postgresql.openfga.username -}}
{{- else -}}
{{- .Values.database.roles.openfga.username -}}
{{- end -}}
{{- end -}}

{{- define "envsync.openfgaDbPassword" -}}
{{- if .Values.external.postgresql.enabled -}}
{{- required "external.postgresql.openfga.password is required when external.postgresql.enabled=true" .Values.external.postgresql.openfga.password -}}
{{- else -}}
{{- required "database.roles.openfga.password is required" .Values.database.roles.openfga.password -}}
{{- end -}}
{{- end -}}

{{- define "envsync.minikmsDbName" -}}
{{- if .Values.external.postgresql.enabled -}}
{{- required "external.postgresql.minikms.database is required when external.postgresql.enabled=true" .Values.external.postgresql.minikms.database -}}
{{- else -}}
{{- .Values.database.roles.minikms.database -}}
{{- end -}}
{{- end -}}

{{- define "envsync.minikmsDbUser" -}}
{{- if .Values.external.postgresql.enabled -}}
{{- required "external.postgresql.minikms.username is required when external.postgresql.enabled=true" .Values.external.postgresql.minikms.username -}}
{{- else -}}
{{- .Values.database.roles.minikms.username -}}
{{- end -}}
{{- end -}}

{{- define "envsync.minikmsDbPassword" -}}
{{- if .Values.external.postgresql.enabled -}}
{{- required "external.postgresql.minikms.password is required when external.postgresql.enabled=true" .Values.external.postgresql.minikms.password -}}
{{- else -}}
{{- required "database.roles.minikms.password is required" .Values.database.roles.minikms.password -}}
{{- end -}}
{{- end -}}

{{- define "envsync.openfgaDatabaseUri" -}}
{{- printf "postgres://%s:%s@%s:%v/%s?sslmode=%s" (urlquery (include "envsync.openfgaDbUser" .)) (urlquery (include "envsync.openfgaDbPassword" .)) (include "envsync.postgresqlHost" .) (include "envsync.postgresqlPort" .) (include "envsync.openfgaDbName" .) (include "envsync.databaseSslMode" .) -}}
{{- end -}}

{{- define "envsync.minikmsDatabaseUrl" -}}
{{- printf "postgres://%s:%s@%s:%v/%s?sslmode=%s" (urlquery (include "envsync.minikmsDbUser" .)) (urlquery (include "envsync.minikmsDbPassword" .)) (include "envsync.postgresqlHost" .) (include "envsync.postgresqlPort" .) (include "envsync.minikmsDbName" .) (include "envsync.databaseSslMode" .) -}}
{{- end -}}

{{- define "envsync.bootstrapSecretName" -}}
{{- printf "%s-bootstrap" (include "envsync.fullname" .) -}}
{{- end -}}

{{- define "envsync.bootstrapLockName" -}}
{{- printf "%s-bootstrap-lock" (include "envsync.fullname" .) -}}
{{- end -}}

{{- define "envsync.apiConfigMapName" -}}
{{- printf "%s-api-config" (include "envsync.fullname" .) -}}
{{- end -}}

{{- define "envsync.apiSecretName" -}}
{{- printf "%s-api-secret" (include "envsync.fullname" .) -}}
{{- end -}}

{{- define "envsync.bootstrapServiceAccountName" -}}
{{- printf "%s-bootstrap" (include "envsync.fullname" .) -}}
{{- end -}}

{{- define "envsync.runtimeServiceAccountName" -}}
{{- printf "%s-runtime" (include "envsync.fullname" .) -}}
{{- end -}}
