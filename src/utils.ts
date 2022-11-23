/* eslint-disable @typescript-eslint/no-unused-expressions */
import G6, { INode, NodeConfig } from "@antv/g6";
import { isNil } from "lodash";

/**
 * 传入的node是否可以收起/展开
 * @param node
 * @param canCollapseMap
 * @returns
 */
export function nodeCanCollapse(
  node: INode,
  canCollapseMap: { [k in string]?: boolean }
): boolean {
  const nodeId = node.getID();
  if (!isNil(canCollapseMap[nodeId])) {
    return canCollapseMap[nodeId]!;
  }

  let result = false;
  const inEdges = node.getInEdges();
  const sources = inEdges.map((edge) => edge.getSource());

  // 如果递归到根节点还未计算出结果，则返回false
  if (sources.length === 0) {
    result = canCollapseMap[nodeId] = false;
    return result;
  }

  result = canCollapseMap[nodeId] = inEdges.every((edge) => {
    // 如果线已经隐藏，如被其他节点收起，则忽略此线，返回true
    if (!edge.isVisible()) {
      return true;
    }
    const source = edge.getSource();
    const sourceCanCollapse = canCollapseMap[nodeId];
    if (isNil(sourceCanCollapse)) {
      return nodeCanCollapse(source, canCollapseMap);
    }
    return sourceCanCollapse;
  });

  return result;
}

/**
 * 处理node及其后代的收起/展开逻辑
 * @param node
 * @param collapse
 * @returns
 */
export function toggleCollapse(node: INode | undefined, collapse: boolean) {
  if (!node) {
    return;
  }

  const targets = node.getOutEdges().map((edge) => {
    collapse ? edge.hide() : edge.show();
    return edge.getTarget();
  });

  const canCollapseMap: { [k in string]?: boolean } = {
    [node.getID()]: true,
  };

  const result = setTargetNodes({ nodes: targets, collapse });

  function setTargetNodes({
    nodes,
    collapse,
  }: {
    nodes: INode[];
    collapse: boolean;
  }) {
    if (nodes.length === 0) {
      return;
    }
    const targetsMap: Record<string, INode> = {};
    nodes.forEach((node) => {
      if (collapse) {
        const canCollapse = nodeCanCollapse(node, canCollapseMap);
        if (!canCollapse) {
          return;
        }
      }

      const nodeIsCollapsed = (node.getModel() as NodeConfig).collapsed;
      collapse ? node.hide() : node.show();
      if (!collapse && nodeIsCollapsed) {
        return;
      }
      if (node.getType() !== "node") {
        return;
      }
      node.getOutEdges().forEach((edge) => {
        const target = edge.getTarget();
        const targetId = target.getID();
        if (!targetsMap[targetId]) {
          targetsMap[targetId] = target;
        }
        collapse ? edge.hide() : edge.show();
      });
    });

    setTargetNodes({ nodes: Object.values(targetsMap), collapse });
  }

  console.log("canCollapseMap", canCollapseMap);
  return result;
}

// distinguish the Chinese charactors and letters
const chinesePattern = new RegExp("[\u4E00-\u9FA5]+");

const defaultEllipsis = "...";

/**
 * 根据最大宽截取字符串
 * @param str
 * @param options
 * @returns
 */
export function fittingString(
  str: string,
  options: {
    maxWidth: number;
    fontSize: number;
    ellipsis?: boolean | string;
  }
) {
  let currentWidth = 0;
  let overflowIndex = 0;
  let hasOverflow = false;
  const letterArr = str.split("");
  for (let index = 0, len = letterArr.length; index < len; index++) {
    const letter = letterArr[index];
    const letterWidth = chinesePattern.test(letter)
      ? options.fontSize
      : G6.Util.getLetterWidth(letter, options.fontSize);
    if (currentWidth + letterWidth > options.maxWidth) {
      hasOverflow = true;
      break;
    } else {
      overflowIndex = index;
      currentWidth += letterWidth;
    }
  }

  if (hasOverflow) {
    const needEllipsis = options.ellipsis !== false;
    if (needEllipsis) {
      const ellipsis = String(options.ellipsis ?? defaultEllipsis);
      const ellipsisWidth = G6.Util.getLetterWidth(ellipsis, options.fontSize);
      while (overflowIndex >= 0) {
        const letter = letterArr[overflowIndex];
        const letterWidth = chinesePattern.test(letter)
          ? options.fontSize
          : G6.Util.getLetterWidth(letter, options.fontSize);
        if (currentWidth - letterWidth + ellipsisWidth <= options.maxWidth) {
          break;
        }
        currentWidth -= letterWidth;
        overflowIndex--;
      }
      return `${str.substring(0, overflowIndex)}${ellipsis}`;
    }
    return str.substring(0, overflowIndex);
  }

  return str;
}

export function calcTextWidth(text: string, fontSize: number) {
  let width = 0;
  for (let index = 0, len = text.length; index < len; index++) {
    const letter = text[index];
    width += chinesePattern.test(letter)
      ? fontSize
      : G6.Util.getLetterWidth(letter, fontSize);
  }
  return width;
}
