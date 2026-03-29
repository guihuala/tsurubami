import { createBubbleController } from './bubble/bubble.js';
import { bindDrag } from './interaction/drag.js';
import { createMenuController } from './menu/menu.js';
import { createPetController } from './pet/pet.js';
import { restoreWindowPosition } from './storage/position.js';

export async function bootApp() {
  const root = document.getElementById('pet-root');
  const bubbleElement = document.getElementById('bubble');
  const menu = document.getElementById('menu');
  const effects = document.getElementById('effects');

  const bubble = createBubbleController(bubbleElement);
  const pet = createPetController({ root, bubble, effects });

  bindDrag(root);
  createMenuController({ root, menu, bubble });

  await restoreWindowPosition();
  pet.startBehaviorLoop();
}
