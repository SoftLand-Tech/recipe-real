// Fonts for the Cook Mode demo — loaded once at module scope (per skill guidance).
import {loadFont as loadAntonFont} from '@remotion/google-fonts/Anton';
import {loadFont as loadInterFont} from '@remotion/google-fonts/Inter';

const {fontFamily: interFamily} = loadInterFont('normal', {
  weights: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
});

const {fontFamily: antonFamily} = loadAntonFont();

export const inter = interFamily;
export const anton = antonFamily;
