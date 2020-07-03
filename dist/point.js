"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Point = void 0;
/**
 * Gerber Parsing Library
 *
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 *
 * License: MIT License, see LICENSE.txt
 */
const utils_1 = require("./utils");
const primitives_1 = require("./primitives");
class Point {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
    isValid() {
        return this.x != undefined && this.y != undefined;
    }
    toString() {
        return `(${utils_1.formatFloat(this.x, 3)}, ${utils_1.formatFloat(this.y, 3)})`;
    }
    add(other) {
        return new Point(this.x + other.x, this.y + other.y);
    }
    subtract(other) {
        return new Point(this.x - other.x, this.y - other.y);
    }
    scale(scale) {
        return new Point(this.x * scale, this.y * scale);
    }
    mirror(mirror) {
        switch (mirror) {
            case primitives_1.ObjectMirroring.NONE:
                return this.clone();
            case primitives_1.ObjectMirroring.X_AXIS:
                return new Point(-this.x, this.y);
            case primitives_1.ObjectMirroring.Y_AXIS:
                return new Point(this.x, -this.y);
            case primitives_1.ObjectMirroring.XY_AXIS:
                return new Point(-this.x, -this.y);
        }
    }
    distance1(other) {
        let dx = this.x - other.x;
        let dy = this.y - other.y;
        return Math.abs(dx) + Math.abs(dy);
    }
    distance2(other) {
        let dx = this.x - other.x;
        let dy = this.y - other.y;
        return dx * dx + dy * dy;
    }
    distance(other) {
        return Math.sqrt(this.distance2(other));
    }
    clone() {
        return new Point(this.x, this.y);
    }
    midPoint(other) {
        return new Point((this.x + other.x) / 2, (this.y + other.y) / 2);
    }
    // The angle of the vector (other - this) in radians 0..2PI
    angleFrom(other) {
        let angle = Math.atan2(other.y - this.y, other.x - this.x);
        if (angle < 0) {
            angle += Math.PI * 2;
        }
        return angle;
    }
    angleTo(other) {
        let angle = Math.atan2(this.y - other.y, this.x - other.x);
        if (angle < 0) {
            angle += Math.PI * 2;
        }
        return angle;
    }
    // The angle of the vector (this - (0, 0)) in radians 0..2PI
    angle() {
        let angle = Math.atan2(this.y, this.x);
        if (angle < 0) {
            angle += Math.PI * 2;
        }
        return angle;
    }
}
exports.Point = Point;
//# sourceMappingURL=point.js.map