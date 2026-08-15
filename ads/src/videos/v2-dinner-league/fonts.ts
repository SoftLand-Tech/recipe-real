// Type system: Bebas Neue (scoreboard/headlines), Space Grotesk (labels/lower-thirds),
// Archivo Black (RecipeReal wordmark) — the one extra font for the broadcast look.
import {loadFont as loadBebas} from '@remotion/google-fonts/BebasNeue';
import {loadFont as loadSpace} from '@remotion/google-fonts/SpaceGrotesk';
import {loadFont as loadArchivo} from '@remotion/google-fonts/ArchivoBlack';

const bebas = loadBebas('normal', {weights: ['400'], subsets: ['latin']});
const space = loadSpace('normal', {weights: ['400', '500', '700'], subsets: ['latin']});
const archivo = loadArchivo('normal', {weights: ['400'], subsets: ['latin']});

export const F_BEBAS = bebas.fontFamily;
export const F_SPACE = space.fontFamily;
export const F_ARCHIVO = archivo.fontFamily;
