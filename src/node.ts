/**
 * 定制一个支持收起/展开的节点
 */
import G6, { IShape, NodeConfig } from "@antv/g6";
import { fittingString } from "./utils";

const colors = Object.freeze({
  background: "#fff",
  label: "#252626",
  desc: "#898A8C",
  primary: "#326BFB",
  warn: "#FFAA00",
  border: "#F0F2F5",
  liteMode: {
    border: "#d5d6d9",
  },
  hitSearchKey: {
    background: "#fef8e8",
  },
} as const);

function getNodeDefaultStyle(cfg: NodeConfig) {
  return {
    radius: 4,
    fill: colors.background,
    stroke: colors.border,
    shadowColor: "rgba(12, 18, 31, 0.06)",
    shadowBlur: 4,
    shadowOffsetX: 0,
    shadowOffsetY: 2,
  };
}

export function registerNode() {
  G6.registerNode(
    "entity-node",
    {
      shapeType: "rect",
      draw(cfgParam, group) {
        if (!cfgParam || !group) {
          throw Error("cfg and group must be required!");
        }

        const cfg = cfgParam as NodeConfig;
        const { collapsed, id } = cfg;
        const collapseBtnRadius = 8;
        const collapseBtnOffset = {
          x: collapseBtnRadius * 2,
        };

        const rectConfig = {
          width: 218,
          height: 60,
        };

        const contentRectConfig = {
          width: rectConfig.width - collapseBtnOffset.x - 2,
          height: rectConfig.height,
        };

        const collapseBtnConfig = {
          x: contentRectConfig.width / 2,
          fontSize: 16,
          cursor: "pointer",
        };

        const nodeOrigin = {
          x: -rectConfig.width / 2,
          y: -rectConfig.height / 2,
        };

        const rect: IShape = group.addShape("rect", {
          attrs: {
            x: nodeOrigin.x,
            y: nodeOrigin.y,
            ...rectConfig,
            ...getNodeDefaultStyle(cfg),
          },
        });

        // const contentStyle = getNodeDefaultStyle(cfg);

        const contentRect: IShape = group.addShape("rect", {
          name: "entity-content",
          attrs: {
            x: nodeOrigin.x,
            y: nodeOrigin.y,
            ...contentRectConfig,
            // ...contentStyle,
          },
        });
        const contentRectBBox = contentRect.getBBox();

        // label
        const labelConfig = {
          fontSize: 14,
          paddingLeft: 8,
          paddingRight: 5,
          paddingTop: 20,
        };
        group.addShape("text", {
          attrs: {
            ...labelConfig,
            textAlign: "left",
            textBaseline: "bottom",
            x: contentRectBBox.minX + labelConfig.paddingLeft,
            y: contentRectBBox.minY + labelConfig.paddingTop,
            text: String(id),
            fill: colors.label,
            cursor: "pointer",
          },
          modelId: cfg.id,
          name: "entity-name",
        });

        const relatedInfoConfig = {
          paddingRight: 8,
          paddingBottom: 10,
        };
        const relatedInfo = group.addShape("text", {
          attrs: {
            // textAlign: "right",
            textBaseline: "bottom",
            x: contentRectBBox.maxX - relatedInfoConfig.paddingRight,
            y: contentRectBBox.maxY - relatedInfoConfig.paddingBottom,
            text: "次要信息",
            fontSize: 12,
            fill: colors.desc,
            cursor: "pointer",
          },
          name: "related-info",
          modelId: cfg.id,
        });

        // collapse rect
        group.addShape("circle", {
          attrs: {
            ...collapseBtnConfig,
            r: collapseBtnRadius,
            fill: colors.primary,
          },
          name: "collapse-back",
          modelId: cfg.id,
        });
        group.addShape("text", {
          attrs: {
            ...collapseBtnConfig,
            y: -1,
            textAlign: "center",
            textBaseline: "middle",
            text: collapsed ? "+" : "-",
            fill: colors.background,
          },
          name: "collapse-text",
          modelId: cfg.id,
        });

        (this as any).drawLinkPoints(cfg, group);
        return rect;
      },
      update(cfgParam, item) {
        const cfg = cfgParam as NodeConfig;
        const group = item.getContainer();
        const nodeStyle = getNodeDefaultStyle(cfg);
        const content = group.findAllByName("entity-content")[0];
        if (content) {
          for (const k in nodeStyle) {
            content.attr(k, (nodeStyle as any)[k]);
          }
        }
        (this as any).updateLinkPoints(cfg, group);
      },
      setState(name, value, item) {
        const group = item!.getContainer();
        const cfg = item?._cfg?.model as NodeConfig;
        if (name === "collapse") {
          const collapseText = group.find(
            (e) => e.get("name") === "collapse-text"
          );
          if (collapseText) {
            if (!value) {
              collapseText.attr({
                text: "-",
              });
            } else {
              collapseText.attr({
                text: "+",
              });
            }
          }
        }
      },
      getAnchorPoints() {
        return [
          [0, 0.5],
          [1, 0.5],
        ];
      },
    },
    "rect"
  );
}
