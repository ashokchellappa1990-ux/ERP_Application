import { AppShell } from "@/components/layout/AppShell";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { ScopeProvider } from "@/components/scope/ScopeProvider";
import { GeneralConfigLoader } from "@/components/settings/GeneralConfigProvider";
import { DocumentFieldsConfigLoader } from "@/components/settings/DocumentFieldsConfigLoader";

/**
 * Layout for all authenticated console routes. Wraps pages in the session
 * provider (current user from /api/auth/me) + the business/branch scope provider
 * + the persistent sidebar/topbar.
 *
 * WeighbridgeProvider deliberately lives in the ROOT layout (src/app/layout.tsx),
 * not here — logout navigates to /login, which sits OUTSIDE this layout, so a
 * provider mounted here would unmount (and drop the live serial connection) on
 * every logout. The root layout is the only ancestor shared by both, so that's
 * the one place a connection can actually survive a logout/login round-trip.
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
