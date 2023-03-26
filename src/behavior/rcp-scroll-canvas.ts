/* eslint-disable no-lonely-if */
/* eslint-disable complexity */
import { IBBox, IG6GraphEvent } from '@antv/g6-core';
import { isBoolean, isObject } from '@antv/util';
import debounce from 'lodash/debounce';
import cloneDeep from 'lodash/cloneDeep';
import { getGroupsBBoxMap, calcVisibleArea, edgeGroupNeedHide, inVisibleArea, resetProto, IDirection, calcBufferArea, IArea, initArea } from './scroll-optimize';
import { Edge, IGroup } from '@antv/g6';

const ALLOW_EVENTS = [ 'shift', 'ctrl', 'alt', 'control', 'meta' ];

type OptimizeOptions = {
    scrollOffsetUnit: number;
    showEdges: boolean;
}

type PrevEventInfo = {
    action: Action | '';
    direction: IDirection;
    graphBBox: IBBox | null;
}
const defaultOptimizeOpts: OptimizeOptions = {
    scrollOffsetUnit: 300,
    showEdges: true,
};
const defaultCfg = {
    direction: 'both',
    enableOptimize: false,
    optimizeOptions: defaultOptimizeOpts,
    zoomKey: 'ctrl',
    // scroll-canvas 可滚动的扩展范围，默认为 0，即最多可以滚动一屏的位置
    // 当设置的值大于 0 时，即滚动可以超过一屏
    // 当设置的值小于 0 时，相当于缩小了可滚动范围
    // 具体实例可参考：https://gw.alipayobjects.com/mdn/rms_f8c6a0/afts/img/A*IFfoS67_HssAAAAAAAAAAAAAARQnAQ
    scalableRange: 0,
    allowDragOnItem: true,

};

type IBase = typeof defaultCfg;

type Action = 'zoom' | 'scroll';
interface IRcpScrollCanvas extends IBase {
    type: string;
    getDefaultCfg(): IBase;
    getEvents(): { wheel: 'onWheel' };
    bboxCacheMap: Map<string, IBBox> | null;
    prevEventInfo: PrevEventInfo;
    firstShowData: {
        nodes: Node[];
        edges: Edge[];
    };
    delayShowData: {
        nodes: Node[];
        edges: Edge[];
    };
    hideData: {
        nodes: Node[];
        edges: Edge[];
    };
    protoIsReseted: boolean;
    getGroupsBBoxMap(): Map<string, IBBox>;
    translateBBoxCache(x: number, y: number): void;
    updateBBoxCache(): Map<string, IBBox>;
    onWheel(ev: IG6GraphEvent): void;
    processOptimize(action: Action, translateInfo: any): void;
    optimizeNodes(canvasRect: DOMRect, visibleArea: IArea): void;
    optimizeEdges(canvasRect: DOMRect, visibleArea: IArea): void;
    // delayShow(): void;
    afterProcessOptimize(): void;
    allowDrag(evt: IG6GraphEvent): boolean;
}

