/**
 * Root component (FOUNDATION OWNED): provider stack + router.
 *
 * Order matters: I18nProvider outermost (html lang/dir + every label),
 * AuthProvider next (needs nothing above it but feeds gates inside the
 * tree), ToastProvider innermost of the context providers so slice pages
 * can toast from day one. RouterProvider consumes the basename-/app router
 * built in routes.tsx.
 */
import { RouterProvider } from "react-router";

import { AuthProvider } from "@/auth/AuthContext";
import { ToastProvider } from "@/components/Toast";
import { I18nProvider } from "@/i18n";

import { router } from "@/app/routes";

export function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
