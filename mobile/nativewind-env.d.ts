/// <reference types="nativewind/types" />

// Allow side-effect and default imports of plain CSS files.
declare module "*.css";
declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}
