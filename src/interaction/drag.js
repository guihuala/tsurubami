export function bindDrag(root) {
  const dragRegion = root.querySelector('#pet-drag-region');
  if (!dragRegion) return;

  dragRegion.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    root.classList.add('dragging');
  });

  const clearDragging = () => {
    root.classList.remove('dragging');
  };

  window.addEventListener('pointerup', clearDragging);
  window.addEventListener('pointercancel', clearDragging);
}
