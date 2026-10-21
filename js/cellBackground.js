(() => {
    const cellField = document.querySelector('.cell-field');
    if (!cellField) return;

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let pointerFrame = 0;
    let draggedItem = null;
    let dragOrigin = null;
    let pulseTimer;

    document.addEventListener('pointermove', (event) => {
        if (!draggedItem || !dragOrigin || pointerFrame) return;
        pointerFrame = window.requestAnimationFrame(() => {
            pointerFrame = 0;
            if (!draggedItem || !dragOrigin) return;
            const deltaX = event.clientX - dragOrigin.x;
            const deltaY = event.clientY - dragOrigin.y;
            draggedItem.style.setProperty('--pointer-shift-x', `${dragOrigin.offsetX + deltaX}px`);
            draggedItem.style.setProperty('--pointer-shift-y', `${dragOrigin.offsetY + deltaY}px`);
        });
    }, { passive: true });

    document.addEventListener('pointerdown', (event) => {
        if (!finePointer.matches || reducedMotion.matches) return;
        const draggable = event.target.closest('.floating-cell, .cell-particle');
        if (!draggable) return;

        draggedItem = draggable;
        dragOrigin = {
            x: event.clientX,
            y: event.clientY,
            offsetX: parseFloat(draggable.style.getPropertyValue('--pointer-shift-x')) || 0,
            offsetY: parseFloat(draggable.style.getPropertyValue('--pointer-shift-y')) || 0
        };
        draggable.classList.add('is-dragging');
        draggable.setPointerCapture(event.pointerId);
        cellField.style.setProperty('--pulse-x', `${(event.clientX / window.innerWidth) * 100}%`);
        cellField.style.setProperty('--pulse-y', `${(event.clientY / window.innerHeight) * 100}%`);
        cellField.classList.remove('is-pulsing');
        void cellField.offsetWidth;
        cellField.classList.add('is-pulsing');
        window.clearTimeout(pulseTimer);
        pulseTimer = window.setTimeout(() => cellField.classList.remove('is-pulsing'), 800);
    }, { passive: true });

    function mergeWithNearbyCell(item) {
        if (!item.classList.contains('floating-cell')) return;

        const itemRect = item.getBoundingClientRect();
        const itemCenterX = itemRect.left + itemRect.width / 2;
        const itemCenterY = itemRect.top + itemRect.height / 2;
        let nearestCell = null;
        let nearestDistance = 72;

        document.querySelectorAll('.floating-cell').forEach((cell) => {
            if (cell === item) return;
            const rect = cell.getBoundingClientRect();
            const distance = Math.hypot(
                itemCenterX - (rect.left + rect.width / 2),
                itemCenterY - (rect.top + rect.height / 2)
            );
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestCell = cell;
            }
        });

        if (!nearestCell) return;

        const targetRect = nearestCell.getBoundingClientRect();
        const targetX = targetRect.left + targetRect.width / 2;
        const targetY = targetRect.top + targetRect.height / 2;
        const currentX = parseFloat(item.style.getPropertyValue('--pointer-shift-x')) || 0;
        const currentY = parseFloat(item.style.getPropertyValue('--pointer-shift-y')) || 0;
        item.style.setProperty('--pointer-shift-x', `${currentX + targetX - itemCenterX}px`);
        item.style.setProperty('--pointer-shift-y', `${currentY + targetY - itemCenterY}px`);
        item.classList.add('is-merging');

        const mergeCount = Number(nearestCell.dataset.mergeCount || 0) + 1;
        nearestCell.dataset.mergeCount = String(mergeCount);
        nearestCell.style.setProperty('--merge-scale', String(Math.min(1 + mergeCount * 0.12, 1.6)));
        nearestCell.classList.add('is-merged', 'is-merge-target');

        window.setTimeout(() => {
            item.remove();
            nearestCell.classList.remove('is-merge-target');
        }, 460);
    }

    function stopDragging(event) {
        if (draggedItem) {
            const releasedItem = draggedItem;
            releasedItem.classList.remove('is-dragging');
            if (event.type === 'pointerup') mergeWithNearbyCell(releasedItem);
        }
        draggedItem = null;
        dragOrigin = null;
    }

    document.addEventListener('pointerup', stopDragging, { passive: true });
    document.addEventListener('pointercancel', stopDragging, { passive: true });
})();