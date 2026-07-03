{{- define "crm.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "crm.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "crm.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "crm.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" -}}
{{- end -}}

{{- define "crm.labels" -}}
helm.sh/chart: {{ include "crm.chart" . }}
app.kubernetes.io/name: {{ include "crm.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "crm.selectorLabels" -}}
app.kubernetes.io/name: {{ include "crm.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "crm.image" -}}
{{- $root := index . 0 -}}
{{- $service := index . 1 -}}
{{- $tag := default $root.Chart.AppVersion $root.Values.global.imageTag -}}
{{- if $root.Values.global.imageRegistry -}}
{{- printf "%s/%s:%s" $root.Values.global.imageRegistry $service.image.repository $tag -}}
{{- else -}}
{{- printf "%s:%s" $service.image.repository $tag -}}
{{- end -}}
{{- end -}}

{{- define "crm.envFrom" -}}
envFrom:
  - configMapRef:
      name: {{ include "crm.fullname" . }}-config
  - secretRef:
      name: {{ .Values.secrets.existingSecret }}
{{- end -}}

{{- define "crm.imagePullSecrets" -}}
{{- with .Values.global.imagePullSecrets }}
imagePullSecrets:
{{- toYaml . | nindent 2 }}
{{- end }}
{{- end -}}
