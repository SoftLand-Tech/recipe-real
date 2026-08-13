/**
 * Ambient declaration for CSS Modules (used by the scaffold's web-only
 * components such as animated-icon.web.tsx).
 */
declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}
