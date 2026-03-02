function TreeNode({ node, onSelectPage }) {
  const hasPage = Boolean(node.page);

  return (
    <li>
      <div className="tree-row">
        <span className="tree-name">/{node.path === '/' ? '' : node.name}</span>
        {hasPage ? (
          <button onClick={() => onSelectPage(node.page)} className="link-btn">
            View page details
          </button>
        ) : null}
      </div>
      {node.children?.length ? (
        <ul>
          {node.children.map((child) => (
            <TreeNode key={child.path} node={child} onSelectPage={onSelectPage} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function SubdirectoryTree({ tree, discoveredCount, onSelectPage }) {
  if (!tree) return null;

  return (
    <section className="panel">
      <h2>Scanned Subdirectories</h2>
      <p>{discoveredCount} pages discovered and listed in a path hierarchy.</p>
      <ul className="tree-root">
        <TreeNode node={tree} onSelectPage={onSelectPage} />
      </ul>
    </section>
  );
}
