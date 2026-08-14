import {loadFont as loadAnton} from '@remotion/google-fonts/Anton';
import {loadFont as loadInter} from '@remotion/google-fonts/Inter';

const {fontFamily: antonFamily} = loadAnton('normal', {
  weights: ['400'],
  subsets: ['latin'],
});

const {fontFamily: interFamily} = loadInter('normal', {
  weights: ['400', '600', '700', '800'],
  subsets: ['latin'],
});

export const anton = antonFamily;
export const inter = interFamily;