const rcpScrollCanvas: IRcpScrollCanvas = {
    type: 'rcp-scroll-canvas',
    ...defaultCfg,
    getDefaultCfg() {
        return defaultCfg;
    },
    getEvents() {
        if (!this.zoomKey || ALLOW_EVENTS.indexOf(this.zoomKey) === -1) { this.zoomKey = 'ctrl'; }
        return {
            wheel: 'onWheel',
        };
    },
    prevEventInfo: initEventInfo(),
    bboxCacheMap: null,
    firstShowData: {
        nodes: [],
        edges: [],
    },
    delayShowData: {
        nodes: [],
        edges: [],
    },
    hideData: {
        nodes: [],
        edges: [],
    },

    getGroupsBBoxMap() {
        const cache = this.bboxCacheMap;
        if (cache) {
            return cache;
        }

        return this.updateBBoxCache();
    },
    translateBBoxCache(x: number, y: number) {
        this.bboxCacheMap?.forEach(bbox => {
            bbox.x += x; bbox.minX += x; bbox.maxX += x;
            bbox.y += y; bbox.minY += y; bbox.maxY += y;
        });
    },
    updateBBoxCache() {
        const { bboxMap } = getGroupsBBoxMap(this.graph!.get('canvas'));
        this.bboxCacheMap = bboxMap;
        return bboxMap;
    },
    protoIsReseted: false,
    onWheel(ev: IG6GraphEvent) {
        if (!this.allowDrag(ev)) { return; }
        const { graph, prevEventInfo } = this;

        if (!this.protoIsReseted) {
            resetProto(graph); this.protoIsReseted = true;
        }

        const zoomKeys = [ this.zoomKey ];
        const translateInfo: { x: number; y: number; direction: IDirection } = {
            x: 0, y: 0,
            direction: { x: '', y: '' },
        };
        if (zoomKeys.includes('control')) { zoomKeys.push('ctrl'); }
        const keyDown = zoomKeys.some(ele => ev[`${ele}Key`]);
        const currentAction: Action = keyDown ? 'zoom' : 'scroll';
        if (currentAction !== prevEventInfo.action) {
            prevEventInfo.graphBBox = null;
        }
        if (keyDown) {
            const canvas = graph.get('canvas');
            const point = canvas.getPointByClient(ev.clientX, ev.clientY);
            let ratio = graph.getZoom();
            if (ev.wheelDelta > 0) {
                ratio = ratio + ratio * 0.05;
            } else {
                ratio = ratio - ratio * 0.05;
            }
            this.updateBBoxCache();
            translateInfo.direction.x = translateInfo.direction.y = 'all';
            this.processOptimize(currentAction, translateInfo);
            graph.zoomTo(ratio, {
                x: point.x,
                y: point.y,
            });
            this.afterProcessOptimize();
        } else {
            let dx = (ev.deltaX || ev.movementX) as number;
            let dy = (ev.deltaY || ev.movementY) as number;

            if (!dy && navigator.userAgent.indexOf('Firefox') > -1) { dy = (-ev.wheelDelta * 125) / 3; }

            const width = this.graph.get('width');
            const height = this.graph.get('height');

            let expandWidth = this.scalableRange;
            let expandHeight = this.scalableRange;
            // 若 scalableRange 是 0~1 的小数，则作为比例考虑
            if (expandWidth < 1 && expandWidth > -1) {
                expandWidth = width * expandWidth;
                expandHeight = height * expandHeight;
            }

            const bboxMap = this.getGroupsBBoxMap();
            const graphCanvasBBox = bboxMap.get('-root')!;
            const { minX, maxX, minY, maxY } = graphCanvasBBox;


            if (dx > 0) {
                if (maxX < -expandWidth) {
                    dx = 0;
                } else if (maxX - dx < -expandWidth) {
                    dx = maxX + expandWidth;
                }
            } else if (dx < 0) {
                if (minX > width + expandWidth) {
                    dx = 0;
                } else if (minX - dx > width + expandWidth) {
                    dx = minX - (width + expandWidth);
                }
            }

            if (dy > 0) {
                if (maxY < -expandHeight) {
                    dy = 0;
                } else if (maxY - dy < -expandHeight) {
                    dy = maxY + expandHeight;
                }
            } else if (dy < 0) {
                if (minY > height + expandHeight) {
                    dy = 0;
                } else if (minY - dy > height + expandHeight) {
                    dy = minY - (height + expandHeight);
                }
            }

            if (this.get('direction') === 'x') {
                dy = 0;
            } else if (this.get('direction') === 'y') {
                dx = 0;
            }

            const x = translateInfo.x = dx === 0 ? dx : -dx;
            const y = translateInfo.y = dy === 0 ? dy : -dy;
            if (x !== 0) {
                translateInfo.direction.x = x > 0 ? 'left' : 'right';
            }
            if (y !== 0) {
                translateInfo.direction.y = y > 0 ? 'top' : 'bottom';
            }
            // console.log('x,y', x, y);

            this.translateBBoxCache(x, y);
            this.processOptimize(currentAction, translateInfo);
            graph.translate(translateInfo.x, translateInfo.y);
            this.afterProcessOptimize();
        }
        this.prevEventInfo.action = currentAction;
        this.prevEventInfo.direction = translateInfo.direction;
        ev.preventDefault();
    },
    processOptimize(action: Action, translateInfo: any) {
        const enableOptimize = this.get('enableOptimize');

        if (!enableOptimize) {
            return;
        }
        const { graph, optimizeOptions: { scrollOffsetUnit } } = this;
        const bboxMap = this.getGroupsBBoxMap();
        const graphCanvasBBox = bboxMap.get('-root')!;

        const prevGraphBBox = this.prevEventInfo.graphBBox;

        const needCalc = prevGraphBBox === null ? true : (
            Math.abs(Math.abs(prevGraphBBox.x) - Math.abs(graphCanvasBBox.x)) > scrollOffsetUnit
      || Math.abs(Math.abs(prevGraphBBox.y) - Math.abs(graphCanvasBBox.y)) > scrollOffsetUnit
        );

        if (!needCalc) {
            return;
        }

        const canvasRect: DOMRect = graph.get('canvas').get('el').getBoundingClientRect();
        const bufferArea = calcBufferArea(canvasRect, translateInfo.direction);
        const visibleArea = calcVisibleArea(canvasRect, translateInfo.direction, bufferArea);

        this.optimizeNodes(canvasRect, visibleArea);
        this.optimizeEdges(canvasRect, visibleArea);
        this.prevEventInfo.graphBBox = cloneDeep(graphCanvasBBox);
    },
    optimizeNodes(canvasRect: DOMRect, visibleArea: IArea) {
        const { graph } = this;
        const bboxMap = this.getGroupsBBoxMap();

        let nodeOptimized: boolean | undefined = this.get('nodeOptimized');

        // hiding
        // console.time('nodeOptimized');
        const nodes = graph.getNodes();
        const nodeLen = nodes.length;

        // 为保证极致性能，遍历使用for loop而非Array.forEach，赋值直接操作group.cfg，最大限度减少无用流程
        for (let i = 0; i < nodeLen; i++) {
            const node = nodes[i];
            if (node.destroyed) { continue; }

            const group = node.get('group') as IGroup;
            const gCfg = group.cfg;
            const { id, visible: nodeIsVisible } = gCfg;

            const bbox = bboxMap.get(id)!;
            const needHide = !inVisibleArea(bbox, visibleArea);

            if (needHide) {
                if (nodeIsVisible) {
                    node.hide();
                    group.getChildren().forEach(({ cfg }) => {
                        if (cfg.visible) {
                            cfg.visible = false;
                        }
                    });
                    nodeOptimized = true;
                }
            } else {
                if (!nodeIsVisible) {
                    node.show();
                    group.getChildren().forEach(({ cfg }) => {
                        if (!cfg.visible) {
                            cfg.visible = true;
                        }
                    });
                }
            }
        }
        // console.timeEnd('nodeOptimized');

        this.set('nodeOptimized', nodeOptimized);
    },
    optimizeEdges(canvasRect: DOMRect, visibleArea: IArea) {
        const { graph, optimizeOptions: { showEdges } } = this;
        const bboxMap = this.getGroupsBBoxMap();

        let edgeOptimized: boolean | undefined = this.get('edgeOptimized');
        // console.time('edgeOptimized');

        const edges = graph.getEdges();
        const edgeLen = edges.length;

        // TODO: showEdges展示延迟太高怎么办，需要一个更小延迟的逻辑
        if (!showEdges && edgeOptimized) {
            return;
        }

        // 为保证极致性能，遍历使用for loop而非Array.forEach，赋值直接操作group.cfg，最大限度减少无用流程
        for (let i = 0; i < edgeLen; i++) {
            const edge = edges[i];
            if (edge.destroyed) { continue; }

            const group = edge.get('group') as IGroup;
            const gCfg = group.cfg;
            const { id, visible: edgeIsVisible } = gCfg;

            const bbox = bboxMap.get(id)!;
            // TODO: 超长边该如何处理
            const needHide = showEdges ? edgeGroupNeedHide(bbox, visibleArea, canvasRect) : true;

            if (needHide) {
                if (edgeIsVisible) {
                    edge.hide();
                    group.getChildren().forEach(({ cfg }) => {
                        if (cfg.visible) {
                            cfg.visible = false;
                        }
                    });
                    edgeOptimized = true;
                }
            } else {
                if (!edgeIsVisible) {
                    edge.show();
                    group.getChildren().forEach(({ cfg }) => {
                        if (!cfg.visible) {
                            cfg.visible = true;
                        }
                    });
                }
            }
        }
        // console.timeEnd('edgeOptimized');

        this.set('edgeOptimized', edgeOptimized);
    },
    afterProcessOptimize() {
        const nodeOptimized: boolean | undefined = this.get('nodeOptimized');
        if (nodeOptimized) {
            this.graph.getNodes().forEach(node => {
                const group = node.get('group') as IGroup;
                if (!group.get('visible')) {
                    group.show();
                    group.getChildren().forEach(child => {
                        child.show();
                    });
                }
            });
        }

        const edgeOptimized: boolean | undefined = this.get('edgeOptimized');
        if (edgeOptimized) {
            this.graph.getEdges().forEach(edge => {
                const group = edge.get('group') as IGroup;
                if (!group.get('visible')) {
                    group.show();
                    group.getChildren().forEach(child => {
                        child.show();
                    });
                }
            });
        }

        if (nodeOptimized || edgeOptimized) {
            this.graph.translate(0, 0);
        }
        this.set('nodeOptimized', false);
        this.set('edgeOptimized', false);

        this.bboxCacheMap = null;
        this.prevEventInfo = initEventInfo();
        console.log('afterProcess');
    },
    allowDrag(evt: IG6GraphEvent) {
        const target = evt.target;
        const targetIsCanvas = target && target.isCanvas && target.isCanvas();
        if (isBoolean(this.allowDragOnItem) && !this.allowDragOnItem && !targetIsCanvas) { return false; }
        if (isObject(this.allowDragOnItem)) {
            const { node, edge, combo } = this.allowDragOnItem as any;
            const itemType = evt.item?.getType?.();
            if (!node && itemType === 'node') { return false; }
            if (!edge && itemType === 'edge') { return false; }
            if (!combo && itemType === 'combo') { return false; }
        }
        return true;
    },
};
rcpScrollCanvas.afterProcessOptimize = debounce(rcpScrollCanvas.afterProcessOptimize, 1500);

function initEventInfo(): PrevEventInfo {
    return {
        action: '',
        direction: { x: '', y: '' },
        graphBBox: null,
    };
}
export default rcpScrollCanvas;