// Module-scope font loading (blocks render until ready). Inter only, per spec.
import {loadFont} from '@remotion/google-fonts/Inter';

const {fontFamily} = loadFont('normal', {
  weights: ['400', '600', '700'],
  subsets: ['latin'],
});

export const inter = fontFamily;
