import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, FileText, XCircle } from "lucide-react";
import {
  BulkEnvVarData,
  EnvironmentType,
  BULK_IMPORT_EXAMPLE,
  ENV_VAR_KEY_REGEX,
  MAX_KEY_LENGTH,
  MAX_VALUE_LENGTH,
} from "@/constants";

interface ParsedVariable {
  key: string;
  value: string;
  sensitive: boolean;
  line: number;
  valid: boolean;
  error?: string;
}

interface BulkImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  environmentTypes: EnvironmentType[];
  onImport: (data: BulkEnvVarData) => void;
  isImporting: boolean;
  isSecret?: boolean; // Optional prop to force secret mode
  defaultEnvironment?: string; // Pre-fill environment from page context
}

export const BulkImportModal = ({
  open,
  onOpenChange,
  environmentTypes,
  onImport,
  isImporting,
  isSecret,
  defaultEnvironment,
}: BulkImportModalProps) => {
  const location = useLocation();

  // Determine if we're on secrets page or if forced to secret mode
  const isSecretsPage = location.pathname.includes("/secrets") || isSecret;

  const [selectedEnvType, setSelectedEnvType] = useState("");
  const [importText, setImportText] = useState("");
  const [parsedVariables, setParsedVariables] = useState<ParsedVariable[]>([]);
  const [activeTab, setActiveTab] = useState("input");

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      const prefilledEnvId = defaultEnvironment && environmentTypes.some(et => et.id === defaultEnvironment)
        ? defaultEnvironment
        : "";
      setSelectedEnvType(prefilledEnvId);
      setImportText("");
      setParsedVariables([]);
      setActiveTab("input");
    }
  }, [open, defaultEnvironment, environmentTypes]);

  // Parse variables when import text changes
  useEffect(() => {
    if (!importText.trim()) {
      setParsedVariables([]);
      return;
    }

    const lines = importText.split("\n");
    const parsed: ParsedVariable[] = [];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith("#")) {
        return;
      }

      const equalIndex = trimmedLine.indexOf("=");
      if (equalIndex === -1) {
        parsed.push({
          key: trimmedLine,
          value: "",
          sensitive: isSecretsPage, // Auto-set sensitive for secrets page
          line: index + 1,
          valid: false,
          error: "Missing '=' separator",
        });
        return;
      }

      const key = trimmedLine.substring(0, equalIndex).trim();
      const value = trimmedLine.substring(equalIndex + 1).trim();

      // Remove quotes if present
      const cleanValue = value.replace(/^["']|["']$/g, "");

      // Validate key
      let error: string | undefined;
      let valid = true;

      if (!key) {
        error = "Key is required";
        valid = false;
      } else if (!ENV_VAR_KEY_REGEX.test(key)) {
        error = "Invalid key format";
        valid = false;
      } else if (key.length > MAX_KEY_LENGTH) {
        error = `Key too long (max ${MAX_KEY_LENGTH} chars)`;
        valid = false;
      } else if (!cleanValue) {
        error = "Value is required";
        valid = false;
      } else if (cleanValue.length > MAX_VALUE_LENGTH) {
        error = `Value too long (max ${MAX_VALUE_LENGTH} chars)`;
        valid = false;
      }

      // Determine if sensitive
      let sensitive = isSecretsPage; // Auto-set for secrets page

      if (!isSecretsPage) {
        // Only auto-detect sensitivity if not on secrets page
        const sensitivePatterns = [
          /secret/i,
          /password/i,
          /token/i,
          /key/i,
          /auth/i,
          /credential/i,
          /private/i,
          /jwt/i,
          /api_key/i,
        ];
        sensitive = sensitivePatterns.some((pattern) => pattern.test(key));
      }

      parsed.push({
        key: key.toUpperCase(),
        value: cleanValue,
        sensitive,
        line: index + 1,
        valid,
        error,
      });
    });

    setParsedVariables(parsed);
  }, [importText, isSecretsPage]);

  // Handle import
  const handleImport = useCallback(() => {
    if (!selectedEnvType || isImporting) return;

    const validVariables = parsedVariables.filter((v) => v.valid);
    if (validVariables.length === 0) return;

    const importData: BulkEnvVarData = {
      env_type_id: selectedEnvType,
      variables: validVariables.map((v) => ({
        key: v.key,
        value: v.value,
        sensitive: v.sensitive,
      })),
    };

    onImport(importData);
  }, [selectedEnvType, parsedVariables, isImporting, onImport]);

  // Handle modal close
  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // Load example
  const handleLoadExample = useCallback(() => {
    const exampleText = isSecretsPage
      ? `# Secret variables for your application
# Lines starting with # are comments

API_SECRET_KEY=example_api_secret
DATABASE_PASSWORD=example_database_password
JWT_SECRET=example_jwt_secret
STRIPE_SECRET_KEY=example_stripe_secret
OAUTH_CLIENT_SECRET=oauth_secret_value`
      : BULK_IMPORT_EXAMPLE;

    setImportText(exampleText);
    setActiveTab("preview");
  }, [isSecretsPage]);

  const validVariables = parsedVariables.filter((v) => v.valid);
  const invalidVariables = parsedVariables.filter((v) => !v.valid);
  const canImport = selectedEnvType && validVariables.length > 0;

  // Dynamic content based on context
  const modalTitle = isSecretsPage ? "Import secrets" : "Import variables";
  const buttonText = isSecretsPage ? "Import secrets" : "Import variables";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-foreground">{modalTitle}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            One KEY=value pair per line. Lines starting with # are ignored.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-env-type" className="text-foreground">
              Environment
            </Label>
            <Select
              value={selectedEnvType}
              onValueChange={setSelectedEnvType}
              disabled={isImporting}
            >
              <SelectTrigger className="bg-card border-border text-foreground">
                <SelectValue placeholder="Select environment type" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {environmentTypes.map((envType) => (
                  <SelectItem
                    key={envType.id}
                    value={envType.id}
                    className="text-foreground hover:bg-muted"
                  >
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: envType.color }}
                      />
                      <span>{envType.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid h-9 w-full grid-cols-2 bg-muted">
              <TabsTrigger
                value="input"
                className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                Input
              </TabsTrigger>
              <TabsTrigger
                value="preview"
                className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                Preview ({parsedVariables.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="input" className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="import-text" className="text-foreground">
                    {isSecretsPage
                      ? "Secret Variables"
                      : "Variables"}
                  </Label>
                  <Button
                    onClick={handleLoadExample}
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Load Example
                  </Button>
                </div>
                <Textarea
                  id="import-text"
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  className="bg-card border-border text-foreground font-mono min-h-[300px]"
                  placeholder={
                    isSecretsPage
                      ? `# Enter your secret variables in KEY=value format
# Lines starting with # are comments

API_SECRET_KEY=your-secret-api-key
DATABASE_PASSWORD=secure_password_123
JWT_SECRET=your-jwt-secret-key
STRIPE_SECRET_KEY=sk_live_your_stripe_key`
                      : `# Enter your variables in KEY=value format
# Lines starting with # are comments

DATABASE_URL=postgresql://user:pass@localhost:5432/db
API_KEY=your-secret-api-key
DEBUG=true
PORT=3000`
                  }
                  disabled={isImporting}
                />
                <p className="text-xs text-muted-foreground">
                  {importText.split("\n").length} lines
                  {isSecretsPage ? " · values are stored as secrets" : ""}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="space-y-4">
              {parsedVariables.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                  <p className="text-muted-foreground">No variables to preview</p>
                  <p className="text-tertiary text-sm">
                    Enter variables in the Input tab to see the preview
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-muted-foreground">
                      {validVariables.length} valid
                      {invalidVariables.length > 0 ? ` · ${invalidVariables.length} invalid` : ""}
                    </span>
                  </div>

                  {/* Variables List */}
                  <div className="max-h-[300px] overflow-y-auto border border-border rounded-lg">
                    <table className="w-full">
                      <thead className="bg-card sticky top-0">
                        <tr>
                          <th className="text-left py-2 px-3 text-muted-foreground text-sm">
                            Status
                          </th>
                          <th className="text-left py-2 px-3 text-muted-foreground text-sm">
                            Key
                          </th>
                          <th className="text-left py-2 px-3 text-muted-foreground text-sm">
                            Value
                          </th>
                          <th className="text-left py-2 px-3 text-muted-foreground text-sm">
                            Type
                          </th>
                          <th className="text-left py-2 px-3 text-muted-foreground text-sm">
                            Line
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedVariables.map((variable, index) => (
                          <tr
                            key={index}
                            className="border-b border-border hover:bg-muted"
                          >
                            <td className="py-2 px-3">
                              {variable.valid ? (
                                <CheckCircle className="size-4 text-accent-ink" />
                              ) : (
                                <XCircle className="size-4 text-destructive" />
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <code
                                className={`font-mono text-sm ${
                                  variable.valid ? "text-foreground" : "text-destructive"
                                }`}
                              >
                                {variable.key || "Invalid"}
                              </code>
                            </td>
                            <td className="py-2 px-3">
                              <code className="text-sm font-mono text-muted-foreground bg-card px-2 py-1 rounded max-w-xs truncate block">
                                {variable.sensitive || isSecretsPage
                                  ? "••••••••"
                                  : variable.value || "MISSING"}
                              </code>
                            </td>
                            <td className="py-2 px-3">
                              <span className="text-xs text-muted-foreground">
                                {variable.sensitive || isSecretsPage ? "Secret" : "Variable"}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <span className="text-sm text-muted-foreground">
                                {variable.line}
                              </span>
                              {variable.error && (
                                <div className="text-xs text-red-400 mt-1">
                                  {variable.error}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Invalid Variables Warning */}
                  {invalidVariables.length > 0 && (
                    <p className="text-sm text-destructive">
                      {invalidVariables.length}{" "}
                      {invalidVariables.length === 1 ? "line" : "lines"} will be skipped
                      {invalidVariables[0]?.error ? `: ${invalidVariables[0].error}` : ""}
                    </p>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            className="text-foreground border-border hover:bg-muted"
            disabled={isImporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!canImport || isImporting}
          >
            {isImporting ? "Importing…" : `${buttonText} (${validVariables.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
