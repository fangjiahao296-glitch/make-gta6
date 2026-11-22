// Solara Bay — entry point. Boots the world.
import { World } from './world.js';

// Exposed for debugging and automated checks (harmless in the shipped game).
window.__solara = new World();
