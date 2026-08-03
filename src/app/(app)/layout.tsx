import { AppShell } from "@/components/layout/AppShell";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { ScopeProvider } from "@/components/scope/ScopeProvider";
import { GeneralConfigLoader } from "@/components/settings/GeneralConfigProvider";
import { DocumentFieldsConfigLoader } from "@/components/settings/DocumentFieldsConfigLoader";

/**
 * Layout for all authenticated console routes. Wraps pages in the session
 * provider (current user from /api/auth/me) + the business/branch scope provider
 * + the persistent sidebar/topbar.
 */
export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <ScopeProvider>
        <GeneralConfigLoader />
        <DocumentFieldsConfigLoader />
        <AppShell>{children}</AppShell>
      </ScopeProvider>
    </SessionProvider>
  );
}
