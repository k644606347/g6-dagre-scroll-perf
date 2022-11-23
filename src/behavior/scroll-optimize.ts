/* eslint-disable @typescript-eslint/no-unused-expressions */
import { IContainer } from '@antv/g-base';
import { IBBox, IShape, Matrix } from '@antv/g6';
import { memoize } from 'lodash';

export type IArea = {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
}

export function initArea(): IArea {
    return {
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
        width: 0,
        height: 0,
    };
}
export function nodeGroupNeedHide(bbox: IBBox, visibleArea: IArea) {
    return !inVisibleArea(bbox, visibleArea);
}

export function edgeGroupNeedHide(bbox: IBBox, visibleArea: IArea, canvasRect: DOMRect) {
    const itemInVisibleArea = inVisibleArea(bbox, visibleArea);

    if (!itemInVisibleArea) { return true; }

    // 超长的edge可能没有必要展示，选择隐藏，这里可以加个开关配置，根据场景设置
    // const lengthScope = {
    //     w: canvasRect.width * 2,
    //     h: canvasRect.height * 2,
    // };
    // const overlength = (bbox.maxX - bbox.minX > lengthScope.w) || (bbox.maxY - bbox.minY > lengthScope.h);

    // if (overlength) {
    //     return true;
    // }

    return false;
}

export function inVisibleArea(bbox: IBBox, visibleArea: IArea) {
    const xIsHidden = (bbox.maxX) <= visibleArea.minX || (bbox.minX) >= visibleArea.maxX;
    if (xIsHidden) { return false; }

    const yIsHidden = (bbox.maxY) <= visibleArea.minY || (bbox.minY) >= visibleArea.maxY;
    if (yIsHidden) { return false; }

    return true;
}

export type IDirection = {
    x: 'left' | 'right' | 'all' | '';
    y: 'top' | 'bottom' | 'all' | '';
}

/**
 * 算缓冲区，缓冲区不一定会显示在视口内，根据偏移提前计算接下来可能会展示的区域
 */
export const calcBufferArea = memoize(function calcBufferArea(
    canvasRect: DOMRect,
    { x, y }: IDirection,
): IArea {
    console.log(x, y);
    const { width, height } = canvasRect;
    const minOffset = 500;
    let minX = 0;
    let maxX = 0;
    let minY = 0;
    let maxY = 0;

    if (x === 'all') {
        const offset = Math.max(minOffset, Math.floor(width / 4));
        minX = -offset;
        maxX = offset;
    } else if (x === 'left' || x === 'right') {
        const offset = Math.max(minOffset, Math.floor(width / 2));
        x === 'left' ? (minX = -offset) : (maxX = offset);
    }

    if (y === 'all') {
        const offset = Math.max(minOffset, Math.floor(height / 4));
        minY = -offset;
        maxY = offset;
    } else if (y === 'top' || y === 'bottom') {
        const offset = Math.max(minOffset, Math.floor(height / 2));
        y === 'top' ? (minY = -offset) : (maxY = offset);
    }

    console.log(minX, maxX, minY, maxY);
    return {
        minX, maxX,
        minY, maxY,
        width: Math.abs(minX) + Math.abs(maxX),
        height: Math.abs(minY) + Math.abs(maxY),
    };
}, calcAreaCacheKey);

function calcAreaCacheKey(canvasRect: DOMRect, direction: IDirection) {
    return `${canvasRect.width}-${canvasRect.height}-${direction.x}-${direction.y}`;
}

/**
 * 算可视区域（包含缓冲区）
 * @param canvasRect 
 * @param direction 
 * @returns 
 */
export function calcVisibleArea(canvasRect: DOMRect, direction: IDirection, bufferArea = calcBufferArea(canvasRect, direction)) {
    // console.log('bufferArea', bufferArea);

    const visibleArea: IArea = {
        minX: bufferArea.minX, maxX: canvasRect.width + bufferArea.maxX,
        minY: bufferArea.minY, maxY: canvasRect.height + bufferArea.maxY,
        width: canvasRect.width + bufferArea.width,
        height: canvasRect.height + bufferArea.height,
    };
    // console.log('visibleArea', visibleArea)
    return visibleArea;
}

// TODO: 这里可以给g6提pr，优化类型推导，比如通过item.isGroup()收敛类型为IContainer
type Element = (IContainer & IShape) & {
    isCanvas(): boolean;
}

