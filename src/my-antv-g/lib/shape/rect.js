"use strict";
/**
 * @fileoverview 矩形
 * @author dxq613@gmail.com
 */
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var base_1 = require("./base");
var parse_1 = require("../util/parse");
var util_1 = require("../util/util");
var rect_1 = require("../util/in-stroke/rect");
var rect_radius_1 = require("../util/in-stroke/rect-radius");
var point_in_path_1 = require("../util/in-path/point-in-path");
var Rect = /** @class */ (function (_super) {
    tslib_1.__extends(Rect, _super);
    function Rect() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Rect.prototype.getDefaultAttrs = function () {
        var attrs = _super.prototype.getDefaultAttrs.call(this);
        return tslib_1.__assign(tslib_1.__assign({}, attrs), { x: 0, y: 0, width: 0, height: 0, radius: 0 });
    };
    Rect.prototype.isInStrokeOrPath = function (x, y, isStroke, isFill, lineWidth) {
        var attrs = this.attr();
        var minX = attrs.x;
        var minY = attrs.y;
        var width = attrs.width;
        var height = attrs.height;
        var radius = attrs.radius;
        // 无圆角时的策略
        if (!radius) {
            var halfWidth = lineWidth / 2;
            // 同时填充和带有边框
            if (isFill && isStroke) {
                return (0, util_1.inBox)(minX - halfWidth, minY - halfWidth, width + halfWidth, height + halfWidth, x, y);
            }
            // 仅填充
            if (isFill) {
                return (0, util_1.inBox)(minX, minY, width, height, x, y);
            }
            if (isStroke) {
                return (0, rect_1.default)(minX, minY, width, height, lineWidth, x, y);
            }
        }
        else {
            var isHit = false;
            if (isStroke) {
                isHit = (0, rect_radius_1.default)(minX, minY, width, height, radius, lineWidth, x, y);
            }
            // 仅填充时带有圆角的矩形直接通过图形拾取
            // 以后可以改成纯数学的近似拾取，将圆弧切割成多边形
            if (!isHit && isFill) {
                isHit = (0, point_in_path_1.default)(this, x, y);
            }
            return isHit;
        }
    };
    Rect.prototype.createPath = function (context) {
        var attrs = this.attr();
        var x = attrs.x;
        var y = attrs.y;
        var width = attrs.width;
        var height = attrs.height;
        var radius = attrs.radius;
        context.beginPath();
        if (radius === 0) {
            // 改成原生的rect方法
            context.rect(x, y, width, height);
        }
        else {
            var _a = (0, parse_1.parseRadius)(radius), r1 = _a[0], r2 = _a[1], r3 = _a[2], r4 = _a[3];
            context.moveTo(x + r1, y);
            context.lineTo(x + width - r2, y);
            r2 !== 0 && context.arc(x + width - r2, y + r2, r2, -Math.PI / 2, 0);
            context.lineTo(x + width, y + height - r3);
            r3 !== 0 && context.arc(x + width - r3, y + height - r3, r3, 0, Math.PI / 2);
            context.lineTo(x + r4, y + height);
            r4 !== 0 && context.arc(x + r4, y + height - r4, r4, Math.PI / 2, Math.PI);
            context.lineTo(x, y + r1);
            r1 !== 0 && context.arc(x + r1, y + r1, r1, Math.PI, Math.PI * 1.5);
            context.closePath();
        }
    };
    return Rect;
}(base_1.default));
exports.default = Rect;
//# sourceMappingURL=rect.js.map