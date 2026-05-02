export function findNodeById(list = [], id) {
  for (const item of list) {
    if (item.id === id) return item;
    if (item.children?.length) {
      const found = findNodeById(item.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function findPathToNode(list = [], id, path = []) {
  for (const item of list) {
    const nextPath = [...path, item.id];
    if (item.id === id) return nextPath;
    if (item.children?.length) {
      const found = findPathToNode(item.children, id, nextPath);
      if (found) return found;
    }
  }
  return null;
}

export function updateNodeById(list = [], id, updater) {
  return list.map((item) => {
    if (item.id === id) return updater(item);
    if (item.children?.length) {
      return {
        ...item,
        children: updateNodeById(item.children, id, updater),
      };
    }
    return item;
  });
}