export function getGroupsBBoxMap(item: Element) {
    const bboxMap = new Map<string, IBBox>();
    /** 位于画布的四个顶点上的图形 */
    const peakItems: { top: IShape, right: IShape, bottom: IShape, left: IShape } = {} as any;

    function _calcBBox(item: Element) {
        const isGroup = item.isGroup();
        const isCanvas = item.isCanvas ? item.isCanvas() : false;

        if (!isGroup && !isCanvas) {
            return item.getCanvasBBox();
        }

        const children = item.getChildren() as Element[];
        const childLen = children.length;
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        let hitChild = false;

        // 为保证极致性能，遍历使用for loop而非Array.forEach，最大限度减少无用流程
        for (let i = 0; i < childLen; i++) {
            const child = children[i];
            const isGroup = child.isGroup();
            if (!isGroup || (isGroup && child.getChildren().length > 0)) {
                hitChild = true;
                const {
                    minX: childMinX, maxX: childMaxX,
                    minY: childMinY, maxY: childMaxY,
                } = _calcBBox(child);

                if (typeof childMinX === 'number' && childMinX < minX) {
                    minX = childMinX;
                    peakItems.left = child;
                }
                if (typeof childMaxX === 'number' && childMaxX > maxX) {
                    maxX = childMaxX;
                    peakItems.right = child;
                }
                if (typeof childMinY === 'number' && childMinY < minY) {
                    minY = childMinY;
                    peakItems.top = child;
                }
                if (typeof childMaxY === 'number' && childMaxY > maxY) {
                    maxY = childMaxY;
                    peakItems.bottom = child;
                }
            }
        }

        if (!hitChild) {
            minX = 0;
            maxX = 0;
            minY = 0;
            maxY = 0;
        }

        const groupBBox = genGroupBBox({ minX, maxX, minY, maxY });
        bboxMap.set(item.cfg.id, groupBBox);
        return groupBBox;
    }

    _calcBBox(item);
    return {
        bboxMap,
        peakItems,
    };
}

export function genGroupBBox({ minX, maxX, minY, maxY }: { minX: number; maxX: number; minY: number; maxY: number; }) {
    return {
        x: minX,
        y: minY,
        minX: minX,
        minY: minY,
        maxX: maxX,
        maxY: maxY,
        width: maxX - minX,
        height: maxY - minY,
    };
}

/**
 * !!!变更prototype!!!，危险操作，谨慎
 * @param graph 
 */
export function resetProto(graph: any) {
    const group = graph.get('group');
    const containerProto = group.__proto__;
    containerProto._applyChildrenMarix = function _applyChildrenMarix(totalMatrix: Matrix) {
        // console.log('_applyChildrenMarix');
        const children = this.getChildren();
        const len = children.length;
        for (let i = 0; i < len; i++) {
            const child = children[i];
            const { cfg } = child;
            if (cfg.visible) {
                child.applyMatrix(totalMatrix);
                cfg.needUpdateTotalMatrix = false;
                continue;
            }
            cfg.needUpdateTotalMatrix = true;
            cfg.parentMatrix = totalMatrix;
            cfg.totalMatrix = null;
            cfg.canvasBBox = null;
            recursionReset(child);
        }
    };

    function recursionReset(group: any) {
        if (!group.isGroup()) {return;}

        const children = group.getChildren();
        const len = children.length;
        for (let i = 0; i < len; i++) {
            const child = children[i];
            if (child.isGroup()) {
                const { cfg } = child;
                cfg.needUpdateTotalMatrix = true;
                cfg.parentMatrix = null;
                cfg.totalMatrix = null;
                cfg.canvasBBox = null;
                recursionReset(child);
            }
        }
    }

    // TODO: 循环调用
    // const elementProto = group.__proto__.__proto__.__proto__.__proto__;
    // const originFn = elementProto.getTotalMatrix;
    // elementProto.getTotalMatrix = function getTotalMatrixByCustom() {
    //     let group = this.isGroup() ? this : this.getParent();
    //     if (!group) {
    //         return originFn.call(this);
    //     }
    //     const { cfg } = group;
    //     const { needUpdateTotalMatrix } = group.cfg;
    //     if (needUpdateTotalMatrix) {
    //         let parentMatrix = cfg.parentMatrix;
    //         while (group && !parentMatrix) {
    //             group = group.getParent();
    //             parentMatrix = group.cfg.parentMatrix;
    //         }
    //         if (group) {
    //             group.applyMatrix(parentMatrix);
    //         }
    //     }
    //     return originFn.call(this);
    // };
}