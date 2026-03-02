function createNode(name, path) {
  return {
    name,
    path,
    children: [],
    page: null
  };
}

function buildPagesTree(pages, pageMetricsByUrl = {}) {
  const root = createNode('/', '/');

  for (const pageUrl of pages) {
    let url;
    try {
      url = new URL(pageUrl);
    } catch {
      continue;
    }

    const segments = url.pathname.split('/').filter(Boolean);
    let current = root;
    let currentPath = '';

    if (segments.length === 0) {
      current.page = {
        url: pageUrl,
        ...pageMetricsByUrl[pageUrl]
      };
      continue;
    }

    for (const segment of segments) {
      currentPath += `/${segment}`;
      let child = current.children.find((node) => node.name === segment);
      if (!child) {
        child = createNode(segment, currentPath);
        current.children.push(child);
      }
      current = child;
    }

    current.page = {
      url: pageUrl,
      ...pageMetricsByUrl[pageUrl]
    };
  }

  const sortNode = (node) => {
    node.children.sort((a, b) => a.name.localeCompare(b.name));
    for (const child of node.children) {
      sortNode(child);
    }
  };

  sortNode(root);
  return root;
}

module.exports = {
  buildPagesTree
};
