import { EdgeConfig, NodeConfig } from "@antv/g6";

export function mock(maxDepth = 5) {
  const rootId = "mock_root";
  const mockNodesMap = new Map();

  let nodeCount = 0;
  function genNodeId(nodeDepth: number) {
    return "depth_" + String(nodeDepth) + "_" + nodeCount++ + "_" + Date.now();
  }

  function makeMock(sources: string[], curDepth = 1) {
    let edges: EdgeConfig[] = [];
    let nodes: NodeConfig[] = [];

    if (curDepth > maxDepth) {
      return { edges, nodes };
    }

    const nextSources: string[] = [];

    // if (sources.length > 0 && randomPick()) {
    // nextSources.push(sources[Math.floor(Math.random() * sources.length)]);
    // }

    sources.forEach((source, sourceIndex) => {
      if (!mockNodesMap[source]) {
        nodes.push(
          (mockNodesMap[source] = {
            id: source,
            collapsed: false,
          })
        );
      }

      let maxChildCount: number;
      if (curDepth <= 1) {
        maxChildCount = 5;
      } else if (curDepth < 10) {
        maxChildCount = 2;
      } else if (curDepth === 10) {
        maxChildCount = 3;
        // } else if (curDepth <= 30) {
        //     maxChildCount = 2;
      } else {
        maxChildCount = randomPick() ? 2 : 0;
      }

      const len = maxChildCount;
      // const len = Math.round(Math.random() * maxChildCount);

      for (let index = 0; index < len; ) {
        const useNewNode = true;
        const targetId = genNodeId(curDepth);
        // const useNewNode = sourceIndex > 2 ? randomPick() : true;
        // TODO: 猜测这里 random可能导致形成环了，然后maximum call stack size
        // const targetId = useNewNode
        //   ? genNodeId(curDepth)
        //   : edges[Math.floor(Math.random() * edges.length)].target;
        // if (useNewNode && mockNodesMap[targetId]) {
        //   continue;
        // }
        if (
          edges.find(
            (edge) => edge.source === String(source) && edge.target === targetId
          )
        ) {
          continue;
        }
        edges.push({
          source: String(source),
          target: targetId,
        });
        nextSources.push(targetId);
        if (useNewNode) {
          nodes.push(
            (mockNodesMap[targetId] = {
              id: targetId,
              collapsed: false,
            })
          );
        }
        index++;
      }
    });

    const nextData = makeMock(nextSources, curDepth + 1);
    if (nextData) {
      edges = edges.concat(nextData.edges);
      nodes = nodes.concat(nextData.nodes);
    }

    return {
      edges,
      nodes,
    };
  }

  console.time("mockData");
  const mockData = makeMock([rootId]);
  // JSON.parse(JSON.stringify(makeMock([ rootId ])));
  // mockData.edges = mockData.edges.reverse();
  console.timeEnd("mockData");
  console.log(mockData);
  return mockData;
}

function randomPick() {
  return Math.floor(Math.random() * 10) > 4;
}
