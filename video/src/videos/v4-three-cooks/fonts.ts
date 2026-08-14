import {loadFont} from '@remotion/google-fonts/Anton';
import {loadFont as loadInterFont} from '@remotion/google-fonts/Inter';

export const {fontFamily: anton} = loadFont();
export const {fontFamily: inter} = loadInterFont('normal', {
  weights: ['400', '500', '600', '700'],
  subsets: ['latin'],
});
