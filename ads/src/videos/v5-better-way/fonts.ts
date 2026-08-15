// Campaign fonts: Bebas Neue (slams/numbers), Space Grotesk (modern UI),
// Limelight (the ONE extra font — 1950s art-deco title cards).
import {loadFont as loadBebas} from '@remotion/google-fonts/BebasNeue';
import {loadFont as loadLimelight} from '@remotion/google-fonts/Limelight';
import {loadFont as loadSpace} from '@remotion/google-fonts/SpaceGrotesk';

export const bebas = loadBebas('normal', {weights: ['400'], subsets: ['latin']}).fontFamily;
export const lime = loadLimelight('normal', {weights: ['400'], subsets: ['latin']}).fontFamily;
export const space = loadSpace('normal', {
  weights: ['400', '500', '700'],
  subsets: ['latin'],
}).fontFamily;
