import "react";

/**
 * React's CSSProperties typing lags behind Chrome's support for the individual
 * transform properties. Remotion renders in Chrome, where these are native —
 * and they stay Studio-editable (unlike `transform` strings).
 */
declare module "react" {
  interface CSSProperties {
    rotateX?: Property.Rotate;
    rotateY?: Property.Rotate;
    rotateZ?: Property.Rotate;
    translateX?: string | number;
    translateY?: string | number;
    perspective?: string | number;
  }
}

export {};
