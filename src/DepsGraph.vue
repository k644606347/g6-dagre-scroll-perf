<template>
  <div class="deps-graph">
    <div class="deps-graph-btns">
      <button @click="focusRoot">聚焦到根节点</button>
      <button @click="resetNodes">重新设置数据层级</button>
    </div>
    <div ref="graphElRef" class="deps-graph-content"></div>
    <div class="related-info-pane">
      <span>层级={{ layers }}级</span>
      <span>nodes={{ nodes.length }}</span>
      <span>edges={{ edges.length }}</span>
      <span>图元总数={{ nodes.length * 5 + edges.length }}</span>
      <!-- <span>layout time={{ layoutTime }}</span>
      <span>render time={{ renderTime }}</span> -->
    </div>
  </div>
</template>

<script lang="ts">
import {
  defineComponent,
  nextTick,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import G6, {
  EdgeConfig,
  NodeConfig,
  Graph,
  GraphOptions,
  IG6GraphEvent,
  INode,
  ITEM_TYPE,
  registerBehavior,
} from "@antv/g6";
import { registerNode } from "./node";
import { toggleCollapse } from "./utils";
import { mock } from "./mock";
import rcpScrollCanvas from "./behavior/rcp-scroll-canvas";
registerBehavior("rcp-scroll-canvas", rcpScrollCanvas);

registerNode();
type IDepsGraphData = {
  nodes: NodeConfig[];
  edges: EdgeConfig[];
};
const canSelectTypes: ITEM_TYPE[] = ["node", "edge"];

export default defineComponent({
  name: "DepsGraph",

  setup(props, { emit }) {
    const graphElRef = ref<HTMLElement>();
    const graphInstance = shallowRef<Graph | undefined>();

    const layers = ref(10);
    const mockData = mock(layers.value);
    const nodes = shallowRef<NodeConfig[]>(mockData.nodes);
    const edges = shallowRef<EdgeConfig[]>(mockData.edges);
    const layoutTime = ref(Date.now());
    const renderTime = ref(Date.now());

    watch([nodes, edges], async ([nodes, edges]) => {
      console.log("g6 rerender before", nodes, edges);
      await nextTick();
      console.time("g6 relayout");
      console.time("g6 rerender");
      layoutTime.value = Date.now();
      renderTime.value = Date.now();
      graphInstance.value?.read({
        nodes,
        edges,
      });
    });

    onMounted(async () => {
      console.log("g6 first render before");
      console.time("g6 first layout");
      console.time("g6 first render");
      await nextTick();

      if (!graphElRef.value) {
        return;
      }

      const data = {
        nodes: nodes.value,
        edges: edges.value,
      };

      const toolbar = new G6.ToolBar({
        className: "deps-graph-toolbar",
      });
      const tooltip = new G6.Tooltip({
        className: "deps-graph-tooltip",
        fixToNode: [0, 0],
        shouldBegin(e) {
          if (!e || !e.item || e.item.getType() !== "node") {
            return false;
          }
          return e.item.getModel().type === "entity-node";
        },
        getContent(e) {
          if (!e) {
            return "";
          }
          const mainDiv = document.createElement("div");
          mainDiv.className = "deps-graph-tooltip-content";
          mainDiv.innerHTML = String(e.item!.getModel().id);
          return mainDiv;
        },
        itemTypes: ["node"],
      });
      const graph =
        ((window as any).__graph =
        graphInstance.value =
          initG6(data, {
            container: graphElRef.value,
            plugins: [tooltip, toolbar],
          }));
      graph.data(data);
      graph.render();

      graph.on("afterlayout", (e) => {
        console.timeEnd("g6 first layout");
        console.timeEnd("g6 relayout");
        layoutTime.value = Date.now() - layoutTime.value;
      });
      graph.on("afterrender", (e) => {
        console.timeEnd("g6 first render");
        console.timeEnd("g6 rerender");
        graph.focusItem("mock_root");
        renderTime.value = Date.now() - renderTime.value;
      });

      graph.on("node:click", onItemClick);
      function onItemClick(e: IG6GraphEvent) {
        const item = e.item;
        if (!item) {
          return;
        }

        const state = "selected";

        let isSelected = item.hasState(state);
        if (isSelected) {
          graph.setItemState(item, state, false);
        } else {
          graph.findAllByState(item.getType(), state).forEach((item) => {
            graph.setItemState(item, state, false);
          });
          graph.setItemState(item, state, true);
        }
        isSelected = !isSelected;
      }

      graph.on("mouseenter", (e) => {
        const item = e.item;
        if (!item || !canSelectTypes.includes(item.getType())) {
          return;
        }
        graph.setItemState(item, "hover", true);
      });
      graph.on("mouseleave", (e) => {
        const item = e.item;
        if (!item || !canSelectTypes.includes(item.getType())) {
          return;
        }
        graph.setItemState(item, "hover", false);
      });

      graph.on("collapse-text:click", handleCollapse);
      graph.on("collapse-back:click", handleCollapse);
      graph.on("entity-name:click", (e) => {
        const model = getNodeModelByEvent(e, graph);
        emit("entity-name-click", { model });
      });
      graph.on("related-info:click", (e) => {
        const model = getNodeModelByEvent(e, graph);
        emit("related-info-click", { model });
      });

      async function handleCollapse(e: IG6GraphEvent) {
        const model = getNodeModelByEvent(e, graph);
        const item = e.item as INode;
        const collapsed = (model.collapsed = !model.collapsed);
        graph.setItemState(item, "collapse", collapsed);
        toggleCollapse(item, collapsed);
        emit(collapsed ? "collapse-node" : "expand-node", { model });
      }
    });

    return {
      layers,
      nodes,
      edges,
      // layoutTime,
      // renderTime,
      graphElRef,
      graphInstance,
      focusRoot() {
        graphInstance.value.zoomTo(1);
        graphInstance.value.focusItem("mock_root");
      },
      resetNodes() {
        const size = Number(window.prompt("请输入要生成的DAG图的层级", "5"));
        const mockData = mock(size);
        layers.value = size;
        nodes.value = mockData.nodes;
        edges.value = mockData.edges;
      },
    };
  },
});

function initG6(
  data: IDepsGraphData,
  {
    container,
    plugins,
  }: { container: HTMLElement; plugins?: GraphOptions["plugins"] }
) {
  const graph = new G6.Graph({
    container: container,
    fitCenter: true,
    groupByTypes: false,
    width: container.clientWidth,
    height: container.clientHeight,
    modes: {
      default: [
        // 重写scroll-canvas behavior
        {
          type: "rcp-scroll-canvas",
          enableOptimize: true,
        },
        //{
        //  type: "scroll-canvas",
        // TODO: 这个配置会隐藏node的keyShape，可能显示效果不好
        // enableOptimize: true,
        //},
        {
          type: "drag-canvas",
          // enableOptimize: true,
        },
      ],
    },
    plugins,
    layout: {
      type: "dagre",
      workerEnabled: true,
      rankdir: "LR",
      // align: 'UL',
      controlPoints: true,
      // sortByCombo: true,
      nodesep: 10,
      ranksep: 80,
      // workerScriptURL: 'https://unpkg.com/@antv/layout@latest/dist/layout.min.js',
    },
    defaultNode: {
      type: "entity-node",
      // type: 'rect',
    },
    defaultEdge: {
      // type: 'line',
      type: "cubic-horizontal",
      // type: "polyline",
      // routeCfg: {
      //   simple: true,
      // },
      style: {
        startArrow: {
          path: G6.Arrow.triangle(8, 8, 0),
          fill: "#326BFB",
        },
        stroke: "#326BFB",
        radius: 5,
      },
    },
  });

  window.onresize = () => {
    if (graph.get("destroyed")) {
      return;
    }
    graph.changeSize(container.clientWidth, container.clientHeight);
  };

  return graph;
}

function getNodeModelByEvent(e: IG6GraphEvent, graph: Graph) {
  const id = e.target.get("modelId");
  const item = graph.findById(id) as INode;
  return item.getModel() as NodeConfig;
}
</script>

<style>
.deps-graph {
  width: 100%;
  height: 100%;
  background-color: #f5f7fa;
  display: flex;
  flex-direction: column;
  gap: 20px;
  border: 1px solid #ccc;
}
.deps-graph-content {
  position: relative;
  width: 100%;
  flex: 1 1 auto;
}
.deps-graph-btns {
  display: flex;
  flex-direction: row;
  gap: 10px;
}
.related-info-pane {
  position: fixed;
  top: 40px;
  z-index: 200;
  width: 200px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: rgba(0, 0, 0, 0.08);
  border: 1px solid #000;
  padding: 2px 5px;
}

.deps-graph-toolbar {
  position: absolute;
  bottom: 24px;
  right: 24px;
  display: flex;
  flex-direction: column;
  row-gap: 16px;
  list-style: none;
  margin: 0;
  padding: 0;
}
.deps-graph-toolbar > li {
  border: 1px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: #fff;
  box-shadow: 0px 16px 28px 3px rgba(0, 0, 0, 0.05),
    0px 8px 33px 7px rgba(0, 0, 0, 0.02), 0px 8px 15px -9px rgba(0, 0, 0, 0.04);
  border-radius: 4px;
  cursor: pointer;
}
.deps-graph-toolbar > li:hover {
  border-color: #326bfb;
}
.deps-graph-toolbar [code="redo"],
.deps-graph-toolbar [code="undo"] {
  display: none;
}
.deps-graph-tooltip {
  width: 200px;
}
.deps-graph-tooltip .deps-graph-tooltip-content {
  border: 1px solid #ccc;
  padding: 2px 5px;
  margin-left: -5px;
  margin-top: -32px;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
}
</style>
