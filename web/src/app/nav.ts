/**
 * Navigation configuration (FOUNDATION OWNED — slices never edit this).
 *
 * Labels resolve through the `nav.*` i18n namespace, so the top bar and the
 * bottom tab bar stay bilingual + RTL for free. `end: true` keeps "/" from
 * prefix-matching every route for its active state.
 */
export interface NavItem {
  /** Router path, relative to the /app basename. */
  to: string;
  /** i18n key under the nav.* namespace. */
  labelKey: string;
  /** NavLink `end` flag (only the exact path counts as active). */
  end?: boolean;
}

/** The five main tabs — mobile bottom bar AND desktop top bar. */
export const MAIN_TABS: NavItem[] = [
  { to: "/", labelKey: "nav.home", end: true },
  { to: "/browse", labelKey: "nav.browse" },
  { to: "/community", labelKey: "nav.community" },
  { to: "/favorites", labelKey: "nav.favorites" },
  { to: "/account", labelKey: "nav.account" },
];

/**
 * Secondary destinations: full links on the desktop top bar; on mobile they
 * surface from the account hub (/account) and the shell's compact actions
 * (the + create button) until their slices build deeper navigation.
 */
export const SECONDARY_LINKS: NavItem[] = [
  { to: "/create", labelKey: "nav.create" },
  { to: "/notifications", labelKey: "nav.notifications" },
  { to: "/settings", labelKey: "nav.settings" },
];
